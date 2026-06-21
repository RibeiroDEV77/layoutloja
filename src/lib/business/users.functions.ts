/**
 * Server Functions: Users & Roles.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as Svc from './services/users.server';

export const listUsers = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Svc.ListUsersInput) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.listUsers(context.supabase, context.userId, data)));

export const listRoles = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Record<string, never>) => i)
  .handler(withBusiness(async ({ context }) => Svc.listRoles(context.supabase, context.userId)));

export const assignRole = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Svc.AssignRoleInput) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.assignRole(context.supabase, context.userId, data)));

export const revokeRole = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { user_role_id: string }) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.revokeRole(context.supabase, context.userId, data.user_role_id)));

export const inviteUser = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Svc.InviteUserInput) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.inviteUser(context.supabase, context.userId, data)));
