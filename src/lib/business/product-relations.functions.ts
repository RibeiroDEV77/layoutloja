/**
 * Server Functions: Produtos Relacionados.
 * Toda I/O do painel administrativo passa por estes controllers.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as R from './services/product-relations.server';

export const listProductRelations = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { product_id: string; relation_type?: R.RelationType }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    R.listRelations(context.supabase, context.userId, data.product_id, data.relation_type),
  ));

export const addProductRelation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { product_id: string; related_product_id: string; relation_type?: R.RelationType; position?: number }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    R.addRelation(context.supabase, context.userId, data.product_id, {
      related_product_id: data.related_product_id,
      relation_type: data.relation_type,
      position: data.position,
    }),
  ));

export const removeProductRelation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    R.removeRelation(context.supabase, context.userId, data.id),
  ));

export const reorderProductRelations = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { product_id: string; items: { id: string; position: number }[] }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    R.reorderRelations(context.supabase, context.userId, data.product_id, data.items),
  ));
