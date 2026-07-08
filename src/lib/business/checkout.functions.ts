/**
 * Server Functions: Checkout público (visitante não autenticado).
 *
 * - Carrinho anônimo via `session_token` (UUID gerado no cliente).
 * - Cotação automática via `quoteShippingForCart` (Shipping Adapter Registry
 *   já mescla Melhor Envio quando há conta ativa).
 * - Finalização via RPC SECURITY DEFINER `order_create_from_cart`.
 *
 * Geração de etiqueta é AUTENTICADA (admin) e usa `purchaseShippingLabel`.
 */
import { createServerFn } from '@tanstack/react-start';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as Cart from './services/cart.server';
import * as Shipping from './services/shipping.server';
import { Errors } from './errors';

/**
 * Cliente admin (service_role) carregado dinamicamente dentro do handler.
 *
 * Necessário porque as policies RLS de `carts`/`cart_items` exigem um GUC
 * (`request.cart_session_token`) que o PostgREST anônimo não define. A
 * validação de propriedade do carrinho continua sendo feita via
 * `session_token` em `Cart.*` (assertCartAccess). A chave service_role
 * permanece exclusivamente no runtime do servidor.
 */
async function publicClient(): Promise<SupabaseClient<Database>> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return supabaseAdmin as unknown as SupabaseClient<Database>;
}

// ---------------------------------------------------------------------------
// Carrinho anônimo
// ---------------------------------------------------------------------------

export const anonGetOrCreateCart = createServerFn({ method: 'POST' })
  .inputValidator((d: { store_id: string; session_token: string; sales_channel?: 'retail' | 'wholesale' }) => d)
  .handler(async ({ data }) => {
    if (!data.store_id || !data.session_token) {
      throw Errors.validation('store_id e session_token obrigatórios');
    }
    // P5 (Atacado seguro): visitante anônimo NUNCA cria carrinho wholesale.
    // Cookie/localStorage podem indicar preferência visual, mas o servidor
    // decide o canal. Rejeitamos explicitamente para não gerar carrinho
    // wholesale órfão que depois seja tratado como "aprovado".
    if (data.sales_channel === 'wholesale') {
      throw Errors.forbidden('Canal atacado exige cliente autenticado e aprovado');
    }
    const sb = await publicClient() as unknown as Parameters<typeof Cart.getOrCreateCart>[0];
    return Cart.getOrCreateCart(sb, null, {
      store_id: data.store_id,
      session_token: data.session_token,
      sales_channel: 'retail',
    });
  });


export const anonGetCart = createServerFn({ method: 'POST' })
  .inputValidator((d: { cart_id: string; session_token: string }) => d)
  .handler(async ({ data }) => {
    const sb = await publicClient() as unknown as Parameters<typeof Cart.getCart>[0];
    return Cart.getCart(sb, null, data.cart_id, data.session_token);
  });

export const anonAddCartItem = createServerFn({ method: 'POST' })
  .inputValidator((d: { cart_id: string; variant_id: string; qty: number; session_token: string }) => d)
  .handler(async ({ data }) => {
    const sb = await publicClient() as unknown as Parameters<typeof Cart.addItem>[0];
    return Cart.addItem(sb, null, data);
  });

/** Adiciona ao carrinho escolhendo automaticamente a primeira variante ativa do produto. */
export const anonAddProductToCart = createServerFn({ method: 'POST' })
  .inputValidator((d: { cart_id: string; product_id: string; qty: number; session_token: string }) => d)
  .handler(async ({ data }) => {
    const sb = await publicClient();
    const { data: variant, error } = await sb
      .from('product_variants')
      .select('id')
      .eq('product_id', data.product_id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw Errors.internal('Falha ao buscar variante', { error: error.message });
    if (!variant) throw Errors.rule('Produto sem variante disponível');
    const cartSb = sb as unknown as Parameters<typeof Cart.addItem>[0];
    return Cart.addItem(cartSb, null, {
      cart_id: data.cart_id,
      variant_id: variant.id,
      qty: data.qty,
      session_token: data.session_token,
    });
  });


export const anonUpdateCartItemQty = createServerFn({ method: 'POST' })
  .inputValidator((d: { cart_id: string; item_id: string; qty: number; session_token: string }) => d)
  .handler(async ({ data }) => {
    const sb = await publicClient() as unknown as Parameters<typeof Cart.updateItemQty>[0];
    return Cart.updateItemQty(sb, null, data);
  });

export const anonRemoveCartItem = createServerFn({ method: 'POST' })
  .inputValidator((d: { cart_id: string; item_id: string; session_token: string }) => d)
  .handler(async ({ data }) => {
    const sb = await publicClient() as unknown as Parameters<typeof Cart.removeItem>[0];
    return Cart.removeItem(sb, null, data);
  });

// ---------------------------------------------------------------------------
// Cotação automática + seleção
// ---------------------------------------------------------------------------

export const anonQuoteShipping = createServerFn({ method: 'POST' })
  .inputValidator((d: { cart_id: string; postal_code: string }) => d)
  .handler(async ({ data }) => {
    const cep = data.postal_code.replace(/\D/g, '');
    if (cep.length !== 8) throw Errors.validation('CEP inválido');
    const sb = await publicClient() as unknown as Parameters<typeof Shipping.quoteShippingForCart>[0];
    const rows = await Shipping.quoteShippingForCart(sb, null, {
      cart_id: data.cart_id,
      postal_code: cep,
    });
    return { quotes: rows };
  });

export const anonSelectShipping = createServerFn({ method: 'POST' })
  .inputValidator((d: { cart_id: string; quote_id: string }) => d)
  .handler(async ({ data }) => {
    const sb = await publicClient() as unknown as Parameters<typeof Shipping.selectShippingQuote>[0];
    return Shipping.selectShippingQuote(sb, null, data);
  });

// ---------------------------------------------------------------------------
// Finalização do pedido (chama RPC SECURITY DEFINER)
// ---------------------------------------------------------------------------

export const placeOrder = createServerFn({ method: 'POST' })
  .inputValidator((d: {
    cart_id: string;
    session_token: string;
    email: string;
    name: string;
    phone: string;
    address: {
      postal_code: string;
      street: string;
      number: string;
      complement?: string | null;
      district: string;
      city: string;
      state: string;
      country?: string;
    };
  }) => d)
  .handler(async ({ data }) => {
    const sb = await publicClient();
    // valida que o session_token confere com o carrinho
    const { data: cart, error: cartErr } = await sb
      .from('carts')
      .select('id, session_token, status, store_id')
      .eq('id', data.cart_id)
      .maybeSingle();
    if (cartErr) throw Errors.internal('Falha ao validar carrinho', { error: cartErr.message });
    if (!cart) throw Errors.notFound('Carrinho');
    if (cart.session_token !== data.session_token) throw Errors.forbidden('Carrinho inválido');

    // ---- P4: revalidação server-side obrigatória (produto/variante/canal/preço/estoque)
    const { validateCartForCheckout } = await import('./services/checkout-guards.server');
    const revalidated = await validateCartForCheckout(
      sb as unknown as Parameters<typeof validateCartForCheckout>[0],
      data.cart_id,
    );

    const { data: orderId, error } = await sb.rpc('order_create_from_cart', {
      _cart_id: data.cart_id,
      _email: data.email,
      _name: data.name,
      _phone: data.phone,
      _address: data.address as never,
    });
    if (error) throw Errors.internal(error.message || 'Falha ao finalizar pedido', { error: error.message });
    const newOrderId = orderId as unknown as string;

    // ---- P4: snapshot auditável de preço (best-effort, não bloqueia pedido)
    try {
      const snapshotPayload = {
        revalidated_at: new Date().toISOString(),
        sales_channel: revalidated.sales_channel,
        currency: revalidated.currency,
        price_list_id: revalidated.price_list_id,
        total: revalidated.total,
        items: revalidated.items.map((i) => ({
          item_id: i.item_id,
          variant_id: i.variant_id,
          product_id: i.product_id,
          qty: i.qty,
          unit_price: i.unit_price,
          list_price: i.list_price,
          price_source: i.price_source,
          price_list_item_id: i.price_list_item_id,
        })),
      };
      const hashInput = JSON.stringify(snapshotPayload);
      // hash não-criptográfico só para dedup humano; integridade real vem
      // do UNIQUE(order_id) e do audit trigger em order_addresses/orders.
      let hash = 0;
      for (let i = 0; i < hashInput.length; i++) hash = ((hash << 5) - hash + hashInput.charCodeAt(i)) | 0;
      await sb.from('order_pricing_snapshots').insert({
        order_id: newOrderId,
        store_id: cart.store_id,
        snapshot: snapshotPayload as never,
        hash: `sha1:${(hash >>> 0).toString(16).padStart(8, '0')}`,
      } as never);
    } catch (snapErr) {
      // Snapshot é auditoria complementar — order_items já tem unit_price;
      // não desfazemos o pedido por falha aqui.
      console.warn('[placeOrder] pricing snapshot insert falhou:', snapErr instanceof Error ? snapErr.message : snapErr);
    }

    return { order_id: newOrderId };
  });

// ---------------------------------------------------------------------------
// Detalhe público do pedido (página de confirmação)
// ---------------------------------------------------------------------------

/**
 * Detalhe público do pedido (página de confirmação).
 *
 * Segurança:
 * - Exige `session_token` que corresponda ao `carts.session_token` do carrinho
 *   de origem (`orders.source_cart_id`). Sem prova de posse, retorna 404.
 * - Nunca retorna e-mail do cliente por esta rota pública. E-mail privado só é
 *   exposto via rotas autenticadas em `storefront-account.functions.ts`.
 */
export const getPublicOrder = createServerFn({ method: 'POST' })
  .inputValidator((d: { order_id: string; session_token: string }) => d)
  .handler(async ({ data }) => {
    if (!data.order_id || !data.session_token) {
      throw Errors.notFound('Pedido');
    }
    const sb = await publicClient();
    const { data: order } = await sb
      .from('orders')
      .select('id, order_number, status, total, subtotal, shipping_total, currency, placed_at, source_cart_id')
      .eq('id', data.order_id)
      .maybeSingle();
    if (!order) throw Errors.notFound('Pedido');

    // Prova de posse: session_token deve conferir com o carrinho de origem.
    if (!order.source_cart_id) throw Errors.notFound('Pedido');
    const { data: cart } = await sb
      .from('carts')
      .select('id, session_token')
      .eq('id', order.source_cart_id)
      .maybeSingle();
    if (!cart || cart.session_token !== data.session_token) {
      throw Errors.notFound('Pedido');
    }

    const { data: items } = await sb.from('order_items')
      .select('name, qty, unit_price, line_total')
      .eq('order_id', data.order_id);
    const { data: shipping } = await sb.from('order_shipping_snapshots')
      .select('carrier, service, price, eta_days, snapshot')
      .eq('order_id', data.order_id).maybeSingle();
    const { data: address } = await sb.from('order_addresses')
      .select('recipient, postal_code, street, number, complement, district, city, state')
      .eq('order_id', data.order_id).eq('kind', 'shipping').maybeSingle();

    // Não expor source_cart_id nem customer_email no retorno público.
    const { source_cart_id: _srcCart, ...orderSafe } = order;
    void _srcCart;
    return { order: orderSafe, items: items ?? [], shipping, address };
  });

// ---------------------------------------------------------------------------
// Admin: gerar etiqueta (autenticado)
// ---------------------------------------------------------------------------

export const purchaseOrderLabel = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order_id: string }) => d)
  .handler(
    withBusiness(async ({ data, context }) => {
      const { supabase } = context;
      // resolve fulfillment + shipment
      const { data: order } = await supabase
        .from('orders').select('id, store_id').eq('id', data.order_id).maybeSingle();
      if (!order) throw Errors.notFound('Pedido', data.order_id);

      const { data: fulfillment } = await supabase
        .from('fulfillments')
        .select('id')
        .eq('fulfillable_type', 'order')
        .eq('fulfillable_id', data.order_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!fulfillment) throw Errors.rule('Pedido sem separação (fulfillment) — não é possível gerar etiqueta');

      const { data: shipment } = await supabase
        .from('shipments')
        .select('id, carrier_code, service_code, ship_from, ship_to, status')
        .eq('fulfillment_id', fulfillment.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!shipment) throw Errors.rule('Pedido sem remessa (shipment)');
      if (!shipment.service_code) throw Errors.rule('Remessa sem código de serviço — refaça a cotação');

      const to = shipment.ship_to as Record<string, unknown>;
      const from = shipment.ship_from as Record<string, unknown>;

      const labels = await import('./services/shipping/labels.server');
      const result = await labels.purchaseShippingLabel(supabase, {
        shipment_id: shipment.id,
        service_code: String(shipment.service_code),
        to: {
          name: String(to.recipient ?? ''),
          postal_code: String(to.postal_code ?? ''),
          street: String(to.street ?? ''),
          number: String(to.number ?? ''),
          complement: (to.complement as string) ?? undefined,
          district: String(to.district ?? ''),
          city: String(to.city ?? ''),
          state: String(to.state ?? ''),
          country: String(to.country ?? 'BR'),
          phone: (to.phone as string) ?? undefined,
          email: (to.email as string) ?? undefined,
        },
        from: {
          name: 'Loja',
          postal_code: String(from.postal_code ?? ''),
          street: String(from.street ?? ''),
          number: String(from.number ?? ''),
          district: String(from.district ?? ''),
          city: String(from.city ?? ''),
          state: String(from.state ?? ''),
          country: String(from.country ?? 'BR'),
        },
      });
      return result;
    }),
  );
