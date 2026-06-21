/**
 * ShippingProviderRegistry — resolução e orquestração de providers de frete
 * por loja. É a ÚNICA dependência que o ShippingService usa para falar com
 * transportadoras externas; o service nunca importa `CorreiosAdapter`
 * (ou qualquer outro) diretamente.
 *
 * Responsabilidades:
 *  - Resolver os providers ativos de uma loja (a partir de
 *    `shipping_carrier_accounts`).
 *  - Decifrar credenciais via RPC restrita (admin client) — adapters
 *    permanecem stateless e nunca tocam o DB.
 *  - Executar `calculateQuote()` em fan-out, agregando resultados.
 *  - Observability: métricas por chamada (request/success/error/duration_ms).
 *  - Outbox: emitir `shipping.quote.generated` no fim do ciclo.
 *  - Idempotency: chave determinística por (store, destino, peso, origem,
 *    minuto) — chamadas repetidas dentro da janela ficam noop.
 *
 * NÃO altera arquitetura existente: o serviço de cotação continua a função
 * pública `quoteShippingForCart` em `services/shipping.server.ts`; aqui está
 * a camada de orquestração de providers que ele consome.
 */
import type { SbClient } from '../../events/dispatcher.server';
import { recordMetric } from '@/lib/foundations/observability.functions';
import { enqueueOutbox } from '@/lib/foundations/outbox.functions';
import { getShippingAdapter, listShippingAdapters } from './registry.server';
import type {
  AdapterContext,
  AdapterCredentials,
  AdapterQuoteOption,
  AdapterQuoteRequest,
  ShippingAdapter,
  ShippingProviderCode,
} from './adapter';

export interface ResolvedProvider {
  account_id: string;
  store_id: string;
  provider_code: ShippingProviderCode;
  display_name: string;
  sandbox: boolean;
  config: Record<string, unknown>;
  adapter: ShippingAdapter;
}

export interface ProviderQuoteOption extends AdapterQuoteOption {
  provider_code: ShippingProviderCode;
  carrier_account_id: string;
  carrier_name: string;
}

export interface CalculateQuoteInput {
  store_id: string;
  origin_postal_code: string | null;
  destination_postal_code: string;
  weight_g: number;
  dimensions_cm?: { length: number; width: number; height: number };
  declared_value?: number;
  service_codes?: string[];
  /** Correlaciona a chamada com o agregado de origem (ex.: cart_id). */
  correlation_id?: string | null;
  /** Opcional: rótulo do agregado iniciador (ex.: 'cart'). */
  source_aggregate_type?: string;
  source_aggregate_id?: string | null;
}

export interface CalculateQuoteResult {
  options: ProviderQuoteOption[];
  /** Erros por provider — não interrompem a operação. */
  errors: Array<{ provider_code: string; carrier_account_id: string; error: string }>;
  duration_ms: number;
  providers_attempted: number;
  providers_succeeded: number;
  idempotency_key: string;
}

// ---- Idempotency cache (in-memory, server worker scope) ---------------
//
// Janela curta (60s) para suprimir cliques duplos / retries do checkout.
// Persistência durável de quotes vive em `shipping_quotes` (DB).
const IDEMPOTENCY_TTL_MS = 60_000;
const idempotencyCache = new Map<string, { at: number; result: CalculateQuoteResult }>();
function purgeIdempotency() {
  const now = Date.now();
  for (const [k, v] of idempotencyCache) {
    if (now - v.at > IDEMPOTENCY_TTL_MS) idempotencyCache.delete(k);
  }
}

function digits(s: string | null | undefined) { return (s ?? '').replace(/\D/g, ''); }

function buildIdempotencyKey(input: CalculateQuoteInput): string {
  const bucket = Math.floor(Date.now() / IDEMPOTENCY_TTL_MS);
  return [
    input.store_id,
    digits(input.origin_postal_code),
    digits(input.destination_postal_code),
    Math.round(input.weight_g),
    input.declared_value ? Math.round(input.declared_value * 100) : 0,
    (input.service_codes ?? []).join(','),
    bucket,
  ].join('|');
}

/**
 * Resolve todas as contas de transportadora ativas da loja, materializando
 * cada uma com o seu `ShippingAdapter`. Providers cujo adapter não está
 * registrado, está inativo ou não suporta `calculateQuote` são filtrados.
 */
export async function resolveActiveProviders(
  supabase: SbClient,
  storeId: string,
): Promise<ResolvedProvider[]> {
  const { data: accounts } = await supabase
    .from('shipping_carrier_accounts')
    .select('id, store_id, provider_code, display_name, sandbox, config, is_active')
    .eq('store_id', storeId)
    .eq('is_active', true);
  if (!accounts || accounts.length === 0) return [];

  const out: ResolvedProvider[] = [];
  for (const acc of accounts) {
    const adapter = getShippingAdapter(acc.provider_code);
    if (!adapter) continue;
    if (!adapter.capabilities.quote) continue;
    out.push({
      account_id: acc.id,
      store_id: acc.store_id,
      provider_code: acc.provider_code,
      display_name: acc.display_name,
      sandbox: acc.sandbox,
      config: (acc.config ?? {}) as Record<string, unknown>,
      adapter,
    });
  }
  return out;
}

/** Apenas para diagnóstico / admin UI — lista providers conhecidos pelo registry. */
export function listKnownProviders() {
  return listShippingAdapters().map((a) => ({
    code: a.code,
    display_name: a.displayName,
    capabilities: a.capabilities,
  }));
}

async function loadCredentials(accountId: string): Promise<AdapterCredentials | null> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data } = await supabaseAdmin.rpc('shipping_get_credentials', { _account_id: accountId });
  return (data as AdapterCredentials | null) ?? null;
}

/**
 * Executa a cotação em todos os providers ativos da loja.
 *
 *  - Falha de um provider NÃO derruba os demais (registrada em `errors`).
 *  - Métricas: `shipping.quote.request|success|error|duration_ms`.
 *  - Outbox: `shipping.quote.generated` ao final (uma vez por chamada).
 *  - Idempotência: chamadas equivalentes dentro de 60s retornam o cache.
 */
export async function calculateQuote(
  supabase: SbClient,
  input: CalculateQuoteInput,
): Promise<CalculateQuoteResult> {
  purgeIdempotency();
  const idempotencyKey = buildIdempotencyKey(input);
  const cached = idempotencyCache.get(idempotencyKey);
  if (cached) return cached.result;

  const started = Date.now();
  await recordMetric(supabase, {
    scope: 'shipping', name: 'shipping.quote.request', value: 1, storeId: input.store_id,
    tags: { destination: digits(input.destination_postal_code) },
  });

  const providers = await resolveActiveProviders(supabase, input.store_id);
  const options: ProviderQuoteOption[] = [];
  const errors: CalculateQuoteResult['errors'] = [];
  let succeeded = 0;

  for (const p of providers) {
    const cfgOrigin = typeof p.config.origin_postal_code === 'string'
      ? (p.config.origin_postal_code as string) : null;
    const origin = input.origin_postal_code ?? cfgOrigin;
    if (!origin) {
      errors.push({ provider_code: p.provider_code, carrier_account_id: p.account_id,
        error: 'CEP de origem ausente (input ou config do provider)' });
      continue;
    }

    let credentials: AdapterCredentials | null = null;
    try {
      credentials = await loadCredentials(p.account_id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ provider_code: p.provider_code, carrier_account_id: p.account_id,
        error: `Falha ao decifrar credenciais: ${msg}` });
      await recordMetric(supabase, {
        scope: 'shipping', name: 'shipping.quote.error', value: 1, storeId: input.store_id,
        tags: { provider: p.provider_code, reason: 'credentials' },
      });
      continue;
    }

    const ctx: AdapterContext = {
      account: {
        id: p.account_id, store_id: p.store_id, provider_code: p.provider_code,
        display_name: p.display_name, sandbox: p.sandbox,
        config: p.config, capabilities: p.adapter.capabilities as unknown as Record<string, unknown>,
      },
      credentials,
    };
    const req: AdapterQuoteRequest = {
      origin_postal_code: origin,
      destination_postal_code: input.destination_postal_code,
      weight_g: input.weight_g,
      dimensions_cm: input.dimensions_cm,
      declared_value: input.declared_value,
      service_codes: input.service_codes,
    };

    const providerStart = Date.now();
    try {
      // `calculateQuote()` é o nome canônico no Registry; adapters expõem
      // `quote()` (mesma assinatura) — mantemos compatibilidade.
      const fn = p.adapter.calculateQuote ?? p.adapter.quote;
      if (!fn) throw new Error('adapter sem método de cotação');
      const opts = await fn.call(p.adapter, ctx, req);
      for (const o of opts) {
        options.push({
          ...o,
          provider_code: p.provider_code,
          carrier_account_id: p.account_id,
          carrier_name: p.adapter.displayName,
        });
      }
      succeeded += 1;
      await recordMetric(supabase, {
        scope: 'shipping', name: 'shipping.quote.success', value: 1, storeId: input.store_id,
        tags: { provider: p.provider_code, options: String(opts.length) },
      });
      await recordMetric(supabase, {
        scope: 'shipping', name: 'shipping.quote.duration_ms',
        value: Date.now() - providerStart, storeId: input.store_id,
        tags: { provider: p.provider_code, granularity: 'provider' },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ provider_code: p.provider_code, carrier_account_id: p.account_id, error: msg });
      await recordMetric(supabase, {
        scope: 'shipping', name: 'shipping.quote.error', value: 1, storeId: input.store_id,
        tags: { provider: p.provider_code, reason: 'adapter' },
      });
      // Marca último teste como falho para diagnóstico admin.
      await supabase.from('shipping_carrier_accounts').update({
        last_test_at: new Date().toISOString(),
        last_test_ok: false,
        last_test_error: msg.slice(0, 500),
      }).eq('id', p.account_id);
    }
  }

  const duration_ms = Date.now() - started;
  await recordMetric(supabase, {
    scope: 'shipping', name: 'shipping.quote.duration_ms', value: duration_ms,
    storeId: input.store_id, tags: { granularity: 'aggregate' },
  });

  const result: CalculateQuoteResult = {
    options,
    errors,
    duration_ms,
    providers_attempted: providers.length,
    providers_succeeded: succeeded,
    idempotency_key: idempotencyKey,
  };
  idempotencyCache.set(idempotencyKey, { at: Date.now(), result });

  // Outbox — Domain Event publicado de forma transacional.
  // Falha aqui NÃO derruba o cálculo (degradação graciosa).
  try {
    await enqueueOutbox(supabase, {
      storeId: input.store_id,
      aggregateType: (input.source_aggregate_type ?? 'shipping_quote') as never,
      aggregateId: (input.source_aggregate_id ?? '00000000-0000-0000-0000-000000000000') as string,
      eventType: 'shipping.quote.generated' as never,
      payload: {
        store_id: input.store_id,
        origin_postal_code: digits(input.origin_postal_code),
        destination_postal_code: digits(input.destination_postal_code),
        weight_g: input.weight_g,
        declared_value: input.declared_value ?? null,
        providers_attempted: providers.length,
        providers_succeeded: succeeded,
        options_count: options.length,
        idempotency_key: idempotencyKey,
        duration_ms,
        source_aggregate: input.source_aggregate_type ?? null,
        source_aggregate_id: input.source_aggregate_id ?? null,
      },
      metadata: { source: 'shipping_provider_registry' },
      correlationId: input.correlation_id ?? null,
    });
  } catch (err) {
    console.error('[shipping] enqueue shipping.quote.generated falhou', err);
  }

  return result;
}
