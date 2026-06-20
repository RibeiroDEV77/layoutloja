/**
 * Server Functions: Grupos de Clientes.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as M from './services/master.server';

const CFG: M.MasterConfig = {
  table: 'customer_groups',
  permission: 'settings.manage',
  readPermission: 'customers.read',
  searchCols: ['name', 'code'],
  defaultSort: 'name',
};

export const listCustomerGroups = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: M.ListParams) => input)
  .handler(withBusiness(async ({ data, context }) =>
    M.listGeneric(context.supabase, context.userId, CFG, data),
  ));

export const createCustomerGroup = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown> & { store_id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    M.createGeneric(context.supabase, context.userId, CFG, data),
  ));

export const updateCustomerGroup = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; patch: Record<string, unknown> }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    M.updateGeneric(context.supabase, context.userId, CFG, data.id, data.patch),
  ));

export const deleteCustomerGroup = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    M.deleteGeneric(context.supabase, context.userId, CFG, data.id),
  ));
