/**
 * Server Functions: Audit log.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as Svc from './services/audit.server';

export const listAudit = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Svc.ListAuditInput) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.listAudit(context.supabase, context.userId, data)));

export const exportAuditCsv = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Omit<Svc.ListAuditInput, 'page' | 'pageSize'>) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.exportAuditCsv(context.supabase, context.userId, data)));
