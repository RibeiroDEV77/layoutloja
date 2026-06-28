/**
 * Service: Produtos — Central de Produtos.
 *
 * Cobre o ciclo: rascunho → configuração → publicação → operações
 * (duplicar, arquivar, exportar/importar, histórico, auditoria).
 *
 * Toda operação verifica RBAC + escopo de loja. RLS no banco é o último
 * cinto de segurança.
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { dispatchEvent } from '../events/dispatcher.server';
import { DomainEvent } from '../events/types';
import {
  requirePermission,
  requireStoreAccess,
  isSuperAdmin,
  hasPermission,
} from './permissions.server';

// ---------- Tipos públicos ----------

export type ProductStatus = 'draft' | 'published' | 'archived';
export type ProductVisibility = 'published' | 'hidden' | 'private' | 'catalog_only';
export type SaleChannel = 'varejo' | 'atacado' | 'ambos';

export interface ListProductsInput {
  store_id: string;
  q?: string;
  status?: ProductStatus | 'all';
  category_id?: string;
  category_ids?: string[];
  brand_id?: string;
  collection_id?: string;
  page?: number;
  pageSize?: number;
  sort?: { col: string; dir: 'asc' | 'desc' };
}

export interface CreateProductDraftInput {
  store_id: string;
  name: string;
  sku_root: string;
  slug?: string;
  category_id?: string | null;
  brand_id?: string | null;
  collection_id?: string | null;
  short_description?: string | null;
}

export interface UpdateProductInput {
  name?: string;
  slug?: string;
  short_description?: string | null;
  description?: string | null;
  category_id?: string | null;
  brand_id?: string | null;
  visibility?: ProductVisibility;
  sale_channel?: SaleChannel;
  tax_class?: string | null;
  featured?: boolean;
  new_product?: boolean;
  best_seller?: boolean;
  on_sale?: boolean;
  seo_title?: string | null;
  seo_description?: string | null;
}

// ---------- Helpers internos ----------

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function fetchProductStoreId(supabase: SbClient, productId: string): Promise<string> {
  const { data, error } = await supabase
    .from('products')
    .select('store_id')
    .eq('id', productId)
    .maybeSingle();
  if (error) throw Errors.internal('Falha ao localizar produto', { error: error.message });
  if (!data) throw Errors.notFound('product', productId);
  return data.store_id as string;
}

async function ensureRead(supabase: SbClient, userId: string, storeId: string) {
  if (await isSuperAdmin(supabase, userId)) return;
  await requireStoreAccess(supabase, userId, storeId);
  if (await hasPermission(supabase, userId, 'products.read', storeId)) return;
  throw Errors.forbidden('Permissão necessária: products.read', { store_id: storeId });
}

// ---------- LIST / GET ----------

export async function listProducts(
  supabase: SbClient,
  userId: string,
  p: ListProductsInput,
) {
  if (!p.store_id) throw Errors.validation('store_id obrigatório');
  await ensureRead(supabase, userId, p.store_id);

  const page = Math.max(1, p.page ?? 1);
  const size = Math.min(100, Math.max(1, p.pageSize ?? 25));
  const from = (page - 1) * size;
  const to = from + size - 1;

  let q = supabase
    .from('products')
    .select('id, name, sku_root, slug, status, visibility, category_id, brand_id, featured, on_sale, published_at, updated_at, created_at', {
      count: 'exact',
    })
    .eq('store_id', p.store_id);

  if (p.status && p.status !== 'all') q = q.eq('status', p.status);
  if (p.category_id) q = q.eq('category_id', p.category_id);
  if (p.category_ids && p.category_ids.length) q = q.in('category_id', p.category_ids);
  if (p.brand_id) q = q.eq('brand_id', p.brand_id);
  if (p.q && p.q.trim()) {
    const safe = p.q.replace(/[%,]/g, '');
    q = q.or(`name.ilike.%${safe}%,sku_root.ilike.%${safe}%,slug.ilike.%${safe}%`);
  }
  const sort = p.sort ?? { col: 'updated_at', dir: 'desc' };
  q = q.order(sort.col, { ascending: sort.dir === 'asc' }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw Errors.internal('Falha ao listar produtos', { error: error.message });
  return { rows: data ?? [], total: count ?? 0, page, pageSize: size };
}

export async function getProduct(supabase: SbClient, userId: string, productId: string) {
  const storeId = await fetchProductStoreId(supabase, productId);
  await ensureRead(supabase, userId, storeId);

  const [{ data: product, error: pe }, { data: colors }, { data: variants }, { data: attrs }] = await Promise.all([
    supabase.from('products').select('*').eq('id', productId).maybeSingle(),
    supabase.from('product_colors').select('*').eq('product_id', productId).order('sort_order'),
    supabase.from('product_variants').select('*').eq('product_id', productId).order('created_at'),
    supabase.from('product_attribute_values').select('*').eq('product_id', productId),
  ]);
  if (pe) throw Errors.internal('Falha ao carregar produto', { error: pe.message });
  if (!product) throw Errors.notFound('product', productId);
  return {
    product,
    colors: colors ?? [],
    variants: variants ?? [],
    attributes: attrs ?? [],
  };
}

// ---------- CRUD base ----------

export async function createProductDraft(
  supabase: SbClient,
  userId: string,
  input: CreateProductDraftInput,
) {
  if (!input.store_id) throw Errors.validation('store_id obrigatório');
  if (!input.name?.trim()) throw Errors.validation('Nome obrigatório');
  if (!input.sku_root?.trim()) throw Errors.validation('SKU Root obrigatório');

  await requirePermission(supabase, userId, 'products.create', input.store_id);

  const baseSlug = input.slug?.trim() || slugify(input.name);
  const baseSku = input.sku_root.trim().toUpperCase();

  // Auto-resolve conflitos: se slug/SKU já existirem na loja, anexa sufixo incremental.
  let slug = baseSlug;
  let sku = baseSku;
  const insertOnce = (s: string, k: string) =>
    supabase
      .from('products')
      .insert({
        store_id: input.store_id,
        name: input.name.trim(),
        sku_root: k,
        slug: s,
        category_id: input.category_id ?? null,
        brand_id: input.brand_id ?? null,
        short_description: input.short_description ?? null,
        status: 'published',
        visibility: 'published',
        sale_channel: 'ambos',
        featured: false,
        new_product: true,
        best_seller: false,
        on_sale: false,
        published_at: new Date().toISOString(),
      })
      .select('*')
      .single();

  let res = await insertOnce(slug, sku);
  for (let attempt = 0; attempt < 8 && res.error?.code === '23505'; attempt++) {
    const suffix = `-${Math.random().toString(36).slice(2, 6)}`;
    slug = `${baseSlug}${suffix}`;
    sku = `${baseSku}${suffix.toUpperCase()}`;
    res = await insertOnce(slug, sku);
  }

  if (res.error) {
    if (res.error.code === '23505') throw Errors.conflict('SKU Root ou slug já em uso', { error: res.error.message });
    if (res.error.code === '23503') throw Errors.validation('Referência inválida (categoria/marca)', { error: res.error.message });
    throw Errors.internal('Falha ao criar produto', { error: res.error.message });
  }
  const data = res.data!;

  if (input.collection_id) {
    await supabase
      .from('product_collections')
      .insert({ product_id: data.id, collection_id: input.collection_id });
  }

  await dispatchEvent(supabase, {
    event_type: DomainEvent.ProductCreated,
    aggregate_type: 'product',
    aggregate_id: data.id,
    store_id: input.store_id,
    payload: { name: data.name, sku_root: data.sku_root },
  });

  return data;
}

export async function updateProduct(
  supabase: SbClient,
  userId: string,
  productId: string,
  patch: UpdateProductInput,
) {
  const storeId = await fetchProductStoreId(supabase, productId);
  await requirePermission(supabase, userId, 'products.update', storeId);

  const { data, error } = await supabase
    .from('products')
    .update(patch)
    .eq('id', productId)
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') throw Errors.conflict('Slug já em uso', { error: error.message });
    throw Errors.internal('Falha ao atualizar produto', { error: error.message });
  }

  await dispatchEvent(supabase, {
    event_type: DomainEvent.ProductUpdated,
    aggregate_type: 'product',
    aggregate_id: productId,
    store_id: storeId,
    payload: { fields: Object.keys(patch) },
  });

  return data;
}

export async function deleteProduct(supabase: SbClient, userId: string, productId: string) {
  const storeId = await fetchProductStoreId(supabase, productId);
  await requirePermission(supabase, userId, 'products.delete', storeId);

  // Limpa referências fracas que bloqueariam o delete por RESTRICT, sem
  // tocar em dados de negócio (pedidos, NFs, estoque histórico).
  const variantIds = await supabase
    .from('product_variants').select('id').eq('product_id', productId)
    .then((r) => (r.data ?? []).map((v) => v.id));

  await supabase.from('cart_items').delete().eq('product_id', productId);
  if (variantIds.length) {
    await supabase.from('cart_items').delete().in('variant_id', variantIds);
  }
  await supabase.from('wishlist_items').delete().eq('product_id', productId);

  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) {
    if (error.code === '23503') {
      // Possui vínculos duros (pedidos, NFs, estoque). Faz arquivamento lógico
      // para que suma das listagens da loja e do admin "Publicados".
      await supabase.from('products').update({ status: 'archived' }).eq('id', productId);
      await dispatchEvent(supabase, {
        event_type: DomainEvent.ProductUpdated,
        aggregate_type: 'product',
        aggregate_id: productId,
        store_id: storeId,
        payload: { archived: true, reason: 'delete_fallback' },
      });
      return { ok: true as const, id: productId, archived: true };
    }
    throw Errors.internal('Falha ao remover produto', { error: error.message });
  }
  await dispatchEvent(supabase, {
    event_type: DomainEvent.ProductDeleted,
    aggregate_type: 'product',
    aggregate_id: productId,
    store_id: storeId,
  });
  return { ok: true as const, id: productId, archived: false };
}


// ---------- Operações (Fase 4.2C) ----------

export async function archiveProduct(
  supabase: SbClient,
  userId: string,
  productId: string,
  archived: boolean,
) {
  const storeId = await fetchProductStoreId(supabase, productId);
  await requirePermission(supabase, userId, 'products.archive', storeId);
  const status: ProductStatus = archived ? 'archived' : 'draft';
  const { data, error } = await supabase
    .from('products')
    .update({ status })
    .eq('id', productId)
    .select('id, status')
    .single();
  if (error) throw Errors.internal('Falha ao arquivar produto', { error: error.message });
  await dispatchEvent(supabase, {
    event_type: DomainEvent.ProductUpdated,
    aggregate_type: 'product',
    aggregate_id: productId,
    store_id: storeId,
    payload: { archived },
  });
  return data;
}

export async function duplicateProduct(
  supabase: SbClient,
  userId: string,
  productId: string,
  opts: { name?: string; sku_root?: string },
) {
  const storeId = await fetchProductStoreId(supabase, productId);
  await requirePermission(supabase, userId, 'products.duplicate', storeId);

  const { data: src, error: se } = await supabase
    .from('products').select('*').eq('id', productId).maybeSingle();
  if (se || !src) throw Errors.notFound('product', productId);

  const newName = opts.name?.trim() || `${src.name} (cópia)`;
  const newSku = (opts.sku_root?.trim() || `${src.sku_root}-COPY-${Date.now().toString(36).toUpperCase()}`).toUpperCase();
  const newSlug = slugify(`${newName}-${Date.now().toString(36)}`);

  const { data: created, error: ce } = await supabase
    .from('products')
    .insert({
      store_id: storeId,
      name: newName,
      sku_root: newSku,
      slug: newSlug,
      category_id: src.category_id,
      brand_id: src.brand_id,
      short_description: src.short_description,
      description: src.description,
      visibility: 'hidden',
      sale_channel: src.sale_channel,
      tax_class: src.tax_class,
      status: 'draft',
      featured: false, new_product: false, best_seller: false, on_sale: false,
      seo_title: src.seo_title,
      seo_description: src.seo_description,
    })
    .select('*').single();
  if (ce) throw Errors.internal('Falha ao duplicar produto', { error: ce.message });

  // Copy attribute values
  const { data: srcAttrs } = await supabase
    .from('product_attribute_values').select('*').eq('product_id', productId);
  if (srcAttrs?.length) {
    await supabase.from('product_attribute_values').insert(
      srcAttrs.map((a) => ({
        product_id: created.id,
        attribute_id: a.attribute_id,
        attribute_value_id: a.attribute_value_id,
        value_text: a.value_text,
        value_number: a.value_number,
        value_boolean: a.value_boolean,
      })),
    );
  }

  // Copy colors (and remember old→new id map)
  const { data: srcColors } = await supabase
    .from('product_colors').select('*').eq('product_id', productId);
  const colorMap = new Map<string, string>();
  if (srcColors?.length) {
    for (const c of srcColors) {
      const { data: nc, error: ne } = await supabase
        .from('product_colors')
        .insert({
          product_id: created.id,
          name: c.name,
          hex: c.hex,
          attribute_value_id: c.attribute_value_id,
          sort_order: c.sort_order,
          is_default: c.is_default,
          is_active: c.is_active,
        })
        .select('id').single();
      if (!ne && nc) colorMap.set(c.id, nc.id);
    }
  }

  // Copy media
  for (const [oldColorId, newColorId] of colorMap) {
    const { data: media } = await supabase
      .from('product_color_media').select('*').eq('product_color_id', oldColorId);
    if (media?.length) {
      await supabase.from('product_color_media').insert(
        media.map((m) => ({
          product_color_id: newColorId,
          media_type: m.media_type,
          storage_path: m.storage_path,
          external_url: m.external_url,
          external_id: m.external_id,
          thumbnail_url: m.thumbnail_url,
          alt: m.alt,
          title: m.title,
          width: m.width,
          height: m.height,
          duration_seconds: m.duration_seconds,
          sort_order: m.sort_order,
          is_cover: m.is_cover,
          is_hover_media: m.is_hover_media,
        })),
      );
    }
  }

  await dispatchEvent(supabase, {
    event_type: DomainEvent.ProductCreated,
    aggregate_type: 'product',
    aggregate_id: created.id,
    store_id: storeId,
    payload: { duplicated_from: productId },
  });

  return created;
}

export async function exportProducts(
  supabase: SbClient,
  userId: string,
  storeId: string,
) {
  await requirePermission(supabase, userId, 'products.export', storeId);
  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku_root, slug, status, visibility, short_description, description, category_id, brand_id, seo_title, seo_description, featured, new_product, best_seller, on_sale')
    .eq('store_id', storeId)
    .order('updated_at', { ascending: false });
  if (error) throw Errors.internal('Falha ao exportar produtos', { error: error.message });
  return { exported_at: new Date().toISOString(), store_id: storeId, products: data ?? [] };
}

export async function importProducts(
  supabase: SbClient,
  userId: string,
  storeId: string,
  rows: Array<{
    name: string;
    sku_root: string;
    slug?: string;
    short_description?: string | null;
    category_id?: string | null;
    brand_id?: string | null;
  }>,
) {
  await requirePermission(supabase, userId, 'products.import', storeId);
  if (!Array.isArray(rows) || !rows.length) throw Errors.validation('Nenhum produto para importar');

  let ok = 0, fail = 0;
  const errors: Array<{ sku_root: string; reason: string }> = [];
  for (const r of rows) {
    if (!r.name || !r.sku_root) { fail++; errors.push({ sku_root: r.sku_root ?? '?', reason: 'campos obrigatórios' }); continue; }
    const { error } = await supabase.from('products').insert({
      store_id: storeId,
      name: r.name,
      sku_root: r.sku_root.toUpperCase(),
      slug: r.slug?.trim() || slugify(r.name + '-' + r.sku_root),
      short_description: r.short_description ?? null,
      category_id: r.category_id ?? null,
      brand_id: r.brand_id ?? null,
      status: 'draft',
      visibility: 'hidden',
      sale_channel: 'ambos',
      featured: false, new_product: false, best_seller: false, on_sale: false,
    });
    if (error) { fail++; errors.push({ sku_root: r.sku_root, reason: error.message }); }
    else ok++;
  }
  return { imported: ok, failed: fail, errors };
}

export async function listProductHistory(
  supabase: SbClient,
  userId: string,
  productId: string,
) {
  const storeId = await fetchProductStoreId(supabase, productId);
  await ensureRead(supabase, userId, storeId);
  const { data, error } = await supabase
    .from('domain_events')
    .select('id, event_type, payload, metadata, actor_user_id, created_at')
    .eq('aggregate_type', 'product')
    .eq('aggregate_id', productId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw Errors.internal('Falha ao carregar histórico', { error: error.message });
  return data ?? [];
}

export async function listProductAudit(
  supabase: SbClient,
  userId: string,
  productId: string,
) {
  const storeId = await fetchProductStoreId(supabase, productId);
  await ensureRead(supabase, userId, storeId);
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, action, entity_type, actor_user_id, diff, created_at')
    .eq('entity_type', 'products')
    .eq('entity_id', productId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw Errors.internal('Falha ao carregar auditoria', { error: error.message });
  return data ?? [];
}

// ---------- Publicação ----------

export async function publishProduct(
  supabase: SbClient,
  userId: string,
  productId: string,
) {
  const storeId = await fetchProductStoreId(supabase, productId);
  await requirePermission(supabase, userId, 'products.publish', storeId);

  // Backfill SEO defaults antes de validar — admin pode sobrescrever manualmente
  // a qualquer momento; só preenchemos o que estiver vazio.
  await backfillSeoDefaults(supabase, productId);

  // valida readiness
  const { canPublish, issues } = await computeReadiness(supabase, productId);
  if (!canPublish) {
    throw Errors.rule('Produto não está pronto para publicação', {
      issues: issues.slice(0, 5).join('; '),
    });
  }

  const { data, error } = await supabase
    .from('products')
    .update({ status: 'published', visibility: 'published', published_at: new Date().toISOString() })
    .eq('id', productId)
    .select('id, status, published_at')
    .single();
  if (error) throw Errors.internal('Falha ao publicar produto', { error: error.message });

  await dispatchEvent(supabase, {
    event_type: DomainEvent.ProductUpdated,
    aggregate_type: 'product',
    aggregate_id: productId,
    store_id: storeId,
    payload: { action: 'published' },
  });
  return data;
}

/**
 * Preenche seo_title / seo_description / slug a partir de
 * name / short_description / description quando estiverem vazios.
 * Mantém valores manuais existentes — o admin sempre tem prioridade.
 * Garante unicidade do slug por loja anexando sufixo incremental.
 */
async function backfillSeoDefaults(supabase: SbClient, productId: string): Promise<void> {
  const { data: p } = await supabase
    .from('products')
    .select('id, store_id, name, short_description, description, seo_title, seo_description, slug')
    .eq('id', productId)
    .maybeSingle();
  if (!p) return;

  const patch: { seo_title?: string; seo_description?: string; slug?: string } = {};

  if (!p.seo_title?.trim() && p.name) {
    patch.seo_title = p.name.slice(0, 160);
  }
  if (!p.seo_description?.trim()) {
    const fallback =
      p.short_description?.trim() ||
      (p.description ? String(p.description).replace(/<[^>]+>/g, '').trim().slice(0, 200) : '');
    if (fallback) patch.seo_description = fallback;
  }
  if (!p.slug?.trim() && p.name) {
    const base = slugify(p.name);
    let candidate = base;
    let suffix = 1;
    // Garante unicidade por loja
    // (slug é único globalmente no insert, mas aqui validamos por loja para evitar 23505)
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: clash } = await supabase
        .from('products')
        .select('id')
        .eq('store_id', p.store_id)
        .eq('slug', candidate)
        .neq('id', productId)
        .maybeSingle();
      if (!clash) break;
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    patch.slug = candidate;
  }

  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from('products').update(patch).eq('id', productId);
  if (error) throw Errors.internal('Falha ao preencher SEO automaticamente', { error: error.message });
}

export async function unpublishProduct(
  supabase: SbClient,
  userId: string,
  productId: string,
) {
  const storeId = await fetchProductStoreId(supabase, productId);
  await requirePermission(supabase, userId, 'products.publish', storeId);
  const { data, error } = await supabase
    .from('products')
    .update({ status: 'draft', visibility: 'hidden' })
    .eq('id', productId)
    .select('id, status').single();
  if (error) throw Errors.internal('Falha ao despublicar', { error: error.message });
  return data;
}

// ---------- Readiness (checklist + progresso) ----------

export interface ReadinessStep {
  key: string;
  label: string;
  complete: boolean;
  issues: string[];
}
export interface ReadinessResult {
  steps: ReadinessStep[];
  progress: number;
  canPublish: boolean;
  issues: string[];
}

async function computeReadiness(supabase: SbClient, productId: string): Promise<ReadinessResult> {
  const [{ data: p }, { data: colors }, { data: variants }, { data: media }, { data: prices }] = await Promise.all([
    supabase.from('products').select('*').eq('id', productId).maybeSingle(),
    supabase.from('product_colors').select('id, is_default, is_active').eq('product_id', productId),
    supabase.from('product_variants').select('id').eq('product_id', productId),
    supabase.from('product_color_media').select('id, product_color_id, is_cover').eq('product_color_id', 'will-be-replaced').limit(0),
    supabase.from('price_list_items').select('variant_id, price').limit(1000),
  ]);

  // re-fetch media properly (aggregate via colors)
  const colorIds = (colors ?? []).map((c) => c.id);
  let mediaRows: Array<{ product_color_id: string; is_cover: boolean }> = [];
  if (colorIds.length) {
    const { data: m } = await supabase
      .from('product_color_media')
      .select('product_color_id, is_cover')
      .in('product_color_id', colorIds);
    mediaRows = m ?? [];
  }
  void media; // silence unused

  const variantIds = (variants ?? []).map((v) => v.id);
  let priceRows: Array<{ variant_id: string }> = [];
  if (variantIds.length) {
    const { data: pr } = await supabase
      .from('price_list_items')
      .select('variant_id')
      .in('variant_id', variantIds);
    priceRows = pr ?? [];
  }
  void prices;

  const steps: ReadinessStep[] = [];

  // 1. Informações Gerais
  const info: ReadinessStep = { key: 'general', label: 'Informações Gerais', complete: false, issues: [] };
  if (!p?.name) info.issues.push('Nome ausente');
  if (!p?.sku_root) info.issues.push('SKU Root ausente');
  if (!p?.category_id) info.issues.push('Categoria não definida');
  if (!p?.short_description) info.issues.push('Descrição curta ausente');
  info.complete = info.issues.length === 0;
  steps.push(info);

  // 2. Atributos — apenas obrigatórios via category_attributes
  const attrs: ReadinessStep = { key: 'attributes', label: 'Atributos', complete: true, issues: [] };
  if (p?.category_id) {
    const { data: req } = await supabase
      .from('category_attributes')
      .select('attribute_id, is_required')
      .eq('category_id', p.category_id)
      .eq('is_required', true);
    const requiredIds = (req ?? []).map((r) => r.attribute_id);
    if (requiredIds.length) {
      const { data: filled } = await supabase
        .from('product_attribute_values')
        .select('attribute_id')
        .eq('product_id', productId)
        .in('attribute_id', requiredIds);
      const filledSet = new Set((filled ?? []).map((f) => f.attribute_id));
      const missing = requiredIds.filter((id) => !filledSet.has(id));
      if (missing.length) {
        attrs.complete = false;
        attrs.issues.push(`${missing.length} atributo(s) obrigatório(s) não preenchido(s)`);
      }
    }
  }
  steps.push(attrs);

  // 3. Cores
  const colorsStep: ReadinessStep = { key: 'colors', label: 'Cores', complete: false, issues: [] };
  const activeColors = (colors ?? []).filter((c) => c.is_active);
  if (!activeColors.length) colorsStep.issues.push('Adicione ao menos uma cor');
  if (activeColors.length && !activeColors.some((c) => c.is_default)) colorsStep.issues.push('Defina a cor padrão');
  colorsStep.complete = colorsStep.issues.length === 0;
  steps.push(colorsStep);

  // 4. Galeria
  const gallery: ReadinessStep = { key: 'gallery', label: 'Galeria', complete: false, issues: [] };
  if (activeColors.length) {
    const missingCover = activeColors.filter(
      (c) => !mediaRows.some((m) => m.product_color_id === c.id && m.is_cover),
    );
    if (missingCover.length) gallery.issues.push(`${missingCover.length} cor(es) sem capa`);
  } else {
    gallery.issues.push('Sem cores');
  }
  gallery.complete = gallery.issues.length === 0;
  steps.push(gallery);

  // 5. Variantes
  const variantsStep: ReadinessStep = { key: 'variants', label: 'Variantes', complete: false, issues: [] };
  if (!(variants ?? []).length) variantsStep.issues.push('Gere ao menos uma variante');
  variantsStep.complete = variantsStep.issues.length === 0;
  steps.push(variantsStep);

  // 6. Preços
  const pricesStep: ReadinessStep = { key: 'prices', label: 'Preços', complete: false, issues: [] };
  if ((variants ?? []).length) {
    const pricedSet = new Set(priceRows.map((p) => p.variant_id));
    const unpriced = (variants ?? []).filter((v) => !pricedSet.has(v.id));
    if (unpriced.length) pricesStep.issues.push(`${unpriced.length} variante(s) sem preço`);
  } else {
    pricesStep.issues.push('Sem variantes para precificar');
  }
  pricesStep.complete = pricesStep.issues.length === 0;
  steps.push(pricesStep);

  // 7. SEO
  const seo: ReadinessStep = { key: 'seo', label: 'SEO', complete: false, issues: [] };
  if (!p?.seo_title) seo.issues.push('Título SEO ausente');
  if (!p?.seo_description) seo.issues.push('Descrição SEO ausente');
  if (!p?.slug) seo.issues.push('Slug ausente');
  seo.complete = seo.issues.length === 0;
  steps.push(seo);

  // 8. Produtos relacionados (opcional — sempre completo)
  const relCount = await supabase
    .from('product_relations')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId);
  const related: ReadinessStep = {
    key: 'related',
    label: 'Relacionados',
    complete: true,
    issues: [],
  };
  if ((relCount.count ?? 0) === 0) related.issues.push('Nenhum produto relacionado (opcional)');
  steps.push(related);

  // 9. Publicação
  const pub: ReadinessStep = {
    key: 'publish',
    label: 'Publicação',
    complete: p?.status === 'published',
    issues: p?.status === 'published' ? [] : ['Produto ainda em rascunho'],
  };
  steps.push(pub);

  const considered = steps.filter((s) => s.key !== 'publish' && s.key !== 'related');
  const done = considered.filter((s) => s.complete).length;
  const progress = Math.round((done / considered.length) * 100);
  const blockingIssues = considered.flatMap((s) => s.issues);
  const canPublish = considered.every((s) => s.complete);
  return { steps, progress, canPublish, issues: blockingIssues };
}

export async function getProductReadiness(
  supabase: SbClient,
  userId: string,
  productId: string,
): Promise<ReadinessResult> {
  const storeId = await fetchProductStoreId(supabase, productId);
  await ensureRead(supabase, userId, storeId);
  return computeReadiness(supabase, productId);
}
