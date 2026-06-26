/**
 * Storefront cart hook (anônimo).
 *
 * - Persiste `session_token` (UUID) e `cart_id` em localStorage.
 * - Resolve o `store_id` via getStorefrontStore.
 * - Expõe: add(productId), remove(itemId), update(itemId,qty), refresh().
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

export function useStorefrontCart(salesChannel: SalesChannel = 'retail') {
  const CART_KEY = cartKeyFor(salesChannel);
  const fnStore = useServerFn(getStorefrontStore);
  const fnGetOrCreate = useServerFn(anonGetOrCreateCart);
  const fnGet = useServerFn(anonGetCart);
  const fnAdd = useServerFn(anonAddProductToCart);
  const fnAddVariant = useServerFn(anonAddCartItem);

  const fnUpdate = useServerFn(anonUpdateCartItemQty);
  const fnRemove = useServerFn(anonRemoveCartItem);

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

  // bootstrap — re-executa quando o canal muda (cartId namespaced por canal).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sessionToken = ensureSessionToken();
      // Reset do estado ao trocar de canal, evitando exibir o carrinho anterior.
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
            cartPayload = (await fnGet({ data: { cart_id: storedCartId, session_token: sessionToken } })) as never;
          } catch {
            cartPayload = null;
          }
        }
        if (!cartPayload) {
          const cart = await fnGetOrCreate({ data: { store_id: store.id, session_token: sessionToken, sales_channel: salesChannel } });
          window.localStorage.setItem(CART_KEY, String((cart as { id: string }).id));
          cartPayload = (await fnGet({ data: { cart_id: (cart as { id: string }).id, session_token: sessionToken } })) as never;
        }
        if (cancelled || !cartPayload) return;
        applyCartPayload(cartPayload);
        setState((s) => ({ ...s, storeId: store.id, ready: true, loading: false }));
      } catch {
        if (!cancelled) setState((s) => ({ ...s, ready: true, loading: false }));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesChannel]);

  const refresh = useCallback(async () => {
    if (!state.cartId) return;
    const payload = (await fnGet({ data: { cart_id: state.cartId, session_token: state.sessionToken } })) as never;
    applyCartPayload(payload);
  }, [state.cartId, state.sessionToken, fnGet, applyCartPayload]);

  const add = useCallback(async (productId: string, qty = 1) => {
    if (!state.cartId) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      await fnAdd({ data: { cart_id: state.cartId, product_id: productId, qty, session_token: state.sessionToken } });
      await refresh();
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [state.cartId, state.sessionToken, fnAdd, refresh]);

  const update = useCallback(async (itemId: string, qty: number) => {
    if (!state.cartId) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      await fnUpdate({ data: { cart_id: state.cartId, item_id: itemId, qty, session_token: state.sessionToken } });
      await refresh();
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [state.cartId, state.sessionToken, fnUpdate, refresh]);

  const remove = useCallback(async (itemId: string) => {
    if (!state.cartId) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      await fnRemove({ data: { cart_id: state.cartId, item_id: itemId, session_token: state.sessionToken } });
      await refresh();
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [state.cartId, state.sessionToken, fnRemove, refresh]);

  const addVariant = useCallback(async (variantId: string, qty = 1) => {
    if (!state.cartId) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      await fnAddVariant({ data: { cart_id: state.cartId, variant_id: variantId, qty, session_token: state.sessionToken } });
      await refresh();
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [state.cartId, state.sessionToken, fnAddVariant, refresh]);

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
