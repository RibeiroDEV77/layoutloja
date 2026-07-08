/**
 * Storefront cart hook.
 *
 * - Retail (visitante ou logado): endpoints `anon*`, identifica-se por
 *   `session_token` (UUID em localStorage).
 * - Wholesale (P5.1): endpoints `wholesale*` autenticados; visitante nunca
 *   toca aqui. Autorização (customer + aplicação aprovada) acontece no
 *   servidor (`Cart.getOrCreateCart`), e `error` é exposto para a UI.
 *
 * Carrinhos retail e wholesale são separados por chave localStorage e por
 * `sales_channel` na tabela `carts`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import {
  anonGetOrCreateCart,
  anonGetCart,
  anonAddProductToCart,
  anonAddCartItem,
  anonUpdateCartItemQty,
  anonRemoveCartItem,
  wholesaleGetOrCreateCart,
  wholesaleGetCart,
  wholesaleAddProductToCart,
  wholesaleAddCartItem,
  wholesaleUpdateCartItemQty,
  wholesaleRemoveCartItem,
} from '@/lib/business/checkout.functions';


import { getStorefrontStore } from '@/lib/business/storefront.functions';

const SESSION_KEY = 'storefront.cart.session';
const CART_KEY_BASE = 'storefront.cart.id';
export type SalesChannel = 'retail' | 'wholesale';
function cartKeyFor(channel: SalesChannel): string {
  // Retroativo: o canal 'retail' continua usando a chave legada.
  return channel === 'retail' ? CART_KEY_BASE : `${CART_KEY_BASE}:${channel}`;
}

function ensureSessionToken(): string {
  if (typeof window === 'undefined') return '';
  let t = window.localStorage.getItem(SESSION_KEY);
  if (!t) {
    t = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    window.localStorage.setItem(SESSION_KEY, t);
  }
  return t;
}

export type StorefrontCartItem = {
  id: string;
  variant_id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  line_total: number;
  snapshot: { product_name?: string; sku?: string } & Record<string, unknown>;
};

export type StorefrontCartState = {
  ready: boolean;
  loading: boolean;
  storeId: string | null;
  cartId: string | null;
  sessionToken: string;
  items: StorefrontCartItem[];
  subtotal: number;
  itemsCount: number;
  total: number;
  shippingTotal: number;
  currency: string;
  selectedShippingQuoteId: string | null;
  shippingQuotes: ShippingQuote[];
  /** Erro de autorização do canal (ex.: wholesale exigindo login/aprovação). */
  error: string | null;
};

export type ShippingQuote = {
  id: string;
  method_code: string | null;
  method_name: string | null;
  carrier: string | null;
  provider_code: string | null;
  price: number;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  selected: boolean;
};

function messageOf(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const anyErr = err as Record<string, unknown>;
    const msg = (anyErr.message ?? (anyErr.error as Record<string, unknown> | undefined)?.message) as string | undefined;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}

export function useStorefrontCart(salesChannel: SalesChannel = 'retail') {
  const CART_KEY = cartKeyFor(salesChannel);
  const isWholesale = salesChannel === 'wholesale';

  const fnStore = useServerFn(getStorefrontStore);

  // Retail (anon)
  const fnAnonGetOrCreate = useServerFn(anonGetOrCreateCart);
  const fnAnonGet = useServerFn(anonGetCart);
  const fnAnonAddProduct = useServerFn(anonAddProductToCart);
  const fnAnonAddVariant = useServerFn(anonAddCartItem);
  const fnAnonUpdate = useServerFn(anonUpdateCartItemQty);
  const fnAnonRemove = useServerFn(anonRemoveCartItem);

  // Wholesale (auth)
  const fnWsGetOrCreate = useServerFn(wholesaleGetOrCreateCart);
  const fnWsGet = useServerFn(wholesaleGetCart);
  const fnWsAddProduct = useServerFn(wholesaleAddProductToCart);
  const fnWsAddVariant = useServerFn(wholesaleAddCartItem);
  const fnWsUpdate = useServerFn(wholesaleUpdateCartItemQty);
  const fnWsRemove = useServerFn(wholesaleRemoveCartItem);

  const [state, setState] = useState<StorefrontCartState>(() => ({
    ready: false,
    loading: false,
    storeId: null,
    cartId: null,
    sessionToken: '',
    items: [],
    subtotal: 0,
    itemsCount: 0,
    total: 0,
    shippingTotal: 0,
    currency: 'BRL',
    selectedShippingQuoteId: null,
    shippingQuotes: [],
    error: null,
  }));

  const applyCartPayload = useCallback((payload: { cart: Record<string, unknown>; items: unknown[]; shipping_quotes?: unknown[] }) => {
    const c = payload.cart as Record<string, unknown>;
    setState((s) => ({
      ...s,
      cartId: String(c.id ?? ''),
      subtotal: Number(c.subtotal ?? 0),
      total: Number(c.total ?? 0),
      shippingTotal: Number(c.shipping_total ?? 0),
      itemsCount: Number(c.items_count ?? 0),
      currency: String(c.currency ?? 'BRL'),
      selectedShippingQuoteId: (c.selected_shipping_quote_id as string | null) ?? null,
      items: (payload.items ?? []) as StorefrontCartItem[],
      shippingQuotes: ((payload.shipping_quotes ?? []) as ShippingQuote[])
        .slice()
        .sort((a, b) => a.price - b.price),
    }));
  }, []);

  // Adaptadores canal-agnósticos.
  const getCartPayload = useCallback(async (cartId: string, sessionToken: string) => {
    if (isWholesale) return (await fnWsGet({ data: { cart_id: cartId } })) as never;
    return (await fnAnonGet({ data: { cart_id: cartId, session_token: sessionToken } })) as never;
  }, [isWholesale, fnWsGet, fnAnonGet]);

  // bootstrap — re-executa quando o canal muda (cartId namespaced por canal).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sessionToken = ensureSessionToken();
      setState((s) => ({
        ...s,
        sessionToken,
        loading: true,
        ready: false,
        cartId: null,
        items: [],
        itemsCount: 0,
        subtotal: 0,
        total: 0,
        shippingTotal: 0,
        shippingQuotes: [],
        selectedShippingQuoteId: null,
        error: null,
      }));
      try {
        const { store } = await fnStore();
        if (cancelled) return;
        if (!store) {
          setState((s) => ({ ...s, ready: true, loading: false }));
          return;
        }
        const storedCartId = typeof window !== 'undefined' ? window.localStorage.getItem(CART_KEY) : null;
        let cartPayload: { cart: Record<string, unknown>; items: unknown[]; shipping_quotes?: unknown[] } | null = null;
        if (storedCartId) {
          try {
            cartPayload = await getCartPayload(storedCartId, sessionToken);
          } catch {
            cartPayload = null;
          }
        }
        if (!cartPayload) {
          try {
            const cart = isWholesale
              ? await fnWsGetOrCreate({ data: { store_id: store.id } })
              : await fnAnonGetOrCreate({ data: { store_id: store.id, session_token: sessionToken, sales_channel: 'retail' } });
            const cartId = String((cart as { id: string }).id);
            if (typeof window !== 'undefined') window.localStorage.setItem(CART_KEY, cartId);
            cartPayload = await getCartPayload(cartId, sessionToken);
          } catch (err) {
            // Wholesale sem login/aprovação → mensagem clara, sem carrinho criado.
            if (!cancelled) {
              setState((s) => ({
                ...s,
                ready: true,
                loading: false,
                error: isWholesale
                  ? messageOf(err, 'Canal atacado exige cliente autenticado e aprovado.')
                  : messageOf(err, 'Não foi possível abrir o carrinho.'),
              }));
            }
            return;
          }
        }
        if (cancelled || !cartPayload) return;
        applyCartPayload(cartPayload);
        setState((s) => ({ ...s, storeId: store.id, ready: true, loading: false, error: null }));
      } catch {
        if (!cancelled) setState((s) => ({ ...s, ready: true, loading: false }));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesChannel]);

  const refresh = useCallback(async () => {
    if (!state.cartId) return;
    const payload = await getCartPayload(state.cartId, state.sessionToken);
    applyCartPayload(payload);
  }, [state.cartId, state.sessionToken, getCartPayload, applyCartPayload]);

  const wrap = useCallback(async (op: () => Promise<unknown>) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      await op();
      await refresh();
    } catch (err) {
      setState((s) => ({ ...s, error: messageOf(err, 'Operação não permitida no canal atual.') }));
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [refresh]);

  const add = useCallback(async (productId: string, qty = 1) => {
    if (!state.cartId) return;
    await wrap(() => isWholesale
      ? fnWsAddProduct({ data: { cart_id: state.cartId!, product_id: productId, qty } })
      : fnAnonAddProduct({ data: { cart_id: state.cartId!, product_id: productId, qty, session_token: state.sessionToken } }));
  }, [state.cartId, state.sessionToken, isWholesale, fnWsAddProduct, fnAnonAddProduct, wrap]);

  const update = useCallback(async (itemId: string, qty: number) => {
    if (!state.cartId) return;
    await wrap(() => isWholesale
      ? fnWsUpdate({ data: { cart_id: state.cartId!, item_id: itemId, qty } })
      : fnAnonUpdate({ data: { cart_id: state.cartId!, item_id: itemId, qty, session_token: state.sessionToken } }));
  }, [state.cartId, state.sessionToken, isWholesale, fnWsUpdate, fnAnonUpdate, wrap]);

  const remove = useCallback(async (itemId: string) => {
    if (!state.cartId) return;
    await wrap(() => isWholesale
      ? fnWsRemove({ data: { cart_id: state.cartId!, item_id: itemId } })
      : fnAnonRemove({ data: { cart_id: state.cartId!, item_id: itemId, session_token: state.sessionToken } }));
  }, [state.cartId, state.sessionToken, isWholesale, fnWsRemove, fnAnonRemove, wrap]);

  const addVariant = useCallback(async (variantId: string, qty = 1) => {
    if (!state.cartId) return;
    await wrap(() => isWholesale
      ? fnWsAddVariant({ data: { cart_id: state.cartId!, variant_id: variantId, qty } })
      : fnAnonAddVariant({ data: { cart_id: state.cartId!, variant_id: variantId, qty, session_token: state.sessionToken } }));
  }, [state.cartId, state.sessionToken, isWholesale, fnWsAddVariant, fnAnonAddVariant, wrap]);



  return useMemo(() => ({ ...state, add, addVariant, update, remove, refresh }), [state, add, addVariant, update, remove, refresh]);
}


export function formatBRL(n: number, currency = 'BRL'): string {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(n);
  } catch {
    return `R$ ${n.toFixed(2)}`;
  }
}

export function clearStoredCart(salesChannel: SalesChannel = 'retail') {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(cartKeyFor(salesChannel));
}
