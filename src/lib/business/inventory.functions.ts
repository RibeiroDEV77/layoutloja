/**
 * Server Functions: Inventory (controllers).
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as Svc from './services/inventory.server';

export const createInventoryMovement = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Svc.CreateMovementInput) => input)
  .handler(
    withBusiness(async ({ data, context }) =>
      Svc.createInventoryMovement(context.supabase, context.userId, data),
    ),
  );

export const adjustInventory = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      store_id: string;
      warehouse_id: string;
      variant_id: string;
      new_quantity: number;
      reason?: string;
    }) => input,
  )
  .handler(
    withBusiness(async ({ data, context }) =>
      Svc.adjustInventory(context.supabase, context.userId, data),
    ),
  );

export const transferInventory = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Svc.TransferInventoryInput) => input)
  .handler(
    withBusiness(async ({ data, context }) =>
      Svc.transferInventory(context.supabase, context.userId, data),
    ),
  );

export const createInventoryCount = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Svc.CreateInventoryCountInput) => input)
  .handler(
    withBusiness(async ({ data, context }) =>
      Svc.createInventoryCount(context.supabase, context.userId, data),
    ),
  );

export const finishInventoryCount = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(
    withBusiness(async ({ data, context }) =>
      Svc.finishInventoryCount(context.supabase, context.userId, data.id),
    ),
  );
