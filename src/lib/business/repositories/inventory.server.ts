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

// ============================================================================
// Fase 6.1 Etapa 3 — Inventory MVP (Admin Read Model + listings)
// ============================================================================

export type StockAdminListRow = Database['public']['Views']['stock_admin_list_v']['Row'];
export type StockMovementRow = Database['public']['Tables']['stock_movements']['Row'];
export type StockReservationRow = Database['public']['Tables']['stock_reservations']['Row'];
export type WarehouseRow = Database['public']['Tables']['warehouses']['Row'];

export interface StockListFilters {
  store_id: string;
  q?: string;
  warehouse_id?: string;
  stock_status?: Array<'in_stock' | 'low_stock' | 'out_of_stock'>;
  product_id?: string;
  brand_id?: string;
  category_id?: string;
  page?: number;
  pageSize?: number;
  sort?: 'product_name' | 'sku' | 'quantity_on_hand' | 'quantity_available' | 'last_movement_at';
  sort_dir?: 'asc' | 'desc';
}

export async function listAdminStock(supabase: SbClient, filters: StockListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const size = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const from = (page - 1) * size;
  const to = from + size - 1;
  const sort = filters.sort ?? 'product_name';
  const ascending = (filters.sort_dir ?? 'asc') === 'asc';

  let q = supabase
    .from('stock_admin_list_v')
    .select('*', { count: 'exact' })
    .eq('store_id', filters.store_id);

  if (filters.warehouse_id) q = q.eq('warehouse_id', filters.warehouse_id);
  if (filters.product_id) q = q.eq('product_id', filters.product_id);
  if (filters.brand_id) q = q.eq('brand_id', filters.brand_id);
  if (filters.category_id) q = q.eq('category_id', filters.category_id);
  if (filters.stock_status?.length) q = q.in('stock_status', filters.stock_status);

  if (filters.q?.trim()) {
    const safe = filters.q.replace(/[%,]/g, '');
    q = q.or(
      `sku.ilike.%${safe}%,product_name.ilike.%${safe}%,barcode.ilike.%${safe}%,internal_reference.ilike.%${safe}%,sku_root.ilike.%${safe}%`,
    );
  }

  q = q.order(sort, { ascending }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw Errors.internal('Falha ao listar estoque', { error: error.message });
  return { rows: (data ?? []) as StockAdminListRow[], total: count ?? 0, page, pageSize: size };
}

export async function findAdminStockById(
  supabase: SbClient,
  id: string,
): Promise<StockAdminListRow | null> {
  const { data, error } = await supabase
    .from('stock_admin_list_v')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw Errors.internal('Falha ao buscar nível de estoque', { error: error.message });
  return data as StockAdminListRow | null;
}

export async function listMovements(
  supabase: SbClient,
  args: { warehouse_id: string; variant_id: string; limit?: number },
): Promise<StockMovementRow[]> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('warehouse_id', args.warehouse_id)
    .eq('variant_id', args.variant_id)
    .order('occurred_at', { ascending: false })
    .limit(args.limit ?? 100);
  if (error) throw Errors.internal('Falha ao listar movimentações', { error: error.message });
  return (data ?? []) as StockMovementRow[];
}

export async function listReservations(
  supabase: SbClient,
  args: { warehouse_id: string; variant_id: string; limit?: number },
): Promise<StockReservationRow[]> {
  const { data, error } = await supabase
    .from('stock_reservations')
    .select('*')
    .eq('warehouse_id', args.warehouse_id)
    .eq('variant_id', args.variant_id)
    .order('created_at', { ascending: false })
    .limit(args.limit ?? 100);
  if (error) throw Errors.internal('Falha ao listar reservas', { error: error.message });
  return (data ?? []) as StockReservationRow[];
}

export async function listWarehouses(
  supabase: SbClient,
  storeId: string,
): Promise<WarehouseRow[]> {
  const { data, error } = await supabase
    .from('warehouses')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw Errors.internal('Falha ao listar armazéns', { error: error.message });
  return (data ?? []) as WarehouseRow[];
}
