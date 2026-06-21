/**
 * FiscalProviderRegistry — resolução e orquestração dos provedores fiscais
 * por loja. É a ÚNICA dependência que o FiscalService usa para falar com
 * providers externos; o service nunca importa `NuvemFiscalAdapter` (ou
 * qualquer outro) diretamente.
 *
 * Responsabilidades:
 *  - Resolver providers ativos de uma loja a partir de `fiscal_providers`.
 *  - Decifrar credenciais via RPC SECURITY DEFINER (`fiscal_get_credentials`).
 *  - Capability Discovery: seleciona provider por documento (nfe/nfce/nfse)
 *    e por capability (cancel, correctionLetter, downloadXml…), nunca por `code`.
 *  - Observability: métricas `fiscal.provider.latency`, request/success/error.
 */
import type { SbClient } from '../../events/dispatcher.server';
import { recordMetric } from '@/lib/foundations/observability.functions';
import {
  getFiscalAdapter,
  listFiscalAdapters,
  supportsDocument,
  supportsCapability,
} from './registry.server';
import type {
  FiscalAdapter,
  FiscalAdapterContext,
  FiscalAdapterCredentials,
  FiscalCapability,
  FiscalDocumentType,
  FiscalProviderCode,
} from './adapter';
import { FiscalAdapterCapabilityError } from './adapter';

export interface ResolvedFiscalProvider {
  provider_id: string;
  store_id: string;
  provider_code: FiscalProviderCode;
  display_name: string;
  environment: 'production' | 'sandbox';
  priority: number;
  config: Record<string, any>;
  capabilities: Record<string, any>;
  adapter: FiscalAdapter;
}

export async function resolveActiveFiscalProviders(
  supabase: SbClient, storeId: string,
): Promise<ResolvedFiscalProvider[]> {
  const { data: rows } = await (supabase as any)
    .from('fiscal_providers')
    .select('id, store_id, adapter, display_name, environment, is_active, priority, config, capabilities, supported_documents')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('priority', { ascending: true });
  if (!rows || rows.length === 0) return [];

  const out: ResolvedFiscalProvider[] = [];
  for (const r of rows as any[]) {
    const adapter = getFiscalAdapter(r.adapter as FiscalProviderCode);
    if (!adapter) continue;
    out.push({
      provider_id: r.id,
      store_id: r.store_id,
      provider_code: r.adapter,
      display_name: r.display_name,
      environment: r.environment,
      priority: r.priority ?? 100,
      config: (r.config ?? {}) as Record<string, any>,
      capabilities: (r.capabilities ?? {}) as Record<string, any>,
      adapter,
    });
  }
  return out;
}

/**
 * Resolve o melhor provider para um tipo de documento fiscal.
 * Capability Discovery — nunca compara `provider_code`.
 */
export async function resolveProviderForDocument(
  supabase: SbClient, storeId: string,
  doc: FiscalDocumentType,
  opts: { preferredProviderId?: string; requiredCapability?: FiscalCapability } = {},
): Promise<ResolvedFiscalProvider | null> {
  const all = await resolveActiveFiscalProviders(supabase, storeId);
  const ok = (p: ResolvedFiscalProvider) =>
    supportsDocument(p.provider_code, doc) &&
    (!opts.requiredCapability || supportsCapability(p.provider_code, opts.requiredCapability));
  if (opts.preferredProviderId) {
    const pinned = all.find((p) => p.provider_id === opts.preferredProviderId);
    if (pinned && ok(pinned)) return pinned;
  }
  return all.find(ok) ?? null;
}

export async function resolveProviderById(
  supabase: SbClient, providerId: string,
): Promise<ResolvedFiscalProvider | null> {
  const { data: r } = await (supabase as any)
    .from('fiscal_providers')
    .select('id, store_id, adapter, display_name, environment, is_active, priority, config, capabilities')
    .eq('id', providerId).maybeSingle();
  if (!r) return null;
  const adapter = getFiscalAdapter(r.adapter as FiscalProviderCode);
  if (!adapter) return null;
  return {
    provider_id: r.id,
    store_id: r.store_id,
    provider_code: r.adapter,
    display_name: r.display_name,
    environment: r.environment,
    priority: r.priority ?? 100,
    config: (r.config ?? {}) as Record<string, any>,
    capabilities: (r.capabilities ?? {}) as Record<string, any>,
    adapter,
  };
}

export function assertCapability(p: ResolvedFiscalProvider, cap: FiscalCapability) {
  if (!p.adapter.capabilities[cap]) {
    throw new FiscalAdapterCapabilityError(p.provider_code, cap);
  }
}

export async function loadProviderCredentials(
  providerId: string,
): Promise<FiscalAdapterCredentials | null> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data } = await (supabaseAdmin as any).rpc('fiscal_get_credentials', { _provider_id: providerId });
  return (data as FiscalAdapterCredentials | null) ?? null;
}

export async function loadProviderWebhookSecret(providerId: string): Promise<string | null> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data } = await (supabaseAdmin as any).rpc('fiscal_get_webhook_secret', { _provider_id: providerId });
  return (data as string | null) ?? null;
}

export function buildAdapterContext(
  p: ResolvedFiscalProvider,
  credentials: FiscalAdapterCredentials | null,
  extra: { traceId?: string; idempotencyKey?: string } = {},
): FiscalAdapterContext {
  return {
    provider: {
      id: p.provider_id,
      store_id: p.store_id,
      adapter: p.provider_code,
      display_name: p.display_name,
      environment: p.environment,
      config: p.config,
      capabilities: p.adapter.capabilities as unknown as Record<string, any>,
    },
    credentials,
    traceId: extra.traceId,
    idempotencyKey: extra.idempotencyKey,
  };
}

export async function runAdapterOp<T>(
  supabase: SbClient,
  p: ResolvedFiscalProvider,
  opName: 'issue' | 'cancel' | 'correction' | 'consult' | 'download_xml' | 'download_danfe' | 'webhook' | 'test',
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  await recordMetric(supabase, {
    scope: 'fiscal', name: `fiscal.${opName}.request`, value: 1,
    storeId: p.store_id, tags: { provider: p.provider_code },
  });
  try {
    const out = await fn();
    const latency = Date.now() - started;
    await recordMetric(supabase, {
      scope: 'fiscal', name: `fiscal.${opName}.success`, value: 1,
      storeId: p.store_id, tags: { provider: p.provider_code },
    });
    await recordMetric(supabase, {
      scope: 'fiscal', name: 'fiscal.provider.latency', value: latency,
      storeId: p.store_id, tags: { provider: p.provider_code, op: opName },
    });
    return out;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordMetric(supabase, {
      scope: 'fiscal', name: `fiscal.${opName}.error`, value: 1,
      storeId: p.store_id, tags: { provider: p.provider_code, reason: msg.slice(0, 80) },
    });
    throw err;
  }
}

export function listKnownFiscalProviders() {
  return listFiscalAdapters().map((a) => ({
    code: a.code, display_name: a.displayName, capabilities: a.capabilities,
  }));
}
