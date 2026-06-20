/**
 * Server Functions: Atributos de Categoria (pivot).
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as Svc from './services/category-attributes.server';

export const listCategoryAttributes = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Svc.ListInput) => input)
  .handler(withBusiness(async ({ data, context }) =>
    Svc.list(context.supabase, context.userId, data),
  ));

export const createCategoryAttribute = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Svc.CreateInput) => input)
  .handler(withBusiness(async ({ data, context }) =>
    Svc.create(context.supabase, context.userId, data),
  ));

export const updateCategoryAttribute = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; patch: Svc.UpdateInput }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    Svc.update(context.supabase, context.userId, data.id, data.patch),
  ));

export const deleteCategoryAttribute = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    Svc.remove(context.supabase, context.userId, data.id),
  ));
