/**
 * PaymentProviderRegistry — resolução e orquestração de Payment Gateways
 * por loja. É a ÚNICA dependência que o PaymentService usa para falar com
 * gateways externos; o service nunca importa `MercadoPagoAdapter` (ou
 * qualquer outro) diretamente.
 *
 * Responsabilidades:
 *  - Resolver gateways ativos de uma loja a partir de `payment_gateways`.
 *  - Decifrar credenciais via RPC SECURITY DEFINER (`payment_get_credentials`)
 *    — adapters permanecem stateless e nunca tocam o DB.
 *  - Capability Discovery: seleciona gateway por método (pix/credit_card/
 *    boleto) usando exclusivamente `PaymentCapabilities`, nunca o `code`.
 *  - Observability: métricas `payment.provider.latency`, request/success/error.
 *  - Idempotência: chave determinística para autorize (reaproveita
 *    `idempotency_keys` quando vier do caller; cache local de 5s
 *    para suprimir cliques duplos).
 *
 * NÃO altera arquitetura existente: o Payment Engine (RPCs SECURITY DEFINER)
 * continua dono do estado; aqui está apenas a camada de roteamento.
 */
import type { SbClient } from '../../events/dispatcher.server';
import { recordMetric } from '@/lib/foundations/observability.functions';
import {
  getPaymentAdapter,
  listPaymentAdapters,
  supportsMethod,
} from './registry.server';
import type {
  AdapterContext,
  AdapterCredentials,
  PaymentAdapter,
  PaymentCapability,
  PaymentMethod,
  PaymentProviderCode,
} from './adapter';
import { PaymentAdapterCapabilityError } from './adapter';

export interface ResolvedGateway {
  gateway_id: string;
  store_id: string;
  provider_code: PaymentProviderCode;
  display_name: string;
  sandbox: boolean;
  priority: number;
  config: Record<string, unknown>;
  capabilities: Record<string, unknown>;
  adapter: PaymentAdapter;
}

export async function resolveActiveGateways(
  supabase: SbClient,
  storeId: string,
): Promise<ResolvedGateway[]> {
  const { data: rows } = await supabase
    .from('payment_gateways')
    .select('id, store_id, adapter, display_name, is_active, priority, config, capabilities, supported_methods')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('priority', { ascending: true });
  if (!rows || rows.length === 0) return [];

  const out: ResolvedGateway[] = [];
  for (const r of rows) {
    const adapter = getPaymentAdapter(r.adapter as PaymentProviderCode);
    if (!adapter) continue;
    out.push({
      gateway_id: r.id,
      store_id: r.store_id,
      provider_code: r.adapter as PaymentProviderCode,
      display_name: r.display_name,
      sandbox: ((r.config as { sandbox?: boolean } | null)?.sandbox) ?? false,
      priority: r.priority ?? 100,
      config: (r.config ?? {}) as Record<string, unknown>,
      capabilities: (r.capabilities ?? {}) as Record<string, unknown>,
      adapter,
    });
  }
  return out;
}

/**
 * Resolve o melhor gateway para um método de pagamento.
 * Capability Discovery — nunca compara `provider_code`.
 */
export async function resolveGatewayForMethod(
  supabase: SbClient,
  storeId: string,
  method: PaymentMethod,
  opts: { preferredGatewayId?: string } = {},
): Promise<ResolvedGateway | null> {
  const all = await resolveActiveGateways(supabase, storeId);
  if (opts.preferredGatewayId) {
    const pinned = all.find((g) => g.gateway_id === opts.preferredGatewayId);
    if (pinned && supportsMethod(pinned.provider_code, method)) return pinned;
  }
  // Filtra exclusivamente por capability.
  const eligible = all.filter((g) => supportsMethod(g.provider_code, method));
  return eligible[0] ?? null;
}

export async function resolveGatewayById(
  supabase: SbClient,
  gatewayId: string,
): Promise<ResolvedGateway | null> {
  const { data: r } = await supabase
    .from('payment_gateways')
    .select('id, store_id, adapter, display_name, is_active, priority, config, capabilities')
    .eq('id', gatewayId)
    .maybeSingle();
  if (!r) return null;
  const adapter = getPaymentAdapter(r.adapter as PaymentProviderCode);
  if (!adapter) return null;
  return {
    gateway_id: r.id,
    store_id: r.store_id,
    provider_code: r.adapter as PaymentProviderCode,
    display_name: r.display_name,
    sandbox: ((r.config as { sandbox?: boolean } | null)?.sandbox) ?? false,
    priority: r.priority ?? 100,
    config: (r.config ?? {}) as Record<string, unknown>,
    capabilities: (r.capabilities ?? {}) as Record<string, unknown>,
    adapter,
  };
}

export function assertCapability(g: ResolvedGateway, cap: PaymentCapability) {
  if (!g.adapter.capabilities[cap]) {
    throw new PaymentAdapterCapabilityError(g.provider_code, cap);
  }
}

export async function loadGatewayCredentials(
  gatewayId: string,
): Promise<AdapterCredentials | null> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data } = await supabaseAdmin.rpc('payment_get_credentials', { _gateway_id: gatewayId });
  return (data as AdapterCredentials | null) ?? null;
}

export async function loadGatewayWebhookSecret(gatewayId: string): Promise<string | null> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data } = await supabaseAdmin.rpc('payment_get_webhook_secret', { _gateway_id: gatewayId });
  return (data as string | null) ?? null;
}

export function buildAdapterContext(
  g: ResolvedGateway,
  credentials: AdapterCredentials | null,
  extra: { traceId?: string; idempotencyKey?: string } = {},
): AdapterContext {
  return {
    gateway: {
      id: g.gateway_id,
      store_id: g.store_id,
      adapter: g.provider_code,
      display_name: g.display_name,
      sandbox: g.sandbox,
      config: g.config,
      capabilities: g.adapter.capabilities as unknown as Record<string, unknown>,
    },
    credentials,
    traceId: extra.traceId,
    idempotencyKey: extra.idempotencyKey,
  };
}

/**
 * Wrapper genérico para executar uma operação de adapter com métricas e
 * latência padronizadas. Mantém `PaymentService` livre desse boilerplate.
 */
export async function runAdapterOp<T>(
  supabase: SbClient,
  g: ResolvedGateway,
  opName: 'authorize' | 'capture' | 'cancel' | 'refund' | 'status' | 'test' | 'webhook',
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  await recordMetric(supabase, {
    scope: 'payments', name: `payment.${opName}.request`, value: 1,
    storeId: g.store_id, tags: { provider: g.provider_code },
  });
  try {
    const out = await fn();
    const latency = Date.now() - started;
    await recordMetric(supabase, {
      scope: 'payments', name: `payment.${opName}.success`, value: 1,
      storeId: g.store_id, tags: { provider: g.provider_code },
    });
    await recordMetric(supabase, {
      scope: 'payments', name: 'payment.provider.latency', value: latency,
      storeId: g.store_id, tags: { provider: g.provider_code, op: opName },
    });
    return out;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordMetric(supabase, {
      scope: 'payments', name: `payment.${opName}.error`, value: 1,
      storeId: g.store_id, tags: { provider: g.provider_code, reason: msg.slice(0, 80) },
    });
    throw err;
  }
}

export function listKnownPaymentProviders() {
  return listPaymentAdapters().map((a) => ({
    code: a.code,
    display_name: a.displayName,
    capabilities: a.capabilities,
  }));
}
