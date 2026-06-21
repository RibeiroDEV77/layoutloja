/**
 * Server Functions: Filtros dinâmicos da Loja Pública.
 *
 * Endpoint público (sem auth) que entrega — para uma categoria — os atributos
 * configurados no Painel Administrativo como "filtráveis" e visíveis, junto
 * com seus valores ativos. Consome `attributes`, `attribute_values`,
 * `category_attributes` e `product_attribute_values` via cliente publishable.
 *
 * Nenhuma lista hardcoded. Tudo é alimentado pelo Painel.
 */
import { createServerFn } from '@tanstack/react-start';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

function publicClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type StorefrontFilterValue = {
  id: string;
  code: string;
  label: string;
  swatch: string | null;
  sort_order: number;
  count: number;
};

export type StorefrontFilterGroup = {
  attribute_id: string;
  code: string;
  name: string;
  filter_ui: 'checkbox' | 'color' | 'size' | 'range';
  is_color: boolean;
  is_size: boolean;
  sort_order: number;
  values: StorefrontFilterValue[];
};

export type StorefrontProductAttributeMap = Record<string, string[]>; // product_id -> attribute_value_id[]

export const getCategoryFilters = createServerFn({ method: 'POST' })
  .inputValidator((input: { category_id?: string | null; product_ids?: string[] }) => input ?? {})
  .handler(async ({ data }): Promise<{ groups: StorefrontFilterGroup[]; productAttrs: StorefrontProductAttributeMap }> => {
    const sb = publicClient();
    const productIds = (data.product_ids ?? []).filter(Boolean);

    // 1) Resolve which attributes to expose for this category.
    //    Strategy: if a category is provided AND has category_attributes rows,
    //    use those (respecting show_in_filters/filter_order). Otherwise, fall
    //    back to ALL public+filterable attributes — so the storefront still
    //    works for canonical pages (Promoções, Novidades, etc).
    let attributeIds: string[] = [];
    type LinkRow = { attribute_id: string; filter_order: number; sort_order: number };
    let links: LinkRow[] = [];
    if (data.category_id) {
      const { data: caRows } = await sb
        .from('category_attributes')
        .select('attribute_id, filter_order, sort_order, show_in_filters')
        .eq('category_id', data.category_id)
        .eq('show_in_filters', true);
      links = ((caRows ?? []) as LinkRow[]);
      attributeIds = links.map((r) => r.attribute_id);
    }

    let attrsQuery = sb
      .from('attributes')
      .select('id, code, name, is_color, is_size, is_filterable, filter_ui, filter_order')
      .eq('is_public', true)
      .eq('is_filterable', true);
    if (attributeIds.length > 0) attrsQuery = attrsQuery.in('id', attributeIds);
    const { data: attrs } = await attrsQuery;
    const attributes = (attrs ?? []) as Array<{
      id: string; code: string; name: string;
      is_color: boolean; is_size: boolean;
      is_filterable: boolean; filter_ui: string; filter_order: number;
    }>;
    if (attributes.length === 0) return { groups: [], productAttrs: {} };

    const attrIds = attributes.map((a) => a.id);
    const { data: values } = await sb
      .from('attribute_values')
      .select('id, attribute_id, code, label, sort_order, meta_json, is_active')
      .in('attribute_id', attrIds)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    // 2) Counts based on product_ids of the current category (server-side join).
    let pavMap: StorefrontProductAttributeMap = {};
    const valueCount = new Map<string, number>();
    if (productIds.length > 0) {
      const { data: pavRows } = await sb
        .from('product_attribute_values')
        .select('product_id, attribute_value_id')
        .in('product_id', productIds)
        .in('attribute_id', attrIds);
      for (const row of (pavRows ?? []) as Array<{ product_id: string; attribute_value_id: string | null }>) {
        if (!row.attribute_value_id) continue;
        const arr = pavMap[row.product_id] ?? (pavMap[row.product_id] = []);
        if (!arr.includes(row.attribute_value_id)) arr.push(row.attribute_value_id);
        valueCount.set(row.attribute_value_id, (valueCount.get(row.attribute_value_id) ?? 0) + 1);
      }
    }

    const linkOrder = new Map<string, number>();
    for (const l of links) linkOrder.set(l.attribute_id, l.filter_order || l.sort_order || 0);

    const groups: StorefrontFilterGroup[] = attributes
      .map((a) => {
        const vs = ((values ?? []) as Array<{
          id: string; attribute_id: string; code: string; label: string; sort_order: number; meta_json: unknown;
        }>)
          .filter((v) => v.attribute_id === a.id)
          .map((v) => {
            const meta = (v.meta_json && typeof v.meta_json === 'object') ? (v.meta_json as Record<string, unknown>) : {};
            const swatch = typeof meta.color === 'string' ? meta.color
              : typeof meta.hex === 'string' ? meta.hex
              : typeof meta.swatch === 'string' ? meta.swatch
              : null;
            return {
              id: v.id, code: v.code, label: v.label,
              swatch, sort_order: v.sort_order,
              count: valueCount.get(v.id) ?? 0,
            };
          });
        const ui = (['checkbox', 'color', 'size', 'range'] as const).includes(a.filter_ui as 'checkbox')
          ? (a.filter_ui as StorefrontFilterGroup['filter_ui'])
          : a.is_color ? 'color' : a.is_size ? 'size' : 'checkbox';
        return {
          attribute_id: a.id, code: a.code, name: a.name,
          filter_ui: ui, is_color: a.is_color, is_size: a.is_size,
          sort_order: linkOrder.get(a.id) ?? a.filter_order ?? 0,
          values: vs,
        };
      })
      .filter((g) => g.values.length > 0)
      .sort((x, y) => x.sort_order - y.sort_order || x.name.localeCompare(y.name));

    return { groups, productAttrs: pavMap };
  });
