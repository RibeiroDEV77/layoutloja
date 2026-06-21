/**
 * Server Functions: Purchases (controllers).
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as Svc from './services/purchases.server';

export const createPurchaseOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Svc.CreatePurchaseOrderInput) => input)
  .handler(
    withBusiness(async ({ data, context }) =>
      Svc.createPurchaseOrder(context.supabase, context.userId, data),
    ),
  );

export const approvePurchaseOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(
    withBusiness(async ({ data, context }) =>
      Svc.approvePurchaseOrder(context.supabase, context.userId, data.id),
    ),
  );

export const cancelPurchaseOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; reason?: string }) => input)
  .handler(
    withBusiness(async ({ data, context }) =>
      Svc.cancelPurchaseOrder(context.supabase, context.userId, data.id, data.reason),
    ),
  );

export const receivePurchaseOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Svc.ReceivePOInput) => input)
  .handler(
    withBusiness(async ({ data, context }) =>
      Svc.receivePurchaseOrder(context.supabase, context.userId, data),
    ),
);

export const listPurchaseOrders = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Svc.ListInput) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.list(context.supabase, context.userId, data)));

export const getPurchaseOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.get(context.supabase, context.userId, data.id)));

export const getPurchaseOrderTimeline = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.timeline(context.supabase, context.userId, data.id)));

export const getPurchaseOrderAudit = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.audit(context.supabase, context.userId, data.id)));
