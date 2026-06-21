/**
 * Service: Users & Roles — complete admin management.
 * RBAC enforced via is_super_admin / has_permission SECURITY DEFINER RPCs.
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { isSuperAdmin } from './permissions.server';

async function requireUserManage(supabase: SbClient, userId: string) {
  if (!(await isSuperAdmin(supabase, userId))) {
    throw Errors.forbidden('Apenas super administradores podem gerenciar usuários');
  }
}

async function audit(
  supabase: SbClient,
  userId: string,
  action: string,
  targetUserId: string | null,
  diff?: Record<string, unknown>,
) {
  await supabase.from('audit_log').insert({
    actor_user_id: userId,
    entity_type: 'user',
    entity_id: targetUserId,
    action,
    diff: (diff ?? {}) as never,
  });
}

// ============================================================
// LIST / DASHBOARD / DETAIL
// ============================================================

export interface ListUsersInput {
  q?: string;
  page?: number;
  pageSize?: number;
  status?: 'all' | 'active' | 'inactive' | 'blocked';
  role_code?: string;
  store_id?: string;
}

export async function listUsers(supabase: SbClient, userId: string, input: ListUsersInput) {
  await requireUserManage(supabase, userId);
  const page = Math.max(1, input.page ?? 1);
  const size = Math.min(100, Math.max(1, input.pageSize ?? 25));
  const from = (page - 1) * size;
  const to = from + size - 1;

  let q = supabase
    .from('profiles')
    .select(
      'id,user_id,full_name,email,phone,job_title,avatar_url,locale,is_active,is_blocked,blocked_reason,must_change_password,last_login_at,default_store_id,created_at,updated_at',
      { count: 'exact' },
    );

  if (input.q?.trim()) {
    const safe = input.q.replace(/[%,]/g, '');
    q = q.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`);
  }
  if (input.status === 'active') q = q.eq('is_active', true).eq('is_blocked', false);
  else if (input.status === 'inactive') q = q.eq('is_active', false);
  else if (input.status === 'blocked') q = q.eq('is_blocked', true);

  q = q.order('created_at', { ascending: false }).range(from, to);
  const { data: profiles, error, count } = await q;
  if (error) throw Errors.internal('Falha ao listar usuários', { error: error.message });

  const userIds = (profiles ?? []).map((p) => p.user_id);
  let rolesByUser: Record<string, { user_role_id: string; role_id: string; role_code: string; role_name: string; store_id: string | null }[]> = {};
  if (userIds.length > 0) {
    const { data: rolesData, error: rolesErr } = await supabase
      .from('user_roles')
      .select('id,user_id,role_id,store_id,roles(code,name)')
      .in('user_id', userIds);
    if (rolesErr) throw Errors.internal('Falha ao listar papéis', { error: rolesErr.message });
    rolesByUser = (rolesData ?? []).reduce((acc, r) => {
      const arr = acc[r.user_id] ?? (acc[r.user_id] = []);
      const role = r.roles as unknown as { code: string; name: string } | null;
      arr.push({
        user_role_id: r.id,
        role_id: r.role_id,
        role_code: role?.code ?? '?',
        role_name: role?.name ?? '?',
        store_id: r.store_id,
      });
      return acc;
    }, {} as typeof rolesByUser);
  }

  let rows = (profiles ?? []).map((p) => ({ ...p, roles: rolesByUser[p.user_id] ?? [] }));

  // post-filter by role/store (cheap; counts already approximate)
  if (input.role_code) rows = rows.filter((r) => r.roles.some((x) => x.role_code === input.role_code));
  if (input.store_id) rows = rows.filter((r) => r.roles.some((x) => x.store_id === input.store_id));

  return { rows, total: count ?? 0, page, pageSize: size };
}

export async function usersDashboard(supabase: SbClient, userId: string) {
  await requireUserManage(supabase, userId);
  const [active, inactive, blocked, admins] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('is_blocked', false),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', false),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_blocked', true),
    supabase.from('user_roles').select('user_id,roles!inner(code)', { count: 'exact', head: true }).eq('roles.code', 'super_admin'),
  ]);
  return {
    active: active.count ?? 0,
    inactive: inactive.count ?? 0,
    blocked: blocked.count ?? 0,
    super_admins: admins.count ?? 0,
  };
}

export async function getUser(supabase: SbClient, userId: string, targetUserId: string) {
  await requireUserManage(supabase, userId);
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (error) throw Errors.internal('Falha ao carregar perfil', { error: error.message });
  if (!profile) throw Errors.notFound('Usuário', targetUserId);

  const [{ data: roles }, perms, { data: sessions }] = await Promise.all([
    supabase
      .from('user_roles')
      .select('id,role_id,store_id,created_at,roles(code,name),stores(name)')
      .eq('user_id', targetUserId),
    listEffectivePermissionsRaw(supabase, targetUserId),
    supabase
      .from('user_sessions')
      .select('id,ip,user_agent,last_seen_at,revoked_at,created_at')
      .eq('user_id', targetUserId)
      .order('last_seen_at', { ascending: false })
      .limit(20),
  ]);

  return {
    profile,
    roles: (roles ?? []).map((r) => ({
      user_role_id: r.id,
      role_id: r.role_id,
      role_code: (r.roles as unknown as { code: string } | null)?.code ?? '?',
      role_name: (r.roles as unknown as { name: string } | null)?.name ?? '?',
      store_id: r.store_id,
      store_name: (r.stores as unknown as { name: string } | null)?.name ?? null,
      granted_at: r.created_at,
    })),
    permissions: perms,
    sessions: sessions ?? [],
  };
}

async function listEffectivePermissionsRaw(supabase: SbClient, targetUserId: string) {
  const { data, error } = await supabase
    .from('user_roles')
    .select('roles(code,name,role_permissions(permissions(code,module,description)))')
    .eq('user_id', targetUserId);
  if (error) return [];
  const map = new Map<string, { code: string; module: string; description: string | null; source_roles: string[] }>();
  for (const ur of data ?? []) {
    const role = ur.roles as unknown as
      | { code: string; name: string; role_permissions: { permissions: { code: string; module: string; description: string | null } | null }[] }
      | null;
    if (!role) continue;
    for (const rp of role.role_permissions ?? []) {
      const p = rp.permissions;
      if (!p) continue;
      const existing = map.get(p.code) ?? { code: p.code, module: p.module, description: p.description, source_roles: [] };
      if (!existing.source_roles.includes(role.code)) existing.source_roles.push(role.code);
      map.set(p.code, existing);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
}

// ============================================================
// LIST ROLES
// ============================================================
export async function listRoles(supabase: SbClient, userId: string) {
  await requireUserManage(supabase, userId);
  const { data, error } = await supabase
    .from('roles')
    .select('id,code,name,description,is_system')
    .order('name');
  if (error) throw Errors.internal('Falha ao listar papéis', { error: error.message });
  return data ?? [];
}

// ============================================================
// MUTATIONS — ROLES
// ============================================================

export interface AssignRoleInput {
  user_id: string;
  role_id: string;
  store_id: string;
}

export async function assignRole(supabase: SbClient, userId: string, input: AssignRoleInput) {
  await requireUserManage(supabase, userId);
  if (!input.store_id) throw Errors.validation('Loja obrigatória para atribuição de papel');
  const { data, error } = await supabase
    .from('user_roles')
    .insert({ user_id: input.user_id, role_id: input.role_id, store_id: input.store_id, granted_by: userId })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw Errors.conflict('Papel já atribuído a este usuário/loja');
    throw Errors.internal('Falha ao atribuir papel', { error: error.message });
  }
  await audit(supabase, userId, 'user.role_assigned', input.user_id, { role_id: input.role_id, store_id: input.store_id });
  return data;
}

export async function revokeRole(supabase: SbClient, userId: string, userRoleId: string) {
  await requireUserManage(supabase, userId);
  const { data: existing } = await supabase
    .from('user_roles')
    .select('user_id,role_id,store_id')
    .eq('id', userRoleId)
    .maybeSingle();
  const { error } = await supabase.from('user_roles').delete().eq('id', userRoleId);
  if (error) throw Errors.internal('Falha ao revogar papel', { error: error.message });
  await audit(supabase, userId, 'user.role_revoked', existing?.user_id ?? null, {
    user_role_id: userRoleId,
    role_id: existing?.role_id ?? null,
    store_id: existing?.store_id ?? null,
  });
  return { ok: true };
}

// ============================================================
// PROFILE / SECURITY
// ============================================================

export interface UpdateProfileInput {
  user_id: string;
  full_name?: string | null;
  phone?: string | null;
  job_title?: string | null;
  avatar_url?: string | null;
  locale?: string | null;
  default_store_id?: string | null;
}

export async function updateProfile(supabase: SbClient, userId: string, input: UpdateProfileInput) {
  await requireUserManage(supabase, userId);
  const patch: Record<string, unknown> = {};
  (['full_name', 'phone', 'job_title', 'avatar_url', 'locale', 'default_store_id'] as const).forEach((k) => {
    if (k in input) patch[k] = input[k];
  });
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('user_id', input.user_id)
    .select()
    .single();
  if (error) throw Errors.internal('Falha ao atualizar perfil', { error: error.message });
  await audit(supabase, userId, 'user.profile_updated', input.user_id, patch);
  return data;
}

export async function setUserActive(supabase: SbClient, userId: string, targetUserId: string, active: boolean) {
  await requireUserManage(supabase, userId);
  const { error } = await supabase.from('profiles').update({ is_active: active }).eq('user_id', targetUserId);
  if (error) throw Errors.internal('Falha ao alterar status', { error: error.message });
  await audit(supabase, userId, active ? 'user.activated' : 'user.deactivated', targetUserId, { is_active: active });
  return { ok: true };
}

export async function blockUser(supabase: SbClient, userId: string, targetUserId: string, reason: string) {
  await requireUserManage(supabase, userId);
  if (!reason?.trim()) throw Errors.validation('Motivo do bloqueio é obrigatório');
  const { error } = await supabase
    .from('profiles')
    .update({ is_blocked: true, blocked_reason: reason })
    .eq('user_id', targetUserId);
  if (error) throw Errors.internal('Falha ao bloquear', { error: error.message });
  // Revoga sessões ativas
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  await supabaseAdmin.auth.admin.signOut(targetUserId).catch(() => undefined);
  await supabase.from('user_sessions').update({ revoked_at: new Date().toISOString() }).eq('user_id', targetUserId).is('revoked_at', null);
  await audit(supabase, userId, 'user.blocked', targetUserId, { reason });
  return { ok: true };
}

export async function unblockUser(supabase: SbClient, userId: string, targetUserId: string) {
  await requireUserManage(supabase, userId);
  const { error } = await supabase
    .from('profiles')
    .update({ is_blocked: false, blocked_reason: null })
    .eq('user_id', targetUserId);
  if (error) throw Errors.internal('Falha ao desbloquear', { error: error.message });
  await audit(supabase, userId, 'user.unblocked', targetUserId);
  return { ok: true };
}

export async function forcePasswordChange(supabase: SbClient, userId: string, targetUserId: string, force: boolean) {
  await requireUserManage(supabase, userId);
  const { error } = await supabase.from('profiles').update({ must_change_password: force }).eq('user_id', targetUserId);
  if (error) throw Errors.internal('Falha ao alterar flag de senha', { error: error.message });
  await audit(supabase, userId, 'user.force_password_change', targetUserId, { force });
  return { ok: true };
}

export async function resetPassword(supabase: SbClient, userId: string, targetUserId: string) {
  await requireUserManage(supabase, userId);
  const { data: prof } = await supabase.from('profiles').select('email').eq('user_id', targetUserId).maybeSingle();
  const email = prof?.email;
  if (!email) throw Errors.validation('Usuário sem e-mail cadastrado');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email });
  if (error) throw Errors.internal('Falha ao gerar link de redefinição', { error: error.message });
  await audit(supabase, userId, 'user.password_reset_requested', targetUserId, { email });
  return { ok: true, action_link: data.properties?.action_link ?? null };
}

export async function revokeSession(supabase: SbClient, userId: string, sessionId: string) {
  await requireUserManage(supabase, userId);
  const { data: sess } = await supabase.from('user_sessions').select('user_id').eq('id', sessionId).maybeSingle();
  const { error } = await supabase.from('user_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', sessionId);
  if (error) throw Errors.internal('Falha ao revogar sessão', { error: error.message });
  await audit(supabase, userId, 'user.session_revoked', sess?.user_id ?? null, { session_id: sessionId });
  return { ok: true };
}

// ============================================================
// INVITE
// ============================================================

export interface InviteUserInput {
  email: string;
  full_name?: string;
  phone?: string;
  job_title?: string;
  role_id?: string;
  store_id?: string;
}

export async function inviteUser(supabase: SbClient, userId: string, input: InviteUserInput) {
  await requireUserManage(supabase, userId);
  if (!input.email?.trim()) throw Errors.validation('E-mail obrigatório');

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(input.email.trim(), {
    data: { full_name: input.full_name },
  });
  if (error) throw Errors.internal('Falha ao enviar convite', { error: error.message });

  const newUserId = data.user?.id;
  if (newUserId) {
    // Garante profile + dados extras (trigger já cria, fazemos upsert dos campos)
    await supabase
      .from('profiles')
      .update({
        full_name: input.full_name ?? null,
        phone: input.phone ?? null,
        job_title: input.job_title ?? null,
        must_change_password: true,
      })
      .eq('user_id', newUserId);

    if (input.role_id && input.store_id) {
      await supabase.from('user_roles').insert({
        user_id: newUserId,
        role_id: input.role_id,
        store_id: input.store_id,
        granted_by: userId,
      });
    }
  }
  await audit(supabase, userId, 'user.invited', newUserId ?? null, { email: input.email, role_id: input.role_id ?? null, store_id: input.store_id ?? null });
  return { ok: true, user_id: newUserId };
}

// ============================================================
// AUDIT — list events for a target user
// ============================================================
export async function listUserAudit(supabase: SbClient, userId: string, targetUserId: string, limit = 50) {
  await requireUserManage(supabase, userId);
  const { data, error } = await supabase
    .from('audit_log')
    .select('id,actor_user_id,action,diff,created_at')
    .eq('entity_type', 'user')
    .eq('entity_id', targetUserId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw Errors.internal('Falha ao listar auditoria', { error: error.message });
  return data ?? [];
}

// ============================================================
// BOOTSTRAP — first super admin
// ============================================================
export async function bootstrapStatus(supabase: SbClient) {
  const { count } = await supabase
    .from('user_roles')
    .select('user_id,roles!inner(code)', { count: 'exact', head: true })
    .eq('roles.code', 'super_admin');
  return { has_super_admin: (count ?? 0) > 0 };
}

export async function claimSuperAdmin(supabase: SbClient) {
  const { data, error } = await supabase.rpc('claim_first_super_admin');
  if (error) throw Errors.forbidden(error.message);
  return data as { ok: boolean; user_id: string };
}
