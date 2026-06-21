/**
 * Server Functions: Cart (Fase 5.2).
 *
 * Endpoint anônimo (`anonCartFn`) usa server publishable client + session_token.
 * Demais endpoints exigem auth.
 */
import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as Cart from './services/cart.server';
import * as Coupon from './services/coupons.server';
import * as Shipping from './services/shipping.server';
import * as Merge from './services/cart-merge.server';
import * as Stock from './services/stock-reservation.server';

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

// ---------- Authenticated ----------
export const getOrCreateCart = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Cart.GetOrCreateInput) => d)
  .handler(withBusiness(async ({ data, context }) => Cart.getOrCreateCart(context.supabase, context.userId, data)));

export const getCart = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cart_id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Cart.getCart(context.supabase, context.userId, data.cart_id)));

export const addCartItem = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Cart.AddItemInput) => d)
  .handler(withBusiness(async ({ data, context }) => Cart.addItem(context.supabase, context.userId, data)));

export const updateCartItemQty = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cart_id: string; item_id: string; qty: number }) => d)
  .handler(withBusiness(async ({ data, context }) => Cart.updateItemQty(context.supabase, context.userId, data)));

export const removeCartItem = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cart_id: string; item_id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Cart.removeItem(context.supabase, context.userId, data)));

export const clearCart = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cart_id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Cart.clearCart(context.supabase, context.userId, data)));

export const abandonCart = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cart_id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Cart.abandonCart(context.supabase, context.userId, data.cart_id)));

export const snapshotCart = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cart_id: string; reason: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Cart.snapshotCart(context.supabase, context.userId, data)));

export const getCartTimeline = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cart_id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Cart.getTimeline(context.supabase, context.userId, data.cart_id)));

export const listAdminCarts = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { store_id: string; status?: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Cart.listAdminCarts(context.supabase, context.userId, data.store_id, data.status)));

// ---------- Merge (post-login) ----------
export const mergeAnonymousCart = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { anonymous_cart_id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Merge.mergeAnonymousIntoCustomer(context.supabase, context.userId, data)));

// ---------- Coupons ----------
export const applyCartCoupon = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cart_id: string; code: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Coupon.applyCoupon(context.supabase, context.userId, data)));

export const removeCartCoupon = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cart_coupon_id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Coupon.removeCoupon(context.supabase, context.userId, data)));

// ---------- Shipping ----------
export const quoteCartShipping = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cart_id: string; postal_code: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Shipping.quoteShippingForCart(context.supabase, context.userId, data)));

export const selectCartShippingQuote = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cart_id: string; quote_id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Shipping.selectShippingQuote(context.supabase, context.userId, data)));

// ---------- Public: Simulate delivery (sem carrinho/login) ----------
export const simulateDelivery = createServerFn({ method: 'POST' })
  .inputValidator((d: { store_id: string; postal_code: string; subtotal: number; weight_g: number }) => d)
  .handler(withBusiness(async ({ data }) => Shipping.simulateDelivery(publicClient(), data)));

// ---------- Maintenance ----------
export const expireStaleReservations = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(withBusiness(async ({ context }) => ({ expired: await Stock.expireStaleReservations(context.supabase) })));
