/**
 * Storefront session helpers (server-only).
 *
 * - `sf_session` (httpOnly): identificador estável do visitante anônimo (UUID).
 *   Usado como `carts.session_token`.
 * - `sf_cart_id` (httpOnly): última cart_id criada para esta sessão. Cookie evita
 *   roundtrip extra para reidentificar o carrinho a cada request.
 *
 * Os cookies são httpOnly: o frontend NUNCA lê o session_token — só atua via
 * server functions públicas.
 */
import { getCookie, setCookie } from '@tanstack/react-start/server';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: true,
  path: '/',
  maxAge: 60 * 60 * 24 * 60, // 60 days
};

export function getOrCreateSessionToken(): string {
  let token = getCookie('sf_session');
  if (!token) {
    token = crypto.randomUUID();
    setCookie('sf_session', token, COOKIE_OPTS);
  }
  return token;
}

export function getStoredCartId(): string | null {
  return getCookie('sf_cart_id') ?? null;
}

export function setStoredCartId(cartId: string): void {
  setCookie('sf_cart_id', cartId, COOKIE_OPTS);
}

export function clearStoredCartId(): void {
  setCookie('sf_cart_id', '', { ...COOKIE_OPTS, maxAge: 0 });
}
