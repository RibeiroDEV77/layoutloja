/**
 * Melhor Envio — OAuth 2.0 (Authorization Code + PKCE) e gestão de tokens.
 *
 * Estratégia:
 *  - Tokens (access_token, refresh_token, expires_at, scope) ficam CIFRADOS
 *    em `shipping_carrier_accounts.credentials` via as RPCs já existentes
 *    `shipping_set_credentials` / `shipping_get_credentials` (pgcrypto +
 *    keyring). Não criamos tabela nova de tokens — reutilizamos o keyring.
 *  - O `state` + `code_verifier` (PKCE) ficam em `shipping_oauth_states`
 *    com TTL de 10 minutos e são consumidos uma única vez via RPC
 *    `shipping_oauth_consume_state`.
 *  - `ensureFreshAccessToken()` é o ponto único de leitura: descriptografa,
 *    refaz refresh se faltar < 60s para expirar, persiste de volta e devolve
 *    o token válido para o adapter.
 *
 * Server-only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

type AdminSb = SupabaseClient<Database>;

const PROVIDER_CODE = 'melhor_envio';
const DEFAULT_SCOPES = [
  'cart-read', 'cart-write',
  'companies-read', 'companies-write',
  'coupons-read', 'coupons-write',
  'notifications-read',
  'orders-read',
  'products-read', 'products-destroy', 'products-write',
  'purchases-read',
  'shipping-calculate', 'shipping-cancel', 'shipping-checkout',
  'shipping-companies', 'shipping-generate', 'shipping-preview',
  'shipping-print', 'shipping-share', 'shipping-tracking',
  'ecommerce-shipping',
  'transactions-read',
  'users-read', 'users-write',
].join(' ');

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  /** ISO timestamp. */
  expires_at: string;
  token_type: string;
  scope?: string;
  user_agent?: string;
}

export function getEnv() {
  const client_id = process.env.MELHOR_ENVIO_CLIENT_ID;
  const client_secret = process.env.MELHOR_ENVIO_CLIENT_SECRET;
  const redirect_uri = process.env.MELHOR_ENVIO_REDIRECT_URI;
  const raw_environment = process.env.MELHOR_ENVIO_ENV;
  const webhook_secret = process.env.MELHOR_ENVIO_WEBHOOK_SECRET;
  const environment = (raw_environment ?? 'sandbox').toLowerCase();
  const sandbox = environment !== 'production';
  const envStatus = {
    MELHOR_ENVIO_CLIENT_ID: client_id ? 'defined' : 'undefined',
    MELHOR_ENVIO_CLIENT_SECRET: client_secret ? 'defined' : 'undefined',
    MELHOR_ENVIO_REDIRECT_URI: redirect_uri ? 'defined' : 'undefined',
    MELHOR_ENVIO_ENV: raw_environment ? 'defined' : 'undefined',
    MELHOR_ENVIO_WEBHOOK_SECRET: webhook_secret ? 'defined' : 'undefined',
  };
  console.info('[Melhor Envio getEnv]', {
    runtime: 'Server Function',
    variables: envStatus,
  });
  const missing: string[] = [];
  if (!client_id) missing.push('MELHOR_ENVIO_CLIENT_ID');
  if (!client_secret) missing.push('MELHOR_ENVIO_CLIENT_SECRET');
  if (!redirect_uri) missing.push('MELHOR_ENVIO_REDIRECT_URI');
  if (missing.length) {
    throw new Error(`Melhor Envio não configurado. Variáveis ausentes: ${missing.join(', ')}`);
  }
  return {
    client_id: client_id!,
    client_secret: client_secret!,
    redirect_uri: redirect_uri!,
    sandbox,
    host: sandbox ? 'https://sandbox.melhorenvio.com.br' : 'https://melhorenvio.com.br',
  };
}

function base64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return base64url(arr);
}

async function sha256(s: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
}

/**
 * Garante que existe (ou cria) uma `shipping_carrier_accounts` para o store
 * com `provider_code='melhor_envio'`. Devolve o id do account.
 */
export async function ensureMelhorEnvioAccount(
  admin: AdminSb,
  storeId: string,
  opts: { sandbox: boolean; createdBy?: string | null } = { sandbox: true },
): Promise<string> {
  const { data: existing, error: selErr } = await admin
    .from('shipping_carrier_accounts')
    .select('id')
    .eq('store_id', storeId)
    .eq('provider_code', PROVIDER_CODE)
    .maybeSingle();
  if (selErr) throw new Error(`Falha ao consultar conta Melhor Envio: ${selErr.message}`);
  if (existing?.id) return existing.id;

  const { data, error } = await admin
    .from('shipping_carrier_accounts')
    .insert({
      store_id: storeId,
      provider_code: PROVIDER_CODE,
      display_name: 'Melhor Envio',
      sandbox: opts.sandbox,
      is_active: true,
      config: {} as never,
      capabilities: {
        quote: true, tracking: true, label: true,
        pickup: true, reverseLogistics: true, sandbox: true,
      } as never,
      created_by: opts.createdBy ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(`Falha ao criar conta Melhor Envio: ${error.message}`);
  return data.id;
}

/**
 * Gera state + PKCE, persiste em `shipping_oauth_states` e devolve a URL
 * para a qual o admin deve ser redirecionado.
 */
export async function buildAuthorizationUrl(
  admin: AdminSb,
  args: { storeId: string; accountId: string; returnTo?: string },
): Promise<{ url: string; state: string }> {
  const env = getEnv();
  const state = randomToken(24);
  const code_verifier = randomToken(48);
  const code_challenge = base64url(await sha256(code_verifier));

  const { error } = await admin.from('shipping_oauth_states').insert({
    provider_code: PROVIDER_CODE,
    store_id: args.storeId,
    account_id: args.accountId,
    state,
    code_verifier,
    redirect_uri: env.redirect_uri,
    return_to: args.returnTo ?? null,
  });
  if (error) throw new Error(`Falha ao iniciar OAuth: ${error.message}`);

  const url = new URL(`${env.host}/oauth/authorize`);
  url.searchParams.set('client_id', env.client_id);
  url.searchParams.set('redirect_uri', env.redirect_uri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', DEFAULT_SCOPES);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', code_challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return { url: url.toString(), state };
}

interface OAuthStateRow {
  id: string;
  provider_code: string;
  store_id: string;
  account_id: string | null;
  code_verifier: string;
  redirect_uri: string;
  return_to: string | null;
}

export async function consumeOAuthState(
  admin: AdminSb,
  state: string,
): Promise<OAuthStateRow | null> {
  // SECURITY DEFINER RPC garante uso único + TTL.
  // O Supabase JS expõe RPC como `.rpc(name, args)`.
  const { data, error } = await admin.rpc('shipping_oauth_consume_state' as never, { _state: state } as never);
  if (error) throw new Error(`Falha ao validar state OAuth: ${error.message}`);
  const rows = (data as OAuthStateRow[] | null) ?? [];
  return rows[0] ?? null;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const env = getEnv();
  const res = await fetch(`${env.host}/oauth/token`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!res.ok) {
    const msg = typeof parsed === 'object' && parsed && 'message' in parsed
      ? String((parsed as Record<string, unknown>).message)
      : typeof parsed === 'string' ? parsed : `HTTP ${res.status}`;
    throw new Error(`Melhor Envio OAuth ${res.status}: ${msg}`);
  }
  return parsed as TokenResponse;
}

export async function exchangeCodeForTokens(
  args: { code: string; code_verifier: string; redirect_uri: string },
): Promise<OAuthTokens> {
  const env = getEnv();
  const tok = await postToken({
    grant_type: 'authorization_code',
    client_id: env.client_id,
    client_secret: env.client_secret,
    redirect_uri: args.redirect_uri,
    code: args.code,
    code_verifier: args.code_verifier,
  });
  return normalize(tok);
}

export async function refreshAccessToken(refresh_token: string): Promise<OAuthTokens> {
  const env = getEnv();
  const tok = await postToken({
    grant_type: 'refresh_token',
    client_id: env.client_id,
    client_secret: env.client_secret,
    refresh_token,
  });
  return normalize(tok);
}

function normalize(t: TokenResponse): OAuthTokens {
  const expires_at = new Date(Date.now() + Math.max(60, t.expires_in - 30) * 1000).toISOString();
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at,
    token_type: t.token_type ?? 'Bearer',
    scope: t.scope,
  };
}

export async function persistTokens(
  admin: AdminSb,
  accountId: string,
  tokens: OAuthTokens,
): Promise<void> {
  const { error } = await admin.rpc('shipping_set_credentials' as never, {
    _account_id: accountId,
    _creds: tokens as unknown as never,
  } as never);
  if (error) throw new Error(`Falha ao persistir tokens: ${error.message}`);
  await admin.from('shipping_carrier_accounts').update({
    last_test_at: new Date().toISOString(),
    last_test_ok: true,
    last_test_error: null,
  }).eq('id', accountId);
}

export async function loadTokens(
  admin: AdminSb,
  accountId: string,
): Promise<OAuthTokens | null> {
  const { data, error } = await admin.rpc(
    'shipping_get_credentials' as never,
    { _account_id: accountId } as never,
  );
  if (error) throw new Error(`Falha ao ler credenciais: ${error.message}`);
  const creds = (data ?? null) as Record<string, unknown> | null;
  if (!creds || typeof creds.access_token !== 'string') return null;
  return {
    access_token: String(creds.access_token),
    refresh_token: String(creds.refresh_token ?? ''),
    expires_at: String(creds.expires_at ?? new Date(0).toISOString()),
    token_type: String(creds.token_type ?? 'Bearer'),
    scope: creds.scope ? String(creds.scope) : undefined,
    user_agent: creds.user_agent ? String(creds.user_agent) : undefined,
  };
}

/**
 * Devolve um access_token válido. Faz refresh transparente quando faltam
 * < 60 segundos para expirar (ou já expirou). Persiste o novo par.
 */
export async function ensureFreshAccessToken(
  admin: AdminSb,
  accountId: string,
): Promise<OAuthTokens> {
  const current = await loadTokens(admin, accountId);
  if (!current) throw new Error('Melhor Envio não está conectado para esta loja.');
  const msToExpiry = new Date(current.expires_at).getTime() - Date.now();
  if (msToExpiry > 60_000) return current;
  if (!current.refresh_token) {
    throw new Error('Token expirado e sem refresh_token. Reconecte a integração.');
  }
  const refreshed = await refreshAccessToken(current.refresh_token);
  const merged: OAuthTokens = { ...current, ...refreshed };
  await persistTokens(admin, accountId, merged);
  return merged;
}

export async function getMelhorEnvioAccountId(
  admin: AdminSb,
  storeId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('shipping_carrier_accounts')
    .select('id')
    .eq('store_id', storeId)
    .eq('provider_code', PROVIDER_CODE)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function getConnectionStatus(
  admin: AdminSb,
  storeId: string,
): Promise<{
  connected: boolean;
  account_id: string | null;
  sandbox: boolean;
  expires_at: string | null;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  scope: string | null;
}> {
  const { data: acc } = await admin
    .from('shipping_carrier_accounts')
    .select('id, sandbox, last_test_at, last_test_ok')
    .eq('store_id', storeId)
    .eq('provider_code', PROVIDER_CODE)
    .maybeSingle();
  if (!acc) {
    return { connected: false, account_id: null, sandbox: true, expires_at: null,
             last_test_at: null, last_test_ok: null, scope: null };
  }
  const tokens = await loadTokens(admin, acc.id).catch(() => null);
  return {
    connected: !!tokens?.access_token,
    account_id: acc.id,
    sandbox: !!acc.sandbox,
    expires_at: tokens?.expires_at ?? null,
    last_test_at: acc.last_test_at,
    last_test_ok: acc.last_test_ok,
    scope: tokens?.scope ?? null,
  };
}

export async function disconnectAccount(
  admin: AdminSb,
  accountId: string,
): Promise<void> {
  // Sobrescreve credenciais com objeto vazio (mantém row para histórico).
  const { error } = await admin.rpc('shipping_set_credentials' as never, {
    _account_id: accountId,
    _creds: {} as unknown as never,
  } as never);
  if (error) throw new Error(`Falha ao desconectar: ${error.message}`);
  await admin.from('shipping_carrier_accounts').update({
    is_active: false,
    last_test_at: new Date().toISOString(),
    last_test_ok: false,
    last_test_error: 'Desconectado pelo administrador',
  }).eq('id', accountId);
}
