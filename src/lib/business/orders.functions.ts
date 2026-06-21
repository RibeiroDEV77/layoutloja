/**
 * Server Functions: Orders (Admin) — Fase 6.1 Etapa 2.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as Svc from './services/orders.server';

export const listOrders = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Svc.ListInput) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.list(context.supabase, context.userId, data)));

export const getOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.get(context.supabase, context.userId, data.id)));

export const getOrderTimeline = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.timeline(context.supabase, context.userId, data.id)));

export const getOrderAudit = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.audit(context.supabase, context.userId, data.id)));

export const addOrderNote = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order_id: string; body: string; visibility?: 'internal' | 'public'; pinned?: boolean }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.addNote(context.supabase, context.userId, data)));

export const addOrderTag = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order_id: string; tag: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.addTag(context.supabase, context.userId, data)));

export const removeOrderTag = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order_id: string; tag: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.removeTag(context.supabase, context.userId, data)));

export const assignOrderUser = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order_id: string; user_id: string; role?: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.assignUser(context.supabase, context.userId, data)));

export const cancelOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order_id: string; reason: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.cancel(context.supabase, context.userId, data)));

export const bulkCancelOrders = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order_ids: string[]; reason: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.bulkCancel(context.supabase, context.userId, data)));

export const bulkAddOrderTag = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order_ids: string[]; tag: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.bulkAddTag(context.supabase, context.userId, data)));
