/**
 * Server Functions: Suppliers (controllers).
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as Svc from './services/suppliers.server';

export const createSupplier = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Svc.CreateSupplierInput) => input)
  .handler(
    withBusiness(async ({ data, context }) =>
      Svc.createSupplier(context.supabase, context.userId, data),
    ),
  );

export const updateSupplier = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; patch: Svc.UpdateSupplierInput }) => input)
  .handler(
    withBusiness(async ({ data, context }) =>
      Svc.updateSupplier(context.supabase, context.userId, data.id, data.patch),
    ),
  );

export const deleteSupplier = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(
    withBusiness(async ({ data, context }) =>
      Svc.deleteSupplier(context.supabase, context.userId, data.id),
    ),
  );
