/**
 * Server Functions: Stores.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as Svc from './services/stores.server';

export const listStores = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Svc.ListStoresInput) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.listStores(context.supabase, context.userId, data)));

export const createStore = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Svc.CreateStoreInput) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.createStore(context.supabase, context.userId, data)));

export const updateStore = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; patch: Svc.UpdateStoreInput }) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.updateStore(context.supabase, context.userId, data.id, data.patch)));

export const archiveStore = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.archiveStore(context.supabase, context.userId, data.id)));

export const listStoreSettings = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { store_id: string }) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.listStoreSettings(context.supabase, context.userId, data.store_id)));

export const upsertStoreSetting = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { store_id: string; key: string; value: unknown }) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.upsertStoreSetting(context.supabase, context.userId, data.store_id, data.key, data.value)));
