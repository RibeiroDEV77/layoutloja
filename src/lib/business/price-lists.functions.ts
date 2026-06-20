/**
 * Server Functions: Listas de Preço.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as M from './services/master.server';

const CFG: M.MasterConfig = {
  table: 'price_lists',
  permission: 'settings.manage',
  readPermission: 'products.read',
  searchCols: ['name', 'code'],
  defaultSort: 'priority',
  defaultSortDir: 'desc',
};

export const listPriceLists = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: M.ListParams) => input)
  .handler(withBusiness(async ({ data, context }) =>
    M.listGeneric(context.supabase, context.userId, CFG, data),
  ));

export const createPriceList = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown> & { store_id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    M.createGeneric(context.supabase, context.userId, CFG, data),
  ));

export const updatePriceList = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; patch: Record<string, unknown> }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    M.updateGeneric(context.supabase, context.userId, CFG, data.id, data.patch),
  ));

export const deletePriceList = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    M.deleteGeneric(context.supabase, context.userId, CFG, data.id),
  ));
