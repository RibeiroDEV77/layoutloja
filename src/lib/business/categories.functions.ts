/**
 * Server Functions: Categorias.
 *
 * Etapa 2 — Árvore oficial:
 *   • listCategoriesTree: retorna a árvore via VIEW `categories_tree`
 *     com level/depth/path/path_ids/children_count/is_leaf — pronta para
 *     alimentar a Tree View do admin nas próximas etapas.
 *
 * Funções legadas (listCategories/create/update/delete) preservadas para
 * não quebrar consumidores existentes. Triggers no banco mantêm
 * level/depth/path/path_ids automaticamente após cada CRUD.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as M from './services/master.server';
import { Errors } from './errors';
import { isSuperAdmin, requireStoreAccess, hasPermission } from './services/permissions.server';

const CFG: M.MasterConfig = {
  table: 'categories',
  permission: 'products.update',
  readPermission: 'products.read',
  searchCols: ['name', 'slug'],
  defaultSort: 'sort_order',
};

export const listCategories = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: M.ListParams) => input)
  .handler(withBusiness(async ({ data, context }) =>
    M.listGeneric(context.supabase, context.userId, CFG, data),
  ));

export const createCategory = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown> & { store_id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    M.createGeneric(context.supabase, context.userId, CFG, data),
  ));

export const updateCategory = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; patch: Record<string, unknown> }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    M.updateGeneric(context.supabase, context.userId, CFG, data.id, data.patch),
  ));

export const deleteCategory = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    M.deleteGeneric(context.supabase, context.userId, CFG, data.id),
  ));

// =============================================================================
// Etapa 2 — Árvore enriquecida
// =============================================================================

export interface CategoryTreeNode {
  id: string;
  store_id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  path: string | null;
  path_ids: string[] | null;
  level: number | null;
  depth: number | null;
  sort_order: number;
  is_active: boolean;
  children_count: number;
  is_leaf: boolean;
}

export const listCategoriesTree = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { store_id: string; only_active?: boolean }) => input)
  .handler(withBusiness(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.store_id) throw Errors.validation('store_id obrigatório');

    if (!(await isSuperAdmin(supabase, userId))) {
      await requireStoreAccess(supabase, userId, data.store_id);
      const ok =
        (await hasPermission(supabase, userId, 'products.read', data.store_id)) ||
        (await hasPermission(supabase, userId, 'products.update', data.store_id));
      if (!ok) throw Errors.forbidden('Permissão necessária: products.read');
    }

    let q = supabase
      .from('categories_tree')
      .select('id,store_id,parent_id,name,slug,path,path_ids,level,depth,sort_order,is_active,children_count,is_leaf')
      .eq('store_id', data.store_id)
      .order('level', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (data.only_active) q = q.eq('is_active', true);

    const { data: rows, error } = await q;
    if (error) throw Errors.internal('Falha ao listar árvore de categorias', { error: error.message });
    return { rows: (rows ?? []) as CategoryTreeNode[] };
  }));
