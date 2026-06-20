/**
 * Camada de Permissões (RBAC) — server-only.
 *
 * Helpers que delegam às funções `has_permission` / `is_super_admin`
 * já criadas no banco (SECURITY DEFINER, search_path = public).
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';

export async function isSuperAdmin(supabase: SbClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_super_admin', { _user_id: userId });
  if (error) throw Errors.internal('Falha ao verificar super admin', { error: error.message });
  return !!data;
}

export async function hasPermission(
  supabase: SbClient,
  userId: string,
  permissionCode: string,
  storeId: string | null = null,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_permission', {
    _user_id: userId,
    _permission_code: permissionCode,
    _store_id: storeId,
  });
  if (error) throw Errors.internal('Falha ao verificar permissão', { error: error.message });
  return !!data;
}

/**
 * Garante que o usuário tem a permissão no escopo da loja.
 * Super admin sempre passa.
 */
export async function requirePermission(
  supabase: SbClient,
  userId: string,
  permissionCode: string,
  storeId: string,
): Promise<void> {
  if (await isSuperAdmin(supabase, userId)) return;
  if (await hasPermission(supabase, userId, permissionCode, storeId)) return;
  throw Errors.forbidden(`Permissão necessária: ${permissionCode}`, {
    permission: permissionCode,
    store_id: storeId,
  });
}

/**
 * Garante que o usuário tem acesso (qualquer papel) à loja.
 * Útil para leituras genéricas.
 */
export async function requireStoreAccess(
  supabase: SbClient,
  userId: string,
  storeId: string,
): Promise<void> {
  if (await isSuperAdmin(supabase, userId)) return;
  const { data, error } = await supabase.rpc('user_store_ids', { _user_id: userId });
  if (error) throw Errors.internal('Falha ao verificar acesso à loja', { error: error.message });
  const stores = (data ?? []) as string[];
  if (!stores.includes(storeId)) {
    throw Errors.forbidden('Sem acesso a esta loja', { store_id: storeId });
  }
}
