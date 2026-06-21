/**
 * Wrappers PÚBLICOS de carrinho — anônimo via cookie `sf_session`.
 *
 * Reutilizam 100% das funções de Cart/Coupon/Shipping em services/cart.server.ts
 * sem duplicar regras (pricing, reservation, snapshot, timeline, outbox).
 *
 * Ownership é garantida via `assertCartAccess` interno (compara session_token).
 * Usamos `supabaseAdmin` porque o Cart service grava em outbox/metrics que
 * não têm policies anon. A autorização ainda é feita pelo session_token.
 */
import { createServerFn } from '@tanstack/react-start';
import * as Cart from './services/cart.server';
import * as Coupon from './services/coupons.server';
import * as Shipping from './services/shipping.server';
import { getDefaultStore } from '@/lib/storefront/store-context.server';
import {
  getOrCreateSessionToken,
  getStoredCartId,
  setStoredCartId,
  clearStoredCartId,
} from '@/lib/storefront/session.server';

async function admin() {
  const mod = await import('@/integrations/supabase/client.server');
  return mod.supabaseAdmin;
}

async function ensureCart() {
  const sb = await admin();
  const store = await getDefaultStore(sb);
  const sessionToken = getOrCreateSessionToken();
  const storedId = getStoredCartId();
  if (storedId) {
    // valida que ainda existe + pertence à sessão
    const { data } = await sb.from('carts').select('id, session_token, status').eq('id', storedId).maybeSingle();
    if (data && data.session_token === sessionToken && data.status === 'active') {
      return { sb, storeId: store.id, sessionToken, cartId: storedId };
    }
  }
  const cart = await Cart.getOrCreateCart(sb, null, { store_id: store.id, session_token: sessionToken });
  setStoredCartId(cart.id);
  return { sb, storeId: store.id, sessionToken, cartId: cart.id };
}

/* ---- leitura ---- */
export const getPublicCart = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { sb, sessionToken } = await ensureCart();
    const storedId = getStoredCartId()!;
    const cart = await Cart.getCart(sb, null, storedId, sessionToken);
    return { ...cart };
  });

/* ---- mutações ---- */
export const addPublicCartItem = createServerFn({ method: 'POST' })
  .inputValidator((d: { variant_id: string; qty: number }) => d)
  .handler(async ({ data }) => {
    const { sb, sessionToken, cartId } = await ensureCart();
    return Cart.addItem(sb, null, {
      cart_id: cartId,
      variant_id: data.variant_id,
      qty: data.qty,
      session_token: sessionToken,
    });
  });

export const updatePublicCartItemQty = createServerFn({ method: 'POST' })
  .inputValidator((d: { item_id: string; qty: number }) => d)
  .handler(async ({ data }) => {
    const { sb, sessionToken, cartId } = await ensureCart();
    return Cart.updateItemQty(sb, null, {
      cart_id: cartId,
      item_id: data.item_id,
      qty: data.qty,
      session_token: sessionToken,
    });
  });

export const removePublicCartItem = createServerFn({ method: 'POST' })
  .inputValidator((d: { item_id: string }) => d)
  .handler(async ({ data }) => {
    const { sb, sessionToken, cartId } = await ensureCart();
    return Cart.removeItem(sb, null, {
      cart_id: cartId,
      item_id: data.item_id,
      session_token: sessionToken,
    });
  });

export const clearPublicCart = createServerFn({ method: 'POST' })
  .handler(async () => {
    const { sb, sessionToken, cartId } = await ensureCart();
    const result = await Cart.clearCart(sb, null, { cart_id: cartId, session_token: sessionToken });
    return result;
  });

export const resetPublicCart = createServerFn({ method: 'POST' })
  .handler(async () => {
    clearStoredCartId();
    return { ok: true };
  });

/* ---- cupom ---- */
export const applyPublicCoupon = createServerFn({ method: 'POST' })
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data }) => {
    const { sb, cartId } = await ensureCart();
    return Coupon.applyCoupon(sb, null, { cart_id: cartId, code: data.code });
  });

export const removePublicCoupon = createServerFn({ method: 'POST' })
  .inputValidator((d: { cart_coupon_id: string }) => d)
  .handler(async ({ data }) => {
    const { sb } = await ensureCart();
    return Coupon.removeCoupon(sb, null, { cart_coupon_id: data.cart_coupon_id });
  });

/* ---- frete ---- */
export const quotePublicShipping = createServerFn({ method: 'POST' })
  .inputValidator((d: { postal_code: string }) => d)
  .handler(async ({ data }) => {
    const { sb, cartId } = await ensureCart();
    return Shipping.quoteShippingForCart(sb, null, { cart_id: cartId, postal_code: data.postal_code });
  });

export const selectPublicShippingQuote = createServerFn({ method: 'POST' })
  .inputValidator((d: { quote_id: string }) => d)
  .handler(async ({ data }) => {
    const { sb, cartId } = await ensureCart();
    return Shipping.selectShippingQuote(sb, null, { cart_id: cartId, quote_id: data.quote_id });
  });
