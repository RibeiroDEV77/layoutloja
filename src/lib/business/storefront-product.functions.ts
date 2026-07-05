/**
 * Server Function: detalhe público de produto para a vitrine.
 * - Lê produto, marca, cores+mídia, variantes (com tamanho), atributos públicos.
 * - Resolve preço via price_list_items (qty=1) escolhendo o menor preço entre as variantes.
 * - Resolve disponibilidade por variante usando supabaseAdmin (stock_levels é staff-only).
 */
import { createServerFn } from '@tanstack/react-start';
import { storefrontClient } from './services/storefront-client.server';

// Encaminha o bearer token quando presente para habilitar RLS `authenticated`
// (ex.: leitura da Tabela Atacado por cliente aprovado). Anônimos continuam
// caindo nas políticas `TO anon`.
const publicClient = storefrontClient;

export type StorefrontProductMedia = {
  id: string;
  url: string;
  alt: string | null;
  sort_order: number;
  is_cover: boolean;
};
export type StorefrontProductColor = {
  id: string;
  name: string;
  hex: string | null;
  is_default: boolean;
  sort_order: number;
  media: StorefrontProductMedia[];
};
export type StorefrontProductSize = {
  attribute_value_id: string;
  label: string;
  sort_order: number;
};
export type StorefrontProductVariant = {
  id: string;
  product_color_id: string | null;
  size_attribute_value_id: string | null;
  sku: string | null;
  is_active: boolean;
  available: boolean;
  price: number;
  list_price: number;
};
export type StorefrontProductAttribute = {
  code: string;
  label: string;
  value: string;
};
export type StorefrontProductDetail = {
  id: string;
  name: string;
  slug: string;
  store_id: string | null;
  short_description: string | null;
  description: string | null;
  brand: { id: string; name: string; slug: string } | null;
  colors: StorefrontProductColor[];
  sizes: StorefrontProductSize[];
  variants: StorefrontProductVariant[];
  attributes: StorefrontProductAttribute[];
  price_from: number | null;
  price_to: number | null;
  list_price_from: number | null;
  currency: string;
};


export const getStorefrontProduct = createServerFn({ method: 'POST' })
  .inputValidator((d: { slug: string; sales_channel?: 'retail' | 'wholesale' }) => d)
  .handler(async ({ data }): Promise<{ product: StorefrontProductDetail | null }> => {
    const sb = publicClient();
    // Resolve o contexto comercial cedo (store_id ainda desconhecido).
    const { resolveCommercialContext } = await import('./services/commercial-context.server');
    const baseCtx = await resolveCommercialContext({
      explicit_channel: data.sales_channel ?? null,
      store_id: null,
    });
    const { data: product } = await sb
      .from('products')
      .select('id, name, slug, short_description, description, brand_id, store_id')
      .eq('slug', data.slug)
      .eq('status', 'published')
      .in('visibility', ['published', 'catalog_only'])
      .in('sale_channel', baseCtx.product_sale_channels)
      .maybeSingle();
    if (!product) return { product: null };
    // Re-resolve já com store_id para obter o price_list_code de atacado.
    const ctx = await resolveCommercialContext({
      explicit_channel: data.sales_channel ?? null,
      store_id: product.store_id,
    });

    const [brandRes, colorsRes, variantsRes, pavRes] = await Promise.all([
      product.brand_id
        ? sb.from('brands').select('id, name, slug').eq('id', product.brand_id).maybeSingle()
        : Promise.resolve({ data: null }),
      sb.from('product_colors')
        .select('id, name, hex, is_default, sort_order, is_active')
        .eq('product_id', product.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      sb.from('product_variants')
        .select('id, product_color_id, size_attribute_value_id, sku, is_active')
        .eq('product_id', product.id)
        .eq('is_active', true),
      sb.from('product_attribute_values')
        .select('attribute_id, attribute_value_id, value_text, value_number, value_boolean, attributes!inner(code, name, is_public), attribute_values(label)')
        .eq('product_id', product.id),
    ]);

    const colorIds = (colorsRes.data ?? []).map((c) => c.id);
    const variantIds = (variantsRes.data ?? []).map((v) => v.id);
    const sizeIds = Array.from(new Set((variantsRes.data ?? [])
      .map((v) => v.size_attribute_value_id).filter(Boolean) as string[]));

    const [mediaRes, sizesRes, pricesRes] = await Promise.all([
      colorIds.length
        ? sb.from('product_color_media')
            .select('id, product_color_id, external_url, storage_path, alt, sort_order, is_cover')
            .in('product_color_id', colorIds)
            .order('sort_order', { ascending: true })
        : Promise.resolve({ data: [] }),
      sizeIds.length
        ? sb.from('attribute_values')
            .select('id, label, sort_order')
            .in('id', sizeIds)
        : Promise.resolve({ data: [] }),
      variantIds.length
        ? (ctx.price_list_code
            ? sb.from('price_list_items')
                .select('variant_id, price, compare_at_price, min_quantity, max_quantity, price_lists!inner(is_active, store_id, code, starts_at, ends_at)')
                .in('variant_id', variantIds)
                .eq('price_lists.is_active', true)
                .eq('price_lists.store_id', product.store_id)
                .eq('price_lists.code', ctx.price_list_code)
            : sb.from('price_list_items')
                .select('variant_id, price, compare_at_price, min_quantity, max_quantity, price_lists!inner(is_active, store_id, starts_at, ends_at)')
                .in('variant_id', variantIds)
                .eq('price_lists.is_active', true)
                .eq('price_lists.store_id', product.store_id))
        : Promise.resolve({ data: [] }),
    ]);

    // Stock via admin (stock_levels é authenticated-only).
    const stockByVariant = new Map<string, number>();
    if (variantIds.length) {
      try {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { data: stock } = await supabaseAdmin
          .from('stock_levels')
          .select('variant_id, quantity_on_hand, quantity_reserved')
          .in('variant_id', variantIds);
        for (const s of stock ?? []) {
          const avail = Math.max(0, Number(s.quantity_on_hand ?? 0) - Number(s.quantity_reserved ?? 0));
          stockByVariant.set(s.variant_id, (stockByVariant.get(s.variant_id) ?? 0) + avail);
        }
      } catch { /* sem estoque -> trata como disponível */ }
    }

    // Extrai o path dentro do bucket "dam" a partir de uma URL salva (assinada/pública)
    // ou de um storage_path direto. Devolve null se não der pra resolver.
    const damPathFromUrl = (raw: string | null | undefined): string | null => {
      if (!raw) return null;
      const s = raw.trim();
      if (!s) return null;
      if (!/^https?:\/\//i.test(s)) {
        const noBucket = s.replace(/^\/?dam\//, '');
        return noBucket || null;
      }
      const m = s.match(/\/object\/(?:sign|public|authenticated)\/dam\/([^?#]+)/i);
      if (m && m[1]) return decodeURIComponent(m[1]);
      return null;
    };

    type RawMedia = {
      id: string; product_color_id: string; external_url: string | null;
      storage_path: string | null; alt: string | null; sort_order: number | null; is_cover: boolean | null;
    };
    const rawMedia = (mediaRes.data ?? []) as RawMedia[];

    // Gera URLs assinadas frescas (TTL longo) para mídias do bucket "dam".
    // URLs curtas salvas pelo admin expiravam em ~1h e quebravam o storefront.
    const resolvedUrlById = new Map<string, string>();
    const toSign: Array<{ id: string; path: string }> = [];
    for (const m of rawMedia) {
      const path = damPathFromUrl(m.storage_path) ?? damPathFromUrl(m.external_url);
      if (path) toSign.push({ id: m.id, path });
      else if (m.external_url) resolvedUrlById.set(m.id, m.external_url);
    }
    if (toSign.length) {
      try {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { data: signed } = await supabaseAdmin
          .storage.from('dam')
          .createSignedUrls(toSign.map((t) => t.path), 60 * 60 * 24 * 7);
        signed?.forEach((row, i) => {
          if (row?.signedUrl) resolvedUrlById.set(toSign[i].id, row.signedUrl);
        });
      } catch { /* fallback: usa external_url original */ }
      for (const t of toSign) {
        if (!resolvedUrlById.has(t.id)) {
          const orig = rawMedia.find((r) => r.id === t.id)?.external_url;
          if (orig) resolvedUrlById.set(t.id, orig);
        }
      }
    }

    const mediaByColor = new Map<string, StorefrontProductMedia[]>();
    for (const m of rawMedia) {
      const url = resolvedUrlById.get(m.id) ?? m.external_url ?? m.storage_path;
      if (!url) continue;
      const list = mediaByColor.get(m.product_color_id) ?? [];
      list.push({
        id: m.id, url, alt: m.alt,
        sort_order: Number(m.sort_order ?? 0),
        is_cover: !!m.is_cover,
      });
      mediaByColor.set(m.product_color_id, list);
    }

    const colors: StorefrontProductColor[] = (colorsRes.data ?? []).map((c) => ({
      id: c.id, name: c.name, hex: c.hex ?? null,
      is_default: !!c.is_default, sort_order: Number(c.sort_order ?? 0),
      media: (mediaByColor.get(c.id) ?? []).sort((a, b) =>
        Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order,
      ),
    }));

    const sizes: StorefrontProductSize[] = ((sizesRes.data ?? []) as Array<{
      id: string; label: string; sort_order: number | null;
    }>).map((s) => ({
      attribute_value_id: s.id, label: s.label,
      sort_order: Number(s.sort_order ?? 0),
    })).sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));

    // preço por variante (qty=1 -> pega o item aplicável de menor preço)
    const priceByVariant = new Map<string, { price: number; list: number }>();
    for (const it of (pricesRes.data ?? []) as Array<{
      variant_id: string; price: number; compare_at_price: number | null;
      min_quantity: number | null; max_quantity: number | null;
    }>) {
      const minQ = it.min_quantity ?? 1;
      const maxQ = it.max_quantity ?? null;
      if (1 < minQ) continue;
      if (maxQ != null && 1 > maxQ) continue;
      const price = Number(it.price);
      const list = it.compare_at_price != null ? Number(it.compare_at_price) : price;
      const prev = priceByVariant.get(it.variant_id);
      if (!prev || price < prev.price) priceByVariant.set(it.variant_id, { price, list });
    }

    const variants: StorefrontProductVariant[] = (variantsRes.data ?? []).map((v) => {
      const pr = priceByVariant.get(v.id) ?? { price: 0, list: 0 };
      const hasStockRow = stockByVariant.has(v.id);
      const available = (!hasStockRow || (stockByVariant.get(v.id) ?? 0) > 0) && v.is_active;
      return {
        id: v.id,
        product_color_id: v.product_color_id,
        size_attribute_value_id: v.size_attribute_value_id,
        sku: v.sku, is_active: !!v.is_active,
        available, price: pr.price, list_price: pr.list,
      };
    });

    const priced = variants.filter((v) => v.price > 0).map((v) => v.price);
    const priceFrom = priced.length ? Math.min(...priced) : null;
    const priceTo = priced.length ? Math.max(...priced) : null;
    const listed = variants.filter((v) => v.list_price > 0).map((v) => v.list_price);
    const listPriceFrom = listed.length ? Math.min(...listed) : null;

    const attributes: StorefrontProductAttribute[] = ((pavRes.data ?? []) as Array<{
      attributes: { code: string; name: string; is_public: boolean } | null;
      attribute_values: { label: string } | null;
      value_text: string | null; value_number: number | null; value_boolean: boolean | null;
    }>)
      .filter((r) => r.attributes?.is_public)
      .map((r) => {
        const value = r.attribute_values?.label
          ?? r.value_text
          ?? (r.value_number != null ? String(r.value_number) : null)
          ?? (r.value_boolean != null ? (r.value_boolean ? 'Sim' : 'Não') : '');
        return { code: r.attributes!.code, label: r.attributes!.name, value };
      })
      .filter((a) => a.value);

    return {
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        store_id: product.store_id ?? null,
        short_description: product.short_description,

        description: product.description,
        brand: (brandRes.data as { id: string; name: string; slug: string } | null) ?? null,
        colors, sizes, variants, attributes,
        price_from: priceFrom, price_to: priceTo,
        list_price_from: listPriceFrom,
        currency: 'BRL',
      },
    };
  });
