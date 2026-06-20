/**
 * Server Functions: Marcas.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as M from './services/master.server';

const CFG: M.MasterConfig = {
  table: 'brands',
  permission: 'products.update',
  readPermission: 'products.read',
  searchCols: ['name', 'slug'],
  defaultSort: 'sort_order',
};

export const listBrands = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: M.ListParams) => input)
  .handler(withBusiness(async ({ data, context }) =>
    M.listGeneric(context.supabase, context.userId, CFG, data),
  ));

export const createBrand = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown> & { store_id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    M.createGeneric(context.supabase, context.userId, CFG, data),
  ));

export const updateBrand = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; patch: Record<string, unknown> }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    M.updateGeneric(context.supabase, context.userId, CFG, data.id, data.patch),
  ));

export const deleteBrand = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    M.deleteGeneric(context.supabase, context.userId, CFG, data.id),
  ));
