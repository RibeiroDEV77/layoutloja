/**
 * Repository: Inventory — stock levels, movements, counts, transfers.
 */
import type { SbClient } from '../events/dispatcher.server';
import type { Database } from '@/integrations/supabase/types';
import { Errors } from '../errors';

export type StockLevelRow = Database['public']['Tables']['stock_levels']['Row'];
export type StockMovementInsert = Database['public']['Tables']['stock_movements']['Insert'];
export type StockTransferInsert = Database['public']['Tables']['stock_transfers']['Insert'];
export type StockTransferItemInsert = Database['public']['Tables']['stock_transfer_items']['Insert'];
export type InventoryCountInsert = Database['public']['Tables']['inventory_counts']['Insert'];
export type InventoryCountItemRow = Database['public']['Tables']['inventory_count_items']['Row'];

export async function getStockLevel(
  supabase: SbClient,
  warehouseId: string,
  variantId: string,
): Promise<StockLevelRow | null> {
  const { data, error } = await supabase
    .from('stock_levels')
    .select('*')
    .eq('warehouse_id', warehouseId)
    .eq('variant_id', variantId)
    .maybeSingle();
  if (error) throw Errors.internal('Falha ao buscar nível de estoque', { error: error.message });
  return data;
}

/**
 * Upsert atômico aplicando delta. Usa o constraint UNIQUE(warehouse_id, variant_id).
 * Quando a linha não existe, cria com o quantity_on_hand inicial.
 */
export async function applyStockDelta(
  supabase: SbClient,
  args: {
    storeId: string;
    warehouseId: string;
    variantId: string;
    delta: number;
  },
): Promise<StockLevelRow> {
  const existing = await getStockLevel(supabase, args.warehouseId, args.variantId);

  if (existing) {
    const newQty = Number(existing.quantity_on_hand) + args.delta;
    if (newQty < 0) {
      throw Errors.rule('Estoque insuficiente', {
        warehouse_id: args.warehouseId,
        variant_id: args.variantId,
        current: existing.quantity_on_hand,
        delta: args.delta,
      });
    }
    const { data, error } = await supabase
      .from('stock_levels')
      .update({ quantity_on_hand: newQty, last_movement_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw Errors.internal('Falha ao atualizar nível de estoque', { error: error.message });
    return data;
  }

  if (args.delta < 0) {
    throw Errors.rule('Estoque insuficiente (nível inexistente)', args);
  }

  const { data, error } = await supabase
    .from('stock_levels')
    .insert({
      store_id: args.storeId,
      warehouse_id: args.warehouseId,
      variant_id: args.variantId,
      quantity_on_hand: args.delta,
      last_movement_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw Errors.internal('Falha ao criar nível de estoque', { error: error.message });
  return data;
}

export async function insertMovement(supabase: SbClient, row: StockMovementInsert) {
  const { data, error } = await supabase.from('stock_movements').insert(row).select('*').single();
  if (error) throw Errors.internal('Falha ao registrar movimentação', { error: error.message });
  return data;
}

export async function insertCostHistory(
  supabase: SbClient,
  row: Database['public']['Tables']['cost_history']['Insert'],
) {
  const { data, error } = await supabase.from('cost_history').insert(row).select('*').single();
  if (error) throw Errors.internal('Falha ao registrar custo', { error: error.message });
  return data;
}

export async function insertTransfer(supabase: SbClient, row: StockTransferInsert) {
  const { data, error } = await supabase.from('stock_transfers').insert(row).select('*').single();
  if (error) {
    if (error.code === '23505') throw Errors.conflict('Número de transferência já utilizado');
    throw Errors.internal('Falha ao criar transferência', { error: error.message });
  }
  return data;
}

export async function insertTransferItems(supabase: SbClient, items: StockTransferItemInsert[]) {
  if (items.length === 0) return [];
  const { data, error } = await supabase.from('stock_transfer_items').insert(items).select('*');
  if (error) throw Errors.internal('Falha ao registrar itens da transferência', { error: error.message });
  return data ?? [];
}

export async function findTransfer(supabase: SbClient, id: string) {
  const { data, error } = await supabase.from('stock_transfers').select('*').eq('id', id).maybeSingle();
  if (error) throw Errors.internal('Falha ao buscar transferência', { error: error.message });
  return data;
}

export async function updateTransfer(
  supabase: SbClient,
  id: string,
  patch: Database['public']['Tables']['stock_transfers']['Update'],
) {
  const { data, error } = await supabase.from('stock_transfers').update(patch).eq('id', id).select('*').single();
  if (error) throw Errors.internal('Falha ao atualizar transferência', { error: error.message });
  return data;
}

export async function insertCount(supabase: SbClient, row: InventoryCountInsert) {
  const { data, error } = await supabase.from('inventory_counts').insert(row).select('*').single();
  if (error) {
    if (error.code === '23505') throw Errors.conflict('Número de inventário já utilizado');
    throw Errors.internal('Falha ao criar inventário', { error: error.message });
  }
  return data;
}

export async function findCount(supabase: SbClient, id: string) {
  const { data, error } = await supabase.from('inventory_counts').select('*').eq('id', id).maybeSingle();
  if (error) throw Errors.internal('Falha ao buscar inventário', { error: error.message });
  return data;
}

export async function findCountItems(supabase: SbClient, countId: string): Promise<InventoryCountItemRow[]> {
  const { data, error } = await supabase
    .from('inventory_count_items')
    .select('*')
    .eq('inventory_count_id', countId);
  if (error) throw Errors.internal('Falha ao buscar itens do inventário', { error: error.message });
  return data ?? [];
}

export async function updateCount(
  supabase: SbClient,
  id: string,
  patch: Database['public']['Tables']['inventory_counts']['Update'],
) {
  const { data, error } = await supabase.from('inventory_counts').update(patch).eq('id', id).select('*').single();
  if (error) throw Errors.internal('Falha ao atualizar inventário', { error: error.message });
  return data;
}

export async function variantStoreId(supabase: SbClient, variantId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('variant_store_id', { _variant_id: variantId });
  if (error) throw Errors.internal('Falha ao resolver loja do SKU', { error: error.message });
  return (data as unknown as string) ?? null;
}

export async function warehouseStoreId(supabase: SbClient, warehouseId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('warehouse_store_id', { _warehouse_id: warehouseId });
  if (error) throw Errors.internal('Falha ao resolver loja do armazém', { error: error.message });
  return (data as unknown as string) ?? null;
}
