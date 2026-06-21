/**
 * Server Functions: Coupons admin (Fase 5.2).
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as Svc from './services/coupons.server';

export const listCoupons = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { store_id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.listCoupons(context.supabase, context.userId, data.store_id)));

export const createCoupon = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Svc.CouponInput) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.createCoupon(context.supabase, context.userId, data)));

export const updateCoupon = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Partial<Svc.CouponInput> }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.updateCoupon(context.supabase, context.userId, data.id, data.patch)));

export const deleteCoupon = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.deleteCoupon(context.supabase, context.userId, data.id)));

export const getCouponLedger = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.getCouponLedger(context.supabase, context.userId, data.id)));
