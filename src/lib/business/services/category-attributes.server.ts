/**
 * Service: Category Attributes — pivot category × attribute.
 * O escopo de loja é herdado da categoria pai (que deve estar na mesma loja do atributo).
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { requirePermission, isSuperAdmin, hasPermission, requireStoreAccess } from './permissions.server';

const WRITE_PERM = 'products.update';
const READ_PERM = 'products.read';

async function getCategoryStoreId(supabase: SbClient, categoryId: string): Promise<string> {
  const { data, error } = await supabase
    .from('categories')
    .select('store_id')
    .eq('id', categoryId)
    .maybeSingle();
  if (error) throw Errors.internal('Falha ao buscar categoria', { error: error.message });
  if (!data) throw Errors.notFound('Categoria', categoryId);
  return data.store_id;
}

export interface ListInput {
  category_id: string;
}

export async function list(supabase: SbClient, userId: string, input: ListInput) {
  if (!input.category_id) throw Errors.validation('category_id obrigatório');
  const storeId = await getCategoryStoreId(supabase, input.category_id);
  if (!(await isSuperAdmin(supabase, userId))) {
    await requireStoreAccess(supabase, userId, storeId);
    const ok = (await hasPermission(supabase, userId, READ_PERM, storeId))
      || (await hasPermission(supabase, userId, WRITE_PERM, storeId));
    if (!ok) throw Errors.forbidden('Permissão necessária: products.read');
  }

  const { data, error } = await supabase
    .from('category_attributes')
    .select('*, attribute:attributes(id, name, code, input_type, is_color, is_size)')
    .eq('category_id', input.category_id)
    .order('sort_order', { ascending: true });
  if (error) throw Errors.internal('Falha ao listar atributos da categoria', { error: error.message });
  return { rows: data ?? [], total: data?.length ?? 0 };
}

export interface CreateInput {
  category_id: string;
  attribute_id: string;
  is_required?: boolean;
  is_variant_axis?: boolean;
  sort_order?: number;
  show_in_filters?: boolean;
  filter_order?: number;
}

export async function create(supabase: SbClient, userId: string, input: CreateInput) {
  if (!input.category_id) throw Errors.validation('category_id obrigatório');
  if (!input.attribute_id) throw Errors.validation('attribute_id obrigatório');

  const storeId = await getCategoryStoreId(supabase, input.category_id);
  await requirePermission(supabase, userId, WRITE_PERM, storeId);

  // Garante que atributo pertence à mesma loja
  const { data: attr, error: ae } = await supabase
    .from('attributes')
    .select('store_id')
    .eq('id', input.attribute_id)
    .maybeSingle();
  if (ae) throw Errors.internal('Falha ao buscar atributo', { error: ae.message });
  if (!attr) throw Errors.notFound('Atributo', input.attribute_id);
  if (attr.store_id !== storeId) {
    throw Errors.validation('Atributo pertence a outra loja');
  }

  const { data, error } = await supabase
    .from('category_attributes')
    .insert({
      category_id: input.category_id,
      attribute_id: input.attribute_id,
      is_required: input.is_required ?? false,
      is_variant_axis: input.is_variant_axis ?? false,
      sort_order: input.sort_order ?? 0,
    })
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') throw Errors.conflict('Atributo já vinculado a esta categoria');
    throw Errors.internal('Falha ao vincular atributo', { error: error.message });
  }
  return data;
}

export type UpdateInput = Partial<Omit<CreateInput, 'category_id' | 'attribute_id'>>;

export async function update(supabase: SbClient, userId: string, id: string, patch: UpdateInput) {
  const { data: current, error: ce } = await supabase
    .from('category_attributes')
    .select('category_id')
    .eq('id', id)
    .maybeSingle();
  if (ce) throw Errors.internal('Falha ao buscar vínculo', { error: ce.message });
  if (!current) throw Errors.notFound('Vínculo', id);

  const storeId = await getCategoryStoreId(supabase, current.category_id);
  await requirePermission(supabase, userId, WRITE_PERM, storeId);

  const { data, error } = await supabase
    .from('category_attributes')
    .update(patch as never)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw Errors.internal('Falha ao atualizar vínculo', { error: error.message });
  return data;
}

export async function remove(supabase: SbClient, userId: string, id: string) {
  const { data: current, error: ce } = await supabase
    .from('category_attributes')
    .select('category_id')
    .eq('id', id)
    .maybeSingle();
  if (ce) throw Errors.internal('Falha ao buscar vínculo', { error: ce.message });
  if (!current) throw Errors.notFound('Vínculo', id);

  const storeId = await getCategoryStoreId(supabase, current.category_id);
  await requirePermission(supabase, userId, WRITE_PERM, storeId);

  const { error } = await supabase.from('category_attributes').delete().eq('id', id);
  if (error) throw Errors.internal('Falha ao remover vínculo', { error: error.message });
  return { ok: true, id };
}
