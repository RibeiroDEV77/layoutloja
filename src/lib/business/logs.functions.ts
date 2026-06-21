/**
 * Server Functions: Logs (system, outbox, DLQ).
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as Svc from './services/logs.server';

export const listSystemLogs = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Svc.ListLogsInput) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.listSystemLogs(context.supabase, context.userId, data)));

export const listOutbox = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { status?: string; page?: number; pageSize?: number }) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.listOutbox(context.supabase, context.userId, data)));

export const listOutboxDLQ = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { page?: number; pageSize?: number }) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.listOutboxDLQ(context.supabase, context.userId, data)));

export const retryOutboxEvent = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.retryOutboxEvent(context.supabase, context.userId, data.id)));

export const discardOutboxEvent = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.discardOutboxEvent(context.supabase, context.userId, data.id)));

export const reprocessDLQ = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.reprocessDLQ(context.supabase, context.userId, data.id)));
