/**
 * Storefront read projection — server-only.
 *
 * Camada de LEITURA para a loja pública. NÃO duplica regras de negócio:
 * apenas projeta dados já gravados pelos engines (catálogo, pricing, stock).
 *
 * Filtros sempre aplicados:
 *  - products.status = 'published'
 *  - products.visibility IN ('published','catalog_only')
 *
 * Resolução de imagem (V1):
 *  - usa `product_color_media.external_url` quando presente;
 *  - storage_path com bucket Supabase: monta URL pública via `getPublicUrl`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

type Sb = SupabaseClient<Database>;

const PUBLIC_VIS = ['published', 'catalog_only'] as const;

/** Estrutura mínima do card de produto exibida em listas. */
export interface StorefrontProductCard {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  brand_id: string | null;
  category_id: string | null;
  featured: boolean;
  new_product: boolean;
  best_seller: boolean;
  on_sale: boolean;
  image_url: string | null;
  price_from: number | null;
  list_price_from: number | null;
}

function resolveMediaUrl(
  supabase: Sb,
  m: { external_url: string | null; storage_path: string | null; thumbnail_url?: string | null },
): string | null {
  if (m.thumbnail_url) return m.thumbnail_url;
  if (m.external_url) return m.external_url;
  if (m.storage_path) {
    const { data } = supabase.storage.from('assets').getPublicUrl(m.storage_path);
    return data?.publicUrl ?? null;
  }
  return null;
}

/* ---------------- Categorias ---------------- */

export interface StorefrontCategoryNode {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  sort_order: number | null;
  children: StorefrontCategoryNode[];
}

export async function listCategoryTree(
  supabase: Sb,
  storeId: string,
): Promise<StorefrontCategoryNode[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, slug, name, parent_id, sort_order, is_active')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name');
  if (error) throw new Error('categories_failed: ' + error.message);
  const rows = (data ?? []) as Array<{ id: string; slug: string; name: string; parent_id: string | null; sort_order: number | null }>;
  const byParent = new Map<string | null, StorefrontCategoryNode[]>();
  for (const r of rows) {
    const node: StorefrontCategoryNode = {
      id: r.id, slug: r.slug, name: r.name, parent_id: r.parent_id, sort_order: r.sort_order, children: [],
    };
    const arr = byParent.get(r.parent_id) ?? [];
    arr.push(node);
    byParent.set(r.parent_id, arr);
  }
  function attach(parentId: string | null): StorefrontCategoryNode[] {
    return (byParent.get(parentId) ?? []).map((n) => ({ ...n, children: attach(n.id) }));
  }
  return attach(null);
}

export async function getCategoryBySlug(
  supabase: Sb,
  storeId: string,
  slug: string,
) {
  const { data, error } = await supabase
    .from('categories')
    .select('id, slug, name, parent_id, description')
    .eq('store_id', storeId)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error('category_lookup_failed: ' + error.message);
  return data;
}

/* ---------------- Coleções / marcas ---------------- */

export async function listCollections(supabase: Sb, storeId: string) {
  const { data } = await supabase
    .from('collections')
    .select('id, slug, name')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true, nullsFirst: false });
  return data ?? [];
}

export async function listBrands(supabase: Sb, storeId: string) {
  const { data } = await supabase
    .from('brands')
    .select('id, slug, name')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('name');
  return data ?? [];
}

/* ---------------- Resolução de preço/imagem em lote ---------------- */

async function enrichCards(supabase: Sb, base: Array<{
  id: string; slug: string; name: string; short_description: string | null;
  brand_id: string | null; category_id: string | null;
  featured: boolean; new_product: boolean; best_seller: boolean; on_sale: boolean;
}>): Promise<StorefrontProductCard[]> {
  if (!base.length) return [];
  const productIds = base.map((p) => p.id);

  // 1) primeira mídia de capa por produto (via product_colors -> product_color_media)
  const { data: colors } = await supabase
    .from('product_colors')
    .select('id, product_id, is_default, sort_order')
    .in('product_id', productIds)
    .eq('is_active', true);
  const colorIds = (colors ?? []).map((c) => c.id);
  const coverByProduct = new Map<string, string>();
  if (colorIds.length) {
    const { data: media } = await supabase
      .from('product_color_media')
      .select('product_color_id, external_url, storage_path, thumbnail_url, sort_order, is_cover, media_type')
      .in('product_color_id', colorIds)
      .eq('media_type', 'image')
      .order('is_cover', { ascending: false })
      .order('sort_order', { ascending: true, nullsFirst: false });
    const colorToProduct = new Map<string, string>((colors ?? []).map((c) => [c.id, c.product_id]));
    for (const m of media ?? []) {
      const productId = colorToProduct.get(m.product_color_id);
      if (!productId || coverByProduct.has(productId)) continue;
      const url = resolveMediaUrl(supabase, m);
      if (url) coverByProduct.set(productId, url);
    }
  }

  // 2) menor preço entre variantes ativas (via price_list_items.list_price/sale_price ou stock_levels fallback)
  // Como o pricing engine é complexo, usamos o menor `sale_price` (ou `list_price`) dos price_list_items mais recentes.
  const priceByProduct = new Map<string, { price: number; list: number | null }>();
  const { data: variants } = await supabase
    .from('product_variants')
    .select('id, product_id')
    .in('product_id', productIds)
    .eq('is_active', true);
  const variantIds = (variants ?? []).map((v) => v.id);
  const variantToProduct = new Map<string, string>((variants ?? []).map((v) => [v.id, v.product_id]));
  if (variantIds.length) {
    const { data: pli } = await supabase
      .from('price_list_items')
      .select('variant_id, list_price, sale_price')
      .in('variant_id', variantIds);
    for (const it of pli ?? []) {
      const pid = variantToProduct.get(it.variant_id);
      if (!pid) continue;
      const effective = Number(it.sale_price ?? it.list_price ?? 0);
      const list = it.list_price != null ? Number(it.list_price) : null;
      if (!effective) continue;
      const cur = priceByProduct.get(pid);
      if (!cur || effective < cur.price) priceByProduct.set(pid, { price: effective, list });
    }
  }

  return base.map((p) => ({
    ...p,
    image_url: coverByProduct.get(p.id) ?? null,
    price_from: priceByProduct.get(p.id)?.price ?? null,
    list_price_from: priceByProduct.get(p.id)?.list ?? null,
  }));
}

/* ---------------- Listagens ---------------- */

export type StorefrontSort = 'newest' | 'price_asc' | 'price_desc' | 'name_asc';

export interface ListPublicProductsInput {
  store_id: string;
  page?: number;
  pageSize?: number;
  category_slug?: string | null;
  collection_slug?: string | null;
  brand_slug?: string | null;
  on_sale?: boolean;
  new_only?: boolean;
  featured?: boolean;
  best_seller?: boolean;
  search?: string;
  sort?: StorefrontSort;
}

export async function listPublicProducts(supabase: Sb, p: ListPublicProductsInput) {
  const page = Math.max(1, p.page ?? 1);
  const size = Math.min(48, Math.max(1, p.pageSize ?? 24));
  const from = (page - 1) * size;
  const to = from + size - 1;

  // Resolve slugs → ids
  let categoryId: string | undefined;
  if (p.category_slug) {
    const cat = await getCategoryBySlug(supabase, p.store_id, p.category_slug);
    if (!cat) return { rows: [], total: 0, page, pageSize: size };
    categoryId = cat.id;
  }
  let brandId: string | undefined;
  if (p.brand_slug) {
    const { data: b } = await supabase
      .from('brands').select('id').eq('store_id', p.store_id).eq('slug', p.brand_slug).maybeSingle();
    if (!b) return { rows: [], total: 0, page, pageSize: size };
    brandId = b.id;
  }
  let collectionId: string | undefined;
  if (p.collection_slug) {
    const { data: c } = await supabase
      .from('collections').select('id').eq('store_id', p.store_id).eq('slug', p.collection_slug).maybeSingle();
    if (!c) return { rows: [], total: 0, page, pageSize: size };
    collectionId = c.id;
  }

  let q = supabase
    .from('products')
    .select('id, slug, name, short_description, brand_id, category_id, featured, new_product, best_seller, on_sale, published_at, created_at, updated_at', { count: 'exact' })
    .eq('store_id', p.store_id)
    .eq('status', 'published')
    .in('visibility', PUBLIC_VIS as unknown as string[]);

  if (categoryId) q = q.eq('category_id', categoryId);
  if (brandId) q = q.eq('brand_id', brandId);
  if (p.on_sale) q = q.eq('on_sale', true);
  if (p.new_only) q = q.eq('new_product', true);
  if (p.featured) q = q.eq('featured', true);
  if (p.best_seller) q = q.eq('best_seller', true);
  if (p.search && p.search.trim()) {
    const s = p.search.replace(/[%,]/g, '').trim();
    q = q.or(`name.ilike.%${s}%,short_description.ilike.%${s}%`);
  }

  // Coleção exige join → filtramos via subquery na product_collections
  if (collectionId) {
    const { data: pc } = await supabase
      .from('product_collections')
      .select('product_id')
      .eq('collection_id', collectionId);
    const ids = (pc ?? []).map((r) => r.product_id);
    if (!ids.length) return { rows: [], total: 0, page, pageSize: size };
    q = q.in('id', ids);
  }

  switch (p.sort ?? 'newest') {
    case 'newest':
      q = q.order('published_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
      break;
    case 'name_asc':
      q = q.order('name', { ascending: true });
      break;
    case 'price_asc':
    case 'price_desc':
      // sort por preço é resolvido client-side após enriquecimento (V1)
      q = q.order('updated_at', { ascending: false });
      break;
  }

  q = q.range(from, to);
  const { data, error, count } = await q;
  if (error) throw new Error('list_public_products_failed: ' + error.message);

  let rows = await enrichCards(supabase, (data ?? []) as never);

  if (p.sort === 'price_asc' || p.sort === 'price_desc') {
    const dir = p.sort === 'price_asc' ? 1 : -1;
    rows = rows.slice().sort((a, b) => {
      const pa = a.price_from ?? Number.POSITIVE_INFINITY;
      const pb = b.price_from ?? Number.POSITIVE_INFINITY;
      return (pa - pb) * dir;
    });
  }

  return { rows, total: count ?? 0, page, pageSize: size };
}

/* ---------------- PDP ---------------- */

export interface StorefrontProductDetail {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  category_id: string | null;
  brand_id: string | null;
  seo_title: string | null;
  seo_description: string | null;
  featured: boolean;
  new_product: boolean;
  best_seller: boolean;
  on_sale: boolean;
  colors: Array<{
    id: string;
    name: string;
    hex: string | null;
    is_default: boolean;
    sort_order: number | null;
    media: Array<{ url: string; alt: string | null; sort_order: number | null; is_cover: boolean | null; media_type: string | null }>;
  }>;
  variants: Array<{
    id: string;
    sku: string;
    color_id: string | null;
    size_value_id: string | null;
    size_label: string | null;
    list_price: number | null;
    sale_price: number | null;
    effective_price: number | null;
    in_stock: boolean;
  }>;
  attributes: Array<{ attribute: string; value: string }>;
}

export async function getPublicProductBySlug(
  supabase: Sb,
  storeId: string,
  slug: string,
): Promise<StorefrontProductDetail | null> {
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .eq('slug', slug)
    .eq('status', 'published')
    .in('visibility', PUBLIC_VIS as unknown as string[])
    .maybeSingle();
  if (!product) return null;

  const [{ data: colors }, { data: variants }, { data: pavRows }] = await Promise.all([
    supabase.from('product_colors').select('*').eq('product_id', product.id).eq('is_active', true).order('sort_order', { nullsFirst: false }),
    supabase.from('product_variants').select('*').eq('product_id', product.id).eq('is_active', true),
    supabase.from('product_attribute_values')
      .select('value_text, value_number, value_boolean, attributes(name), attribute_values(value)')
      .eq('product_id', product.id),
  ]);

  const colorIds = (colors ?? []).map((c) => c.id);
  const { data: media } = colorIds.length
    ? await supabase.from('product_color_media').select('*').in('product_color_id', colorIds)
        .order('is_cover', { ascending: false }).order('sort_order', { ascending: true, nullsFirst: false })
    : { data: [] as Array<Record<string, unknown>> };

  const mediaByColor = new Map<string, StorefrontProductDetail['colors'][number]['media']>();
  for (const m of (media as unknown as Array<{ product_color_id: string; external_url: string | null; storage_path: string | null; thumbnail_url: string | null; alt: string | null; sort_order: number | null; is_cover: boolean | null; media_type: string | null }>)) {
    const url = resolveMediaUrl(supabase, m);
    if (!url) continue;
    const arr = mediaByColor.get(m.product_color_id) ?? [];
    arr.push({ url, alt: m.alt, sort_order: m.sort_order, is_cover: m.is_cover, media_type: m.media_type });
    mediaByColor.set(m.product_color_id, arr);
  }

  // tamanhos via variant_attribute_values + attribute = 'tamanho'/'size'
  const variantIds = (variants ?? []).map((v) => v.id);
  const { data: vavRows } = variantIds.length
    ? await supabase.from('variant_attribute_values')
        .select('variant_id, attribute_value_id, attributes(name, code), attribute_values(value)')
        .in('variant_id', variantIds)
    : { data: [] as Array<Record<string, unknown>> };

  const sizeByVariant = new Map<string, { value_id: string; label: string }>();
  for (const r of (vavRows as unknown as Array<{ variant_id: string; attribute_value_id: string; attributes: { name?: string; code?: string } | null; attribute_values: { value?: string } | null }>)) {
    const code = (r.attributes?.code ?? r.attributes?.name ?? '').toLowerCase();
    if (code.includes('tama') || code.includes('size')) {
      sizeByVariant.set(r.variant_id, { value_id: r.attribute_value_id, label: r.attribute_values?.value ?? '—' });
    }
  }

  // preços
  const { data: pli } = variantIds.length
    ? await supabase.from('price_list_items').select('variant_id, list_price, sale_price').in('variant_id', variantIds)
    : { data: [] };
  const priceByVariant = new Map<string, { list: number | null; sale: number | null }>();
  for (const it of pli ?? []) {
    const cur = priceByVariant.get(it.variant_id);
    const list = it.list_price != null ? Number(it.list_price) : null;
    const sale = it.sale_price != null ? Number(it.sale_price) : null;
    if (!cur || (sale ?? list ?? Infinity) < (cur.sale ?? cur.list ?? Infinity)) {
      priceByVariant.set(it.variant_id, { list, sale });
    }
  }

  // estoque
  const { data: levels } = variantIds.length
    ? await supabase.from('stock_levels').select('variant_id, available_qty, reserved_qty').in('variant_id', variantIds)
    : { data: [] };
  const stockByVariant = new Map<string, number>();
  for (const l of levels ?? []) {
    const free = Number(l.available_qty ?? 0) - Number(l.reserved_qty ?? 0);
    stockByVariant.set(l.variant_id, (stockByVariant.get(l.variant_id) ?? 0) + Math.max(0, free));
  }

  // variant color: tentar via variant.color_id se houver, senão via variant_attribute_values com attribute 'cor'/'color'
  const colorByVariant = new Map<string, string>();
  for (const v of variants ?? []) {
    const vAny = v as unknown as { color_id?: string | null };
    if (vAny.color_id) colorByVariant.set(v.id, vAny.color_id);
  }

  const attributes: StorefrontProductDetail['attributes'] = (pavRows as unknown as Array<{ attributes: { name?: string } | null; attribute_values: { value?: string } | null; value_text: string | null; value_number: number | null; value_boolean: boolean | null }>)
    .map((r) => ({
      attribute: r.attributes?.name ?? '—',
      value: r.attribute_values?.value ?? r.value_text ?? (r.value_number != null ? String(r.value_number) : r.value_boolean != null ? (r.value_boolean ? 'Sim' : 'Não') : '—'),
    }));

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    short_description: product.short_description,
    description: product.description,
    category_id: product.category_id,
    brand_id: product.brand_id,
    seo_title: product.seo_title,
    seo_description: product.seo_description,
    featured: product.featured,
    new_product: product.new_product,
    best_seller: product.best_seller,
    on_sale: product.on_sale,
    colors: (colors ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      hex: c.hex,
      is_default: c.is_default ?? false,
      sort_order: c.sort_order,
      media: mediaByColor.get(c.id) ?? [],
    })),
    variants: (variants ?? []).map((v) => {
      const price = priceByVariant.get(v.id);
      const size = sizeByVariant.get(v.id);
      return {
        id: v.id,
        sku: v.sku,
        color_id: colorByVariant.get(v.id) ?? null,
        size_value_id: size?.value_id ?? null,
        size_label: size?.label ?? null,
        list_price: price?.list ?? null,
        sale_price: price?.sale ?? null,
        effective_price: price?.sale ?? price?.list ?? null,
        in_stock: (stockByVariant.get(v.id) ?? 0) > 0,
      };
    }),
    attributes,
  };
}

/* ---------------- Relacionados ---------------- */

export async function listRelatedProducts(
  supabase: Sb,
  storeId: string,
  productId: string,
  limit = 8,
): Promise<StorefrontProductCard[]> {
  // 1) tenta product_relations
  const { data: rels } = await supabase
    .from('product_relations')
    .select('related_product_id')
    .eq('product_id', productId)
    .limit(limit);
  let ids = (rels ?? []).map((r) => r.related_product_id);
  // 2) fallback: mesma categoria
  if (!ids.length) {
    const { data: src } = await supabase.from('products').select('category_id').eq('id', productId).maybeSingle();
    if (src?.category_id) {
      const { data: same } = await supabase
        .from('products')
        .select('id')
        .eq('store_id', storeId)
        .eq('status', 'published')
        .in('visibility', PUBLIC_VIS as unknown as string[])
        .eq('category_id', src.category_id)
        .neq('id', productId)
        .limit(limit);
      ids = (same ?? []).map((p) => p.id);
    }
  }
  if (!ids.length) return [];
  const { data: base } = await supabase
    .from('products')
    .select('id, slug, name, short_description, brand_id, category_id, featured, new_product, best_seller, on_sale')
    .in('id', ids);
  return enrichCards(supabase, (base ?? []) as never);
}
