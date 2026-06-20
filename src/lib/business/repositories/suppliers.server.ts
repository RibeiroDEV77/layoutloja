/**
 * Repository: Suppliers — apenas acesso ao banco.
 */
import type { SbClient } from '../events/dispatcher.server';
import type { Database } from '@/integrations/supabase/types';
import { Errors } from '../errors';

export type SupplierRow = Database['public']['Tables']['suppliers']['Row'];
export type SupplierInsert = Database['public']['Tables']['suppliers']['Insert'];
export type SupplierUpdate = Database['public']['Tables']['suppliers']['Update'];

export async function findById(supabase: SbClient, id: string): Promise<SupplierRow | null> {
  const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).maybeSingle();
  if (error) throw Errors.internal('Falha ao buscar fornecedor', { error: error.message });
  return data;
}

export async function insert(supabase: SbClient, row: SupplierInsert): Promise<SupplierRow> {
  const { data, error } = await supabase.from('suppliers').insert(row).select('*').single();
  if (error) {
    if (error.code === '23505') throw Errors.conflict('Fornecedor duplicado (código já existe)', { error: error.message });
    throw Errors.internal('Falha ao criar fornecedor', { error: error.message });
  }
  return data;
}

export async function update(supabase: SbClient, id: string, patch: SupplierUpdate): Promise<SupplierRow> {
  const { data, error } = await supabase.from('suppliers').update(patch).eq('id', id).select('*').single();
  if (error) throw Errors.internal('Falha ao atualizar fornecedor', { error: error.message });
  return data;
}

export async function remove(supabase: SbClient, id: string): Promise<void> {
  const { error } = await supabase.from('suppliers').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') throw Errors.conflict('Fornecedor possui compras vinculadas');
    throw Errors.internal('Falha ao remover fornecedor', { error: error.message });
  }
}

export async function countOpenPurchaseOrders(supabase: SbClient, supplierId: string): Promise<number> {
  const { count, error } = await supabase
    .from('purchase_orders')
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', supplierId)
    .in('status', ['draft', 'sent', 'confirmed', 'partially_received']);
  if (error) throw Errors.internal('Falha ao verificar compras abertas', { error: error.message });
  return count ?? 0;
}
