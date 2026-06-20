/**
 * Service: Purchases — Ordens de Compra e Recebimento.
 *
 * Regras de negócio:
 *  - createPurchaseOrder cria em status 'draft'.
 *  - approvePurchaseOrder muda para 'sent' (registra approved_by/at).
 *  - cancelPurchaseOrder bloqueia OCs já recebidas.
 *  - receivePurchaseOrder cria goods_receipt + itens, aplica delta no estoque,
 *    registra stock_movement + cost_history e atualiza status da OC.
 */
import type { SbClient } from '../events/dispatcher.server';
import { dispatchEvent, dispatchAll } from '../events/dispatcher.server';
import { DomainEvent } from '../events/types';
import { Errors } from '../errors';
import { requirePermission } from './permissions.server';
import * as Repo from '../repositories/purchases.server';
import * as Inv from '../repositories/inventory.server';

export interface POItemInput {
  variant_id: string;
  quantity_ordered: number;
  unit_cost: number;
  discount_amount?: number;
  tax_amount?: number;
  notes?: string;
}

export interface CreatePurchaseOrderInput {
  store_id: string;
  supplier_id: string;
  warehouse_id?: string;
  po_number: string;
  order_date?: string;
  expected_date?: string;
  currency?: string;
  shipping_cost?: number;
  payment_terms?: string;
  notes?: string;
  items: POItemInput[];
}

function computeItemTotal(it: POItemInput): number {
  return it.quantity_ordered * it.unit_cost - (it.discount_amount ?? 0) + (it.tax_amount ?? 0);
}

export async function createPurchaseOrder(
  supabase: SbClient,
  userId: string,
  input: CreatePurchaseOrderInput,
) {
  if (!input.po_number?.trim()) throw Errors.validation('Número da OC obrigatório');
  if (!input.items?.length) throw Errors.validation('OC precisa de ao menos um item');
  for (const it of input.items) {
    if (it.quantity_ordered <= 0) throw Errors.validation('Quantidade deve ser maior que zero');
    if (it.unit_cost < 0) throw Errors.validation('Custo unitário inválido');
  }
  await requirePermission(supabase, userId, 'purchases.manage', input.store_id);

  const subtotal = input.items.reduce((s, it) => s + it.quantity_ordered * it.unit_cost, 0);
  const discount = input.items.reduce((s, it) => s + (it.discount_amount ?? 0), 0);
  const tax = input.items.reduce((s, it) => s + (it.tax_amount ?? 0), 0);
  const shipping = input.shipping_cost ?? 0;
  const total = subtotal - discount + tax + shipping;

  const po = await Repo.insertPO(supabase, {
    store_id: input.store_id,
    supplier_id: input.supplier_id,
    warehouse_id: input.warehouse_id ?? null,
    po_number: input.po_number.trim(),
    status: 'draft',
    order_date: input.order_date ?? new Date().toISOString().slice(0, 10),
    expected_date: input.expected_date ?? null,
    currency: input.currency ?? 'BRL',
    subtotal,
    discount_amount: discount,
    shipping_cost: shipping,
    tax_amount: tax,
    total_amount: total,
    payment_terms: input.payment_terms ?? null,
    notes: input.notes ?? null,
    created_by: userId,
  });

  const items = await Repo.insertPOItems(
    supabase,
    input.items.map((it, idx) => ({
      purchase_order_id: po.id,
      variant_id: it.variant_id,
      quantity_ordered: it.quantity_ordered,
      unit_cost: it.unit_cost,
      discount_amount: it.discount_amount ?? 0,
      tax_amount: it.tax_amount ?? 0,
      total_amount: computeItemTotal(it),
      notes: it.notes ?? null,
      position: idx,
    })),
  );

  await dispatchEvent(supabase, {
    event_type: DomainEvent.PurchaseCreated,
    aggregate_type: 'purchase_order',
    aggregate_id: po.id,
    store_id: po.store_id,
    payload: { po_number: po.po_number, supplier_id: po.supplier_id, total, item_count: items.length },
  });

  return { ...po, items };
}

export async function approvePurchaseOrder(supabase: SbClient, userId: string, poId: string) {
  const po = await Repo.findPO(supabase, poId);
  if (!po) throw Errors.notFound('Ordem de compra', poId);
  await requirePermission(supabase, userId, 'purchases.manage', po.store_id);
  if (po.status !== 'draft') throw Errors.rule(`OC não pode ser aprovada no status '${po.status}'`);

  const updated = await Repo.updatePO(supabase, poId, {
    status: 'sent',
    approved_by: userId,
    approved_at: new Date().toISOString(),
  });

  await dispatchEvent(supabase, {
    event_type: DomainEvent.PurchaseApproved,
    aggregate_type: 'purchase_order',
    aggregate_id: poId,
    store_id: po.store_id,
    payload: { po_number: po.po_number, approved_by: userId },
  });

  return updated;
}

export async function cancelPurchaseOrder(
  supabase: SbClient,
  userId: string,
  poId: string,
  reason?: string,
) {
  const po = await Repo.findPO(supabase, poId);
  if (!po) throw Errors.notFound('Ordem de compra', poId);
  await requirePermission(supabase, userId, 'purchases.manage', po.store_id);
  if (['received', 'cancelled', 'closed'].includes(po.status)) {
    throw Errors.rule(`OC no status '${po.status}' não pode ser cancelada`);
  }

  const updated = await Repo.updatePO(supabase, poId, { status: 'cancelled' });

  await dispatchEvent(supabase, {
    event_type: DomainEvent.PurchaseCancelled,
    aggregate_type: 'purchase_order',
    aggregate_id: poId,
    store_id: po.store_id,
    payload: { po_number: po.po_number, reason: reason ?? null },
  });

  return updated;
}

export interface ReceivePOInput {
  purchase_order_id: string;
  warehouse_id: string;
  receipt_number: string;
  invoice_number?: string;
  invoice_date?: string;
  notes?: string;
  items: Array<{
    purchase_order_item_id: string;
    quantity_received: number;
    quantity_accepted: number;
    quantity_rejected?: number;
    unit_cost?: number;
    notes?: string;
  }>;
}

/**
 * Recebimento de OC. Não é atômico em uma transação Postgres única
 * (limitação do supabase-js), mas:
 *  - usa append-only para movimentações e cost_history;
 *  - aplica delta defensivo em stock_levels com checagem;
 *  - em caso de falha parcial, o `audit_log` permite reconstruir.
 */
export async function receivePurchaseOrder(
  supabase: SbClient,
  userId: string,
  input: ReceivePOInput,
) {
  const po = await Repo.findPO(supabase, input.purchase_order_id);
  if (!po) throw Errors.notFound('Ordem de compra', input.purchase_order_id);
  await requirePermission(supabase, userId, 'purchases.manage', po.store_id);
  if (!['sent', 'confirmed', 'partially_received'].includes(po.status)) {
    throw Errors.rule(`OC no status '${po.status}' não pode receber mercadoria`);
  }
  if (!input.items?.length) throw Errors.validation('Recebimento sem itens');

  const poItems = await Repo.findPOItems(supabase, po.id);
  const poItemsById = new Map(poItems.map((i) => [i.id, i]));

  // valida quantidades
  for (const it of input.items) {
    const poItem = poItemsById.get(it.purchase_order_item_id);
    if (!poItem) throw Errors.validation('Item de OC inválido', { item_id: it.purchase_order_item_id });
    const remaining = Number(poItem.quantity_ordered) - Number(poItem.quantity_received);
    if (it.quantity_received > remaining + 0.0001) {
      throw Errors.rule('Quantidade recebida excede o saldo da OC', {
        item_id: poItem.id,
        remaining,
        attempted: it.quantity_received,
      });
    }
    if (it.quantity_accepted > it.quantity_received) {
      throw Errors.validation('Aceitos não pode exceder recebidos');
    }
  }

  // cria recebimento
  const gr = await Repo.insertGoodsReceipt(supabase, {
    store_id: po.store_id,
    purchase_order_id: po.id,
    warehouse_id: input.warehouse_id,
    receipt_number: input.receipt_number.trim(),
    status: 'confirmed',
    invoice_number: input.invoice_number ?? null,
    invoice_date: input.invoice_date ?? null,
    notes: input.notes ?? null,
    received_by: userId,
  });

  const grItems = await Repo.insertGoodsReceiptItems(
    supabase,
    input.items.map((it) => {
      const poItem = poItemsById.get(it.purchase_order_item_id)!;
      return {
        goods_receipt_id: gr.id,
        purchase_order_item_id: it.purchase_order_item_id,
        variant_id: poItem.variant_id,
        quantity_received: it.quantity_received,
        quantity_accepted: it.quantity_accepted,
        quantity_rejected: it.quantity_rejected ?? Math.max(0, it.quantity_received - it.quantity_accepted),
        unit_cost: it.unit_cost ?? Number(poItem.unit_cost),
        notes: it.notes ?? null,
      };
    }),
  );

  // aplica estoque + movimentação + custo + atualiza item da OC
  for (const it of input.items) {
    const poItem = poItemsById.get(it.purchase_order_item_id)!;
    const unitCost = it.unit_cost ?? Number(poItem.unit_cost);

    if (it.quantity_accepted > 0) {
      await Inv.applyStockDelta(supabase, {
        storeId: po.store_id,
        warehouseId: input.warehouse_id,
        variantId: poItem.variant_id,
        delta: it.quantity_accepted,
      });

      await Inv.insertMovement(supabase, {
        store_id: po.store_id,
        warehouse_id: input.warehouse_id,
        variant_id: poItem.variant_id,
        movement_type: 'purchase_receipt',
        quantity: it.quantity_accepted,
        unit_cost: unitCost,
        reference_type: 'goods_receipt',
        reference_id: gr.id,
        performed_by: userId,
      });

      await Inv.insertCostHistory(supabase, {
        store_id: po.store_id,
        variant_id: poItem.variant_id,
        cost_method: 'last',
        unit_cost: unitCost,
        quantity_in: it.quantity_accepted,
        reference_type: 'goods_receipt',
        reference_id: gr.id,
      });
    }

    await Repo.updatePOItem(supabase, poItem.id, {
      quantity_received: Number(poItem.quantity_received) + it.quantity_received,
    });
  }

  // recalcula status da OC
  const refreshedItems = await Repo.findPOItems(supabase, po.id);
  const allReceived = refreshedItems.every(
    (i) => Number(i.quantity_received) >= Number(i.quantity_ordered) - 0.0001,
  );
  const anyReceived = refreshedItems.some((i) => Number(i.quantity_received) > 0);
  const newStatus = allReceived ? 'received' : anyReceived ? 'partially_received' : po.status;

  if (newStatus !== po.status) {
    await Repo.updatePO(supabase, po.id, { status: newStatus });
  }

  await dispatchAll(supabase, [
    {
      event_type: allReceived ? DomainEvent.PurchaseReceived : DomainEvent.PurchasePartiallyReceived,
      aggregate_type: 'purchase_order',
      aggregate_id: po.id,
      store_id: po.store_id,
      payload: { po_number: po.po_number, receipt_id: gr.id, fully_received: allReceived },
    },
    {
      event_type: DomainEvent.InventoryUpdated,
      aggregate_type: 'goods_receipt',
      aggregate_id: gr.id,
      store_id: po.store_id,
      payload: { warehouse_id: input.warehouse_id, items: grItems.length },
    },
  ]);

  return { receipt: gr, items: grItems, status: newStatus };
}
