/**
 * Service: Inventory — movimentações, ajustes, transferências e inventários.
 */
import type { SbClient } from '../events/dispatcher.server';
import { dispatchEvent, dispatchAll } from '../events/dispatcher.server';
import { DomainEvent } from '../events/types';
import { Errors } from '../errors';
import { requirePermission } from './permissions.server';
import * as Inv from '../repositories/inventory.server';

export interface CreateMovementInput {
  store_id: string;
  warehouse_id: string;
  variant_id: string;
  movement_type:
    | 'adjustment_in'
    | 'adjustment_out'
    | 'loss'
    | 'production'
    | 'reservation'
    | 'release';
  quantity: number;
  unit_cost?: number;
  notes?: string;
  reference_type?: string;
  reference_id?: string;
}

/**
 * Movimentação genérica controlada pelo usuário (ajustes, perdas, produção).
 * Recebimento, venda e transferência têm fluxos próprios.
 */
export async function createInventoryMovement(
  supabase: SbClient,
  userId: string,
  input: CreateMovementInput,
) {
  if (input.quantity <= 0) throw Errors.validation('Quantidade deve ser maior que zero');
  await requirePermission(supabase, userId, 'inventory.manage', input.store_id);

  const isOut = ['adjustment_out', 'loss', 'reservation'].includes(input.movement_type);
  const delta = isOut ? -input.quantity : input.quantity;

  const level = await Inv.applyStockDelta(supabase, {
    storeId: input.store_id,
    warehouseId: input.warehouse_id,
    variantId: input.variant_id,
    delta,
  });

  const mv = await Inv.insertMovement(supabase, {
    store_id: input.store_id,
    warehouse_id: input.warehouse_id,
    variant_id: input.variant_id,
    movement_type: input.movement_type,
    quantity: input.quantity,
    unit_cost: input.unit_cost ?? null,
    reference_type: input.reference_type ?? null,
    reference_id: input.reference_id ?? null,
    notes: input.notes ?? null,
    performed_by: userId,
  });

  await dispatchEvent(supabase, {
    event_type: DomainEvent.InventoryUpdated,
    aggregate_type: 'stock_movement',
    aggregate_id: mv.id,
    store_id: input.store_id,
    payload: {
      warehouse_id: input.warehouse_id,
      variant_id: input.variant_id,
      movement_type: input.movement_type,
      delta,
      on_hand: level.quantity_on_hand,
    },
  });

  if (level.reorder_point !== null && Number(level.quantity_on_hand) <= Number(level.reorder_point)) {
    await dispatchEvent(supabase, {
      event_type: DomainEvent.InventoryLowStock,
      aggregate_type: 'stock_movement',
      aggregate_id: level.id,
      store_id: input.store_id,
      payload: {
        variant_id: input.variant_id,
        warehouse_id: input.warehouse_id,
        on_hand: level.quantity_on_hand,
        reorder_point: level.reorder_point,
      },
    });
  }

  return { movement: mv, level };
}

/**
 * Ajuste fino: define o saldo absoluto e cria movimentação compensatória.
 */
export async function adjustInventory(
  supabase: SbClient,
  userId: string,
  input: {
    store_id: string;
    warehouse_id: string;
    variant_id: string;
    new_quantity: number;
    reason?: string;
  },
) {
  if (input.new_quantity < 0) throw Errors.validation('Saldo não pode ser negativo');
  await requirePermission(supabase, userId, 'inventory.manage', input.store_id);

  const existing = await Inv.getStockLevel(supabase, input.warehouse_id, input.variant_id);
  const current = existing ? Number(existing.quantity_on_hand) : 0;
  const delta = input.new_quantity - current;
  if (delta === 0) return { movement: null, level: existing };

  const movementType = delta > 0 ? 'adjustment_in' : 'adjustment_out';
  return createInventoryMovement(supabase, userId, {
    store_id: input.store_id,
    warehouse_id: input.warehouse_id,
    variant_id: input.variant_id,
    movement_type: movementType,
    quantity: Math.abs(delta),
    notes: input.reason ?? `Ajuste para ${input.new_quantity}`,
  });
}

export interface TransferInventoryInput {
  store_id: string;
  transfer_number: string;
  origin_warehouse_id: string;
  destination_warehouse_id: string;
  notes?: string;
  items: Array<{ variant_id: string; quantity: number; unit_cost?: number; notes?: string }>;
}

/**
 * Transferência entre armazéns — em uma única chamada:
 *   - cria o documento de transferência;
 *   - debita do origem (transfer_out);
 *   - credita no destino (transfer_in);
 *   - emite evento `inventory.transferred`.
 */
export async function transferInventory(
  supabase: SbClient,
  userId: string,
  input: TransferInventoryInput,
) {
  if (input.origin_warehouse_id === input.destination_warehouse_id) {
    throw Errors.validation('Origem e destino devem ser diferentes');
  }
  if (!input.items?.length) throw Errors.validation('Transferência sem itens');
  for (const it of input.items) {
    if (it.quantity <= 0) throw Errors.validation('Quantidade deve ser maior que zero');
  }
  await requirePermission(supabase, userId, 'inventory.manage', input.store_id);

  const transfer = await Inv.insertTransfer(supabase, {
    store_id: input.store_id,
    transfer_number: input.transfer_number.trim(),
    origin_warehouse_id: input.origin_warehouse_id,
    destination_warehouse_id: input.destination_warehouse_id,
    status: 'received',
    shipped_at: new Date().toISOString(),
    received_at: new Date().toISOString(),
    shipped_by: userId,
    received_by: userId,
    notes: input.notes ?? null,
  });

  await Inv.insertTransferItems(
    supabase,
    input.items.map((it) => ({
      stock_transfer_id: transfer.id,
      variant_id: it.variant_id,
      quantity_shipped: it.quantity,
      quantity_received: it.quantity,
      unit_cost: it.unit_cost ?? null,
      notes: it.notes ?? null,
    })),
  );

  for (const it of input.items) {
    // OUT
    await Inv.applyStockDelta(supabase, {
      storeId: input.store_id,
      warehouseId: input.origin_warehouse_id,
      variantId: it.variant_id,
      delta: -it.quantity,
    });
    await Inv.insertMovement(supabase, {
      store_id: input.store_id,
      warehouse_id: input.origin_warehouse_id,
      variant_id: it.variant_id,
      movement_type: 'transfer_out',
      quantity: it.quantity,
      unit_cost: it.unit_cost ?? null,
      reference_type: 'stock_transfer',
      reference_id: transfer.id,
      performed_by: userId,
    });
    // IN
    await Inv.applyStockDelta(supabase, {
      storeId: input.store_id,
      warehouseId: input.destination_warehouse_id,
      variantId: it.variant_id,
      delta: it.quantity,
    });
    await Inv.insertMovement(supabase, {
      store_id: input.store_id,
      warehouse_id: input.destination_warehouse_id,
      variant_id: it.variant_id,
      movement_type: 'transfer_in',
      quantity: it.quantity,
      unit_cost: it.unit_cost ?? null,
      reference_type: 'stock_transfer',
      reference_id: transfer.id,
      performed_by: userId,
    });
  }

  await dispatchEvent(supabase, {
    event_type: DomainEvent.InventoryTransferred,
    aggregate_type: 'stock_transfer',
    aggregate_id: transfer.id,
    store_id: input.store_id,
    payload: {
      transfer_number: transfer.transfer_number,
      origin: input.origin_warehouse_id,
      destination: input.destination_warehouse_id,
      items: input.items.length,
    },
  });

  return transfer;
}

export interface CreateInventoryCountInput {
  store_id: string;
  warehouse_id: string;
  count_number: string;
  count_type?: 'full' | 'cyclic' | 'spot' | 'category';
  scheduled_date?: string;
  notes?: string;
}

export async function createInventoryCount(
  supabase: SbClient,
  userId: string,
  input: CreateInventoryCountInput,
) {
  if (!input.count_number?.trim()) throw Errors.validation('Número do inventário obrigatório');
  await requirePermission(supabase, userId, 'inventory.manage', input.store_id);

  const row = await Inv.insertCount(supabase, {
    store_id: input.store_id,
    warehouse_id: input.warehouse_id,
    count_number: input.count_number.trim(),
    count_type: input.count_type ?? 'full',
    status: 'draft',
    scheduled_date: input.scheduled_date ?? null,
    notes: input.notes ?? null,
  });

  await dispatchEvent(supabase, {
    event_type: DomainEvent.InventoryCountCreated,
    aggregate_type: 'inventory_count',
    aggregate_id: row.id,
    store_id: input.store_id,
    payload: { count_number: row.count_number, warehouse_id: row.warehouse_id, type: row.count_type },
  });

  return row;
}

/**
 * Finaliza inventário: gera movimentações compensatórias para todas as
 * variâncias e marca como `approved`.
 */
export async function finishInventoryCount(
  supabase: SbClient,
  userId: string,
  countId: string,
) {
  const count = await Inv.findCount(supabase, countId);
  if (!count) throw Errors.notFound('Inventário', countId);
  await requirePermission(supabase, userId, 'inventory.manage', count.store_id);
  if (count.status === 'approved') throw Errors.rule('Inventário já aprovado');
  if (count.status === 'cancelled') throw Errors.rule('Inventário cancelado');

  const items = await Inv.findCountItems(supabase, countId);
  if (items.length === 0) throw Errors.rule('Inventário sem itens contados');

  let adjustments = 0;
  for (const it of items) {
    if (it.counted_quantity === null) continue;
    const variance = Number(it.counted_quantity) - Number(it.expected_quantity);
    if (variance === 0) continue;

    await Inv.applyStockDelta(supabase, {
      storeId: count.store_id,
      warehouseId: count.warehouse_id,
      variantId: it.variant_id,
      delta: variance,
    });
    await Inv.insertMovement(supabase, {
      store_id: count.store_id,
      warehouse_id: count.warehouse_id,
      variant_id: it.variant_id,
      movement_type: 'inventory_count',
      quantity: Math.abs(variance),
      unit_cost: it.unit_cost ?? null,
      reference_type: 'inventory_count',
      reference_id: countId,
      notes: variance > 0 ? 'Sobra de inventário' : 'Falta de inventário',
      performed_by: userId,
    });
    adjustments++;
  }

  const updated = await Inv.updateCount(supabase, countId, {
    status: 'approved',
    completed_at: new Date().toISOString(),
    approved_at: new Date().toISOString(),
    approved_by: userId,
  });

  await dispatchAll(supabase, [
    {
      event_type: DomainEvent.InventoryCountFinished,
      aggregate_type: 'inventory_count',
      aggregate_id: countId,
      store_id: count.store_id,
      payload: { count_number: count.count_number, adjustments, total_items: items.length },
    },
    {
      event_type: DomainEvent.InventoryAdjusted,
      aggregate_type: 'inventory_count',
      aggregate_id: countId,
      store_id: count.store_id,
      payload: { source: 'inventory_count', adjustments },
    },
  ]);

  return { count: updated, adjustments };
}

// ============================================================================
// Fase 6.1 Etapa 3 — Inventory MVP (Admin)
//
// Mantém SoC: leituras passam pelo Repository (read model + tabelas oficiais)
// e mutações reutilizam EXCLUSIVAMENTE o Stock Engine já implementado
// (createInventoryMovement / adjustInventory) preservando auditoria, Outbox,
// telemetria e baixos de feature flag.
// ============================================================================

import { hasPermission, isSuperAdmin, requireStoreAccess } from './permissions.server';
import { recordMetric } from '@/lib/foundations/observability.functions';

async function ensureRead(supabase: SbClient, userId: string, storeId: string) {
  if (await isSuperAdmin(supabase, userId)) return;
  await requireStoreAccess(supabase, userId, storeId);
  if (!(await hasPermission(supabase, userId, 'inventory.read', storeId))) {
    throw Errors.forbidden('Permissão necessária: inventory.read');
  }
}

export type ListStockInput = Inv.StockListFilters;

export async function listAdminStock(
  supabase: SbClient,
  userId: string,
  input: ListStockInput,
) {
  await ensureRead(supabase, userId, input.store_id);
  const out = await Inv.listAdminStock(supabase, input);
  recordMetric(supabase, {
    scope: 'inventory',
    name: 'admin.list',
    value: 1,
    storeId: input.store_id,
  }).catch(() => {});
  return out;
}

export async function getAdminStock(
  supabase: SbClient,
  userId: string,
  id: string,
) {
  const row = await Inv.findAdminStockById(supabase, id);
  if (!row || !row.store_id) throw Errors.notFound('Nível de estoque', id);
  await ensureRead(supabase, userId, row.store_id);
  return row;
}

export async function getStockMovements(
  supabase: SbClient,
  userId: string,
  id: string,
  limit = 100,
) {
  const row = await getAdminStock(supabase, userId, id);
  return Inv.listMovements(supabase, {
    warehouse_id: row.warehouse_id!,
    variant_id: row.variant_id!,
    limit,
  });
}

export async function getStockReservations(
  supabase: SbClient,
  userId: string,
  id: string,
  limit = 100,
) {
  const row = await getAdminStock(supabase, userId, id);
  return Inv.listReservations(supabase, {
    warehouse_id: row.warehouse_id!,
    variant_id: row.variant_id!,
    limit,
  });
}

export async function listAdminWarehouses(
  supabase: SbClient,
  userId: string,
  storeId: string,
) {
  await ensureRead(supabase, userId, storeId);
  return Inv.listWarehouses(supabase, storeId);
}

/**
 * Ação em lote: ajuste absoluto de saldo para múltiplos níveis.
 * Cada item passa pelo Stock Engine (adjustInventory) — preservando
 * auditoria, eventos de domínio e baixo automático (low_stock).
 */
export async function bulkAdjustStock(
  supabase: SbClient,
  userId: string,
  input: { items: Array<{ stock_level_id: string; new_quantity: number; reason?: string }> },
) {
  if (!input.items?.length) throw Errors.validation('Nenhum nível selecionado');
  if (input.items.length > 100) throw Errors.validation('Máximo 100 ajustes por operação');

  const results: { stock_level_id: string; ok: boolean; error?: string }[] = [];
  for (const it of input.items) {
    try {
      const lvl = await Inv.findAdminStockById(supabase, it.stock_level_id);
      if (!lvl || !lvl.store_id) {
        results.push({ stock_level_id: it.stock_level_id, ok: false, error: 'not_found' });
        continue;
      }
      await adjustInventory(supabase, userId, {
        store_id: lvl.store_id,
        warehouse_id: lvl.warehouse_id!,
        variant_id: lvl.variant_id!,
        new_quantity: it.new_quantity,
        reason: it.reason,
      });
      results.push({ stock_level_id: it.stock_level_id, ok: true });
    } catch (err) {
      results.push({
        stock_level_id: it.stock_level_id,
        ok: false,
        error: err instanceof Error ? err.message : 'erro',
      });
    }
  }
  return {
    results,
    ok_count: results.filter((r) => r.ok).length,
    fail_count: results.filter((r) => !r.ok).length,
  };
}
