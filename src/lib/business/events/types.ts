/**
 * Catálogo oficial de Domain Events.
 * Convenção: `<aggregate>.<event>` em snake_case.
 */
export const DomainEvent = {
  // Catálogo
  ProductCreated: 'product.created',
  ProductUpdated: 'product.updated',
  ProductDeleted: 'product.deleted',

  // Estoque
  InventoryUpdated: 'inventory.updated',
  InventoryLowStock: 'inventory.low_stock',
  InventoryAdjusted: 'inventory.adjusted',
  InventoryTransferred: 'inventory.transferred',
  InventoryCountCreated: 'inventory.count_created',
  InventoryCountFinished: 'inventory.count_finished',

  // Fornecedores
  SupplierCreated: 'supplier.created',
  SupplierUpdated: 'supplier.updated',
  SupplierDeleted: 'supplier.deleted',

  // Compras
  PurchaseCreated: 'purchase.created',
  PurchaseApproved: 'purchase.approved',
  PurchaseCancelled: 'purchase.cancelled',
  PurchaseReceived: 'purchase.received',
  PurchasePartiallyReceived: 'purchase.partially_received',

  // Vendas (preparado para Fase 4)
  OrderCreated: 'order.created',
  OrderPaid: 'order.paid',
  OrderShipped: 'order.shipped',
  OrderDelivered: 'order.delivered',
  OrderCancelled: 'order.cancelled',

  // Clientes / Empresa
  CustomerCreated: 'customer.created',
  CompanyApproved: 'company.approved',

  // Financeiro
  PaymentApproved: 'payment.approved',
  PaymentRefunded: 'payment.refunded',
  InvoiceGenerated: 'invoice.generated',

  // Logística
  ShipmentCreated: 'shipment.created',

  // DAM
  AssetRegistered: 'asset.registered',
  AssetArchived: 'asset.archived',
  AssetDeleted: 'asset.deleted',
  AssetLinked: 'asset.linked',
} as const;

export type DomainEventType = (typeof DomainEvent)[keyof typeof DomainEvent];

export type AggregateType =
  | 'product'
  | 'product_variant'
  | 'supplier'
  | 'purchase_order'
  | 'goods_receipt'
  | 'stock_movement'
  | 'stock_transfer'
  | 'inventory_count'
  | 'order'
  | 'customer'
  | 'company'
  | 'payment'
  | 'invoice'
  | 'shipment'
  | 'asset';

export interface DomainEventPayload {
  event_type: DomainEventType;
  aggregate_type: AggregateType;
  aggregate_id: string;
  store_id: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
