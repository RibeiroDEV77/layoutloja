/**
 * Domain event catalog for the commercial module (Phase 5).
 * Events are emitted via the Transactional Outbox.
 */

export const CommerceEventTypes = {
  // Customers
  CustomerCreated: 'customer.created',
  CustomerUpdated: 'customer.updated',
  CustomerAddressAdded: 'customer.address.added',

  // Cart
  CartCreated: 'cart.created',
  CartItemAdded: 'cart.item.added',
  CartItemRemoved: 'cart.item.removed',
  CartAbandoned: 'cart.abandoned',
  CartConverted: 'cart.converted',

  // Stock reservations
  StockReserved: 'stock.reserved',
  StockReservationReleased: 'stock.reservation.released',
  StockReservationExpired: 'stock.reservation.expired',
  StockReservationConfirmed: 'stock.reservation.confirmed',

  // Quotes / shipping
  ShippingQuoteRequested: 'shipping.quote.requested',
  ShippingQuoteReceived: 'shipping.quote.received',

  // Orders
  OrderCreated: 'order.created',
  OrderConfirmed: 'order.confirmed',
  OrderCancelled: 'order.cancelled',
  OrderItemUpdated: 'order.item.updated',
  OrderSnapshotCaptured: 'order.snapshot.captured',
  OrderLedgerEntryAdded: 'order.ledger.entry.added',

  // Payments
  PaymentAttemptStarted: 'payment.attempt.started',
  PaymentAuthorized: 'payment.authorized',
  PaymentCaptured: 'payment.captured',
  PaymentFailed: 'payment.failed',
  PaymentRefunded: 'payment.refunded',
  PaymentChargebackOpened: 'payment.chargeback.opened',

  // Fulfillment / shipping
  FulfillmentCreated: 'fulfillment.created',
  FulfillmentPicked: 'fulfillment.picked',
  FulfillmentPacked: 'fulfillment.packed',
  FulfillmentShipped: 'fulfillment.shipped',
  FulfillmentDelivered: 'fulfillment.delivered',
  FulfillmentReturned: 'fulfillment.returned',

  // Returns / exchanges
  ReturnRequested: 'return.requested',
  ReturnApproved: 'return.approved',
  ReturnRejected: 'return.rejected',
  ReturnReceived: 'return.received',
  ExchangeRequested: 'exchange.requested',
  ExchangeCompleted: 'exchange.completed',

  // Marketplace
  MarketplaceOrderImported: 'marketplace.order.imported',
  MarketplaceStockSynced: 'marketplace.stock.synced',
  MarketplacePriceSynced: 'marketplace.price.synced',

  // Workflow / outbox / observability (cross-cutting)
  WorkflowTransitioned: 'workflow.transitioned',
  WorkflowSlaBreached: 'workflow.sla.breached',
  SettingUpdated: 'system.setting.updated',
  FeatureFlagToggled: 'system.feature_flag.toggled',
} as const;

export type CommerceEventType = (typeof CommerceEventTypes)[keyof typeof CommerceEventTypes];

export const AggregateTypes = {
  Customer: 'customer',
  Cart: 'cart',
  Order: 'order',
  Payment: 'payment',
  Fulfillment: 'fulfillment',
  Return: 'return',
  StockReservation: 'stock_reservation',
  WorkflowInstance: 'workflow_instance',
} as const;

export type AggregateType = (typeof AggregateTypes)[keyof typeof AggregateTypes];
