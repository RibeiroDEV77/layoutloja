/**
 * Repository: Purchase Orders e Goods Receipts.
 */
import type { SbClient } from '../events/dispatcher.server';
import type { Database } from '@/integrations/supabase/types';
import { Errors } from '../errors';

export type POrow = Database['public']['Tables']['purchase_orders']['Row'];
export type POinsert = Database['public']['Tables']['purchase_orders']['Insert'];
export type POupdate = Database['public']['Tables']['purchase_orders']['Update'];
export type POitemRow = Database['public']['Tables']['purchase_order_items']['Row'];
export type POitemInsert = Database['public']['Tables']['purchase_order_items']['Insert'];
export type GRinsert = Database['public']['Tables']['goods_receipts']['Insert'];
export type GRitemInsert = Database['public']['Tables']['goods_receipt_items']['Insert'];

export async function findPO(supabase: SbClient, id: string): Promise<POrow | null> {
  const { data, error } = await supabase.from('purchase_orders').select('*').eq('id', id).maybeSingle();
  if (error) throw Errors.internal('Falha ao buscar ordem de compra', { error: error.message });
  return data;
}

export async function findPOItems(supabase: SbClient, poId: string): Promise<POitemRow[]> {
  const { data, error } = await supabase
    .from('purchase_order_items')
    .select('*')
    .eq('purchase_order_id', poId)
    .order('position', { ascending: true });
  if (error) throw Errors.internal('Falha ao buscar itens da OC', { error: error.message });
  return data ?? [];
}

export async function insertPO(supabase: SbClient, row: POinsert): Promise<POrow> {
  const { data, error } = await supabase.from('purchase_orders').insert(row).select('*').single();
  if (error) {
    if (error.code === '23505') throw Errors.conflict('Número de OC já utilizado');
    throw Errors.internal('Falha ao criar ordem de compra', { error: error.message });
  }
  return data;
}

export async function insertPOItems(supabase: SbClient, items: POitemInsert[]): Promise<POitemRow[]> {
  if (items.length === 0) return [];
  const { data, error } = await supabase.from('purchase_order_items').insert(items).select('*');
  if (error) throw Errors.internal('Falha ao criar itens da OC', { error: error.message });
  return data ?? [];
}

export async function updatePO(supabase: SbClient, id: string, patch: POupdate): Promise<POrow> {
  const { data, error } = await supabase.from('purchase_orders').update(patch).eq('id', id).select('*').single();
  if (error) throw Errors.internal('Falha ao atualizar OC', { error: error.message });
  return data;
}

export async function updatePOItem(
  supabase: SbClient,
  id: string,
  patch: Database['public']['Tables']['purchase_order_items']['Update'],
): Promise<POitemRow> {
  const { data, error } = await supabase.from('purchase_order_items').update(patch).eq('id', id).select('*').single();
  if (error) throw Errors.internal('Falha ao atualizar item da OC', { error: error.message });
  return data;
}

export async function insertGoodsReceipt(supabase: SbClient, row: GRinsert) {
  const { data, error } = await supabase.from('goods_receipts').insert(row).select('*').single();
  if (error) {
    if (error.code === '23505') throw Errors.conflict('Número de recebimento já utilizado');
    throw Errors.internal('Falha ao criar recebimento', { error: error.message });
  }
  return data;
}

export async function insertGoodsReceiptItems(supabase: SbClient, items: GRitemInsert[]) {
  if (items.length === 0) return [];
  const { data, error } = await supabase.from('goods_receipt_items').insert(items).select('*');
  if (error) throw Errors.internal('Falha ao registrar itens recebidos', { error: error.message });
  return data ?? [];
}

// =============================== Reads (Admin) ===============================

export interface POListFilters {
  store_id: string;
  q?: string;
  status?: string[];
  supplier_id?: string;
  page?: number;
  pageSize?: number;
}

export interface POListRow extends POrow {
  supplier_name: string | null;
  items_count: number;
}

export async function listAdmin(supabase: SbClient, f: POListFilters) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, f.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from('purchase_orders')
    .select('*, suppliers(legal_name, trade_name), purchase_order_items(id)', { count: 'exact' })
    .eq('store_id', f.store_id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (f.q) q = q.ilike('po_number', `%${f.q}%`);
  if (f.status?.length) q = q.in('status', f.status);
  if (f.supplier_id) q = q.eq('supplier_id', f.supplier_id);

  const { data, error, count } = await q;
  if (error) throw Errors.internal('Falha ao listar ordens de compra', { error: error.message });

  const rows: POListRow[] = (data ?? []).map((r: any) => ({
    ...r,
    supplier_name: r.suppliers?.trade_name ?? r.suppliers?.legal_name ?? null,
    items_count: Array.isArray(r.purchase_order_items) ? r.purchase_order_items.length : 0,
  }));

  return { rows, total: count ?? 0, page, pageSize };
}

export async function listReceipts(supabase: SbClient, poId: string) {
  const { data, error } = await supabase
    .from('goods_receipts')
    .select('*, goods_receipt_items(*)')
    .eq('purchase_order_id', poId)
    .order('received_at', { ascending: false });
  if (error) throw Errors.internal('Falha ao listar recebimentos', { error: error.message });
  return data ?? [];
}

export async function listAudit(supabase: SbClient, poId: string) {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, store_id, actor_user_id, entity_type, entity_id, action, diff, created_at')
    .eq('entity_type', 'purchase_order')
    .eq('entity_id', poId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw Errors.internal('Falha ao buscar auditoria', { error: error.message });
  return data ?? [];
}

export async function listTimeline(supabase: SbClient, poId: string) {
  const { data, error } = await supabase
    .from('domain_events')
    .select('id, event_type, aggregate_type, aggregate_id, payload, occurred_at')
    .eq('aggregate_type', 'purchase_order')
    .eq('aggregate_id', poId)
    .order('occurred_at', { ascending: false })
    .limit(200);
  if (error) throw Errors.internal('Falha ao buscar timeline', { error: error.message });
  return data ?? [];
}

export async function findSupplier(supabase: SbClient, id: string) {
  const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).maybeSingle();
  if (error) throw Errors.internal('Falha ao buscar fornecedor', { error: error.message });
  return data;
}
