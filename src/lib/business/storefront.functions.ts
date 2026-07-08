/**
 * Server Functions: Storefront público.
 *
 * Endpoints PÚBLICOS (sem auth) que alimentam a Loja Pública (Home, cards,
 * sessões de produtos). Consumem o Supabase via cliente publishable e RLS
 * `TO anon` já existentes (categories_public_select, products_public_select,
 * stores_public_select). Nenhuma alteração no Product Engine, RLS, RBAC ou
 * banco — apenas leitura.
 */
import { createServerFn } from '@tanstack/react-start';
import { storefrontClient } from './services/storefront-client.server';

// Mantém o nome antigo para não tocar nos call sites; encaminha o bearer token
// da requisição quando presente (Canal Atacado / cliente aprovado).
const publicClient = storefrontClient;

export type StorefrontStore = { id: string; name: string; slug: string };
export type StorefrontCategory = {
  id: string; name: string; slug: string;
  parent_id: string | null; image_url: string | null;
  level: number | null; sort_order: number;
  seo_title?: string | null; seo_description?: string | null;
};
export type StorefrontProduct = {
  id: string; name: string; slug: string;
  short_description: string | null;
  category_id: string | null; brand_id: string | null;
  category_ids?: string[];
  on_sale: boolean; new_product: boolean;
  featured: boolean; best_seller: boolean;
  image_url?: string | null;
  hover_image_url?: string | null;
  price?: number | null;
  sale_price?: number | null;
  list_price?: number | null;
};
export type StorefrontBrand = {
  id: string; name: string; slug: string; logo_url: string | null;
};


export const getStorefrontStore = createServerFn({ method: 'GET' })
  .handler(async (): Promise<{ store: StorefrontStore | null }> => {
    const sb = publicClient();
    const { data } = await sb
      .from('stores')
      .select('id,name,slug')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    return { store: (data ?? null) as StorefrontStore | null };
  });

export const listStorefrontCategories = createServerFn({ method: 'POST' })
  .inputValidator((input: { store_id?: string }) => input ?? {})
  .handler(async ({ data }): Promise<{ rows: StorefrontCategory[] }> => {
    const sb = publicClient();
    let q = sb
      .from('categories')
      .select('id,name,slug,parent_id,image_url,level,sort_order,seo_title,seo_description')
      .eq('is_active', true)
      .order('level', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .limit(200);
    if (data.store_id) q = q.eq('store_id', data.store_id);
    const { data: rows } = await q;
    return { rows: (rows ?? []) as StorefrontCategory[] };
  });

export const listStorefrontProducts = createServerFn({ method: 'POST' })
  .inputValidator((input: {
    store_id?: string;
    flag?: 'new' | 'sale' | 'featured';
    limit?: number;
    /** Sprint 10.5: canal comercial. Quando omitido, resolvido por cookie. */
    sales_channel?: 'retail' | 'wholesale';
    /** Filtra produtos por categoria (inclui multi-categoria via product_categories). */
    category_ids?: string[];
  }) => input ?? {})
  .handler(async ({ data }): Promise<{ rows: StorefrontProduct[] }> => {
    const sb = publicClient();
    // Resolve o contexto comercial (cookie SSR-safe + mapeamento canônico).
    // P5: wholesale exige verificação de aprovação server-side.
    const { resolveCommercialContext } = await import('./services/commercial-context.server');
    const ctx = await resolveCommercialContext({
      explicit_channel: data.sales_channel ?? null,
      store_id: data.store_id ?? null,
      supabase: sb,
    });

    const hasCategoryFilter = Array.isArray(data.category_ids) && data.category_ids.length > 0;
    const catIds = hasCategoryFilter ? (data.category_ids as string[]) : [];

    // Coleta product_ids vinculados via junção (multi-categoria) quando filtrando por categoria.
    let productIdsFromJoin: string[] = [];
    if (hasCategoryFilter) {
      const { data: joinRows } = await sb
        .from('product_categories')
        .select('product_id')
        .in('category_id', catIds);
      productIdsFromJoin = Array.from(new Set((joinRows ?? []).map((r: { product_id: string }) => r.product_id)));
    }

    const effectiveLimit = hasCategoryFilter ? Math.min(data.limit ?? 200, 200) : Math.min(data.limit ?? 8, 24);
    let q = sb
      .from('products')
      .select('id,name,slug,short_description,category_id,brand_id,on_sale,new_product,featured,best_seller')
      .eq('status', 'published')
      .in('visibility', ['published', 'catalog_only'])
      .in('sale_channel', ctx.product_sale_channels)
      .order('updated_at', { ascending: false })
      .limit(effectiveLimit);
    if (data.store_id) q = q.eq('store_id', data.store_id);
    if (data.flag === 'new') q = q.eq('new_product', true);
    if (data.flag === 'sale') q = q.eq('on_sale', true);
    if (data.flag === 'featured') q = q.eq('featured', true);
    if (hasCategoryFilter) {
      const orParts: string[] = [`category_id.in.(${catIds.join(',')})`];
      if (productIdsFromJoin.length) orParts.push(`id.in.(${productIdsFromJoin.join(',')})`);
      q = q.or(orParts.join(','));
    }
    const { data: rows } = await q;
    const products = (rows ?? []) as StorefrontProduct[];
    if (!products.length) return { rows: products };

    const productIds = products.map((p) => p.id);
    const { data: productCategoryRows } = await sb
      .from('product_categories')
      .select('product_id, category_id')
      .in('product_id', productIds);
    const categoriesByProduct = new Map<string, string[]>();
    for (const row of (productCategoryRows ?? []) as Array<{ product_id: string; category_id: string }>) {
      const list = categoriesByProduct.get(row.product_id) ?? [];
      list.push(row.category_id);
      categoriesByProduct.set(row.product_id, list);
    }

    const { data: colors } = await sb
      .from('product_colors')
      .select('id, product_id, is_default, sort_order')
      .in('product_id', productIds)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    const colorIds = (colors ?? []).map((c) => c.id);
    const { data: media } = colorIds.length
      ? await sb
          .from('product_color_media')
          .select('id, product_color_id, external_url, storage_path, thumbnail_url, sort_order, is_cover, is_hover_media')
          .in('product_color_id', colorIds)
          .order('sort_order', { ascending: true })
      : { data: [] };

    const damPathFromUrl = (raw: string | null | undefined): string | null => {
      if (!raw) return null;
      const s = raw.trim();
      if (!s) return null;
      if (!/^https?:\/\//i.test(s)) return s.replace(/^\/?dam\//, '') || null;
      const m = s.match(/\/object\/(?:sign|public|authenticated)\/dam\/([^?#]+)/i);
      return m?.[1] ? decodeURIComponent(m[1]) : null;
    };

    type RawMedia = {
      id: string; product_color_id: string; external_url: string | null; storage_path: string | null;
      thumbnail_url: string | null; sort_order: number | null; is_cover: boolean | null; is_hover_media: boolean | null;
    };
    const rawMedia = (media ?? []) as RawMedia[];
    const resolvedById = new Map<string, string>();
    const toSign: Array<{ id: string; path: string }> = [];
    for (const m of rawMedia) {
      const path = damPathFromUrl(m.storage_path) ?? damPathFromUrl(m.external_url) ?? damPathFromUrl(m.thumbnail_url);
      if (path) toSign.push({ id: m.id, path });
      else if (m.external_url || m.thumbnail_url) resolvedById.set(m.id, m.external_url ?? m.thumbnail_url!);
    }
    if (toSign.length) {
      try {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { data: signed } = await supabaseAdmin.storage.from('dam').createSignedUrls(toSign.map((m) => m.path), 60 * 60 * 24 * 7);
        signed?.forEach((row, i) => { if (row?.signedUrl) resolvedById.set(toSign[i].id, row.signedUrl); });
      } catch { /* usa URLs originais quando possível */ }
    }

    const colorsByProduct = new Map<string, typeof colors>();
    for (const c of colors ?? []) {
      const list = colorsByProduct.get(c.product_id) ?? [];
      list.push(c);
      colorsByProduct.set(c.product_id, list);
    }
    const mediaByColor = new Map<string, RawMedia[]>();
    for (const m of rawMedia) {
      const list = mediaByColor.get(m.product_color_id) ?? [];
      list.push(m);
      mediaByColor.set(m.product_color_id, list);
    }

    // Agrega preço mínimo por produto a partir das variantes ativas
    const priceByProduct = new Map<string, { price: number; list: number }>();
    const { data: variantsForPrice } = await sb
      .from('product_variants')
      .select('id, product_id')
      .in('product_id', productIds)
      .eq('is_active', true);
    const variantIds = (variantsForPrice ?? []).map((v) => v.id);
    const productByVariant = new Map((variantsForPrice ?? []).map((v) => [v.id, v.product_id]));
    if (variantIds.length) {
      // Seleciona a tabela de preços conforme o contexto comercial:
      //   - wholesale: filtra pelo `code = WHOLESALE-{store_id}`;
      //   - retail/default: tabelas públicas (`is_public = true`).
      let priceQ = sb
        .from('price_list_items')
        .select('variant_id, price, compare_at_price, min_quantity, max_quantity, price_lists!inner(is_active, is_public, code)')
        .in('variant_id', variantIds)
        .eq('price_lists.is_active', true);
      if (ctx.price_list_code) {
        priceQ = priceQ.eq('price_lists.code', ctx.price_list_code);
      } else {
        priceQ = priceQ.eq('price_lists.is_public', true);
      }
      const { data: priceItems } = await priceQ;
      for (const it of (priceItems ?? []) as Array<{ variant_id: string; price: number; compare_at_price: number | null; min_quantity: number | null; max_quantity: number | null }>) {
        const minQ = it.min_quantity ?? 1;
        const maxQ = it.max_quantity ?? null;
        if (1 < minQ) continue;
        if (maxQ != null && 1 > maxQ) continue;
        const pid = productByVariant.get(it.variant_id);
        if (!pid) continue;
        const price = Number(it.price);
        const list = it.compare_at_price != null ? Number(it.compare_at_price) : price;
        const prev = priceByProduct.get(pid);
        if (!prev || price < prev.price) priceByProduct.set(pid, { price, list });
      }
    }

    const rowsWithImages = products.map((p) => {
      const pColors = (colorsByProduct.get(p.id) ?? []).sort((a, b) =>
        Number(b.is_default) - Number(a.is_default) || Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
      );
      const medias = pColors.flatMap((c) => mediaByColor.get(c.id) ?? []).sort((a, b) =>
        Number(b.is_cover) - Number(a.is_cover) || Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
      );
      const cover = medias.find((m) => m.is_cover) ?? medias[0] ?? null;
      const hover = medias.find((m) => m.is_hover_media && m.id !== cover?.id) ?? medias.find((m) => m.id !== cover?.id) ?? null;
      const pr = priceByProduct.get(p.id) ?? null;
      const onSale = !!(pr && pr.list > pr.price);
      return {
        ...p,
        category_ids: categoriesByProduct.get(p.id) ?? [],
        image_url: cover ? (resolvedById.get(cover.id) ?? cover.external_url ?? cover.thumbnail_url ?? cover.storage_path) : null,
        hover_image_url: hover ? (resolvedById.get(hover.id) ?? hover.external_url ?? hover.thumbnail_url ?? hover.storage_path) : null,
        price: pr ? (onSale ? pr.list : pr.price) : null,
        sale_price: onSale ? pr!.price : null,
        list_price: pr?.list ?? null,
        on_sale: p.on_sale || onSale,
      };
    });
    // Não filtrar por preço: produtos publicados sem preço ainda devem aparecer
    // na vitrine ("Preço sob consulta"); RLS já garante visibilidade.
    return { rows: rowsWithImages };
  });

export const listStorefrontBrands = createServerFn({ method: 'POST' })
  .inputValidator((input: { store_id?: string }) => input ?? {})
  .handler(async ({ data }): Promise<{ rows: StorefrontBrand[] }> => {
    const sb = publicClient();
    let q = sb
      .from('brands')
      .select('id,name,slug,logo_url')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .limit(50);
    if (data.store_id) q = q.eq('store_id', data.store_id);
    const { data: rows } = await q;
    return { rows: (rows ?? []) as StorefrontBrand[] };
  });

