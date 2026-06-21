/**
 * Shipping Adapter Layer (Fase 5.2).
 *
 * - Cotação por zona (CEP/estado) cruzada com método e peso.
 * - Adapter Layer pronta para integrar com transportadoras externas (Correios,
 *   Melhor Envio, Frenet) — no momento usa tabelas internas `shipping_rates`.
 * - Gera múltiplas cotações em `shipping_quotes`.
 * - `selectQuote` marca a escolhida (selected=true, demais false) e gera
 *   `shipping_snapshots` imutável.
 * - Simulação de entrega: `simulateDelivery(postalCode)` retorna cotações
 *   sem precisar de carrinho (preview público).
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { isSuperAdmin, hasPermission } from './permissions.server';
import { enqueueOutbox } from '@/lib/foundations/outbox.functions';
import { recordMetric } from '@/lib/foundations/observability.functions';

interface QuoteRow {
  method_id: string;
  method_code: string;
  method_name: string;
  carrier: string | null;
  price: number;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
}

function digits(s: string) { return s.replace(/\D/g, ''); }

async function findZoneByPostal(supabase: SbClient, storeId: string, postalCode: string): Promise<string | null> {
  const p = digits(postalCode);
  if (!p) return null;
  const { data: zones } = await supabase.from('shipping_zones').select('id, states').eq('store_id', storeId).eq('active', true);
  for (const z of zones ?? []) {
    const { data: ranges } = await supabase.from('shipping_zone_postal_ranges').select('*').eq('zone_id', z.id);
    for (const r of ranges ?? []) {
      const from = digits(r.postal_from);
      const to = digits(r.postal_to);
      if (p >= from && p <= to) return z.id;
    }
  }
  // fallback: first active zone (catch-all)
  return zones?.[0]?.id ?? null;
}

async function cartTotals(supabase: SbClient, cartId: string) {
  const { data: cart } = await supabase.from('carts').select('subtotal, store_id, currency').eq('id', cartId).maybeSingle();
  const { data: items } = await supabase.from('cart_items').select('qty, variant_id, product_variants(weight_grams)').eq('cart_id', cartId);
  const weight = (items ?? []).reduce((acc, it) => {
    const w = (it.product_variants as { weight_grams: number | null } | null)?.weight_grams ?? 0;
    return acc + (Number(w) * it.qty);
  }, 0);
  return { cart, weight_g: weight };
}

export async function quoteShippingForCart(
  supabase: SbClient,
  _userId: string | null,
  input: { cart_id: string; postal_code: string },
) {
  const { cart, weight_g } = await cartTotals(supabase, input.cart_id);
  if (!cart) throw Errors.notFound('Carrinho', input.cart_id);
  const zoneId = await findZoneByPostal(supabase, cart.store_id, input.postal_code);
  if (!zoneId) throw Errors.rule('Nenhuma zona de entrega para o CEP', { postal_code: input.postal_code });

  const { data: rates } = await supabase.from('shipping_rates')
    .select('*, shipping_methods(id, code, name, carrier, estimated_days_min, estimated_days_max, active)')
    .eq('zone_id', zoneId).eq('active', true);
  const subtotal = Number(cart.subtotal ?? 0);
  const candidates: QuoteRow[] = [];
  for (const r of rates ?? []) {
    const m = r.shipping_methods as { id: string; code: string; name: string; carrier: string | null; estimated_days_min: number | null; estimated_days_max: number | null; active: boolean } | null;
    if (!m || !m.active) continue;
    if (weight_g < r.min_weight_g) continue;
    if (r.max_weight_g != null && weight_g > r.max_weight_g) continue;
    if (r.min_subtotal != null && subtotal < Number(r.min_subtotal)) continue;
    if (r.max_subtotal != null && subtotal > Number(r.max_subtotal)) continue;
    let price = Number(r.price);
    if (r.free_above_subtotal != null && subtotal >= Number(r.free_above_subtotal)) price = 0;
    candidates.push({
      method_id: m.id, method_code: m.code, method_name: m.name, carrier: m.carrier,
      price, estimated_days_min: m.estimated_days_min, estimated_days_max: m.estimated_days_max,
    });
  }

  // limpa cotações anteriores ativas (não-selecionadas)
  await supabase.from('shipping_quotes').delete().eq('cart_id', input.cart_id).eq('selected', false);

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const quotedAt = new Date().toISOString();
  const inserts: Array<Record<string, unknown>> = candidates.map((c) => ({
    cart_id: input.cart_id, store_id: cart.store_id,
    method_id: c.method_id, method_code: c.method_code, method_name: c.method_name, carrier: c.carrier,
    price: c.price, estimated_days_min: c.estimated_days_min, estimated_days_max: c.estimated_days_max,
    postal_code: digits(input.postal_code), weight_g, expires_at: expiresAt,
    provider_code: null, carrier_account_id: null, quoted_at: quotedAt,
    payload: { zone_id: zoneId, source: 'internal_rates' },
  }));

  // Mescla cotações de carrier accounts ativas (ex.: Correios).
  try {
    const carrierQuotes = await quoteFromActiveCarriers(supabase, {
      store_id: cart.store_id,
      origin_postal_code: null,
      destination_postal_code: input.postal_code,
      weight_g,
      declared_value: Number(cart.subtotal ?? 0) || undefined,
    });
    for (const cq of carrierQuotes) {
      inserts.push({
        cart_id: input.cart_id, store_id: cart.store_id,
        method_id: null, method_code: cq.service_code,
        method_name: cq.service_name, carrier: cq.carrier_name,
        price: cq.price, estimated_days_min: cq.estimated_days_min, estimated_days_max: cq.estimated_days_max,
        postal_code: digits(input.postal_code), weight_g, expires_at: expiresAt,
        provider_code: cq.provider_code, carrier_account_id: cq.carrier_account_id, quoted_at: quotedAt,
        payload: { source: 'carrier_adapter', raw: cq.raw ?? null },
      });
    }
  } catch (err) {
    console.error('[shipping] cotação via adapter falhou', err);
    await recordMetric(supabase, { scope: 'cart', name: 'shipping.adapter_error', value: 1, storeId: cart.store_id });
  }

  if (inserts.length === 0) {
    await supabase.rpc('record_cart_timeline_event', {
      _cart_id: input.cart_id, _event_type: 'shipping_calculated', _payload: { count: 0 } as never,
    });
    return [];
  }
  const { data: created, error } = await supabase.from('shipping_quotes').insert(inserts as never).select('*');
  if (error) throw Errors.internal('Falha ao criar cotações', { error: error.message });
  await supabase.rpc('record_cart_timeline_event', {
    _cart_id: input.cart_id, _event_type: 'shipping_calculated', _payload: { count: inserts.length } as never,
  });
  await recordMetric(supabase, { scope: 'cart', name: 'shipping.quotes', value: inserts.length, storeId: cart.store_id });
  return created ?? [];
}


export async function selectShippingQuote(
  supabase: SbClient,
  _userId: string | null,
  input: { cart_id: string; quote_id: string },
) {
  const { data: quote } = await supabase.from('shipping_quotes').select('*').eq('id', input.quote_id).maybeSingle();
  if (!quote || quote.cart_id !== input.cart_id) throw Errors.notFound('Cotação');
  await supabase.from('shipping_quotes').update({ selected: false }).eq('cart_id', input.cart_id);
  await supabase.from('shipping_quotes').update({ selected: true }).eq('id', input.quote_id);
  await supabase.from('carts').update({ selected_shipping_quote_id: input.quote_id, shipping_total: quote.price }).eq('id', input.cart_id);
  await supabase.from('shipping_snapshots').insert({
    cart_id: input.cart_id, store_id: quote.store_id, quote_id: input.quote_id,
    payload: { method_code: quote.method_code, method_name: quote.method_name, price: quote.price,
               estimated_days_min: quote.estimated_days_min, estimated_days_max: quote.estimated_days_max,
               postal_code: quote.postal_code, weight_g: quote.weight_g },
  });
  await supabase.rpc('record_cart_timeline_event', {
    _cart_id: input.cart_id, _event_type: 'shipping_selected',
    _payload: { quote_id: input.quote_id, price: quote.price } as never,
  });
  await supabase.rpc('cart_recalculate', { _cart_id: input.cart_id });
  await enqueueOutbox(supabase, {
    storeId: quote.store_id, aggregateType: 'cart', aggregateId: input.cart_id,
    eventType: 'shipping.selected' as never, payload: { quote_id: input.quote_id, price: quote.price },
  });
  return { ok: true };
}

export async function simulateDelivery(
  supabase: SbClient,
  input: { store_id: string; postal_code: string; subtotal: number; weight_g: number },
) {
  const zoneId = await findZoneByPostal(supabase, input.store_id, input.postal_code);
  if (!zoneId) return [];
  const { data: rates } = await supabase.from('shipping_rates')
    .select('*, shipping_methods(id, code, name, carrier, estimated_days_min, estimated_days_max, active)')
    .eq('zone_id', zoneId).eq('active', true);
  const results: QuoteRow[] = [];
  for (const r of rates ?? []) {
    const m = r.shipping_methods as { id: string; code: string; name: string; carrier: string | null; estimated_days_min: number | null; estimated_days_max: number | null; active: boolean } | null;
    if (!m || !m.active) continue;
    if (input.weight_g < r.min_weight_g) continue;
    if (r.max_weight_g != null && input.weight_g > r.max_weight_g) continue;
    if (r.min_subtotal != null && input.subtotal < Number(r.min_subtotal)) continue;
    if (r.max_subtotal != null && input.subtotal > Number(r.max_subtotal)) continue;
    let price = Number(r.price);
    if (r.free_above_subtotal != null && input.subtotal >= Number(r.free_above_subtotal)) price = 0;
    results.push({
      method_id: m.id, method_code: m.code, method_name: m.name, carrier: m.carrier,
      price, estimated_days_min: m.estimated_days_min, estimated_days_max: m.estimated_days_max,
    });
  }
  return results;
}

// ---- Admin CRUD ----
async function assertManage(supabase: SbClient, userId: string, storeId: string) {
  if (await isSuperAdmin(supabase, userId)) return;
  if (await hasPermission(supabase, userId, 'shipping.manage', storeId)) return;
  throw Errors.forbidden('Permissão necessária: shipping.manage');
}

export async function listZones(supabase: SbClient, userId: string, storeId: string) {
  await assertManage(supabase, userId, storeId);
  const { data } = await supabase.from('shipping_zones').select('*, shipping_zone_postal_ranges(*)').eq('store_id', storeId).order('created_at');
  return data ?? [];
}
export async function createZone(supabase: SbClient, userId: string, input: { store_id: string; name: string; country?: string; states?: string[] }) {
  await assertManage(supabase, userId, input.store_id);
  const { data, error } = await supabase.from('shipping_zones').insert({
    store_id: input.store_id, name: input.name, country: input.country ?? 'BR', states: input.states ?? [],
  }).select('*').single();
  if (error) throw Errors.internal('Falha ao criar zona', { error: error.message });
  return data;
}
export async function addPostalRange(supabase: SbClient, userId: string, input: { zone_id: string; postal_from: string; postal_to: string }) {
  const { data: z } = await supabase.from('shipping_zones').select('store_id').eq('id', input.zone_id).maybeSingle();
  if (!z) throw Errors.notFound('Zona');
  await assertManage(supabase, userId, z.store_id);
  const { data, error } = await supabase.from('shipping_zone_postal_ranges').insert(input).select('*').single();
  if (error) throw Errors.internal('Falha', { error: error.message });
  return data;
}
export async function listMethods(supabase: SbClient, userId: string, storeId: string) {
  await assertManage(supabase, userId, storeId);
  const { data } = await supabase.from('shipping_methods').select('*').eq('store_id', storeId).order('created_at');
  return data ?? [];
}
export interface MethodInput { store_id: string; code: string; name: string; kind: 'carrier'|'flat'|'free'|'pickup'|'table'; carrier?: string; estimated_days_min?: number; estimated_days_max?: number; active?: boolean }
export async function createMethod(supabase: SbClient, userId: string, input: MethodInput) {
  await assertManage(supabase, userId, input.store_id);
  const { data, error } = await supabase.from('shipping_methods').insert({ ...input, active: input.active ?? true }).select('*').single();
  if (error) throw Errors.internal('Falha', { error: error.message });
  return data;
}
export async function listRates(supabase: SbClient, userId: string, storeId: string) {
  await assertManage(supabase, userId, storeId);
  const { data } = await supabase.from('shipping_rates').select('*, shipping_methods(name, code), shipping_zones(name)').eq('store_id', storeId).order('created_at');
  return data ?? [];
}
export interface RateInput { store_id: string; zone_id: string; method_id: string; min_weight_g?: number; max_weight_g?: number|null; min_subtotal?: number|null; max_subtotal?: number|null; price: number; free_above_subtotal?: number|null; active?: boolean }
export async function createRate(supabase: SbClient, userId: string, input: RateInput) {
  await assertManage(supabase, userId, input.store_id);
  const { data, error } = await supabase.from('shipping_rates').insert({
    ...input, min_weight_g: input.min_weight_g ?? 0, active: input.active ?? true,
  }).select('*').single();
  if (error) throw Errors.internal('Falha', { error: error.message });
  return data;
}

// ============================================================
// Adapter integration (Correios e demais providers)
// ============================================================

import { getShippingAdapter } from './shipping/registry.server';
import type { AdapterCredentials } from './shipping/adapter';

interface CarrierQuoteResult {
  provider_code: string;
  carrier_account_id: string;
  carrier_name: string;
  service_code: string;
  service_name: string;
  price: number;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  raw?: Record<string, unknown> | null;
}

/**
 * Coleta cotações de todas as contas de transportadora ativas da loja
 * usando seus adapters. Falhas individuais são logadas mas não propagadas
 * (cotação interna sempre completa, mesmo que um carrier esteja indisponível).
 */
async function quoteFromActiveCarriers(
  supabase: SbClient,
  input: {
    store_id: string;
    origin_postal_code: string | null;
    destination_postal_code: string;
    weight_g: number;
    declared_value?: number;
  },
): Promise<CarrierQuoteResult[]> {
  const { data: accounts } = await supabase
    .from('shipping_carrier_accounts')
    .select('id, store_id, provider_code, display_name, sandbox, config, capabilities')
    .eq('store_id', input.store_id).eq('is_active', true);
  if (!accounts || accounts.length === 0) return [];

  const out: CarrierQuoteResult[] = [];
  for (const acc of accounts) {
    const adapter = getShippingAdapter(acc.provider_code);
    if (!adapter || !adapter.capabilities.quote || !adapter.quote) continue;
    const cfg = (acc.config ?? {}) as Record<string, unknown>;
    const origin = input.origin_postal_code
      ?? (typeof cfg.origin_postal_code === 'string' ? cfg.origin_postal_code : null);
    if (!origin) continue;

    // Decifra credenciais via admin client + RPC restrita
    let creds: AdapterCredentials | null = null;
    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { data: c } = await supabaseAdmin.rpc('shipping_get_credentials', { _account_id: acc.id });
      creds = (c as AdapterCredentials | null) ?? null;
    } catch (err) {
      console.error('[shipping] decrypt creds falhou', acc.id, err);
      continue;
    }

    try {
      const options = await adapter.quote({
        account: {
          id: acc.id, store_id: acc.store_id, provider_code: acc.provider_code,
          display_name: acc.display_name, sandbox: acc.sandbox,
          config: cfg, capabilities: (acc.capabilities ?? {}) as Record<string, unknown>,
        },
        credentials: creds,
      }, {
        origin_postal_code: origin,
        destination_postal_code: input.destination_postal_code,
        weight_g: input.weight_g,
        declared_value: input.declared_value,
      });
      for (const o of options) {
        out.push({
          provider_code: acc.provider_code,
          carrier_account_id: acc.id,
          carrier_name: adapter.displayName,
          service_code: o.service_code,
          service_name: o.service_name,
          price: o.price,
          estimated_days_min: o.estimated_days_min,
          estimated_days_max: o.estimated_days_max,
          raw: o.raw ?? null,
        });
      }
    } catch (err) {
      console.error(`[shipping] adapter ${acc.provider_code} falhou`, err);
      await supabase.from('shipping_carrier_accounts').update({
        last_test_at: new Date().toISOString(),
        last_test_ok: false,
        last_test_error: (err instanceof Error ? err.message : String(err)).slice(0, 500),
      }).eq('id', acc.id);
    }
  }
  return out;
}

/**
 * Persiste a cotação selecionada do carrinho no pedido recém-criado
 * (carrier, service, price, eta, quoted_at, provider, account).
 * Idempotente — `order_shipping_snapshots` é UNIQUE por order_id.
 */
export async function persistOrderShippingSnapshot(
  supabase: SbClient,
  input: { order_id: string; cart_id: string },
) {
  const { data, error } = await supabase.rpc('order_persist_shipping_snapshot', {
    _order_id: input.order_id, _cart_id: input.cart_id,
  });
  if (error) throw Errors.internal('Falha ao persistir cotação no pedido', { error: error.message });
  return { snapshot_id: (data as string | null) ?? null };
}

// ---- CEP lookup ----
import { lookupViaCep, type PostalLookup } from './shipping/cep.server';
export async function lookupPostalCode(postalCode: string): Promise<PostalLookup> {
  return lookupViaCep(postalCode);
}

