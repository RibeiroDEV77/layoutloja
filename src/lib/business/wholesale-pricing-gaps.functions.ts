/**
 * P6 — Relatório de pendências de preço atacado.
 *
 * Lista variantes ativas de produtos com `sale_channel IN ('ambos','atacado')`
 * que NÃO possuem `price_list_item` correspondente na lista
 * `WHOLESALE-{store_id}` da loja. É uma leitura autenticada exigindo permissão
 * de leitura de produtos.
 *
 * Não inventa preços. Não altera dado nenhum. Apenas relata.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import { hasPermission, isSuperAdmin } from './services/permissions.server';
import { Errors } from './errors';

export interface WholesalePriceGapRow {
  product_id: string;
  product_name: string;
  product_slug: string;
  sale_channel: 'ambos' | 'atacado' | 'varejo';
  variant_id: string;
  variant_sku: string | null;
}

export interface WholesalePriceGapsResult {
  store_id: string;
  wholesale_price_list_id: string | null;
  products_missing: number;
  variants_missing: number;
  rows: WholesalePriceGapRow[];
}

export const listWholesalePriceGaps = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { store_id: string }) => d)
  .handler(withBusiness(async ({ data, context }): Promise<WholesalePriceGapsResult> => {
    const { supabase, userId } = context;
    const allowed = (await isSuperAdmin(supabase, userId))
      || (await hasPermission(supabase, userId, 'products.read', data.store_id));
    if (!allowed) throw Errors.forbidden('Sem permissão para consultar preços');

    // 1) Lista wholesale da loja
    const { data: pl } = await supabase
      .from('price_lists')
      .select('id')
      .eq('store_id', data.store_id)
      .eq('is_active', true)
      .like('code', 'WHOLESALE-%')
      .limit(1)
      .maybeSingle();
    const wholesalePriceListId = pl?.id ?? null;

    // 2) Variantes ativas de produtos vendáveis no atacado
    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, sku, is_active, products!inner(id, name, slug, sale_channel, store_id)')
      .eq('is_active', true)
      .eq('products.store_id', data.store_id)
      .in('products.sale_channel', ['ambos', 'atacado']);

    const rows = (variants ?? []) as unknown as Array<{
      id: string; sku: string | null;
      products: { id: string; name: string; slug: string; sale_channel: 'ambos' | 'atacado' | 'varejo'; store_id: string };
    }>;
    const variantIds = rows.map((v) => v.id);

    // 3) Preços atacado existentes
    const pricedSet = new Set<string>();
    if (wholesalePriceListId && variantIds.length) {
      const { data: items } = await supabase
        .from('price_list_items')
        .select('variant_id')
        .eq('price_list_id', wholesalePriceListId)
        .in('variant_id', variantIds);
      for (const it of items ?? []) pricedSet.add(it.variant_id);
    }

    // 4) Diff
    const gaps: WholesalePriceGapRow[] = rows
      .filter((v) => !pricedSet.has(v.id))
      .map((v) => ({
        product_id: v.products.id,
        product_name: v.products.name,
        product_slug: v.products.slug,
        sale_channel: v.products.sale_channel,
        variant_id: v.id,
        variant_sku: v.sku,
      }))
      .sort((a, b) => a.product_name.localeCompare(b.product_name) || (a.variant_sku ?? '').localeCompare(b.variant_sku ?? ''));

    const productsMissing = new Set(gaps.map((g) => g.product_id)).size;

    return {
      store_id: data.store_id,
      wholesale_price_list_id: wholesalePriceListId,
      products_missing: productsMissing,
      variants_missing: gaps.length,
      rows: gaps,
    };
  }));
