/**
 * Stock Reservation Engine (Fase 5.2).
 *
 * - Cria reservas com TTL configurável (feature flag `cart.reservation_ttl_seconds`).
 * - Libera, estende, consome e expira reservas.
 * - Toda operação gera entrada no `stock_reservation_ledger` (append-only).
 * - Verifica `stock_levels` antes de reservar.
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { recordMetric } from '@/lib/foundations/observability.functions';

const DEFAULT_TTL = 1800;

async function getReservationTtl(supabase: SbClient): Promise<number> {
  const { data } = await supabase.rpc('evaluate_feature_flag', {
    _key: 'cart.reservation_ttl_seconds', _user_id: undefined, _store_id: undefined,
  });
  const n = Number(data);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL;
}

export async function availableStock(supabase: SbClient, variantId: string): Promise<number> {
  const { data: levels } = await supabase
    .from('stock_levels')
    .select('on_hand, reserved')
    .eq('variant_id', variantId);
  const total = (levels ?? []).reduce(
    (acc, l) => acc + (Number(l.on_hand ?? 0) - Number(l.reserved ?? 0)),
    0,
  );
  const { data: active } = await supabase
    .from('stock_reservations')
    .select('qty')
    .eq('variant_id', variantId)
    .eq('status', 'active');
  const reserved = (active ?? []).reduce((acc, r) => acc + Number(r.qty ?? 0), 0);
  return Math.max(0, total - reserved);
}

export async function reserveForCartItem(supabase: SbClient, cartItemId: string): Promise<string> {
  const ttl = await getReservationTtl(supabase);
  const { data, error } = await supabase.rpc('reserve_stock_for_cart_item', {
    _cart_item_id: cartItemId, _ttl_seconds: ttl,
  });
  if (error) throw Errors.internal('Falha ao reservar estoque', { error: error.message });
  await recordMetric(supabase, { scope: 'cart', name: 'stock.reserved', value: 1 });
  return data as unknown as string;
}

export async function releaseReservation(supabase: SbClient, reservationId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('release_stock_reservation', {
    _reservation_id: reservationId, _reason: reason ?? null,
  });
  if (error) throw Errors.internal('Falha ao liberar reserva', { error: error.message });
  await recordMetric(supabase, { scope: 'cart', name: 'stock.released', value: 1 });
}

export async function releaseAllForCart(supabase: SbClient, cartId: string, reason = 'cart_cleared'): Promise<number> {
  const { data: list } = await supabase
    .from('stock_reservations')
    .select('id')
    .eq('cart_id', cartId)
    .eq('status', 'active');
  let count = 0;
  for (const r of list ?? []) {
    await releaseReservation(supabase, r.id, reason);
    count++;
  }
  return count;
}

export async function expireStaleReservations(supabase: SbClient): Promise<number> {
  const { data, error } = await supabase.rpc('expire_stale_cart_reservations');
  if (error) throw Errors.internal('Falha ao expirar reservas', { error: error.message });
  return (data as unknown as number) ?? 0;
}

export async function ensureStockAvailable(supabase: SbClient, variantId: string, qty: number): Promise<void> {
  const avail = await availableStock(supabase, variantId);
  if (avail < qty) {
    throw Errors.rule('Estoque insuficiente', { variant_id: variantId, requested: qty, available: avail });
  }
}
