/**
 * Service: Users & Roles — gestão de usuários, papéis e convites.
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { isSuperAdmin } from './permissions.server';

async function requireUserManage(supabase: SbClient, userId: string) {
  if (!(await isSuperAdmin(supabase, userId))) {
    throw Errors.forbidden('Apenas super administradores podem gerenciar usuários');
  }
}

async function audit(supabase: SbClient, userId: string, action: string, targetUserId: string | null, diff?: Record<string, unknown>) {
  await supabase.from('audit_log').insert({
    actor_user_id: userId,
    entity_type: 'user',
    entity_id: targetUserId,
    action,
    diff: (diff ?? {}) as never,
  });
}

export interface ListUsersInput {
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function listUsers(supabase: SbClient, userId: string, input: ListUsersInput) {
  await requireUserManage(supabase, userId);
  const page = Math.max(1, input.page ?? 1);
  const size = Math.min(100, Math.max(1, input.pageSize ?? 25));
  const from = (page - 1) * size;
  const to = from + size - 1;

  let q = supabase.from('profiles').select('id,user_id,full_name,phone,avatar_url,locale,created_at,updated_at', { count: 'exact' });
  if (input.q?.trim()) {
    const safe = input.q.replace(/[%,]/g, '');
    q = q.or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%`);
  }
  q = q.order('created_at', { ascending: false }).range(from, to);
  const { data: profiles, error, count } = await q;
  if (error) throw Errors.internal('Falha ao listar usuários', { error: error.message });

  // roles por usuário
  const userIds = (profiles ?? []).map((p) => p.user_id);
  let rolesByUser: Record<string, { role_id: string; role_code: string; role_name: string; store_id: string | null }[]> = {};
  if (userIds.length > 0) {
    const { data: rolesData, error: rolesErr } = await supabase
      .from('user_roles')
      .select('user_id,role_id,store_id,roles(code,name)')
      .in('user_id', userIds);
    if (rolesErr) throw Errors.internal('Falha ao listar papéis', { error: rolesErr.message });
    rolesByUser = (rolesData ?? []).reduce((acc, r) => {
      const arr = acc[r.user_id] ?? (acc[r.user_id] = []);
      const role = r.roles as unknown as { code: string; name: string } | null;
      arr.push({ role_id: r.role_id, role_code: role?.code ?? '?', role_name: role?.name ?? '?', store_id: r.store_id });
      return acc;
    }, {} as typeof rolesByUser);
  }

  const rows = (profiles ?? []).map((p) => ({
    ...p,
    roles: rolesByUser[p.user_id] ?? [],
  }));

  return { rows, total: count ?? 0, page, pageSize: size };
}

export async function listRoles(supabase: SbClient, userId: string) {
  await requireUserManage(supabase, userId);
  const { data, error } = await supabase.from('roles').select('id,code,name,description,is_system').order('name');
  if (error) throw Errors.internal('Falha ao listar papéis', { error: error.message });
  return data ?? [];
}

export interface AssignRoleInput {
  user_id: string;
  role_id: string;
  store_id?: string | null;
}

export async function assignRole(supabase: SbClient, userId: string, input: AssignRoleInput) {
  await requireUserManage(supabase, userId);
  const { data, error } = await supabase.from('user_roles').insert({
    user_id: input.user_id,
    role_id: input.role_id,
    store_id: input.store_id ?? null,
    granted_by: userId,
  }).select().single();
  if (error) {
    if (error.code === '23505') throw Errors.rule('Papel já atribuído a este usuário/loja');
    throw Errors.internal('Falha ao atribuir papel', { error: error.message });
  }
  await audit(supabase, userId, 'user.role_assigned', input.user_id, { role_id: input.role_id, store_id: input.store_id });
  return data;
}

export async function revokeRole(supabase: SbClient, userId: string, userRoleId: string) {
  await requireUserManage(supabase, userId);
  const { data: existing } = await supabase.from('user_roles').select('user_id').eq('id', userRoleId).maybeSingle();
  const { error } = await supabase.from('user_roles').delete().eq('id', userRoleId);
  if (error) throw Errors.internal('Falha ao revogar papel', { error: error.message });
  await audit(supabase, userId, 'user.role_revoked', existing?.user_id ?? null, { user_role_id: userRoleId });
  return { ok: true };
}

export interface InviteUserInput {
  email: string;
  full_name?: string;
  role_id?: string;
  store_id?: string;
}

export async function inviteUser(supabase: SbClient, userId: string, input: InviteUserInput) {
  await requireUserManage(supabase, userId);
  if (!input.email?.trim()) throw Errors.validation('E-mail obrigatório');

  // Operação privilegiada → admin client
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(input.email.trim(), {
    data: { full_name: input.full_name },
  });
  if (error) throw Errors.internal('Falha ao enviar convite', { error: error.message });

  const newUserId = data.user?.id;
  if (newUserId && input.role_id) {
    await supabase.from('user_roles').insert({
      user_id: newUserId,
      role_id: input.role_id,
      store_id: input.store_id ?? null,
      granted_by: userId,
    });
  }
  await audit(supabase, userId, 'user.invited', newUserId ?? null, { email: input.email });
  return { ok: true, user_id: newUserId };
}
