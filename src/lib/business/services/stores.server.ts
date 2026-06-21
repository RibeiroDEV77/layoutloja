/**
 * Service: Stores — gestão de lojas (escopo global; somente super_admin pode criar/excluir).
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { isSuperAdmin } from './permissions.server';

async function audit(supabase: SbClient, userId: string, storeId: string | null, action: string, entityId: string | null, diff?: Record<string, unknown>) {
  await supabase.from('audit_log').insert({
    store_id: storeId,
    actor_user_id: userId,
    entity_type: 'store',
    entity_id: entityId,
    action,
    diff: (diff ?? {}) as never,
  });
}

export interface ListStoresInput {
  q?: string;
  page?: number;
  pageSize?: number;
  include_deleted?: boolean;
}

export async function listStores(supabase: SbClient, userId: string, input: ListStoresInput) {
  const page = Math.max(1, input.page ?? 1);
  const size = Math.min(100, Math.max(1, input.pageSize ?? 25));
  const from = (page - 1) * size;
  const to = from + size - 1;

  let q = supabase.from('stores').select('*', { count: 'exact' });
  if (!input.include_deleted) q = q.is('deleted_at', null);
  if (input.q?.trim()) {
    const safe = input.q.replace(/[%,]/g, '');
    q = q.or(`name.ilike.%${safe}%,slug.ilike.%${safe}%,legal_name.ilike.%${safe}%,cnpj.ilike.%${safe}%`);
  }
  q = q.order('name', { ascending: true }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw Errors.internal('Falha ao listar lojas', { error: error.message });
  void userId;
  return { rows: data ?? [], total: count ?? 0, page, pageSize: size };
}

export interface CreateStoreInput {
  name: string;
  slug: string;
  legal_name?: string;
  cnpj?: string;
  default_currency?: string;
  timezone?: string;
  logo_url?: string;
}

export async function createStore(supabase: SbClient, userId: string, input: CreateStoreInput) {
  if (!(await isSuperAdmin(supabase, userId))) {
    throw Errors.forbidden('Apenas super administradores podem criar lojas');
  }
  if (!input.name?.trim()) throw Errors.validation('Nome obrigatório');
  if (!input.slug?.trim()) throw Errors.validation('Slug obrigatório');

  const { data, error } = await supabase.from('stores').insert({
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase(),
    legal_name: input.legal_name?.trim() || null,
    cnpj: input.cnpj?.trim() || null,
    default_currency: input.default_currency ?? 'BRL',
    timezone: input.timezone ?? 'America/Sao_Paulo',
    logo_url: input.logo_url?.trim() || null,
    status: 'active',
  }).select().single();
  if (error) throw Errors.internal('Falha ao criar loja', { error: error.message });

  await audit(supabase, userId, data.id, 'store.created', data.id, { name: data.name, slug: data.slug });
  return data;
}

export type UpdateStoreInput = Partial<CreateStoreInput> & { status?: string };

export async function updateStore(supabase: SbClient, userId: string, id: string, patch: UpdateStoreInput) {
  if (!(await isSuperAdmin(supabase, userId))) {
    throw Errors.forbidden('Apenas super administradores podem editar lojas');
  }
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    clean[k] = typeof v === 'string' ? v.trim() || null : v;
  }
  const { data, error } = await supabase.from('stores').update(clean as never).eq('id', id).select().single();
  if (error) throw Errors.internal('Falha ao atualizar loja', { error: error.message });
  await audit(supabase, userId, id, 'store.updated', id, { changed: Object.keys(clean) });
  return data;
}

export async function archiveStore(supabase: SbClient, userId: string, id: string) {
  if (!(await isSuperAdmin(supabase, userId))) {
    throw Errors.forbidden('Apenas super administradores podem arquivar lojas');
  }
  const { error } = await supabase.from('stores').update({
    deleted_at: new Date().toISOString(),
    status: 'archived',
  }).eq('id', id);
  if (error) throw Errors.internal('Falha ao arquivar loja', { error: error.message });
  await audit(supabase, userId, id, 'store.archived', id);
  return { ok: true, id };
}

// ===== Settings =====
export async function listStoreSettings(supabase: SbClient, _userId: string, storeId: string) {
  const { data, error } = await supabase.from('store_settings').select('*').eq('store_id', storeId).order('key');
  if (error) throw Errors.internal('Falha ao listar configurações', { error: error.message });
  void _userId;
  return data ?? [];
}

export async function upsertStoreSetting(supabase: SbClient, userId: string, storeId: string, key: string, value: unknown) {
  if (!(await isSuperAdmin(supabase, userId))) {
    throw Errors.forbidden('Apenas super administradores podem alterar configurações');
  }
  const { data, error } = await supabase.from('store_settings').upsert(
    { store_id: storeId, key, value: value as never },
    { onConflict: 'store_id,key' },
  ).select().single();
  if (error) throw Errors.internal('Falha ao salvar configuração', { error: error.message });
  await audit(supabase, userId, storeId, 'store.setting_updated', storeId, { key });
  return data;
}
