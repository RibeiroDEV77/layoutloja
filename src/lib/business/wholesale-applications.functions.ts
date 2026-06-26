/**
 * Server Functions: Wholesale Applications (Sprint 2 — Atacado).
 *
 * Wrappers RPC sobre `services/wholesale-applications.server`.
 * Toda regra de negócio permanece centralizada no serviço; estes endpoints
 * apenas autenticam e delegam.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as Svc from './services/wholesale-applications.server';

export const createWholesaleApplication = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Svc.CreateApplicationInput) => d)
  .handler(withBusiness(async ({ data, context }) =>
    Svc.createApplication(context.supabase, context.userId, data)));

export const getWholesaleApplication = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(withBusiness(async ({ data, context }) =>
    Svc.getApplication(context.supabase, context.userId, data.id)));

export const getActiveWholesaleApplication = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { customer_id: string }) => d)
  .handler(withBusiness(async ({ data, context }) =>
    Svc.getActiveApplication(context.supabase, context.userId, data.customer_id)));

export const listWholesaleApplicationsByCustomer = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { customer_id: string }) => d)
  .handler(withBusiness(async ({ data, context }) =>
    Svc.listApplicationsByCustomer(context.supabase, context.userId, data.customer_id)));

export const transitionWholesaleApplication = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Svc.TransitionInput) => d)
  .handler(withBusiness(async ({ data, context }) =>
    Svc.transitionApplication(context.supabase, context.userId, data)));

export const cancelWholesaleApplication = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; reason?: string }) => d)
  .handler(withBusiness(async ({ data, context }) =>
    Svc.cancelApplication(context.supabase, context.userId, data.id, data.reason)));
