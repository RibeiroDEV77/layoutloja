/**
 * Checkout guards — revalidação server-side obrigatória antes de criar pedido.
 *
 * Sprint 0 / P4: `placeOrder` (anônimo) e futuros callers autenticados devem
 * chamar `validateCartForCheckout` imediatamente antes da RPC
 * `order_create_from_cart`. Nenhuma decisão de preço/estoque/canal pode se
 * apoiar apenas em `cart_items` ou no cliente.
 *
 * O que é validado para CADA item do carrinho:
 *   - produto existe, mesma loja do carrinho;
 *   - produto tem `status='active'` e `visibility='published'`;
 *   - variante existe, ativa e pertence ao produto;
 *   - `products.sale_channel` compatível com `carts.sales_channel`;
 *   - preço atual do Price Engine bate com `cart_items.unit_price`
 *     (tolerância de R$ 0,01 para arredondamento);
 *   - `stock_levels` existe para a variante e disponibilidade
 *     (`quantity_on_hand - quantity_reserved`) cobre `qty`.
 *
 * Regras de canal:
 *   - `cart.sales_channel = 'wholesale'` só é aceito quando o carrinho está
 *     vinculado a um `customer_id` cujo cliente tem
 *     `wholesale_applications.status = 'approved'`. Carrinho anônimo
 *     (customer_id null) NÃO pode finalizar wholesale. A verificação da
 *     identidade autenticada do caller pertence ao Bloco P5.
 *
 * Em qualquer falha lança `Errors.rule/validation/forbidden` com
 * `details.invalid_items` (JSON string) listando `{ item_id, reason, ... }`
 * para que o frontend possa oferecer "atualizar/remover" itens específicos.
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { computeVariantPrice, resolveCartPriceListId } from './pricing.server';

export type InvalidItemReason =
  | 'product_missing'
  | 'product_not_published'
  | 'product_store_mismatch'
  | 'product_channel_incompatible'
  | 'variant_missing'
  | 'variant_inactive'
  | 'variant_product_mismatch'
  | 'price_unavailable'
  | 'price_changed'
  | 'stock_level_missing'
  | 'stock_insufficient'
  | 'invalid_qty';

export interface InvalidItem {
  item_id: string;
  variant_id: string | null;
  product_id: string | null;
  reason: InvalidItemReason;
  expected?: number | string | null;
  got?: number | string | null;
}

const PRICE_EPSILON = 0.01;

interface RevalidatedItem {
  item_id: string;
  variant_id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  list_price: number;
  price_source: string;
  price_list_item_id: string | null;
  available: number;
}

export interface RevalidationResult {
  cart_id: string;
  store_id: string;
  sales_channel: 'retail' | 'wholesale';
  currency: string;
  items: RevalidatedItem[];
  price_list_id: string | null;
  total: number;
}

export async function validateCartForCheckout(
  supabase: SbClient,
  cartId: string,
): Promise<RevalidationResult> {
  // 1) Carrinho ativo
  const { data: cart } = await supabase
    .from('carts')
    .select('id, store_id, status, customer_id, sales_channel, currency, price_list_id, customer_group_id')
    .eq('id', cartId)
    .maybeSingle();
  if (!cart) throw Errors.notFound('Carrinho', cartId);
  if (cart.status !== 'active') {
    throw Errors.rule('Carrinho não está ativo', { cart_status: cart.status });
  }

  // 2) Canal atacado exige cliente com aplicação aprovada
  if (cart.sales_channel === 'wholesale') {
    if (!cart.customer_id) {
      throw Errors.forbidden('Checkout atacado exige cliente autenticado e aprovado', {
        reason: 'wholesale_requires_customer',
      });
    }
    const { data: approved } = await supabase
      .from('wholesale_applications')
      .select('id')
      .eq('customer_id', cart.customer_id)
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle();
    if (!approved) {
      throw Errors.forbidden('Cliente sem aprovação de atacado', {
        reason: 'wholesale_not_approved',
      });
    }
  }

  // 3) Itens
  const { data: rawItems } = await supabase
    .from('cart_items')
    .select('id, cart_id, product_id, variant_id, qty, unit_price, list_price, price_list_item_id')
    .eq('cart_id', cartId);
  const items = rawItems ?? [];
  if (items.length === 0) {
    throw Errors.rule('Carrinho vazio');
  }

  // Carrega produtos e variantes em batch
  const productIds = Array.from(new Set(items.map((i) => i.product_id).filter(Boolean) as string[]));
  const variantIds = Array.from(new Set(items.map((i) => i.variant_id).filter(Boolean) as string[]));

  const { data: products } = await supabase
    .from('products')
    .select('id, store_id, status, visibility, sale_channel')
    .in('id', productIds.length ? productIds : ['00000000-0000-0000-0000-000000000000']);
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  const { data: variants } = await supabase
    .from('product_variants')
    .select('id, product_id, is_active')
    .in('id', variantIds.length ? variantIds : ['00000000-0000-0000-0000-000000000000']);
  const variantById = new Map((variants ?? []).map((v) => [v.id, v]));

  const { data: stockRows } = await supabase
    .from('stock_levels')
    .select('variant_id, quantity_on_hand, quantity_reserved')
    .in('variant_id', variantIds.length ? variantIds : ['00000000-0000-0000-0000-000000000000']);
  const stockByVariant = new Map<string, { on_hand: number; reserved: number }>();
  for (const r of stockRows ?? []) {
    const cur = stockByVariant.get(r.variant_id) ?? { on_hand: 0, reserved: 0 };
    cur.on_hand += Number(r.quantity_on_hand ?? 0);
    cur.reserved += Number(r.quantity_reserved ?? 0);
    stockByVariant.set(r.variant_id, cur);
  }

  // Price list a aplicar (mesma regra do Price Engine)
  const priceListId = cart.price_list_id
    ?? (await resolveCartPriceListId(supabase, cart.store_id, cart.customer_group_id ?? null));

  const invalid: InvalidItem[] = [];
  const revalidated: RevalidatedItem[] = [];

  for (const it of items) {
    const push = (reason: InvalidItemReason, expected?: InvalidItem['expected'], got?: InvalidItem['got']) => {
      invalid.push({
        item_id: it.id,
        variant_id: it.variant_id,
        product_id: it.product_id,
        reason,
        expected: expected ?? null,
        got: got ?? null,
      });
    };

    if (!it.qty || Number(it.qty) <= 0) { push('invalid_qty', null, Number(it.qty)); continue; }

    const product = it.product_id ? productById.get(it.product_id) : null;
    if (!product) { push('product_missing'); continue; }
    if (product.store_id !== cart.store_id) { push('product_store_mismatch'); continue; }
    if (product.status !== 'published' || product.visibility !== 'published') {
      push('product_not_published', 'published/published', `${product.status}/${product.visibility}`);
      continue;
    }
    // Canal comercial: mapping enum PT-BR
    const channel = cart.sales_channel;
    const sc = product.sale_channel;
    const compatible =
      sc === 'ambos'
      || (channel === 'retail' && sc === 'varejo')
      || (channel === 'wholesale' && sc === 'atacado');
    if (!compatible) { push('product_channel_incompatible', channel, sc); continue; }

    const variant = it.variant_id ? variantById.get(it.variant_id) : null;
    if (!variant) { push('variant_missing'); continue; }
    if (variant.product_id !== product.id) { push('variant_product_mismatch'); continue; }
    if (!variant.is_active) { push('variant_inactive'); continue; }

    // Preço atual do Price Engine
    let priced;
    try {
      priced = await computeVariantPrice(supabase, variant.id, Number(it.qty), {
        store_id: cart.store_id,
        customer_group_id: cart.customer_group_id ?? null,
        currency: cart.currency,
        price_list_id: priceListId,
      });
    } catch {
      push('price_unavailable');
      continue;
    }
    if (Math.abs(priced.unit_price - Number(it.unit_price)) > PRICE_EPSILON) {
      push('price_changed', priced.unit_price, Number(it.unit_price));
      continue;
    }

    // Estoque
    const stock = stockByVariant.get(variant.id);
    if (!stock) { push('stock_level_missing'); continue; }
    const available = stock.on_hand - stock.reserved;
    if (available < Number(it.qty)) {
      push('stock_insufficient', available, Number(it.qty));
      continue;
    }

    revalidated.push({
      item_id: it.id,
      variant_id: variant.id,
      product_id: product.id,
      qty: Number(it.qty),
      unit_price: priced.unit_price,
      list_price: priced.list_price,
      price_source: priced.price_source,
      price_list_item_id: priced.price_list_item_id,
      available,
    });
  }

  if (invalid.length > 0) {
    throw Errors.rule('Carrinho requer atualização antes de finalizar', {
      invalid_items: JSON.stringify(invalid),
      invalid_count: invalid.length,
    });
  }

  const total = revalidated.reduce((s, r) => s + r.unit_price * r.qty, 0);
  return {
    cart_id: cartId,
    store_id: cart.store_id,
    sales_channel: cart.sales_channel as 'retail' | 'wholesale',
    currency: cart.currency,
    items: revalidated,
    price_list_id: priceListId,
    total,
  };
}
