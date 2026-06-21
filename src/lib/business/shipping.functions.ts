/**
 * Server Functions: Shipping admin (Fase 5.2).
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as Svc from './services/shipping.server';

export const listShippingZones = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { store_id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.listZones(context.supabase, context.userId, data.store_id)));

export const createShippingZone = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { store_id: string; name: string; country?: string; states?: string[] }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.createZone(context.supabase, context.userId, data)));

export const addShippingPostalRange = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { zone_id: string; postal_from: string; postal_to: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.addPostalRange(context.supabase, context.userId, data)));

export const listShippingMethods = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { store_id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.listMethods(context.supabase, context.userId, data.store_id)));

export const createShippingMethod = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Svc.MethodInput) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.createMethod(context.supabase, context.userId, data)));

export const listShippingRates = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { store_id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.listRates(context.supabase, context.userId, data.store_id)));

export const createShippingRate = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Svc.RateInput) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.createRate(context.supabase, context.userId, data)));
