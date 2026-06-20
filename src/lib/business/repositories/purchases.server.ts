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
