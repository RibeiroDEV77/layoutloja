/**
 * Service: Audit — leitura paginada da timeline com filtros.
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { hasPermission, isSuperAdmin, requireStoreAccess } from './permissions.server';

export interface ListAuditInput {
  store_id?: string;
  q?: string;
  entity_type?: string;
  action?: string;
  actor_user_id?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

async function authorize(supabase: SbClient, userId: string, storeId?: string) {
  if (await isSuperAdmin(supabase, userId)) return;
  if (storeId) {
    await requireStoreAccess(supabase, userId, storeId);
    if (!(await hasPermission(supabase, userId, 'audit.read', storeId))) {
      throw Errors.forbidden('Permissão necessária: audit.read');
    }
  } else {
    throw Errors.forbidden('Loja obrigatória para visualizar auditoria');
  }
}

export async function listAudit(supabase: SbClient, userId: string, input: ListAuditInput) {
  await authorize(supabase, userId, input.store_id);

  const page = Math.max(1, input.page ?? 1);
  const size = Math.min(200, Math.max(1, input.pageSize ?? 50));
  const from = (page - 1) * size;
  const to = from + size - 1;

  let q = supabase.from('audit_log').select('id,store_id,actor_user_id,entity_type,entity_id,action,diff,user_agent,created_at', { count: 'exact' });
  if (input.store_id) q = q.eq('store_id', input.store_id);
  if (input.entity_type) q = q.eq('entity_type', input.entity_type);
  if (input.action) q = q.eq('action', input.action);
  if (input.actor_user_id) q = q.eq('actor_user_id', input.actor_user_id);
  if (input.from) q = q.gte('created_at', input.from);
  if (input.to) q = q.lte('created_at', input.to);
  q = q.order('created_at', { ascending: false }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw Errors.internal('Falha ao listar auditoria', { error: error.message });
  return { rows: data ?? [], total: count ?? 0, page, pageSize: size };
}

export async function exportAuditCsv(supabase: SbClient, userId: string, input: Omit<ListAuditInput, 'page' | 'pageSize'>) {
  await authorize(supabase, userId, input.store_id);

  let q = supabase.from('audit_log').select('*');
  if (input.store_id) q = q.eq('store_id', input.store_id);
  if (input.entity_type) q = q.eq('entity_type', input.entity_type);
  if (input.action) q = q.eq('action', input.action);
  if (input.actor_user_id) q = q.eq('actor_user_id', input.actor_user_id);
  if (input.from) q = q.gte('created_at', input.from);
  if (input.to) q = q.lte('created_at', input.to);
  q = q.order('created_at', { ascending: false }).limit(5000);

  const { data, error } = await q;
  if (error) throw Errors.internal('Falha ao exportar auditoria', { error: error.message });

  const head = 'created_at,actor_user_id,entity_type,entity_id,action,store_id,diff';
  const escape = (v: unknown) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = (data ?? []).map((r) =>
    [r.created_at, r.actor_user_id, r.entity_type, r.entity_id, r.action, r.store_id, r.diff].map(escape).join(','),
  );
  return { csv: [head, ...rows].join('\n'), count: rows.length };
}
