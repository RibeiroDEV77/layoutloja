/**
 * Server Functions: Produtos (Central de Produtos).
 *
 * Toda I/O do painel administrativo de produtos passa por estes controllers.
 * Camada de UI nunca acessa Supabase diretamente.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as P from './services/products.server';

// ---- Listagem e leitura
export const listProducts = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: P.ListProductsInput) => input)
  .handler(withBusiness(async ({ data, context }) =>
    P.listProducts(context.supabase, context.userId, data),
  ));

export const getProduct = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    P.getProduct(context.supabase, context.userId, data.id),
  ));

// ---- CRUD
export const createProductDraft = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: P.CreateProductDraftInput) => input)
  .handler(withBusiness(async ({ data, context }) =>
    P.createProductDraft(context.supabase, context.userId, data),
  ));

export const updateProduct = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; patch: P.UpdateProductInput }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    P.updateProduct(context.supabase, context.userId, data.id, data.patch),
  ));

export const deleteProduct = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    P.deleteProduct(context.supabase, context.userId, data.id),
  ));

// ---- Operações
export const archiveProduct = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; archived: boolean }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    P.archiveProduct(context.supabase, context.userId, data.id, data.archived),
  ));

export const duplicateProduct = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; name?: string; sku_root?: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    P.duplicateProduct(context.supabase, context.userId, data.id, { name: data.name, sku_root: data.sku_root }),
  ));

export const exportProducts = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { store_id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    P.exportProducts(context.supabase, context.userId, data.store_id),
  ));

export const importProducts = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { store_id: string; rows: Parameters<typeof P.importProducts>[3] }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    P.importProducts(context.supabase, context.userId, data.store_id, data.rows),
  ));

export const listProductHistory = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    P.listProductHistory(context.supabase, context.userId, data.id),
  ));

export const listProductAudit = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    P.listProductAudit(context.supabase, context.userId, data.id),
  ));

// ---- Publicação / readiness
export const publishProduct = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    P.publishProduct(context.supabase, context.userId, data.id),
  ));

export const unpublishProduct = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    P.unpublishProduct(context.supabase, context.userId, data.id),
  ));

export const getProductReadiness = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    P.getProductReadiness(context.supabase, context.userId, data.id),
  ));
