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
