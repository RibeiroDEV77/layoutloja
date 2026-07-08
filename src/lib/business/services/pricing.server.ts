/**
 * Pricing Engine (Fase 5.2).
 *
 * Responsável por:
 * - Resolver `customer_group_id` e `price_list_id` aplicáveis a um carrinho.
 * - Calcular `unit_price` por variante respeitando: price_list_items (priority desc),
 *   customer_group, quantidade (faixas min/max) e fallback (sem preço => bloqueia item).
 *
 * Toda decisão de preço passa por aqui. Nenhuma tela calcula preço.
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';

export interface PriceResolution {
  variant_id: string;
  list_price: number;
  unit_price: number;
  price_source: 'catalog' | 'price_list' | 'promo' | 'coupon' | 'manual';
  price_list_item_id: string | null;
  price_list_id: string | null;
  currency: string;
}

interface ResolveContext {
  store_id: string;
  customer_group_id: string | null;
  currency: string;
}

/**
 * Resolve qual price_list aplicar.
 *
 * Regras P6 (preços atacado faltantes):
 * - `sales_channel = 'wholesale'`: **estritamente** listas com
 *   `code LIKE 'WHOLESALE-%'` da loja. Se não houver, retorna `null` —
 *   NUNCA cai em tabela varejo. O engine então lança `price_unavailable`.
 * - `sales_channel = 'retail'` (padrão): mesma lógica anterior, mas
 *   exclui explicitamente listas `WHOLESALE-%` (elas nunca podem vazar
 *   como preço varejo, mesmo que priority seja maior).
 */
export async function resolveCartPriceListId(
  supabase: SbClient,
  storeId: string,
  customerGroupId: string | null,
  salesChannel: 'retail' | 'wholesale' = 'retail',
): Promise<string | null> {
  const now = Date.now();
  const active = (pl: { starts_at: string | null; ends_at: string | null }) =>
    (!pl.starts_at || new Date(pl.starts_at).getTime() <= now) &&
    (!pl.ends_at || new Date(pl.ends_at).getTime() >= now);

  if (salesChannel === 'wholesale') {
    const { data: lists } = await supabase
      .from('price_lists')
      .select('id, priority, starts_at, ends_at, code')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .like('code', 'WHOLESALE-%')
      .order('priority', { ascending: false });
    return (lists ?? []).find(active)?.id ?? null;
  }

  if (customerGroupId) {
    const { data } = await supabase
      .from('price_list_customer_groups')
      .select('price_list_id, price_lists!inner(id, is_active, priority, starts_at, ends_at, store_id, code)')
      .eq('customer_group_id', customerGroupId);
    const eligible = (data ?? [])
      .map((r) => r.price_lists as { id: string; is_active: boolean; priority: number; starts_at: string | null; ends_at: string | null; store_id: string; code: string | null })
      .filter((pl) => pl && pl.store_id === storeId && pl.is_active && !(pl.code ?? '').startsWith('WHOLESALE-') && active(pl))
      .sort((a, b) => b.priority - a.priority);
    if (eligible[0]) return eligible[0].id;
  }
  const { data: lists } = await supabase
    .from('price_lists')
    .select('id, priority, starts_at, ends_at, is_active, code')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('priority', { ascending: false });
  return (lists ?? []).find((pl) => !(pl.code ?? '').startsWith('WHOLESALE-') && active(pl))?.id ?? null;
}

/** Resolve customer_group_id principal do cliente. */
export async function resolveCustomerGroupId(
  supabase: SbClient,
  customerId: string | null,
): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await supabase
    .from('customer_groups_map')
    .select('customer_group_id, customer_groups!inner(id, priority)')
    .eq('customer_id', customerId);
  const rows = ((data ?? []) as unknown as Array<{ customer_groups: { id: string; priority: number } | null }>)
    .map((r) => r.customer_groups)
    .filter((g): g is { id: string; priority: number } => !!g)
    .sort((a, b) => b.priority - a.priority);
  return rows[0]?.id ?? null;
}

/**
 * Calcula unit_price para uma variante+qty no contexto do carrinho.
 *
 * P6: quando `sales_channel === 'wholesale'`, ausência de `price_list_item`
 * na tabela atacado lança `price_unavailable` — NUNCA cai em varejo.
 */
export async function computeVariantPrice(
  supabase: SbClient,
  variantId: string,
  qty: number,
  ctx: ResolveContext & { price_list_id: string | null; sales_channel?: 'retail' | 'wholesale' },
): Promise<PriceResolution> {
  const salesChannel = ctx.sales_channel ?? 'retail';
  let listPrice = 0;
  let unitPrice = 0;
  let source: PriceResolution['price_source'] = 'catalog';
  let pliId: string | null = null;

  if (ctx.price_list_id) {
    const { data: items } = await supabase
      .from('price_list_items')
      .select('id, price, compare_at_price, min_quantity, max_quantity')
      .eq('price_list_id', ctx.price_list_id)
      .eq('variant_id', variantId)
      .order('min_quantity', { ascending: false });
    const applicable = (items ?? []).find((it) =>
      qty >= (it.min_quantity ?? 1) && (it.max_quantity == null || qty <= it.max_quantity),
    );
    if (applicable) {
      unitPrice = Number(applicable.price);
      listPrice = applicable.compare_at_price != null ? Number(applicable.compare_at_price) : unitPrice;
      source = 'price_list';
      pliId = applicable.id;
    }
  }

  // Wholesale: SEM fallback. Ausência de preço atacado bloqueia com erro claro.
  if (unitPrice === 0 && salesChannel === 'wholesale') {
    throw Errors.rule('Preço atacado indisponível para esta variante', {
      variant_id: variantId,
      reason: 'wholesale_price_missing',
    });
  }

  // Retail: fallback existente para outra lista varejo ativa da loja.
  if (unitPrice === 0) {
    const fallbackId = await resolveCartPriceListId(supabase, ctx.store_id, null, 'retail');
    if (fallbackId && fallbackId !== ctx.price_list_id) {
      const { data: items } = await supabase
        .from('price_list_items')
        .select('id, price, compare_at_price, min_quantity, max_quantity')
        .eq('price_list_id', fallbackId)
        .eq('variant_id', variantId)
        .order('min_quantity', { ascending: false });
      const applicable = (items ?? []).find((it) =>
        qty >= (it.min_quantity ?? 1) && (it.max_quantity == null || qty <= it.max_quantity),
      );
      if (applicable) {
        unitPrice = Number(applicable.price);
        listPrice = applicable.compare_at_price != null ? Number(applicable.compare_at_price) : unitPrice;
        source = 'price_list';
        pliId = applicable.id;
      }
    }
  }

  if (unitPrice === 0) {
    throw Errors.rule('Variante sem preço configurado', { variant_id: variantId });
  }

  return {
    variant_id: variantId,
    list_price: listPrice,
    unit_price: unitPrice,
    price_source: source,
    price_list_item_id: pliId,
    price_list_id: ctx.price_list_id,
    currency: ctx.currency,
  };
}
