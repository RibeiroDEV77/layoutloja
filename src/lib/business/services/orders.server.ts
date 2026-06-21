/**
 * Service: Orders (Admin) — Fase 6.1 Etapa 2.
 *
 * Toda mutação consome RPCs SECURITY DEFINER já existentes
 * (order_cancel, order_add_note, order_add_tag, order_remove_tag,
 *  order_assign_user, payment_refund_request, etc).
 *
 * Leituras passam pelo Repository (order_admin_list_v / order_timeline_unified_v).
 *
 * RBAC: usa permissions.server.ts (orders.read / orders.write / orders.cancel).
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { hasPermission, isSuperAdmin, requirePermission, requireStoreAccess } from './permissions.server';
import * as Repo from '../repositories/orders.server';
import { recordMetric } from '@/lib/foundations/observability.functions';

async function ensureRead(supabase: SbClient, userId: string, storeId: string) {
  if (await isSuperAdmin(supabase, userId)) return;
  await requireStoreAccess(supabase, userId, storeId);
  if (!(await hasPermission(supabase, userId, 'orders.read', storeId))) {
    throw Errors.forbidden('Permissão necessária: orders.read');
  }
}

async function ensureWrite(supabase: SbClient, userId: string, storeId: string) {
  if (await isSuperAdmin(supabase, userId)) return;
  await requirePermission(supabase, userId, 'orders.write', storeId);
}

// -------- List --------
export interface ListInput extends Repo.ListFilters {}

export async function list(supabase: SbClient, userId: string, input: ListInput) {
  if (!input.store_id) throw Errors.validation('store_id obrigatório');
  await ensureRead(supabase, userId, input.store_id);
  const result = await Repo.listAdmin(supabase, input);
  recordMetric(supabase, { scope: 'orders', name: 'admin.list', value: result.total, storeId: input.store_id }).catch(() => {});
  return result;
}

// -------- Detail --------
export async function get(supabase: SbClient, userId: string, id: string) {
  const order = await Repo.findById(supabase, id);
  if (!order) throw Errors.notFound('Pedido', id);
  await ensureRead(supabase, userId, order.store_id);

  const [summary, items, payments, fulfillments, shipments, holds, notes, assignments] = await Promise.all([
    Repo.findAdminById(supabase, id),
    Repo.listItems(supabase, id),
    Repo.listPayments(supabase, id),
    Repo.listFulfillments(supabase, id),
    Repo.listShipments(supabase, id),
    Repo.listHolds(supabase, id),
    Repo.listNotes(supabase, id),
    Repo.listAssignments(supabase, id),
  ]);

  return { order, summary, items, payments, fulfillments, shipments, holds, notes, assignments };
}

export async function timeline(supabase: SbClient, userId: string, id: string) {
  const order = await Repo.findById(supabase, id);
  if (!order) throw Errors.notFound('Pedido', id);
  await ensureRead(supabase, userId, order.store_id);
  return Repo.listUnifiedTimeline(supabase, id);
}

export async function audit(supabase: SbClient, userId: string, id: string) {
  const order = await Repo.findById(supabase, id);
  if (!order) throw Errors.notFound('Pedido', id);
  await ensureRead(supabase, userId, order.store_id);
  return Repo.listAudit(supabase, id);
}

// -------- Actions (RPC-backed) --------

export async function addNote(
  supabase: SbClient,
  userId: string,
  input: { order_id: string; body: string; visibility?: 'internal' | 'public'; pinned?: boolean },
) {
  const order = await Repo.findById(supabase, input.order_id);
  if (!order) throw Errors.notFound('Pedido', input.order_id);
  await ensureWrite(supabase, userId, order.store_id);
  const { data, error } = await supabase.rpc('order_add_note', {
    _order_id: input.order_id,
    _body: input.body,
    _visibility: input.visibility ?? 'internal',
    _pinned: input.pinned ?? false,
  });
  if (error) throw Errors.internal('Falha ao adicionar nota', { error: error.message });
  return { id: data as unknown as string };
}

export async function addTag(supabase: SbClient, userId: string, input: { order_id: string; tag: string }) {
  const order = await Repo.findById(supabase, input.order_id);
  if (!order) throw Errors.notFound('Pedido', input.order_id);
  await ensureWrite(supabase, userId, order.store_id);
  const { error } = await supabase.rpc('order_add_tag', { _order_id: input.order_id, _tag: input.tag });
  if (error) throw Errors.internal('Falha ao adicionar tag', { error: error.message });
  return { ok: true };
}

export async function removeTag(supabase: SbClient, userId: string, input: { order_id: string; tag: string }) {
  const order = await Repo.findById(supabase, input.order_id);
  if (!order) throw Errors.notFound('Pedido', input.order_id);
  await ensureWrite(supabase, userId, order.store_id);
  const { error } = await supabase.rpc('order_remove_tag', { _order_id: input.order_id, _tag: input.tag });
  if (error) throw Errors.internal('Falha ao remover tag', { error: error.message });
  return { ok: true };
}

export async function assignUser(
  supabase: SbClient, userId: string,
  input: { order_id: string; user_id: string; role?: string },
) {
  const order = await Repo.findById(supabase, input.order_id);
  if (!order) throw Errors.notFound('Pedido', input.order_id);
  await ensureWrite(supabase, userId, order.store_id);
  const { data, error } = await supabase.rpc('order_assign_user', {
    _order_id: input.order_id, _user: input.user_id, _role: input.role ?? 'owner',
  });
  if (error) throw Errors.internal('Falha ao atribuir usuário', { error: error.message });
  return { id: data as unknown as string };
}

export async function cancel(
  supabase: SbClient, userId: string,
  input: { order_id: string; reason: string },
) {
  const order = await Repo.findById(supabase, input.order_id);
  if (!order) throw Errors.notFound('Pedido', input.order_id);
  if (!(await isSuperAdmin(supabase, userId))) {
    await requireStoreAccess(supabase, userId, order.store_id);
    const ok = (await hasPermission(supabase, userId, 'orders.cancel', order.store_id))
      || (await hasPermission(supabase, userId, 'orders.write', order.store_id));
    if (!ok) throw Errors.forbidden('Permissão necessária: orders.cancel');
  }
  const { error } = await supabase.rpc('order_cancel', { _order_id: input.order_id, _reason: input.reason });
  if (error) {
    if (error.message.includes('cannot cancel')) throw Errors.rule(error.message);
    throw Errors.internal('Falha ao cancelar pedido', { error: error.message });
  }
  recordMetric(supabase, { scope: 'orders', name: 'admin.cancel', value: 1, storeId: order.store_id }).catch(() => {});
  return { ok: true };
}

// -------- Bulk --------
export async function bulkCancel(
  supabase: SbClient, userId: string,
  input: { order_ids: string[]; reason: string },
) {
  if (!input.order_ids?.length) throw Errors.validation('Nenhum pedido selecionado');
  if (input.order_ids.length > 100) throw Errors.validation('Máximo 100 pedidos por operação');
  const results: { order_id: string; ok: boolean; error?: string }[] = [];
  for (const id of input.order_ids) {
    try {
      await cancel(supabase, userId, { order_id: id, reason: input.reason });
      results.push({ order_id: id, ok: true });
    } catch (err) {
      results.push({ order_id: id, ok: false, error: err instanceof Error ? err.message : 'erro' });
    }
  }
  return { results, ok_count: results.filter((r) => r.ok).length, fail_count: results.filter((r) => !r.ok).length };
}

export async function bulkAddTag(
  supabase: SbClient, userId: string,
  input: { order_ids: string[]; tag: string },
) {
  if (!input.order_ids?.length) throw Errors.validation('Nenhum pedido selecionado');
  if (input.order_ids.length > 200) throw Errors.validation('Máximo 200 pedidos por operação');
  const results: { order_id: string; ok: boolean; error?: string }[] = [];
  for (const id of input.order_ids) {
    try {
      await addTag(supabase, userId, { order_id: id, tag: input.tag });
      results.push({ order_id: id, ok: true });
    } catch (err) {
      results.push({ order_id: id, ok: false, error: err instanceof Error ? err.message : 'erro' });
    }
  }
  return { results, ok_count: results.filter((r) => r.ok).length, fail_count: results.filter((r) => !r.ok).length };
}
