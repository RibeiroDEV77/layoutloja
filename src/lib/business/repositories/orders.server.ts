/**
 * Repository: Orders — acesso baixo nível ao banco.
 * Desacoplado da camada de negócio. Apenas SQL/Supabase queries.
 */
import type { SbClient } from '../events/dispatcher.server';
import type { Database } from '@/integrations/supabase/types';
import { Errors } from '../errors';

export type OrderRow = Database['public']['Tables']['orders']['Row'];
export type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
export type OrderPaymentRow = Database['public']['Tables']['order_payments']['Row'];
export type OrderFulfillmentRow = Database['public']['Tables']['order_fulfillments']['Row'];
export type OrderShipmentRow = Database['public']['Tables']['order_shipments']['Row'];
export type OrderHoldRow = Database['public']['Tables']['order_holds']['Row'];
export type OrderNoteRow = Database['public']['Tables']['order_notes']['Row'];
export type OrderAuditRow = Database['public']['Tables']['order_audit']['Row'];
export type OrderAssignmentRow = Database['public']['Tables']['order_assignments']['Row'];

export interface OrderAdminListRow {
  id: string;
  store_id: string;
  order_number: string;
  status: string;
  channel: string;
  currency: string;
  total: number;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  tax_total: number;
  items_count: number;
  tags: string[];
  placed_at: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  payments_count: number;
  paid_amount: number;
  refunded_amount: number;
  fulfillments_count: number;
  shipments_count: number;
  active_holds_count: number;
  assigned_user_id: string | null;
}

export interface ListFilters {
  store_id: string;
  q?: string;
  status?: string[];
  channel?: string;
  customer_id?: string;
  tags?: string[];
  date_from?: string;
  date_to?: string;
  has_active_hold?: boolean;
  assigned_user_id?: string;
  page?: number;
  pageSize?: number;
  sort?: 'created_at' | 'placed_at' | 'total' | 'order_number';
  sort_dir?: 'asc' | 'desc';
}

export async function listAdmin(supabase: SbClient, filters: ListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const size = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const from = (page - 1) * size;
  const to = from + size - 1;
  const sort = filters.sort ?? 'created_at';
  const dir = (filters.sort_dir ?? 'desc') === 'asc';

  let q = supabase
    .from('order_admin_list_v')
    .select('*', { count: 'exact' })
    .eq('store_id', filters.store_id);

  if (filters.status?.length) q = q.in('status', filters.status);
  if (filters.channel) q = q.eq('channel', filters.channel);
  if (filters.customer_id) q = q.eq('customer_id', filters.customer_id);
  if (filters.date_from) q = q.gte('created_at', filters.date_from);
  if (filters.date_to) q = q.lte('created_at', filters.date_to);
  if (filters.has_active_hold) q = q.gt('active_holds_count', 0);
  if (filters.assigned_user_id) q = q.eq('assigned_user_id', filters.assigned_user_id);
  if (filters.tags?.length) q = q.contains('tags', filters.tags);
  if (filters.q?.trim()) {
    const safe = filters.q.replace(/[%,]/g, '');
    // Busca por order_number ou via orders_search (fallback simples)
    q = q.or(
      `order_number.ilike.%${safe}%,customer_name.ilike.%${safe}%,customer_email.ilike.%${safe}%,customer_phone.ilike.%${safe}%`,
    );
  }

  q = q.order(sort, { ascending: dir }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw Errors.internal('Falha ao listar pedidos', { error: error.message });
  return { rows: (data ?? []) as OrderAdminListRow[], total: count ?? 0, page, pageSize: size };
}

export async function findById(supabase: SbClient, id: string): Promise<OrderRow | null> {
  const { data, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
  if (error) throw Errors.internal('Falha ao buscar pedido', { error: error.message });
  return data;
}

export async function findAdminById(supabase: SbClient, id: string) {
  const { data, error } = await supabase
    .from('order_admin_list_v')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw Errors.internal('Falha ao buscar pedido', { error: error.message });
  return data as OrderAdminListRow | null;
}

export async function listItems(supabase: SbClient, orderId: string) {
  const { data, error } = await supabase
    .from('order_items').select('*').eq('order_id', orderId)
    .order('created_at', { ascending: true });
  if (error) throw Errors.internal('Falha ao listar itens', { error: error.message });
  return (data ?? []) as OrderItemRow[];
}

export async function listPayments(supabase: SbClient, orderId: string) {
  const { data, error } = await supabase
    .from('order_payments').select('*').eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) throw Errors.internal('Falha ao listar pagamentos', { error: error.message });
  return (data ?? []) as OrderPaymentRow[];
}

export async function listFulfillments(supabase: SbClient, orderId: string) {
  const { data, error } = await supabase
    .from('order_fulfillments').select('*').eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) throw Errors.internal('Falha ao listar fulfillments', { error: error.message });
  return (data ?? []) as OrderFulfillmentRow[];
}

export async function listShipments(supabase: SbClient, orderId: string) {
  const { data, error } = await supabase
    .from('order_shipments').select('*').eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) throw Errors.internal('Falha ao listar shipments', { error: error.message });
  return (data ?? []) as OrderShipmentRow[];
}

export async function listHolds(supabase: SbClient, orderId: string) {
  const { data, error } = await supabase
    .from('order_holds').select('*').eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) throw Errors.internal('Falha ao listar holds', { error: error.message });
  return (data ?? []) as OrderHoldRow[];
}

export async function listNotes(supabase: SbClient, orderId: string) {
  const { data, error } = await supabase
    .from('order_notes').select('*').eq('order_id', orderId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw Errors.internal('Falha ao listar notas', { error: error.message });
  return (data ?? []) as OrderNoteRow[];
}

export async function listAudit(supabase: SbClient, orderId: string, limit = 200) {
  const { data, error } = await supabase
    .from('order_audit').select('*').eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw Errors.internal('Falha ao listar auditoria', { error: error.message });
  return (data ?? []) as OrderAuditRow[];
}

export interface UnifiedTimelineEntry {
  id: string;
  order_id: string;
  store_id: string;
  source: 'order' | 'payment' | 'fulfillment' | 'tracking' | 'fiscal';
  event_type: string;
  title: string | null;
  payload: Record<string, unknown> | null;
  actor_user_id: string | null;
  created_at: string;
}

export async function listUnifiedTimeline(supabase: SbClient, orderId: string, limit = 300) {
  const { data, error } = await supabase
    .from('order_timeline_unified_v')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw Errors.internal('Falha ao carregar timeline', { error: error.message });
  return (data ?? []) as unknown as UnifiedTimelineEntry[];
}

export async function listAssignments(supabase: SbClient, orderId: string) {
  const { data, error } = await supabase
    .from('order_assignments').select('*').eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) throw Errors.internal('Falha ao listar atribuições', { error: error.message });
  return (data ?? []) as OrderAssignmentRow[];
}
