---
name: Storefront data layer
description: Decisões da camada pública (storefront.server, cart-public) — uso de supabaseAdmin e cookies de sessão anônima
type: feature
---
Camada pública da loja vive em:
- `src/lib/business/services/storefront.server.ts` — reads (catálogo/PDP/relacionados) filtrados estritamente a `status='published'` e `visibility IN ('published','catalog_only')`.
- `src/lib/business/storefront.functions.ts` — server fns públicas (sem `requireSupabaseAuth`).
- `src/lib/business/cart-public.functions.ts` — wrappers públicos de Cart/Coupon/Shipping reusando 100% de `services/cart.server.ts`.
- `src/lib/storefront/session.server.ts` — cookies httpOnly `sf_session` (uuid visitante) e `sf_cart_id` (cache do cart_id).
- `src/lib/storefront/store-context.server.ts` — resolve loja default (primeira `stores.status='active'`).

Decisão: usa `supabaseAdmin` (await import dentro dos handlers) tanto nos reads quanto nos writes públicos. Motivo:
1. Reads são read-only e blindados por WHERE — não há risco de vazar dados não publicados.
2. Cart service interno escreve em outbox/metrics/reservations que não têm policies anon — service-role evita propagar policies.
3. Ownership de carrinho é garantida por `Cart.assertCartAccess` comparando `session_token` (cookie httpOnly).

Débito técnico (V2): migrar reads para publishable key + policies `TO anon` em catalog tables, e expor outbox/metrics via SECURITY DEFINER RPCs para o cart anônimo. Hoje funciona e é seguro.

Para resolver imagens, usa `product_color_media.thumbnail_url || external_url || storage.from('assets').getPublicUrl(storage_path)`.

Colunas reais (não confundir com nomes de services):
- `price_list_items`: `price`, `compare_at_price` (NÃO list_price/sale_price).
- `stock_levels`: `quantity_on_hand`, `quantity_reserved` (NÃO available/reserved_qty).
- `product_variants`: tem `product_color_id` e `size_attribute_value_id`.
