/**
 * Service: Sub-entidades do produto.
 *  - Cores (product_colors)
 *  - Galeria (product_color_media)
 *  - Atributos do produto (product_attribute_values)
 *  - Variantes (product_variants) + geração automática
 *  - Preços (price_list_items)
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { dispatchEvent } from '../events/dispatcher.server';
import { DomainEvent } from '../events/types';
import { requirePermission, isSuperAdmin, hasPermission, requireStoreAccess } from './permissions.server';

async function productStoreId(supabase: SbClient, productId: string): Promise<string> {
  const { data, error } = await supabase
    .from('products').select('store_id, sku_root').eq('id', productId).maybeSingle();
  if (error) throw Errors.internal('Falha ao localizar produto', { error: error.message });
  if (!data) throw Errors.notFound('product', productId);
  return data.store_id as string;
}
async function colorStoreId(supabase: SbClient, colorId: string): Promise<{ storeId: string; productId: string }> {
  const { data, error } = await supabase
    .from('product_colors').select('product_id, products!inner(store_id)').eq('id', colorId).maybeSingle();
  if (error) throw Errors.internal('Falha ao localizar cor', { error: error.message });
  if (!data) throw Errors.notFound('product_color', colorId);
  return { storeId: (data as { products: { store_id: string } }).products.store_id, productId: data.product_id as string };
}

async function ensureRead(supabase: SbClient, userId: string, storeId: string) {
  if (await isSuperAdmin(supabase, userId)) return;
  await requireStoreAccess(supabase, userId, storeId);
  if (await hasPermission(supabase, userId, 'products.read', storeId)) return;
  throw Errors.forbidden('Permissão necessária: products.read');
}

// ============== CORES ==============

export async function listColors(supabase: SbClient, userId: string, productId: string) {
  const storeId = await productStoreId(supabase, productId);
  await ensureRead(supabase, userId, storeId);
  const { data, error } = await supabase
    .from('product_colors').select('*').eq('product_id', productId).order('sort_order');
  if (error) throw Errors.internal('Falha ao listar cores', { error: error.message });
  return data ?? [];
}

export async function createColor(
  supabase: SbClient, userId: string, productId: string,
  input: { name: string; hex?: string | null; attribute_value_id?: string | null; is_default?: boolean; sort_order?: number },
) {
  const storeId = await productStoreId(supabase, productId);
  await requirePermission(supabase, userId, 'products.update', storeId);
  if (!input.name?.trim()) throw Errors.validation('Nome da cor obrigatório');
  const { data, error } = await supabase.from('product_colors').insert({
    product_id: productId,
    name: input.name.trim(),
    hex: input.hex ?? null,
    attribute_value_id: input.attribute_value_id ?? null,
    is_default: !!input.is_default,
    sort_order: input.sort_order ?? 0,
    is_active: true,
  }).select('*').single();
  if (error) throw Errors.internal('Falha ao criar cor', { error: error.message });
  return data;
}

export async function updateColor(
  supabase: SbClient, userId: string, colorId: string,
  patch: { name?: string; hex?: string | null; is_default?: boolean; is_active?: boolean; sort_order?: number },
) {
  const { storeId } = await colorStoreId(supabase, colorId);
  await requirePermission(supabase, userId, 'products.update', storeId);
  const { data, error } = await supabase.from('product_colors').update(patch).eq('id', colorId).select('*').single();
  if (error) throw Errors.internal('Falha ao atualizar cor', { error: error.message });
  return data;
}

export async function deleteColor(supabase: SbClient, userId: string, colorId: string) {
  const { storeId } = await colorStoreId(supabase, colorId);
  await requirePermission(supabase, userId, 'products.update', storeId);
  const { error } = await supabase.from('product_colors').delete().eq('id', colorId);
  if (error) throw Errors.internal('Falha ao remover cor', { error: error.message });
  return { ok: true as const, id: colorId };
}

// ============== GALERIA ==============

export async function listColorMedia(supabase: SbClient, userId: string, colorId: string) {
  const { storeId } = await colorStoreId(supabase, colorId);
  await ensureRead(supabase, userId, storeId);
  const { data, error } = await supabase
    .from('product_color_media').select('*').eq('product_color_id', colorId).order('sort_order');
  if (error) throw Errors.internal('Falha ao listar mídias', { error: error.message });
  return data ?? [];
}

export async function addColorMedia(
  supabase: SbClient, userId: string, colorId: string,
  input: {
    media_type: 'image' | 'video' | 'youtube' | 'vimeo';
    storage_path?: string | null;
    external_url?: string | null;
    external_id?: string | null;
    thumbnail_url?: string | null;
    alt?: string | null;
    title?: string | null;
    sort_order?: number;
    is_cover?: boolean;
    is_hover_media?: boolean;
  },
) {
  const { storeId } = await colorStoreId(supabase, colorId);
  await requirePermission(supabase, userId, 'products.update', storeId);
  const { data, error } = await supabase.from('product_color_media').insert({
    product_color_id: colorId,
    media_type: input.media_type,
    storage_path: input.storage_path ?? null,
    external_url: input.external_url ?? null,
    external_id: input.external_id ?? null,
    thumbnail_url: input.thumbnail_url ?? null,
    alt: input.alt ?? null,
    title: input.title ?? null,
    sort_order: input.sort_order ?? 0,
    is_cover: !!input.is_cover,
    is_hover_media: !!input.is_hover_media,
  }).select('*').single();
  if (error) throw Errors.internal('Falha ao adicionar mídia', { error: error.message });
  return data;
}

export async function updateColorMedia(
  supabase: SbClient, userId: string, mediaId: string,
  patch: { alt?: string | null; title?: string | null; sort_order?: number; is_cover?: boolean; is_hover_media?: boolean },
) {
  // resolve store via join
  const { data: m } = await supabase.from('product_color_media')
    .select('product_color_id').eq('id', mediaId).maybeSingle();
  if (!m) throw Errors.notFound('product_color_media', mediaId);
  const { storeId } = await colorStoreId(supabase, m.product_color_id);
  await requirePermission(supabase, userId, 'products.update', storeId);
  const { data, error } = await supabase.from('product_color_media').update(patch).eq('id', mediaId).select('*').single();
  if (error) throw Errors.internal('Falha ao atualizar mídia', { error: error.message });
  return data;
}

export async function deleteColorMedia(supabase: SbClient, userId: string, mediaId: string) {
  const { data: m } = await supabase.from('product_color_media')
    .select('product_color_id').eq('id', mediaId).maybeSingle();
  if (!m) throw Errors.notFound('product_color_media', mediaId);
  const { storeId } = await colorStoreId(supabase, m.product_color_id);
  await requirePermission(supabase, userId, 'products.update', storeId);
  const { error } = await supabase.from('product_color_media').delete().eq('id', mediaId);
  if (error) throw Errors.internal('Falha ao remover mídia', { error: error.message });
  return { ok: true as const, id: mediaId };
}

// ============== ATRIBUTOS DO PRODUTO ==============

export async function listProductAttributes(supabase: SbClient, userId: string, productId: string) {
  const storeId = await productStoreId(supabase, productId);
  await ensureRead(supabase, userId, storeId);
  const { data, error } = await supabase
    .from('product_attribute_values').select('*').eq('product_id', productId);
  if (error) throw Errors.internal('Falha ao listar atributos', { error: error.message });
  return data ?? [];
}

export async function setProductAttribute(
  supabase: SbClient, userId: string, productId: string,
  input: {
    attribute_id: string;
    attribute_value_id?: string | null;
    value_text?: string | null;
    value_number?: number | null;
    value_boolean?: boolean | null;
  },
) {
  const storeId = await productStoreId(supabase, productId);
  await requirePermission(supabase, userId, 'products.update', storeId);

  // Upsert: delete existing for this product+attribute, then insert
  await supabase.from('product_attribute_values')
    .delete().eq('product_id', productId).eq('attribute_id', input.attribute_id);

  if (input.attribute_value_id || input.value_text || input.value_number != null || input.value_boolean != null) {
    const { data, error } = await supabase.from('product_attribute_values').insert({
      product_id: productId,
      attribute_id: input.attribute_id,
      attribute_value_id: input.attribute_value_id ?? null,
      value_text: input.value_text ?? null,
      value_number: input.value_number ?? null,
      value_boolean: input.value_boolean ?? null,
    }).select('*').single();
    if (error) throw Errors.internal('Falha ao salvar atributo', { error: error.message });
    return data;
  }
  return null;
}

// ============== VARIANTES + GERAÇÃO ==============

export async function listVariants(supabase: SbClient, userId: string, productId: string) {
  const storeId = await productStoreId(supabase, productId);
  await ensureRead(supabase, userId, storeId);
  const { data, error } = await supabase
    .from('product_variants').select('*').eq('product_id', productId).order('created_at');
  if (error) throw Errors.internal('Falha ao listar variantes', { error: error.message });
  return data ?? [];
}

/**
 * Gera variantes automaticamente combinando cores ativas × valores de tamanho.
 * Idempotente: ignora SKUs que já existem.
 */
export async function generateVariants(
  supabase: SbClient, userId: string, productId: string,
  input: { size_attribute_value_ids: string[] },
): Promise<{ created: number; skipped: number; variants: Array<{ id: string; sku: string }> }> {
  const { data: prod, error: pe } = await supabase
    .from('products').select('id, store_id, sku_root').eq('id', productId).maybeSingle();
  if (pe || !prod) throw Errors.notFound('product', productId);
  await requirePermission(supabase, userId, 'products.update', prod.store_id);

  const { data: colors } = await supabase
    .from('product_colors')
    .select('id, name, attribute_value_id, is_active')
    .eq('product_id', productId).eq('is_active', true);
  if (!colors?.length) throw Errors.rule('Adicione ao menos uma cor antes de gerar variantes');

  const sizeIds = input.size_attribute_value_ids ?? [];
  let sizeRows: Array<{ id: string; code: string | null; label: string }> = [];
  if (sizeIds.length) {
    const { data } = await supabase
      .from('attribute_values').select('id, code, label').in('id', sizeIds);
    sizeRows = (data ?? []) as typeof sizeRows;
  } else {
    sizeRows = [{ id: '', code: 'UN', label: 'Único' }];
  }

  const { data: existing } = await supabase
    .from('product_variants').select('id, sku, product_color_id, size_attribute_value_id')
    .eq('product_id', productId);
  const existingKey = new Set(
    (existing ?? []).map((v) => `${v.product_color_id}|${v.size_attribute_value_id ?? ''}`),
  );

  const created: Array<{ id: string; sku: string }> = [];
  let skipped = 0;

  for (const color of colors) {
    const colorCode = sanitizeCode(color.name);
    for (const s of sizeRows) {
      const key = `${color.id}|${s.id}`;
      if (existingKey.has(key)) { skipped++; continue; }
      const sizeCode = sanitizeCode(s.code ?? s.value);
      const sku = `${prod.sku_root}-${colorCode}-${sizeCode}`;
      const { data, error } = await supabase.from('product_variants').insert({
        product_id: productId,
        product_color_id: color.id,
        size_attribute_value_id: s.id || null,
        sku,
        is_active: true,
      }).select('id, sku').single();
      if (error) {
        if (error.code === '23505') { skipped++; continue; }
        throw Errors.internal(`Falha ao criar variante ${sku}`, { error: error.message });
      }
      created.push(data);
    }
  }

  await dispatchEvent(supabase, {
    event_type: DomainEvent.ProductUpdated,
    aggregate_type: 'product',
    aggregate_id: productId,
    store_id: prod.store_id,
    payload: { action: 'variants_generated', created: created.length, skipped },
  });

  return { created: created.length, skipped, variants: created };
}

function sanitizeCode(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'X';
}

export async function deleteVariant(supabase: SbClient, userId: string, variantId: string) {
  const { data: v } = await supabase
    .from('product_variants').select('product_id').eq('id', variantId).maybeSingle();
  if (!v) throw Errors.notFound('product_variant', variantId);
  const storeId = await productStoreId(supabase, v.product_id);
  await requirePermission(supabase, userId, 'products.update', storeId);
  const { error } = await supabase.from('product_variants').delete().eq('id', variantId);
  if (error) throw Errors.internal('Falha ao remover variante', { error: error.message });
  return { ok: true as const, id: variantId };
}

// ============== PREÇOS ==============

export async function listProductPrices(supabase: SbClient, userId: string, productId: string) {
  const storeId = await productStoreId(supabase, productId);
  await ensureRead(supabase, userId, storeId);
  const { data: variants } = await supabase
    .from('product_variants').select('id').eq('product_id', productId);
  const ids = (variants ?? []).map((v) => v.id);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('price_list_items').select('*').in('variant_id', ids);
  if (error) throw Errors.internal('Falha ao listar preços', { error: error.message });
  return data ?? [];
}

export async function setVariantPrice(
  supabase: SbClient, userId: string,
  input: { variant_id: string; price_list_id: string; price: number; compare_at_price?: number | null },
) {
  // discover store via variant
  const { data: v } = await supabase
    .from('product_variants').select('product_id').eq('id', input.variant_id).maybeSingle();
  if (!v) throw Errors.notFound('product_variant', input.variant_id);
  const storeId = await productStoreId(supabase, v.product_id);
  await requirePermission(supabase, userId, 'products.update', storeId);

  if (input.price == null || input.price < 0) throw Errors.validation('Preço inválido');

  // upsert by (price_list_id, variant_id)
  const { data: existing } = await supabase.from('price_list_items')
    .select('id').eq('price_list_id', input.price_list_id).eq('variant_id', input.variant_id).maybeSingle();

  if (existing) {
    const { data, error } = await supabase.from('price_list_items').update({
      price: input.price, compare_at_price: input.compare_at_price ?? null,
    }).eq('id', existing.id).select('*').single();
    if (error) throw Errors.internal('Falha ao atualizar preço', { error: error.message });
    return data;
  }
  const { data, error } = await supabase.from('price_list_items').insert({
    price_list_id: input.price_list_id,
    variant_id: input.variant_id,
    price: input.price,
    compare_at_price: input.compare_at_price ?? null,
    min_quantity: 1,
  }).select('*').single();
  if (error) throw Errors.internal('Falha ao criar preço', { error: error.message });
  return data;
}
