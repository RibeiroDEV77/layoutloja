/**
 * Cart Engine (Fase 5.2) — núcleo do carrinho.
 *
 * Toda mutação:
 * 1) Valida ownership (customer auth_user_id, session_token, ou operador c/ `carts.write`).
 * 2) Aplica regras de negócio (preço via Pricing Engine; estoque via Reservation Engine).
 * 3) Atualiza linhas em `cart_items`, recalcula totais (`cart_recalculate` SQL).
 * 4) Persiste snapshot em `cart_snapshots` quando reason justifica.
 * 5) Registra evento na `cart_timeline`.
 * 6) Emite Outbox event.
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { isSuperAdmin, hasPermission } from './permissions.server';
import { enqueueOutbox } from '@/lib/foundations/outbox.functions';
import { recordMetric } from '@/lib/foundations/observability.functions';
import { computeVariantPrice, resolveCartPriceListId, resolveCustomerGroupId } from './pricing.server';
import { reserveForCartItem, releaseAllForCart, releaseReservation, ensureStockAvailable } from './stock-reservation.server';

export type CartRow = {
  id: string;
  store_id: string;
  customer_id: string | null;
  session_token: string | null;
  status: string;
  currency: string;
  customer_group_id: string | null;
  price_list_id: string | null;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  tax_total: number;
  total: number;
  items_count: number;
};

async function loadCart(supabase: SbClient, cartId: string): Promise<CartRow> {
  const { data, error } = await supabase.from('carts').select('*').eq('id', cartId).maybeSingle();
  if (error) throw Errors.internal('Falha ao carregar carrinho', { error: error.message });
  if (!data) throw Errors.notFound('Carrinho', cartId);
  return data as CartRow;
}

async function assertCartAccess(supabase: SbClient, userId: string | null, cart: CartRow, sessionToken?: string): Promise<void> {
  if (userId) {
    if (await isSuperAdmin(supabase, userId)) return;
    if (await hasPermission(supabase, userId, 'carts.write', cart.store_id)) return;
    if (cart.customer_id) {
      const { data: c } = await supabase.from('customers').select('auth_user_id').eq('id', cart.customer_id).maybeSingle();
      if (c?.auth_user_id === userId) return;
    }
  }
  if (sessionToken && cart.session_token === sessionToken && !cart.customer_id) return;
  throw Errors.forbidden('Sem acesso a este carrinho');
}

async function snapshot(supabase: SbClient, cartId: string, reason: string): Promise<void> {
  const cart = await loadCart(supabase, cartId);
  const { data: items } = await supabase.from('cart_items').select('*').eq('cart_id', cartId);
  const { data: coupons } = await supabase.from('cart_coupons').select('*').eq('cart_id', cartId);
  await supabase.from('cart_snapshots').insert({
    cart_id: cartId,
    store_id: cart.store_id,
    reason,
    payload: { items: items ?? [], coupons: coupons ?? [] },
    totals: {
      subtotal: cart.subtotal, discount_total: cart.discount_total,
      shipping_total: cart.shipping_total, tax_total: cart.tax_total, total: cart.total,
    },
  });
}

async function timeline(supabase: SbClient, cartId: string, event: string, payload: Record<string, unknown> = {}): Promise<void> {
  await supabase.rpc('record_cart_timeline_event', {
    _cart_id: cartId, _event_type: event as never, _payload: payload as never,
  });
}

async function recalc(supabase: SbClient, cartId: string): Promise<CartRow> {
  const { data, error } = await supabase.rpc('cart_recalculate', { _cart_id: cartId });
  if (error) throw Errors.internal('Falha ao recalcular carrinho', { error: error.message });
  return data as unknown as CartRow;
}

// ---------------- Public API ----------------

export interface GetOrCreateInput {
  store_id: string;
  customer_id?: string | null;
  session_token?: string | null;
}

export async function getOrCreateCart(supabase: SbClient, userId: string | null, input: GetOrCreateInput): Promise<CartRow> {
  if (!input.customer_id && !input.session_token) {
    throw Errors.validation('Necessário customer_id ou session_token');
  }
  // try active
  let q = supabase.from('carts').select('*').eq('store_id', input.store_id).eq('status', 'active');
  if (input.customer_id) q = q.eq('customer_id', input.customer_id);
  else q = q.eq('session_token', input.session_token!).is('customer_id', null);
  const { data: existing } = await q.maybeSingle();
  if (existing) return existing as CartRow;

  const customerGroupId = await resolveCustomerGroupId(supabase, input.customer_id ?? null);
  const priceListId = await resolveCartPriceListId(supabase, input.store_id, customerGroupId);

  const { data: created, error } = await supabase.from('carts').insert({
    store_id: input.store_id,
    customer_id: input.customer_id ?? null,
    session_token: input.session_token ?? null,
    customer_group_id: customerGroupId,
    price_list_id: priceListId,
  }).select('*').single();
  if (error) throw Errors.internal('Falha ao criar carrinho', { error: error.message });

  await timeline(supabase, created.id, 'created', { customer_id: input.customer_id ?? null });
  await enqueueOutbox(supabase, {
    storeId: input.store_id, aggregateType: 'cart', aggregateId: created.id,
    eventType: 'cart.created' as never, payload: { customer_id: input.customer_id ?? null },
  });
  await recordMetric(supabase, { scope: 'cart', name: 'created', value: 1, storeId: input.store_id });
  return created as CartRow;
}

export async function getCart(supabase: SbClient, userId: string | null, cartId: string, sessionToken?: string) {
  const cart = await loadCart(supabase, cartId);
  await assertCartAccess(supabase, userId, cart, sessionToken);
  const [{ data: items }, { data: coupons }, { data: quotes }] = await Promise.all([
    supabase.from('cart_items').select('*').eq('cart_id', cartId).order('created_at'),
    supabase.from('cart_coupons').select('*, coupons(code, name, type, value)').eq('cart_id', cartId),
    supabase.from('shipping_quotes').select('*').eq('cart_id', cartId).order('created_at', { ascending: false }).limit(20),
  ]);
  const hydratedItems = await hydrateCartItemSnapshots(supabase, items ?? []);
  return { cart, items: hydratedItems, coupons: coupons ?? [], shipping_quotes: quotes ?? [] };
}

/**
 * Enriquecimento read-only do `snapshot` de cada cart_item com imagem da variante,
 * nome da cor e label do tamanho. Reaproveita a mesma lógica de DAM/signed URL
 * usada na vitrine — sem persistir no banco, apenas para exibição.
 */
async function hydrateCartItemSnapshots<T extends { variant_id?: string | null; snapshot?: unknown }>(supabase: SbClient, items: T[]): Promise<T[]> {
  if (!items.length) return items;
  const variantIds = Array.from(new Set(items.map((i) => i.variant_id as string).filter(Boolean)));
  if (!variantIds.length) return items;

  const { data: variants } = await supabase
    .from('product_variants')
    .select('id, product_id, product_color_id, size_attribute_value_id')
    .in('id', variantIds);
  const vRows = (variants ?? []) as Array<{ id: string; product_id: string; product_color_id: string | null; size_attribute_value_id: string | null }>;

  const productIds = Array.from(new Set(vRows.map((v) => v.product_id)));
  const directColorIds = Array.from(new Set(vRows.map((v) => v.product_color_id).filter(Boolean) as string[]));
  const sizeIds = Array.from(new Set(vRows.map((v) => v.size_attribute_value_id).filter(Boolean) as string[]));

  const { data: prodColors } = productIds.length
    ? await supabase.from('product_colors')
        .select('id, product_id, name, is_default, sort_order')
        .in('product_id', productIds)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
    : { data: [] as Array<{ id: string; product_id: string; name: string; is_default: boolean | null; sort_order: number | null }> };
  const colorsByProduct = new Map<string, Array<{ id: string; name: string; is_default: boolean | null; sort_order: number | null }>>();
  const colorById = new Map<string, { id: string; product_id: string; name: string }>();
  for (const c of (prodColors ?? []) as Array<{ id: string; product_id: string; name: string; is_default: boolean | null; sort_order: number | null }>) {
    const list = colorsByProduct.get(c.product_id) ?? [];
    list.push(c);
    colorsByProduct.set(c.product_id, list);
    colorById.set(c.id, { id: c.id, product_id: c.product_id, name: c.name });
  }

  // resolve fallback color por produto (default → primeira ativa)
  const fallbackColorByProduct = new Map<string, string>();
  for (const [pid, list] of colorsByProduct) {
    const sorted = list.slice().sort((a, b) => Number(b.is_default) - Number(a.is_default) || Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
    if (sorted[0]) fallbackColorByProduct.set(pid, sorted[0].id);
  }

  const allColorIds = Array.from(new Set([...directColorIds, ...fallbackColorByProduct.values()]));
  const { data: mediaRows } = allColorIds.length
    ? await supabase.from('product_color_media')
        .select('id, product_color_id, external_url, storage_path, thumbnail_url, is_cover, sort_order')
        .in('product_color_id', allColorIds)
        .order('sort_order', { ascending: true })
    : { data: [] as Array<{ id: string; product_color_id: string; external_url: string | null; storage_path: string | null; thumbnail_url: string | null; is_cover: boolean | null; sort_order: number | null }> };

  type MediaRow = { id: string; product_color_id: string; external_url: string | null; storage_path: string | null; thumbnail_url: string | null; is_cover: boolean | null; sort_order: number | null };
  const damPathFromUrl = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    const s = raw.trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) return s.replace(/^\/?dam\//, '') || null;
    const m = s.match(/\/object\/(?:sign|public|authenticated)\/dam\/([^?#]+)/i);
    return m?.[1] ? decodeURIComponent(m[1]) : null;
  };
  const mediasByColor = new Map<string, MediaRow[]>();
  for (const m of (mediaRows ?? []) as MediaRow[]) {
    const list = mediasByColor.get(m.product_color_id) ?? [];
    list.push(m);
    mediasByColor.set(m.product_color_id, list);
  }

  // assina URLs do bucket dam
  const resolvedById = new Map<string, string>();
  const toSign: Array<{ id: string; path: string }> = [];
  for (const m of (mediaRows ?? []) as MediaRow[]) {
    const path = damPathFromUrl(m.storage_path) ?? damPathFromUrl(m.external_url) ?? damPathFromUrl(m.thumbnail_url);
    if (path) toSign.push({ id: m.id, path });
    else if (m.external_url || m.thumbnail_url) resolvedById.set(m.id, (m.external_url ?? m.thumbnail_url) as string);
  }
  if (toSign.length) {
    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { data: signed } = await supabaseAdmin.storage.from('dam').createSignedUrls(toSign.map((t) => t.path), 60 * 60 * 24 * 7);
      signed?.forEach((row, i) => { if (row?.signedUrl) resolvedById.set(toSign[i].id, row.signedUrl); });
    } catch { /* mantém fallback */ }
  }

  const { data: sizeLabels } = sizeIds.length
    ? await supabase.from('attribute_values').select('id, label').in('id', sizeIds)
    : { data: [] as Array<{ id: string; label: string }> };
  const sizeById = new Map<string, string>();
  for (const s of (sizeLabels ?? []) as Array<{ id: string; label: string }>) sizeById.set(s.id, s.label);

  function imageForColor(colorId: string | null | undefined, productId: string): string | null {
    const cid = colorId ?? fallbackColorByProduct.get(productId) ?? null;
    if (!cid) return null;
    const medias = (mediasByColor.get(cid) ?? []).slice().sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
    const cover = medias[0];
    if (!cover) return null;
    return resolvedById.get(cover.id) ?? cover.external_url ?? cover.thumbnail_url ?? cover.storage_path ?? null;
  }

  return items.map((it) => {
    const v = vRows.find((x) => x.id === it.variant_id);
    if (!v) return it;
    const snap = (it.snapshot && typeof it.snapshot === 'object') ? { ...(it.snapshot as Record<string, unknown>) } : {};
    snap.image_url = snap.image_url ?? imageForColor(v.product_color_id, v.product_id);
    snap.color_name = snap.color_name ?? (v.product_color_id ? colorById.get(v.product_color_id)?.name ?? null : null);
    snap.size_label = snap.size_label ?? (v.size_attribute_value_id ? sizeById.get(v.size_attribute_value_id) ?? null : null);
    return { ...it, snapshot: snap } as T;
  });
}


export interface AddItemInput {
  cart_id: string;
  variant_id: string;
  qty: number;
  session_token?: string;
}

export async function addItem(supabase: SbClient, userId: string | null, input: AddItemInput) {
  if (input.qty <= 0) throw Errors.validation('Quantidade deve ser > 0');
  const cart = await loadCart(supabase, input.cart_id);
  await assertCartAccess(supabase, userId, cart, input.session_token);
  if (cart.status !== 'active') throw Errors.rule('Carrinho inativo', { status: cart.status });

  const { data: variant } = await supabase
    .from('product_variants')
    .select('id, product_id, sku, is_active, products!inner(id, store_id, name, status)')
    .eq('id', input.variant_id)
    .maybeSingle();
  if (!variant || !variant.is_active) throw Errors.rule('Variante indisponível');
  const product = variant.products as { id: string; store_id: string; name: string; status: string };
  if (product.store_id !== cart.store_id) throw Errors.rule('Variante de outra loja');

  await ensureStockAvailable(supabase, input.variant_id, input.qty);
  const price = await computeVariantPrice(supabase, input.variant_id, input.qty, {
    store_id: cart.store_id,
    customer_group_id: cart.customer_group_id,
    currency: cart.currency,
    price_list_id: cart.price_list_id,
  });

  // upsert por (cart_id, variant_id)
  const { data: existing } = await supabase
    .from('cart_items').select('*').eq('cart_id', input.cart_id).eq('variant_id', input.variant_id).maybeSingle();
  let itemId: string;
  if (existing) {
    const newQty = existing.qty + input.qty;
    await ensureStockAvailable(supabase, input.variant_id, newQty);
    const repriced = await computeVariantPrice(supabase, input.variant_id, newQty, {
      store_id: cart.store_id, customer_group_id: cart.customer_group_id,
      currency: cart.currency, price_list_id: cart.price_list_id,
    });
    const { error } = await supabase.from('cart_items').update({
      qty: newQty, list_price: repriced.list_price, unit_price: repriced.unit_price,
      line_total: repriced.unit_price * newQty - Number(existing.discount_amount ?? 0),
      price_source: repriced.price_source, price_list_item_id: repriced.price_list_item_id,
    }).eq('id', existing.id);
    if (error) throw Errors.internal('Falha ao atualizar item', { error: error.message });
    itemId = existing.id;
    await timeline(supabase, input.cart_id, 'qty_changed', { variant_id: input.variant_id, qty: newQty });
  } else {
    const { data: ins, error } = await supabase.from('cart_items').insert({
      cart_id: input.cart_id, variant_id: input.variant_id, product_id: product.id,
      qty: input.qty, list_price: price.list_price, unit_price: price.unit_price,
      line_total: price.unit_price * input.qty, price_source: price.price_source,
      price_list_item_id: price.price_list_item_id,
      snapshot: { product_name: product.name, sku: variant.sku },
    }).select('id').single();
    if (error) throw Errors.internal('Falha ao adicionar item', { error: error.message });
    itemId = ins.id;
    await timeline(supabase, input.cart_id, 'item_added', { variant_id: input.variant_id, qty: input.qty });
  }

  await reserveForCartItem(supabase, itemId);
  const updated = await recalc(supabase, input.cart_id);
  await enqueueOutbox(supabase, {
    storeId: cart.store_id, aggregateType: 'cart', aggregateId: input.cart_id,
    eventType: 'cart.item_added' as never, payload: { variant_id: input.variant_id, qty: input.qty },
  });
  return { cart: updated, item_id: itemId };
}

export async function updateItemQty(supabase: SbClient, userId: string | null, input: { cart_id: string; item_id: string; qty: number; session_token?: string }) {
  const cart = await loadCart(supabase, input.cart_id);
  await assertCartAccess(supabase, userId, cart, input.session_token);
  if (input.qty <= 0) return removeItem(supabase, userId, { cart_id: input.cart_id, item_id: input.item_id, session_token: input.session_token });
  const { data: item } = await supabase.from('cart_items').select('*').eq('id', input.item_id).maybeSingle();
  if (!item || item.cart_id !== input.cart_id) throw Errors.notFound('Item');
  await ensureStockAvailable(supabase, item.variant_id, input.qty);
  const price = await computeVariantPrice(supabase, item.variant_id, input.qty, {
    store_id: cart.store_id, customer_group_id: cart.customer_group_id,
    currency: cart.currency, price_list_id: cart.price_list_id,
  });
  const { error } = await supabase.from('cart_items').update({
    qty: input.qty, list_price: price.list_price, unit_price: price.unit_price,
    line_total: price.unit_price * input.qty - Number(item.discount_amount ?? 0),
    price_source: price.price_source, price_list_item_id: price.price_list_item_id,
  }).eq('id', input.item_id);
  if (error) throw Errors.internal('Falha ao atualizar quantidade', { error: error.message });
  await reserveForCartItem(supabase, input.item_id);
  await timeline(supabase, input.cart_id, 'qty_changed', { variant_id: item.variant_id, qty: input.qty });
  const updated = await recalc(supabase, input.cart_id);
  return { cart: updated };
}

export async function removeItem(supabase: SbClient, userId: string | null, input: { cart_id: string; item_id: string; session_token?: string }) {
  const cart = await loadCart(supabase, input.cart_id);
  await assertCartAccess(supabase, userId, cart, input.session_token);
  const { data: item } = await supabase.from('cart_items').select('*').eq('id', input.item_id).maybeSingle();
  if (!item) return { cart };
  const { data: res } = await supabase.from('stock_reservations').select('id').eq('cart_item_id', input.item_id).eq('status', 'active');
  for (const r of res ?? []) await releaseReservation(supabase, r.id, 'item_removed');
  await supabase.from('cart_items').delete().eq('id', input.item_id);
  await timeline(supabase, input.cart_id, 'item_removed', { variant_id: item.variant_id });
  const updated = await recalc(supabase, input.cart_id);
  return { cart: updated };
}

export async function clearCart(supabase: SbClient, userId: string | null, input: { cart_id: string; session_token?: string }) {
  const cart = await loadCart(supabase, input.cart_id);
  await assertCartAccess(supabase, userId, cart, input.session_token);
  await releaseAllForCart(supabase, input.cart_id, 'cart_cleared');
  await supabase.from('cart_items').delete().eq('cart_id', input.cart_id);
  await supabase.from('cart_coupons').delete().eq('cart_id', input.cart_id);
  await timeline(supabase, input.cart_id, 'item_removed', { reason: 'clear' });
  return { cart: await recalc(supabase, input.cart_id) };
}

export async function abandonCart(supabase: SbClient, userId: string | null, cartId: string) {
  const cart = await loadCart(supabase, cartId);
  await assertCartAccess(supabase, userId, cart);
  await snapshot(supabase, cartId, 'abandoned');
  await releaseAllForCart(supabase, cartId, 'abandoned');
  await supabase.from('carts').update({ status: 'abandoned' }).eq('id', cartId);
  await timeline(supabase, cartId, 'abandoned', {});
  await enqueueOutbox(supabase, {
    storeId: cart.store_id, aggregateType: 'cart', aggregateId: cartId,
    eventType: 'cart.abandoned' as never, payload: {},
  });
}

export async function snapshotCart(supabase: SbClient, userId: string | null, input: { cart_id: string; reason: string; session_token?: string }) {
  const cart = await loadCart(supabase, input.cart_id);
  await assertCartAccess(supabase, userId, cart, input.session_token);
  await snapshot(supabase, input.cart_id, input.reason);
}

export async function getTimeline(supabase: SbClient, userId: string | null, cartId: string, sessionToken?: string) {
  const cart = await loadCart(supabase, cartId);
  await assertCartAccess(supabase, userId, cart, sessionToken);
  const { data } = await supabase.from('cart_timeline').select('*').eq('cart_id', cartId).order('created_at', { ascending: false }).limit(200);
  return data ?? [];
}

export async function listAdminCarts(supabase: SbClient, userId: string, storeId: string, status?: string) {
  if (!(await isSuperAdmin(supabase, userId)) && !(await hasPermission(supabase, userId, 'carts.read', storeId))) {
    throw Errors.forbidden('Permissão necessária: carts.read');
  }
  let q = supabase.from('carts').select('*').eq('store_id', storeId).order('updated_at', { ascending: false }).limit(200);
  if (status) q = q.eq('status', status as never);
  const { data, error } = await q;
  if (error) throw Errors.internal('Falha ao listar carrinhos', { error: error.message });
  return data ?? [];
}
