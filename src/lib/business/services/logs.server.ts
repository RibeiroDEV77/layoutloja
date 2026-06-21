/**
 * Service: Logs — leitura de logs técnicos, outbox, DLQ e webhooks.
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { hasPermission, isSuperAdmin } from './permissions.server';

async function authorize(supabase: SbClient, userId: string) {
  if (await isSuperAdmin(supabase, userId)) return;
  if (await hasPermission(supabase, userId, 'system.logs.read')) return;
  throw Errors.forbidden('Permissão necessária: system.logs.read');
}

export interface ListLogsInput {
  store_id?: string;
  level?: string;
  source?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function listSystemLogs(supabase: SbClient, userId: string, input: ListLogsInput) {
  await authorize(supabase, userId);
  const page = Math.max(1, input.page ?? 1);
  const size = Math.min(200, Math.max(1, input.pageSize ?? 50));
  const from = (page - 1) * size;
  const to = from + size - 1;

  let q = supabase.from('system_logs').select('*', { count: 'exact' });
  if (input.store_id) q = q.eq('store_id', input.store_id);
  if (input.level) q = q.eq('level', input.level);
  if (input.source) q = q.eq('source', input.source);
  if (input.q?.trim()) q = q.ilike('message', `%${input.q.replace(/[%,]/g, '')}%`);
  q = q.order('created_at', { ascending: false }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw Errors.internal('Falha ao listar logs', { error: error.message });
  return { rows: data ?? [], total: count ?? 0, page, pageSize: size };
}

export async function listOutbox(supabase: SbClient, userId: string, input: { status?: string; page?: number; pageSize?: number }) {
  await authorize(supabase, userId);
  const page = Math.max(1, input.page ?? 1);
  const size = Math.min(200, Math.max(1, input.pageSize ?? 50));
  const from = (page - 1) * size;
  const to = from + size - 1;

  let q = supabase.from('event_outbox').select('*', { count: 'exact' });
  if (input.status) q = q.eq('status', input.status as never);
  q = q.order('created_at', { ascending: false }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw Errors.internal('Falha ao listar outbox', { error: error.message });
  return { rows: data ?? [], total: count ?? 0, page, pageSize: size };
}

export async function listOutboxDLQ(supabase: SbClient, userId: string, input: { page?: number; pageSize?: number }) {
  await authorize(supabase, userId);
  const page = Math.max(1, input.page ?? 1);
  const size = Math.min(200, Math.max(1, input.pageSize ?? 50));
  const from = (page - 1) * size;
  const to = from + size - 1;

  const { data, error, count } = await supabase
    .from('event_outbox_dead_letter')
    .select('*', { count: 'exact' })
    .order('failed_at', { ascending: false })
    .range(from, to);
  if (error) throw Errors.internal('Falha ao listar DLQ', { error: error.message });
  return { rows: data ?? [], total: count ?? 0, page, pageSize: size };
}

export async function retryOutboxEvent(supabase: SbClient, userId: string, id: string) {
  await authorize(supabase, userId);
  const { error } = await supabase
    .from('event_outbox')
    .update({ status: 'pending' as never, available_at: new Date().toISOString(), locked_by: null, locked_until: null })
    .eq('id', id);
  if (error) throw Errors.internal('Falha ao reagendar evento', { error: error.message });
  await supabase.from('audit_log').insert({
    actor_user_id: userId, entity_type: 'event_outbox', entity_id: id, action: 'outbox.retry', diff: {} as never,
  });
  return { ok: true };
}

export async function discardOutboxEvent(supabase: SbClient, userId: string, id: string) {
  await authorize(supabase, userId);
  const { error } = await supabase.from('event_outbox').delete().eq('id', id);
  if (error) throw Errors.internal('Falha ao descartar evento', { error: error.message });
  await supabase.from('audit_log').insert({
    actor_user_id: userId, entity_type: 'event_outbox', entity_id: id, action: 'outbox.discard', diff: {} as never,
  });
  return { ok: true };
}

export async function reprocessDLQ(supabase: SbClient, userId: string, id: string) {
  await authorize(supabase, userId);
  const { data: dlq, error: e1 } = await supabase.from('event_outbox_dead_letter').select('*').eq('id', id).single();
  if (e1 || !dlq) throw Errors.notFound('DLQ', id);

  const { error: e2 } = await supabase.from('event_outbox').insert({
    store_id: dlq.store_id,
    aggregate_type: dlq.aggregate_type,
    aggregate_id: dlq.aggregate_id,
    event_type: dlq.event_type,
    payload: dlq.payload,
    metadata: dlq.metadata,
    status: 'pending' as never,
    attempts: 0,
  });
  if (e2) throw Errors.internal('Falha ao reagendar do DLQ', { error: e2.message });

  await supabase.from('event_outbox_dead_letter').update({
    reprocessed_at: new Date().toISOString(), reprocessed_by: userId,
  }).eq('id', id);

  await supabase.from('audit_log').insert({
    actor_user_id: userId, entity_type: 'event_outbox_dead_letter', entity_id: id, action: 'dlq.reprocess', diff: {} as never,
  });
  return { ok: true };
}
