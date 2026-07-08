/**
 * Cart Merge Engine (Fase 5.2).
 *
 * Funde carrinho anônimo (session_token) no carrinho do cliente autenticado
 * após login/registro. Delega à função SQL `merge_anonymous_cart` que:
 *  - se o cliente não tem carrinho ativo: adota o anônimo (set customer_id).
 *  - se já tem: combina itens (upsert qty), marca origem como 'merged'.
 * Em ambos os casos, dispara `cart_apply_pricing` para reprecificar pela
 * lista do cliente autenticado.
 *
 * Após o merge SQL, este service:
 *  - revalida estoque dos itens combinados,
 *  - recalcula totais (via Cart Engine),
 *  - emite outbox `cart.merged`.
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { enqueueOutbox } from '@/lib/foundations/outbox.functions';
import { recordMetric } from '@/lib/foundations/observability.functions';
import { computeVariantPrice, resolveCartPriceListId, resolveCustomerGroupId } from './pricing.server';
import { reserveForCartItem, ensureStockAvailable } from './stock-reservation.server';

export type CartMergeSkipped = {
  cart_item_id: string | null;
  variant_id: string;
  reason: 'insufficient_stock' | 'pricing_failed' | 'reservation_failed';
  available?: number;
  requested?: number;
  detail?: string;
};

export type CartMergeResult = {
  cart_id: string;
  merged: Array<{ cart_item_id: string; variant_id: string; qty: number }>;
  skipped: CartMergeSkipped[];
};

export async function mergeAnonymousIntoCustomer(
  supabase: SbClient,
  userId: string,
  input: { anonymous_cart_id: string },
): Promise<CartMergeResult> {
  // Resolve customer do auth.uid()
  const { data: cust } = await supabase
    .from('customers').select('id, store_id').eq('auth_user_id', userId).maybeSingle();
  if (!cust) throw Errors.rule('Usuário autenticado não possui customer associado');

  const { data: anon } = await supabase
    .from('carts').select('*').eq('id', input.anonymous_cart_id).maybeSingle();
  if (!anon) throw Errors.notFound('Carrinho anônimo', input.anonymous_cart_id);
  if (anon.customer_id) throw Errors.rule('Carrinho já está atribuído');
  if (anon.store_id !== cust.store_id) throw Errors.rule('Carrinho de outra loja');

  // Recalcula price_list e customer_group antes
  const groupId = await resolveCustomerGroupId(supabase, cust.id);
  const priceListId = await resolveCartPriceListId(supabase, anon.store_id, groupId);

  // Carrinho destino existe?
  const { data: target } = await supabase
    .from('carts').select('*').eq('store_id', anon.store_id)
    .eq('customer_id', cust.id).eq('status', 'active').maybeSingle();

  const merged: CartMergeResult['merged'] = [];
  const skipped: CartMergeSkipped[] = [];

  let targetId: string;
  if (!target) {
    await supabase.from('carts').update({
      customer_id: cust.id, session_token: null,
      customer_group_id: groupId, price_list_id: priceListId,
    }).eq('id', anon.id);
    targetId = anon.id;
  } else {
    // combina itens — NUNCA silenciar. Reporta cada item pulado em `skipped`.
    const { data: anonItems } = await supabase.from('cart_items').select('*').eq('cart_id', anon.id);
    for (const it of anonItems ?? []) {
      const { data: existing } = await supabase.from('cart_items').select('*')
        .eq('cart_id', target.id).eq('variant_id', it.variant_id).maybeSingle();
      const newQty = (existing?.qty ?? 0) + it.qty;
      try {
        await ensureStockAvailable(supabase, it.variant_id, newQty);
      } catch (err) {
        // Reporta com available/requested para a UI poder informar o usuário.
        const { availableStock } = await import('./stock-reservation.server');
        const available = await availableStock(supabase, it.variant_id).catch(() => 0);
        skipped.push({
          cart_item_id: existing?.id ?? null,
          variant_id: it.variant_id,
          reason: 'insufficient_stock',
          available,
          requested: newQty,
          detail: err instanceof Error ? err.message : undefined,
        });
        continue;
      }
      let price;
      try {
        price = await computeVariantPrice(supabase, it.variant_id, newQty, {
          store_id: target.store_id, customer_group_id: groupId, currency: target.currency, price_list_id: priceListId,
        });
      } catch (err) {
        skipped.push({
          cart_item_id: existing?.id ?? null,
          variant_id: it.variant_id,
          reason: 'pricing_failed',
          requested: newQty,
          detail: err instanceof Error ? err.message : undefined,
        });
        continue;
      }
      if (existing) {
        await supabase.from('cart_items').update({
          qty: newQty, list_price: price.list_price, unit_price: price.unit_price,
          line_total: price.unit_price * newQty,
          price_source: price.price_source, price_list_item_id: price.price_list_item_id,
        }).eq('id', existing.id);
        // Reserva agora é idempotente por cart_item_id (índice único parcial +
        // delta atômico na RPC). Ajusta a reserva ao novo qty.
        try { await reserveForCartItem(supabase, existing.id); }
        catch (err) {
          skipped.push({
            cart_item_id: existing.id, variant_id: it.variant_id, reason: 'reservation_failed',
            requested: newQty, detail: err instanceof Error ? err.message : undefined,
          });
          continue;
        }
        merged.push({ cart_item_id: existing.id, variant_id: it.variant_id, qty: newQty });
      } else {
        const { data: ins } = await supabase.from('cart_items').insert({
          cart_id: target.id, variant_id: it.variant_id, product_id: it.product_id,
          qty: newQty, list_price: price.list_price, unit_price: price.unit_price,
          line_total: price.unit_price * newQty,
          price_source: price.price_source, price_list_item_id: price.price_list_item_id,
          snapshot: it.snapshot,
        }).select('id').single();
        if (ins) {
          try { await reserveForCartItem(supabase, ins.id); }
          catch (err) {
            skipped.push({
              cart_item_id: ins.id, variant_id: it.variant_id, reason: 'reservation_failed',
              requested: newQty, detail: err instanceof Error ? err.message : undefined,
            });
            continue;
          }
          merged.push({ cart_item_id: ins.id, variant_id: it.variant_id, qty: newQty });
        }
      }
    }
    await supabase.from('carts').update({
      status: 'merged', merged_into_cart_id: target.id,
    }).eq('id', anon.id);
    await supabase.from('carts').update({
      customer_group_id: groupId, price_list_id: priceListId,
    }).eq('id', target.id);
    targetId = target.id;
  }

  await supabase.rpc('record_cart_timeline_event', {
    _cart_id: targetId, _event_type: 'merged',
    _payload: { source_cart_id: anon.id, customer_id: cust.id, skipped_count: skipped.length } as never,
  });
  await supabase.rpc('cart_recalculate', { _cart_id: targetId });
  await enqueueOutbox(supabase, {
    storeId: anon.store_id, aggregateType: 'cart', aggregateId: targetId,
    eventType: 'cart.merged' as never,
    payload: { source_cart_id: anon.id, customer_id: cust.id, merged_count: merged.length, skipped_count: skipped.length },
  });
  await recordMetric(supabase, { scope: 'cart', name: 'merged', value: 1, storeId: anon.store_id });
  return { cart_id: targetId, merged, skipped };
}
