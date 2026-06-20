/**
 * Service: Attribute Values — parent-scoped por attribute_id.
 * O escopo de loja é herdado do atributo pai.
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { requirePermission, isSuperAdmin, hasPermission, requireStoreAccess } from './permissions.server';

const WRITE_PERM = 'products.update';
const READ_PERM = 'products.read';

async function getAttributeStoreId(supabase: SbClient, attributeId: string): Promise<string> {
  const { data, error } = await supabase
    .from('attributes')
    .select('store_id')
    .eq('id', attributeId)
    .maybeSingle();
  if (error) throw Errors.internal('Falha ao buscar atributo', { error: error.message });
  if (!data) throw Errors.notFound('Atributo', attributeId);
  return data.store_id;
}

export interface ListAttrValuesInput {
  attribute_id: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function list(supabase: SbClient, userId: string, input: ListAttrValuesInput) {
  if (!input.attribute_id) throw Errors.validation('attribute_id obrigatório');
  const storeId = await getAttributeStoreId(supabase, input.attribute_id);
  if (!(await isSuperAdmin(supabase, userId))) {
    await requireStoreAccess(supabase, userId, storeId);
    const ok = (await hasPermission(supabase, userId, READ_PERM, storeId))
      || (await hasPermission(supabase, userId, WRITE_PERM, storeId));
    if (!ok) throw Errors.forbidden('Permissão necessária: products.read');
  }

  const page = Math.max(1, input.page ?? 1);
  const size = Math.min(100, Math.max(1, input.pageSize ?? 50));
  const from = (page - 1) * size;
  const to = from + size - 1;

  let q = supabase
    .from('attribute_values')
    .select('*', { count: 'exact' })
    .eq('attribute_id', input.attribute_id);

  if (input.q?.trim()) {
    const safe = input.q.replace(/[%,]/g, '');
    q = q.or(`label.ilike.%${safe}%,code.ilike.%${safe}%`);
  }

  q = q.order('sort_order', { ascending: true }).order('label', { ascending: true }).range(from, to);
  const { data, error, count } = await q;
  if (error) throw Errors.internal('Falha ao listar valores', { error: error.message });
  return { rows: data ?? [], total: count ?? 0, page, pageSize: size };
}

export interface CreateAttrValueInput {
  attribute_id: string;
  code: string;
  label: string;
  sort_order?: number;
  is_active?: boolean;
  meta_json?: Record<string, unknown>;
}

export async function create(supabase: SbClient, userId: string, input: CreateAttrValueInput) {
  if (!input.attribute_id) throw Errors.validation('attribute_id obrigatório');
  if (!input.code?.trim()) throw Errors.validation('Código obrigatório');
  if (!input.label?.trim()) throw Errors.validation('Rótulo obrigatório');

  const storeId = await getAttributeStoreId(supabase, input.attribute_id);
  await requirePermission(supabase, userId, WRITE_PERM, storeId);

  const { data, error } = await supabase
    .from('attribute_values')
    .insert({
      attribute_id: input.attribute_id,
      code: input.code.trim(),
      label: input.label.trim(),
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
      meta_json: (input.meta_json ?? {}) as never,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') throw Errors.conflict('Código duplicado para este atributo');
    throw Errors.internal('Falha ao criar valor', { error: error.message });
  }
  return data;
}

export type UpdateAttrValueInput = Partial<Omit<CreateAttrValueInput, 'attribute_id'>>;

export async function update(
  supabase: SbClient,
  userId: string,
  id: string,
  patch: UpdateAttrValueInput,
) {
  const { data: current, error: ce } = await supabase
    .from('attribute_values')
    .select('attribute_id')
    .eq('id', id)
    .maybeSingle();
  if (ce) throw Errors.internal('Falha ao buscar valor', { error: ce.message });
  if (!current) throw Errors.notFound('Valor de atributo', id);

  const storeId = await getAttributeStoreId(supabase, current.attribute_id);
  await requirePermission(supabase, userId, WRITE_PERM, storeId);

  const { data, error } = await supabase
    .from('attribute_values')
    .update(patch as never)
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') throw Errors.conflict('Código duplicado para este atributo');
    throw Errors.internal('Falha ao atualizar valor', { error: error.message });
  }
  return data;
}

export async function remove(supabase: SbClient, userId: string, id: string) {
  const { data: current, error: ce } = await supabase
    .from('attribute_values')
    .select('attribute_id')
    .eq('id', id)
    .maybeSingle();
  if (ce) throw Errors.internal('Falha ao buscar valor', { error: ce.message });
  if (!current) throw Errors.notFound('Valor de atributo', id);

  const storeId = await getAttributeStoreId(supabase, current.attribute_id);
  await requirePermission(supabase, userId, WRITE_PERM, storeId);

  const { error } = await supabase.from('attribute_values').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') throw Errors.conflict('Valor está em uso e não pode ser removido');
    throw Errors.internal('Falha ao remover valor', { error: error.message });
  }
  return { ok: true, id };
}
