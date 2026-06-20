/**
 * Service: Cadastro Mestre (CRUD genérico) — store-scoped.
 *
 * Usado por entidades simples: categories, brands, collections, attributes,
 * customer_groups, price_lists. Cada controller fornece um MasterConfig
 * (tabela, permissão, colunas de busca, ordenação padrão).
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { requirePermission, requireStoreAccess, isSuperAdmin, hasPermission } from './permissions.server';

export interface MasterConfig {
  table: string;
  /** Permissão para escrita (create/update/delete). */
  permission: string;
  /** Permissão de leitura. Default: 'products.read'. */
  readPermission?: string;
  searchCols: string[];
  defaultSort: string;
  defaultSortDir?: 'asc' | 'desc';
}

export interface ListParams {
  store_id: string;
  q?: string;
  page?: number;
  pageSize?: number;
  filters?: Record<string, string | number | boolean | null | undefined>;
  sort?: { col: string; dir: 'asc' | 'desc' };
}

export interface ListResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

async function ensureRead(supabase: SbClient, userId: string, cfg: MasterConfig, storeId: string) {
  if (await isSuperAdmin(supabase, userId)) return;
  await requireStoreAccess(supabase, userId, storeId);
  const perm = cfg.readPermission ?? 'products.read';
  if (await hasPermission(supabase, userId, perm, storeId)) return;
  if (await hasPermission(supabase, userId, cfg.permission, storeId)) return;
  throw Errors.forbidden(`Permissão necessária: ${perm}`, { permission: perm, store_id: storeId });
}

export async function listGeneric<T = Record<string, unknown>>(
  supabase: SbClient,
  userId: string,
  cfg: MasterConfig,
  p: ListParams,
): Promise<ListResult<T>> {
  if (!p.store_id) throw Errors.validation('store_id obrigatório');
  await ensureRead(supabase, userId, cfg, p.store_id);

  const page = Math.max(1, p.page ?? 1);
  const size = Math.min(100, Math.max(1, p.pageSize ?? 25));
  const from = (page - 1) * size;
  const to = from + size - 1;

  let q = supabase
    .from(cfg.table as never)
    .select('*', { count: 'exact' })
    .eq('store_id', p.store_id);

  if (p.q && p.q.trim() && cfg.searchCols.length) {
    const safe = p.q.replace(/[%,]/g, '');
    const expr = cfg.searchCols.map((c) => `${c}.ilike.%${safe}%`).join(',');
    // @ts-expect-error supabase generic
    q = q.or(expr);
  }

  if (p.filters) {
    for (const [k, v] of Object.entries(p.filters)) {
      if (v === undefined || v === null || v === '') continue;
      // @ts-expect-error supabase generic
      q = q.eq(k, v);
    }
  }

  const sort = p.sort ?? { col: cfg.defaultSort, dir: cfg.defaultSortDir ?? 'asc' };
  // @ts-expect-error supabase generic
  q = q.order(sort.col, { ascending: sort.dir === 'asc' }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw Errors.internal(`Falha ao listar ${cfg.table}`, { error: error.message });
  return { rows: (data ?? []) as T[], total: count ?? 0, page, pageSize: size };
}

export async function createGeneric<T = Record<string, unknown>>(
  supabase: SbClient,
  userId: string,
  cfg: MasterConfig,
  payload: Record<string, unknown> & { store_id?: string },
): Promise<T> {
  const storeId = payload.store_id;
  if (!storeId) throw Errors.validation('store_id obrigatório');
  await requirePermission(supabase, userId, cfg.permission, storeId);

  const { data, error } = await supabase
    .from(cfg.table as never)
    .insert(payload as never)
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') throw Errors.conflict('Registro duplicado', { error: error.message });
    if (error.code === '23503') throw Errors.validation('Referência inválida', { error: error.message });
    throw Errors.internal(`Falha ao criar em ${cfg.table}`, { error: error.message });
  }
  return data as T;
}

export async function updateGeneric<T = Record<string, unknown>>(
  supabase: SbClient,
  userId: string,
  cfg: MasterConfig,
  id: string,
  patch: Record<string, unknown>,
): Promise<T> {
  const { data: current, error: ce } = await supabase
    .from(cfg.table as never)
    .select('store_id')
    .eq('id', id)
    .maybeSingle();
  if (ce) throw Errors.internal(`Falha ao buscar ${cfg.table}`, { error: ce.message });
  if (!current) throw Errors.notFound(cfg.table, id);
  const storeId = (current as { store_id: string }).store_id;
  await requirePermission(supabase, userId, cfg.permission, storeId);

  // store_id é imutável
  const { store_id: _ignored, ...safePatch } = patch;
  void _ignored;

  const { data, error } = await supabase
    .from(cfg.table as never)
    .update(safePatch as never)
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') throw Errors.conflict('Registro duplicado', { error: error.message });
    throw Errors.internal(`Falha ao atualizar ${cfg.table}`, { error: error.message });
  }
  return data as T;
}

export async function deleteGeneric(
  supabase: SbClient,
  userId: string,
  cfg: MasterConfig,
  id: string,
): Promise<{ ok: true; id: string }> {
  const { data: current, error: ce } = await supabase
    .from(cfg.table as never)
    .select('store_id')
    .eq('id', id)
    .maybeSingle();
  if (ce) throw Errors.internal(`Falha ao buscar ${cfg.table}`, { error: ce.message });
  if (!current) throw Errors.notFound(cfg.table, id);
  const storeId = (current as { store_id: string }).store_id;
  await requirePermission(supabase, userId, cfg.permission, storeId);

  const { error } = await supabase.from(cfg.table as never).delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      throw Errors.conflict('Registro possui vínculos e não pode ser removido', { error: error.message });
    }
    throw Errors.internal(`Falha ao remover de ${cfg.table}`, { error: error.message });
  }
  return { ok: true, id };
}
