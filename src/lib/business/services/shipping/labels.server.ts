/**
 * Shipping Labels Service — orquestra compra e cancelamento de etiquetas
 * delegando 100% ao adapter resolvido pelo ShippingProviderRegistry. Não
 * conhece o provider: usa apenas Capability Discovery (`capabilities.label`).
 *
 *  - Persistência da etiqueta: RPC SECURITY DEFINER `shipment_purchase_label`
 *    (única origem autorizada de escrita em `shipping_labels` + atualização
 *    coerente de `shipments.tracking_number/url/status`).
 *  - Idempotência: chave determinística `(shipment_id, service_code, day)`
 *    repassada ao adapter como `idempotency_key`.
 *  - Outbox: `shipping.label.created` / `shipping.label.cancelled` /
 *    (opcional) `shipment.dispatched` quando o adapter retorna postagem.
 *  - Observability: métricas
 *    `shipping.label.purchase`, `shipping.label.error`,
 *    `shipping.provider.latency`.
 *  - RBAC: `assertCanPurchaseLabel` exige `fulfillment.ship` ou
 *    `shipping.manage`.
 */
import type { SbClient } from '../../events/dispatcher.server';
import { Errors } from '../../errors';
import { hasPermission, isSuperAdmin } from '../permissions.server';
import { recordMetric } from '@/lib/foundations/observability.functions';
import { enqueueOutbox } from '@/lib/foundations/outbox.functions';
import { getShippingAdapter } from './registry.server';
import type {
  AdapterContext, AdapterCredentials, AdapterLabelRequest, AdapterAddress,
} from './adapter';
import { AdapterCapabilityError, AdapterNotConfiguredError } from './adapter';

export interface PurchaseLabelInput {
  shipment_id: string;
  /** ID do serviço escolhido na cotação (ex.: '04014' Correios, '1' Melhor Envio). */
  service_code: string;
  /** Endereços resolvidos pelo caller (do `order_addresses` snapshot). */
  to: AdapterAddress;
  from: AdapterAddress;
  /** Pacotes — quando omitido, derivamos do `shipments.weight_g` + default. */
  packages?: Array<{ weight_g: number; length_cm: number; width_cm: number; height_cm: number; declared_value?: number }>;
}

export interface PurchaseLabelResult {
  shipment_id: string;
  label_id: string | null;
  tracking_code: string;
  tracking_url: string | null;
  label_url: string | null;
  provider_code: string;
}

interface ShipmentRow {
  id: string;
  store_id: string;
  carrier_code: string | null;
  weight_g: number | null;
  status: string;
}

async function loadShipment(supabase: SbClient, id: string): Promise<ShipmentRow> {
  const { data, error } = await supabase
    .from('shipments')
    .select('id, store_id, carrier_code, weight_g, status')
    .eq('id', id).maybeSingle();
  if (error) throw Errors.internal('Falha ao carregar shipment', { error: error.message });
  if (!data) throw Errors.notFound('Shipment', id);
  return data as ShipmentRow;
}

async function resolveAccount(supabase: SbClient, storeId: string, providerCode: string) {
  const { data } = await supabase.from('shipping_carrier_accounts')
    .select('id, store_id, provider_code, display_name, sandbox, config, is_active')
    .eq('store_id', storeId).eq('provider_code', providerCode).eq('is_active', true)
    .order('created_at', { ascending: true }).limit(1).maybeSingle();
  return data ?? null;
}

async function decryptCredentials(accountId: string): Promise<AdapterCredentials | null> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.rpc('shipping_get_credentials', { _account_id: accountId });
  if (error) throw Errors.internal('Falha ao decifrar credenciais', { error: error.message });
  return (data as AdapterCredentials | null) ?? null;
}

function idempotencyKey(shipmentId: string, serviceCode: string) {
  const day = new Date().toISOString().slice(0, 10);
  return `lbl:${shipmentId}:${serviceCode}:${day}`;
}

export async function assertCanPurchaseLabel(supabase: SbClient, userId: string, storeId: string) {
  if (await isSuperAdmin(supabase, userId)) return;
  if (await hasPermission(supabase, userId, 'fulfillment.ship', storeId)) return;
  if (await hasPermission(supabase, userId, 'shipping.manage', storeId)) return;
  throw Errors.forbidden('Permissão necessária: fulfillment.ship ou shipping.manage');
}

/**
 * Compra a etiqueta no provider e persiste via RPC `shipment_purchase_label`.
 * Capability Discovery: rejeita providers que não declaram `label: true`.
 */
export async function purchaseShippingLabel(
  supabase: SbClient,
  input: PurchaseLabelInput,
): Promise<PurchaseLabelResult> {
  const shipment = await loadShipment(supabase, input.shipment_id);
  const providerCode = shipment.carrier_code ?? '';
  const adapter = getShippingAdapter(providerCode);
  if (!adapter) throw Errors.validation(`Provider "${providerCode}" não registrado`);
  if (!adapter.capabilities.label || !adapter.createLabel) {
    throw new AdapterCapabilityError(providerCode, 'label');
  }
  const account = await resolveAccount(supabase, shipment.store_id, providerCode);
  if (!account) throw Errors.validation(`Nenhuma carrier account ativa para ${providerCode}`);

  const credentials = await decryptCredentials(account.id);
  if (!credentials) throw new AdapterNotConfiguredError(providerCode);

  const ctx: AdapterContext = {
    account: {
      id: account.id, store_id: account.store_id, provider_code: account.provider_code,
      display_name: account.display_name, sandbox: account.sandbox,
      config: (account.config ?? {}) as Record<string, unknown>,
      capabilities: adapter.capabilities as unknown as Record<string, unknown>,
    },
    credentials,
  };

  const packages = input.packages?.length ? input.packages : [{
    weight_g: shipment.weight_g ?? 1000, length_cm: 20, width_cm: 15, height_cm: 5,
  }];
  const req: AdapterLabelRequest = {
    shipment_id: shipment.id,
    service_code: input.service_code,
    to: input.to, from: input.from,
    packages,
    idempotency_key: idempotencyKey(shipment.id, input.service_code),
  };

  const started = Date.now();
  try {
    const result = await adapter.createLabel(ctx, req);
    const latency = Date.now() - started;

    // Persistência via RPC SECURITY DEFINER (única escrita autorizada).
    const carrierLabelId = typeof result.raw?.cart === 'object' && result.raw?.cart
      ? String((result.raw.cart as Record<string, unknown>).id ?? '')
      : '';
    const { data: labelId, error } = await supabase.rpc('shipment_purchase_label', {
      p_shipment_id: shipment.id,
      p_tracking_number: result.tracking_code,
      p_tracking_url: '',
      p_label_url: result.label_url ?? '',
      p_format: (result.label_format ?? 'pdf') as never,
      ...(carrierLabelId ? { p_carrier_label_id: carrierLabelId } : {}),
    });
    if (error) throw Errors.internal('Falha ao persistir etiqueta', { error: error.message });

    await Promise.all([
      recordMetric(supabase, {
        scope: 'shipping', name: 'shipping.label.purchase', value: 1,
        storeId: shipment.store_id, tags: { provider: providerCode, service: input.service_code },
      }),
      recordMetric(supabase, {
        scope: 'shipping', name: 'shipping.provider.latency', value: latency,
        storeId: shipment.store_id, tags: { provider: providerCode, op: 'label' },
      }),
    ]);

    // Outbox — shipping.label.created.
    try {
      await enqueueOutbox(supabase, {
        storeId: shipment.store_id,
        aggregateType: 'shipment' as never,
        aggregateId: shipment.id,
        eventType: 'shipping.label.created' as never,
        payload: {
          shipment_id: shipment.id, provider_code: providerCode,
          service_code: input.service_code, tracking_code: result.tracking_code,
          label_url: result.label_url ?? null, label_format: result.label_format ?? 'pdf',
        },
        metadata: { source: 'shipping_labels_service' },
      });
    } catch (err) {
      console.error('[shipping] outbox shipping.label.created falhou', err);
    }

    return {
      shipment_id: shipment.id,
      label_id: (labelId as string | null) ?? null,
      tracking_code: result.tracking_code,
      tracking_url: null,
      label_url: result.label_url ?? null,
      provider_code: providerCode,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordMetric(supabase, {
      scope: 'shipping', name: 'shipping.label.error', value: 1,
      storeId: shipment.store_id, tags: { provider: providerCode, reason: 'adapter' },
    });
    await supabase.from('shipping_carrier_accounts').update({
      last_test_at: new Date().toISOString(), last_test_ok: false, last_test_error: msg.slice(0, 500),
    }).eq('id', account.id);
    throw err;
  }
}

export interface CancelLabelInput {
  shipment_id: string;
  carrier_label_id: string;
  reason?: string;
}

export async function cancelShippingLabel(
  supabase: SbClient,
  input: CancelLabelInput,
): Promise<{ ok: boolean; refunded?: boolean }> {
  const shipment = await loadShipment(supabase, input.shipment_id);
  const providerCode = shipment.carrier_code ?? '';
  const adapter = getShippingAdapter(providerCode);
  if (!adapter || !adapter.capabilities.label || !adapter.cancelLabel) {
    throw new AdapterCapabilityError(providerCode, 'label');
  }
  const account = await resolveAccount(supabase, shipment.store_id, providerCode);
  if (!account) throw Errors.validation(`Sem carrier account para ${providerCode}`);
  const credentials = await decryptCredentials(account.id);

  const ctx: AdapterContext = {
    account: {
      id: account.id, store_id: account.store_id, provider_code: account.provider_code,
      display_name: account.display_name, sandbox: account.sandbox,
      config: (account.config ?? {}) as Record<string, unknown>,
      capabilities: adapter.capabilities as unknown as Record<string, unknown>,
    },
    credentials,
  };

  const result = await adapter.cancelLabel(ctx, {
    shipment_id: shipment.id, carrier_label_id: input.carrier_label_id, reason: input.reason,
  });

  try {
    await enqueueOutbox(supabase, {
      storeId: shipment.store_id,
      aggregateType: 'shipment' as never,
      aggregateId: shipment.id,
      eventType: 'shipping.label.cancelled' as never,
      payload: {
        shipment_id: shipment.id, provider_code: providerCode,
        carrier_label_id: input.carrier_label_id, refunded: Boolean(result.refunded),
        reason: input.reason ?? null,
      },
      metadata: { source: 'shipping_labels_service' },
    });
  } catch (err) {
    console.error('[shipping] outbox shipping.label.cancelled falhou', err);
  }
  return { ok: result.ok, refunded: result.refunded };
}
