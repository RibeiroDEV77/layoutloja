/**
 * Shipping Tracking Service — orquestra a sincronização de rastreamento
 * entre o adapter da transportadora e o módulo Fulfillment.
 *
 *  - Decifra credenciais do `shipping_carrier_accounts` via RPC restrita
 *    (admin client + service_role) e chama `adapter.track()`.
 *  - Persiste eventos em `tracking_events`, atualiza `shipments` e
 *    `fulfillments` e publica Domain Events via Outbox usando a RPC
 *    SECURITY DEFINER `fulfillment_apply_tracking`.
 *  - Registra métricas e respeita RBAC (`fulfillment.read` para leitura;
 *    sincronização manual exige `fulfillment.ship` ou super-admin).
 */
import type { SbClient } from '../../events/dispatcher.server';
import { Errors } from '../../errors';
import { hasPermission, isSuperAdmin } from '../permissions.server';
import { recordMetric } from '@/lib/foundations/observability.functions';
import { getShippingAdapter } from './registry.server';
import type {
  AdapterContext,
  AdapterCredentials,
  AdapterTrackingResult,
} from './adapter';

export interface SyncShipmentInput {
  shipment_id: string;
  /** Força sincronização ignorando intervalo de polling. */
  force?: boolean;
}

export interface SyncShipmentResult {
  shipment_id: string;
  ok: boolean;
  error?: string;
  inserted?: number;
  skipped?: number;
  previous_status?: string;
  status?: string;
  delivered?: boolean;
  tracking_code?: string;
}

interface ShipmentRow {
  id: string;
  store_id: string;
  fulfillment_id: string | null;
  carrier_code: string | null;
  tracking_number: string | null;
  status: string;
}

async function loadShipment(supabase: SbClient, shipmentId: string): Promise<ShipmentRow> {
  const { data, error } = await supabase
    .from('shipments')
    .select('id, store_id, fulfillment_id, carrier_code, tracking_number, status')
    .eq('id', shipmentId)
    .maybeSingle();
  if (error) throw Errors.internal('Falha ao carregar shipment', { error: error.message });
  if (!data) throw Errors.notFound('Shipment', shipmentId);
  return data as ShipmentRow;
}

async function resolveCarrierAccount(supabase: SbClient, storeId: string, providerCode: string) {
  // Convenção: `shipments.carrier_code` armazena o `provider_code` (correios, …)
  // ou o código do método interno. Buscamos a primeira conta ativa do provider.
  const { data } = await supabase
    .from('shipping_carrier_accounts')
    .select('id, store_id, provider_code, display_name, sandbox, config, capabilities, is_active')
    .eq('store_id', storeId)
    .eq('provider_code', providerCode)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function decryptAccountCredentials(accountId: string): Promise<AdapterCredentials | null> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.rpc('shipping_get_credentials', {
    _account_id: accountId,
  });
  if (error) throw Errors.internal('Falha ao decifrar credenciais', { error: error.message });
  return (data as AdapterCredentials | null) ?? null;
}

/**
 * Sincroniza o rastreamento de um shipment chamando o adapter da carrier e
 * aplicando os eventos via RPC `fulfillment_apply_tracking`.
 *
 * Sempre roda server-side. A escrita em `tracking_events`, `shipments` e
 * `fulfillments` acontece dentro da RPC (SECURITY DEFINER), preservando RLS.
 */
export async function syncShipmentTracking(
  supabase: SbClient,
  input: SyncShipmentInput,
): Promise<SyncShipmentResult> {
  const shipment = await loadShipment(supabase, input.shipment_id);
  if (!shipment.tracking_number) {
    return { shipment_id: shipment.id, ok: false, error: 'shipment sem tracking_number' };
  }
  const providerCode = shipment.carrier_code ?? 'correios';
  const adapter = getShippingAdapter(providerCode);
  if (!adapter || !adapter.capabilities.tracking || !adapter.track) {
    return { shipment_id: shipment.id, ok: false, error: `provider "${providerCode}" não suporta tracking` };
  }
  const account = await resolveCarrierAccount(supabase, shipment.store_id, providerCode);
  if (!account) {
    return { shipment_id: shipment.id, ok: false, error: 'nenhuma carrier account ativa para o provider' };
  }

  let credentials: AdapterCredentials | null = null;
  try {
    credentials = await decryptAccountCredentials(account.id);
  } catch (err) {
    return {
      shipment_id: shipment.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const ctx: AdapterContext = {
    account: {
      id: account.id,
      store_id: account.store_id,
      provider_code: account.provider_code,
      display_name: account.display_name,
      sandbox: account.sandbox,
      config: (account.config ?? {}) as Record<string, unknown>,
      capabilities: (account.capabilities ?? {}) as Record<string, unknown>,
    },
    credentials,
  };

  let tracking: AdapterTrackingResult;
  const startedTrack = Date.now();
  try {
    tracking = await adapter.track(ctx, shipment.tracking_number);
    await recordMetric(supabase, {
      scope: 'shipping', name: 'shipping.provider.latency',
      value: Date.now() - startedTrack, storeId: shipment.store_id,
      tags: { provider: providerCode, op: 'tracking' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordMetric(supabase, {
      scope: 'shipping',
      name: 'tracking.adapter_error',
      value: 1,
      storeId: shipment.store_id,
      tags: { provider: providerCode },
    });
    return { shipment_id: shipment.id, ok: false, error: msg };
  }
  await recordMetric(supabase, {
    scope: 'shipping', name: 'shipping.tracking.sync', value: 1,
    storeId: shipment.store_id, tags: { provider: providerCode, events: String(tracking.events.length) },
  });

  // Aplica via RPC (única origem autorizada de escrita em shipments/fulfillments)
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const eventsPayload = tracking.events.map((e) => ({
    occurred_at: e.occurred_at,
    kind: e.status,
    description: e.description,
    location: e.location ?? null,
    raw: e.raw ?? null,
  }));

  const { data, error } = await supabaseAdmin.rpc('fulfillment_apply_tracking', {
    _shipment_id: shipment.id,
    _events: eventsPayload as unknown as never,
    _delivered: tracking.delivered,
    _tracking_code: tracking.tracking_code,
    _source: `adapter:${providerCode}`,
  });
  if (error) {
    return { shipment_id: shipment.id, ok: false, error: error.message };
  }

  const summary = (data ?? {}) as {
    inserted?: number;
    skipped?: number;
    previous_status?: string;
    status?: string;
  };
  return {
    shipment_id: shipment.id,
    ok: true,
    inserted: summary.inserted ?? 0,
    skipped: summary.skipped ?? 0,
    previous_status: summary.previous_status,
    status: summary.status,
    delivered: tracking.delivered,
    tracking_code: tracking.tracking_code,
  };
}

/** Garante que o usuário pode disparar sync manual de tracking. */
export async function assertCanSyncTracking(supabase: SbClient, userId: string, storeId: string) {
  if (await isSuperAdmin(supabase, userId)) return;
  if (await hasPermission(supabase, userId, 'fulfillment.ship', storeId)) return;
  if (await hasPermission(supabase, userId, 'shipping.manage', storeId)) return;
  throw Errors.forbidden('Permissão necessária: fulfillment.ship ou shipping.manage');
}

/**
 * Polling: sincroniza shipments ainda não-finalizados (executado pelo worker
 * cron via endpoint público). Recebe o admin client por parâmetro para evitar
 * que callers regulares chamem esta função.
 */
export async function syncPendingShipmentsTracking(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  opts: { store_id?: string | null; limit?: number; stale_minutes?: number } = {},
): Promise<{ processed: number; ok: number; failed: number; results: SyncShipmentResult[] }> {
  const { data: pending, error } = await supabaseAdmin.rpc('shipping_list_pending_tracking', {
    _store_id: opts.store_id ?? null,
    _limit: opts.limit ?? 50,
    _stale_minutes: opts.stale_minutes ?? 30,
  });
  if (error) throw Errors.internal('Falha ao listar shipments pendentes', { error: error.message });

  const rows = (pending ?? []) as Array<{ shipment_id: string }>;
  const results: SyncShipmentResult[] = [];
  let ok = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const r = await syncShipmentTracking(supabaseAdmin, { shipment_id: row.shipment_id });
      results.push(r);
      if (r.ok) ok += 1; else failed += 1;
    } catch (err) {
      failed += 1;
      results.push({
        shipment_id: row.shipment_id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { processed: rows.length, ok, failed, results };
}
