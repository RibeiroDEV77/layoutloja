/**
 * Server Functions: Users & Roles — admin module.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as Svc from './services/users.server';

export const listUsers = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Svc.ListUsersInput) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.listUsers(context.supabase, context.userId, data)));

export const usersDashboard = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Record<string, never>) => i)
  .handler(withBusiness(async ({ context }) => Svc.usersDashboard(context.supabase, context.userId)));

export const getUser = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { user_id: string }) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.getUser(context.supabase, context.userId, data.user_id)));

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

export const updateProfile = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Svc.UpdateProfileInput) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.updateProfile(context.supabase, context.userId, data)));

export const setUserActive = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { user_id: string; active: boolean }) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.setUserActive(context.supabase, context.userId, data.user_id, data.active)));

export const blockUser = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { user_id: string; reason: string }) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.blockUser(context.supabase, context.userId, data.user_id, data.reason)));

export const unblockUser = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { user_id: string }) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.unblockUser(context.supabase, context.userId, data.user_id)));

export const forcePasswordChange = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { user_id: string; force: boolean }) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.forcePasswordChange(context.supabase, context.userId, data.user_id, data.force)));

export const resetPassword = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { user_id: string }) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.resetPassword(context.supabase, context.userId, data.user_id)));

export const revokeSession = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { session_id: string }) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.revokeSession(context.supabase, context.userId, data.session_id)));

export const listUserAudit = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { user_id: string; limit?: number }) => i)
  .handler(withBusiness(async ({ data, context }) => Svc.listUserAudit(context.supabase, context.userId, data.user_id, data.limit)));

export const bootstrapStatus = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Record<string, never>) => i)
  .handler(withBusiness(async ({ context }) => Svc.bootstrapStatus(context.supabase)));

export const claimSuperAdmin = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Record<string, never>) => i)
  .handler(withBusiness(async ({ context }) => Svc.claimSuperAdmin(context.supabase)));
