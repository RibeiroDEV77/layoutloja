/**
 * Coupon Rule Engine (Fase 5.2).
 *
 * Frontend só dispara `applyCoupon(code)` / `removeCoupon(id)`.
 * Regras (validade, limites totais, limite por cliente, subtotal mínimo,
 * grupo de cliente, scope, stacking) ficam aqui e na função SQL
 * `apply_coupon_to_cart` que é a fonte da verdade transacional.
 *
 * Ledger e timeline são gerados pelo SQL — este service apenas orquestra,
 * verifica acesso e emite Outbox.
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { isSuperAdmin, hasPermission } from './permissions.server';
import { enqueueOutbox } from '@/lib/foundations/outbox.functions';
import { recordMetric } from '@/lib/foundations/observability.functions';

async function loadCart(supabase: SbClient, cartId: string) {
  const { data } = await supabase.from('carts').select('*').eq('id', cartId).maybeSingle();
  if (!data) throw Errors.notFound('Carrinho', cartId);
  return data;
}

export async function applyCoupon(
  supabase: SbClient,
  _userId: string | null,
  input: { cart_id: string; code: string },
) {
  const cart = await loadCart(supabase, input.cart_id);
  if (cart.status !== 'active') throw Errors.rule('Carrinho inativo');

  // stacking?
  if (!cart) throw Errors.notFound('Carrinho');
  const { data: existing } = await supabase.from('cart_coupons').select('id').eq('cart_id', input.cart_id);
  const { data: stackingFlag } = await supabase.rpc('evaluate_feature_flag', {
    _key: 'coupon.enable_stacking', _user_id: undefined, _store_id: undefined,
  });
  const stacking = stackingFlag === true || stackingFlag === 'true';
  if ((existing?.length ?? 0) > 0 && !stacking) {
    throw Errors.rule('Já existe um cupom aplicado. Remova-o antes de aplicar outro.');
  }

  const { data, error } = await supabase.rpc('apply_coupon_to_cart', {
    _coupon_code: input.code, _cart_id: input.cart_id,
  });
  if (error) throw Errors.internal('Falha ao aplicar cupom', { error: error.message });
  const result = data as unknown as { ok: boolean; reason?: string; amount?: number; cart_coupon_id?: string };
  if (!result?.ok) {
    throw Errors.rule(`Cupom inválido: ${result?.reason ?? 'unknown'}`, { reason: result?.reason ?? null });
  }
  await enqueueOutbox(supabase, {
    storeId: cart.store_id, aggregateType: 'cart', aggregateId: input.cart_id,
    eventType: 'coupon.applied' as never, payload: { code: input.code, amount: result.amount ?? 0 },
  });
  await recordMetric(supabase, { scope: 'cart', name: 'coupon.applied', value: 1, storeId: cart.store_id });
  return result;
}

export async function removeCoupon(supabase: SbClient, _userId: string | null, input: { cart_coupon_id: string }) {
  const { data: cc } = await supabase.from('cart_coupons').select('cart_id, coupon_id').eq('id', input.cart_coupon_id).maybeSingle();
  if (!cc) return { ok: true };
  const cart = await loadCart(supabase, cc.cart_id);
  const { error } = await supabase.rpc('remove_coupon_from_cart', { _cart_coupon_id: input.cart_coupon_id });
  if (error) throw Errors.internal('Falha ao remover cupom', { error: error.message });
  await enqueueOutbox(supabase, {
    storeId: cart.store_id, aggregateType: 'cart', aggregateId: cc.cart_id,
    eventType: 'coupon.removed' as never, payload: { coupon_id: cc.coupon_id },
  });
  return { ok: true };
}

// ---- Admin CRUD ----
export interface CouponInput {
  store_id: string;
  code: string;
  name: string;
  description?: string;
  type: 'percent' | 'fixed' | 'free_shipping';
  scope?: 'cart' | 'shipping' | 'category' | 'product' | 'collection';
  value: number;
  min_subtotal?: number | null;
  max_discount?: number | null;
  usage_limit_total?: number | null;
  usage_limit_per_customer?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  stackable?: boolean;
  customer_group_id?: string | null;
  active?: boolean;
}

async function assertManage(supabase: SbClient, userId: string, storeId: string) {
  if (await isSuperAdmin(supabase, userId)) return;
  if (await hasPermission(supabase, userId, 'pricing.manage', storeId)) return;
  throw Errors.forbidden('Permissão necessária: pricing.manage');
}

export async function listCoupons(supabase: SbClient, userId: string, storeId: string) {
  await assertManage(supabase, userId, storeId);
  const { data } = await supabase.from('coupons').select('*').eq('store_id', storeId).order('created_at', { ascending: false });
  return data ?? [];
}

export async function createCoupon(supabase: SbClient, userId: string, input: CouponInput) {
  await assertManage(supabase, userId, input.store_id);
  const { data, error } = await supabase.from('coupons').insert({
    ...input, scope: input.scope ?? 'cart', stackable: input.stackable ?? false, active: input.active ?? true,
  }).select('*').single();
  if (error) throw Errors.internal('Falha ao criar cupom', { error: error.message });
  return data;
}

export async function updateCoupon(supabase: SbClient, userId: string, id: string, patch: Partial<CouponInput>) {
  const { data: existing } = await supabase.from('coupons').select('store_id').eq('id', id).maybeSingle();
  if (!existing) throw Errors.notFound('Cupom', id);
  await assertManage(supabase, userId, existing.store_id);
  const { data, error } = await supabase.from('coupons').update(patch).eq('id', id).select('*').single();
  if (error) throw Errors.internal('Falha ao atualizar cupom', { error: error.message });
  return data;
}

export async function deleteCoupon(supabase: SbClient, userId: string, id: string) {
  const { data: existing } = await supabase.from('coupons').select('store_id').eq('id', id).maybeSingle();
  if (!existing) return { ok: true };
  await assertManage(supabase, userId, existing.store_id);
  const { error } = await supabase.from('coupons').delete().eq('id', id);
  if (error) throw Errors.internal('Falha ao excluir cupom', { error: error.message });
  return { ok: true };
}

export async function getCouponLedger(supabase: SbClient, userId: string, couponId: string) {
  const { data: c } = await supabase.from('coupons').select('store_id').eq('id', couponId).maybeSingle();
  if (!c) throw Errors.notFound('Cupom', couponId);
  await assertManage(supabase, userId, c.store_id);
  const { data } = await supabase.from('coupon_ledger').select('*').eq('coupon_id', couponId).order('created_at', { ascending: false }).limit(200);
  return data ?? [];
}
