/**
 * Server Functions: Valores de Atributos.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as Svc from './services/attribute-values.server';

export const listAttributeValues = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Svc.ListAttrValuesInput) => input)
  .handler(withBusiness(async ({ data, context }) =>
    Svc.list(context.supabase, context.userId, data),
  ));

export const createAttributeValue = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Svc.CreateAttrValueInput) => input)
  .handler(withBusiness(async ({ data, context }) =>
    Svc.create(context.supabase, context.userId, data),
  ));

export const updateAttributeValue = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; patch: Svc.UpdateAttrValueInput }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    Svc.update(context.supabase, context.userId, data.id, data.patch),
  ));

export const deleteAttributeValue = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    Svc.remove(context.supabase, context.userId, data.id),
  ));
