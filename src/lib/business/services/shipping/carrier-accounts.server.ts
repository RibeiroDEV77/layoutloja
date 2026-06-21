/**
 * Carrier Accounts service — CRUD de contas de transportadora por loja,
 * com gestão segura de credenciais (criptografadas via RPC pgcrypto).
 *
 * NUNCA retorna credenciais em texto-claro para a UI. Leituras de plaintext
 * só acontecem em workers/services server-side via `getDecryptedCredentials`,
 * que usa o admin client e a RPC `shipping_get_credentials`.
 */
import type { SbClient } from '../../events/dispatcher.server';
import { Errors } from '../../errors';
import { hasPermission, isSuperAdmin } from '../permissions.server';
import { recordMetric } from '@/lib/foundations/observability.functions';
import { getShippingAdapter, listShippingProviderDescriptors } from './registry.server';
import type { AdapterContext, AdapterCredentials } from './adapter';

async function assertManage(supabase: SbClient, userId: string, storeId: string) {
  if (await isSuperAdmin(supabase, userId)) return;
  if (await hasPermission(supabase, userId, 'shipping.manage', storeId)) return;
  throw Errors.forbidden('Permissão necessária: shipping.manage');
}

export function listAvailableProviders() {
  return listShippingProviderDescriptors();
}

export async function listCarrierAccounts(supabase: SbClient, userId: string, storeId: string) {
  await assertManage(supabase, userId, storeId);
  const { data, error } = await supabase
    .from('shipping_carrier_accounts')
    .select(
      'id, store_id, provider_code, display_name, is_active, sandbox, config, capabilities, credentials_fingerprint, credentials_set_at, credentials_set_by, last_test_at, last_test_ok, last_test_error, created_at, updated_at',
    )
    .eq('store_id', storeId)
    .order('created_at');
  if (error) throw Errors.internal('Falha ao listar contas', { error: error.message });
  return data ?? [];
}

export interface CreateCarrierAccountInput {
  store_id: string;
  provider_code: string;
  display_name: string;
  sandbox?: boolean;
  is_active?: boolean;
  config?: Record<string, unknown>;
}

export async function createCarrierAccount(
  supabase: SbClient,
  userId: string,
  input: CreateCarrierAccountInput,
) {
  await assertManage(supabase, userId, input.store_id);
  const adapter = getShippingAdapter(input.provider_code);
  if (!adapter) throw Errors.rule(`Provider desconhecido: ${input.provider_code}`);
  const { data, error } = await supabase
    .from('shipping_carrier_accounts')
    .insert({
      store_id: input.store_id,
      provider_code: input.provider_code,
      display_name: input.display_name,
      sandbox: input.sandbox ?? true,
      is_active: input.is_active ?? true,
      config: input.config ?? {},
      capabilities: adapter.capabilities as unknown as Record<string, unknown>,
      created_by: userId,
    })
    .select('id, store_id, provider_code, display_name, is_active, sandbox, config, capabilities, created_at, updated_at')
    .single();
  if (error) throw Errors.internal('Falha ao criar conta', { error: error.message });
  await recordMetric(supabase, {
    scope: 'shipping', name: 'carrier_account.created', value: 1, storeId: input.store_id,
    tags: { provider: input.provider_code },
  });
  return data;
}

export interface UpdateCarrierAccountInput {
  id: string;
  display_name?: string;
  is_active?: boolean;
  sandbox?: boolean;
  config?: Record<string, unknown>;
}

export async function updateCarrierAccount(
  supabase: SbClient,
  userId: string,
  input: UpdateCarrierAccountInput,
) {
  const { data: acc } = await supabase
    .from('shipping_carrier_accounts').select('store_id').eq('id', input.id).maybeSingle();
  if (!acc) throw Errors.notFound('Conta de transportadora');
  await assertManage(supabase, userId, acc.store_id);
  const patch: Record<string, unknown> = {};
  if (input.display_name !== undefined) patch.display_name = input.display_name;
  if (input.is_active !== undefined) patch.is_active = input.is_active;
  if (input.sandbox !== undefined) patch.sandbox = input.sandbox;
  if (input.config !== undefined) patch.config = input.config;
  const { data, error } = await supabase
    .from('shipping_carrier_accounts')
    .update(patch).eq('id', input.id)
    .select('id, store_id, provider_code, display_name, is_active, sandbox, config, capabilities, updated_at')
    .single();
  if (error) throw Errors.internal('Falha ao atualizar conta', { error: error.message });
  return data;
}

export async function deleteCarrierAccount(supabase: SbClient, userId: string, id: string) {
  const { data: acc } = await supabase
    .from('shipping_carrier_accounts').select('store_id').eq('id', id).maybeSingle();
  if (!acc) throw Errors.notFound('Conta de transportadora');
  await assertManage(supabase, userId, acc.store_id);
  const { error } = await supabase.from('shipping_carrier_accounts').delete().eq('id', id);
  if (error) throw Errors.internal('Falha ao remover conta', { error: error.message });
  return { ok: true };
}

export async function setCarrierAccountCredentials(
  supabase: SbClient,
  userId: string,
  input: { id: string; credentials: AdapterCredentials },
) {
  const { data: acc } = await supabase
    .from('shipping_carrier_accounts').select('store_id, provider_code').eq('id', input.id).maybeSingle();
  if (!acc) throw Errors.notFound('Conta de transportadora');
  await assertManage(supabase, userId, acc.store_id);
  const adapter = getShippingAdapter(acc.provider_code);
  if (!adapter) throw Errors.rule(`Provider desconhecido: ${acc.provider_code}`);
  // valida campos obrigatórios contra o schema do adapter
  for (const f of adapter.credentialSchema) {
    if (f.required) {
      const v = (input.credentials as Record<string, unknown>)[f.key];
      if (v === undefined || v === null || v === '') {
        throw Errors.validation(`Campo obrigatório: ${f.label}`, { field: f.key });
      }
    }
  }
  const { error } = await supabase.rpc('shipping_set_credentials', {
    _account_id: input.id,
    _creds: input.credentials as unknown as never,
  });
  if (error) throw Errors.internal('Falha ao gravar credenciais', { error: error.message });
  await recordMetric(supabase, {
    scope: 'shipping', name: 'carrier_account.credentials_rotated', value: 1, storeId: acc.store_id,
    tags: { provider: acc.provider_code },
  });
  return { ok: true };
}

/**
 * Testa as credenciais usando o adapter. Roda server-side (chama RPC via
 * admin client para decifrar plaintext) e grava resultado em `last_test_*`.
 */
export async function testCarrierAccount(supabase: SbClient, userId: string, id: string) {
  const { data: acc } = await supabase
    .from('shipping_carrier_accounts')
    .select('id, store_id, provider_code, display_name, sandbox, config, capabilities')
    .eq('id', id).maybeSingle();
  if (!acc) throw Errors.notFound('Conta de transportadora');
  await assertManage(supabase, userId, acc.store_id);
  const adapter = getShippingAdapter(acc.provider_code);
  if (!adapter) throw Errors.rule(`Provider desconhecido: ${acc.provider_code}`);

  // Decifra credenciais usando admin client + RPC restrita a service_role.
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: creds, error: credErr } = await supabaseAdmin.rpc(
    'shipping_get_credentials', { _account_id: id },
  );
  if (credErr) throw Errors.internal('Falha ao decifrar credenciais', { error: credErr.message });

  const ctx: AdapterContext = {
    account: {
      id: acc.id,
      store_id: acc.store_id,
      provider_code: acc.provider_code,
      display_name: acc.display_name,
      sandbox: acc.sandbox,
      config: (acc.config ?? {}) as Record<string, unknown>,
      capabilities: (acc.capabilities ?? {}) as Record<string, unknown>,
    },
    credentials: (creds as AdapterCredentials | null) ?? null,
  };

  const result = await adapter.testConnection(ctx);
  await supabase.from('shipping_carrier_accounts').update({
    last_test_at: new Date().toISOString(),
    last_test_ok: result.ok,
    last_test_error: result.ok ? null : result.error.slice(0, 500),
  }).eq('id', id);
  await recordMetric(supabase, {
    scope: 'shipping', name: 'carrier_account.test', value: 1, storeId: acc.store_id,
    tags: { provider: acc.provider_code, ok: String(result.ok) },
  });
  return result;
}
