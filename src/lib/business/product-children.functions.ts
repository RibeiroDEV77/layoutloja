/**
 * Server Functions: Sub-entidades do produto.
 *  - Cores, Galeria, Atributos, Variantes (geração), Preços
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as C from './services/product-children.server';

// ---- Cores
export const listProductColors = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { product_id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    C.listColors(context.supabase, context.userId, data.product_id),
  ));

export const createProductColor = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { product_id: string; name: string; hex?: string | null; is_default?: boolean; sort_order?: number; attribute_value_id?: string | null }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    C.createColor(context.supabase, context.userId, data.product_id, data),
  ));

export const updateProductColor = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; patch: { name?: string; hex?: string | null; is_default?: boolean; is_active?: boolean; sort_order?: number } }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    C.updateColor(context.supabase, context.userId, data.id, data.patch),
  ));

export const deleteProductColor = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    C.deleteColor(context.supabase, context.userId, data.id),
  ));

// ---- Galeria
export const listColorMedia = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { color_id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    C.listColorMedia(context.supabase, context.userId, data.color_id),
  ));

export const addColorMedia = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { color_id: string; media_type: 'image'|'video'|'youtube'|'vimeo'; storage_path?: string|null; external_url?: string|null; external_id?: string|null; thumbnail_url?: string|null; alt?: string|null; title?: string|null; sort_order?: number; is_cover?: boolean; is_hover_media?: boolean }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    C.addColorMedia(context.supabase, context.userId, data.color_id, data),
  ));

export const updateColorMedia = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; patch: { alt?: string|null; title?: string|null; sort_order?: number; is_cover?: boolean; is_hover_media?: boolean } }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    C.updateColorMedia(context.supabase, context.userId, data.id, data.patch),
  ));

export const deleteColorMedia = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    C.deleteColorMedia(context.supabase, context.userId, data.id),
  ));

// ---- Atributos do produto
export const listProductAttributes = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { product_id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    C.listProductAttributes(context.supabase, context.userId, data.product_id),
  ));

export const setProductAttribute = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { product_id: string; attribute_id: string; attribute_value_id?: string|null; value_text?: string|null; value_number?: number|null; value_boolean?: boolean|null }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    C.setProductAttribute(context.supabase, context.userId, data.product_id, data),
  ));

// ---- Variantes
export const listProductVariants = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { product_id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    C.listVariants(context.supabase, context.userId, data.product_id),
  ));

export const generateProductVariants = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { product_id: string; size_attribute_value_ids: string[] }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    C.generateVariants(context.supabase, context.userId, data.product_id, { size_attribute_value_ids: data.size_attribute_value_ids }),
  ));

export const deleteProductVariant = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    C.deleteVariant(context.supabase, context.userId, data.id),
  ));

export const updateProductVariant = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; patch: C.UpdateVariantPatch }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    C.updateVariant(context.supabase, context.userId, data.id, data.patch),
  ));

// ---- Preços
export const listProductPrices = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { product_id: string }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    C.listProductPrices(context.supabase, context.userId, data.product_id),
  ));

export const setVariantPrice = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { variant_id: string; price_list_id: string; price: number; compare_at_price?: number|null }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    C.setVariantPrice(context.supabase, context.userId, data),
  ));

export const bulkSetVariantPrices = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { items: Array<{ variant_id: string; price_list_id: string; price: number; compare_at_price?: number|null }> }) => input)
  .handler(withBusiness(async ({ data, context }) =>
    C.bulkSetVariantPrices(context.supabase, context.userId, data),
  ));

