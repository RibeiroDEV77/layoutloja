/**
 * Server Functions: Shipping Carrier Accounts (Correios e demais providers).
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as Svc from './services/shipping/carrier-accounts.server';

export const listShippingProviders = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(withBusiness(async () => Svc.listAvailableProviders()));

export const listShippingCarrierAccounts = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { store_id: string }) => d)
  .handler(withBusiness(async ({ data, context }) =>
    Svc.listCarrierAccounts(context.supabase, context.userId, data.store_id)));

export const createShippingCarrierAccount = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Svc.CreateCarrierAccountInput) => d)
  .handler(withBusiness(async ({ data, context }) =>
    Svc.createCarrierAccount(context.supabase, context.userId, data)));

export const updateShippingCarrierAccount = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Svc.UpdateCarrierAccountInput) => d)
  .handler(withBusiness(async ({ data, context }) =>
    Svc.updateCarrierAccount(context.supabase, context.userId, data)));

export const deleteShippingCarrierAccount = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(withBusiness(async ({ data, context }) =>
    Svc.deleteCarrierAccount(context.supabase, context.userId, data.id)));

export const setShippingCarrierCredentials = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; credentials: Record<string, unknown> }) => d)
  .handler(withBusiness(async ({ data, context }) =>
    Svc.setCarrierAccountCredentials(context.supabase, context.userId, data)));

export const testShippingCarrierAccount = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(withBusiness(async ({ data, context }) =>
    Svc.testCarrierAccount(context.supabase, context.userId, data.id)));
