/**
 * Server functions PÚBLICAS da loja (storefront).
 *
 * Reads filtrados estritamente a produtos publicados. Usa `supabaseAdmin`
 * internamente porque (a) é read-only com escopo blindado por WHERE e
 * (b) evita depender de policies anon em ~15 tabelas.
 *
 * NÃO há regra de negócio aqui — apenas projeção do que o admin já gravou.
 */
import { createServerFn } from '@tanstack/react-start';
import * as SF from './services/storefront.server';
import { getDefaultStore } from '@/lib/storefront/store-context.server';

async function admin() {
  const mod = await import('@/integrations/supabase/client.server');
  return mod.supabaseAdmin;
}

/* ---- contexto da loja ---- */
export const getStorefrontContext = createServerFn({ method: 'GET' })
  .handler(async () => {
    const sb = await admin();
    const store = await getDefaultStore(sb);
    const tree = await SF.listCategoryTree(sb, store.id);
    return { store, categories: tree };
  });

/* ---- home ---- */
export const getStorefrontHome = createServerFn({ method: 'GET' })
  .handler(async () => {
    const sb = await admin();
    const store = await getDefaultStore(sb);
    const [featured, novelties, bestSellers, sale] = await Promise.all([
      SF.listPublicProducts(sb, { store_id: store.id, featured: true, pageSize: 8 }),
      SF.listPublicProducts(sb, { store_id: store.id, new_only: true, pageSize: 8, sort: 'newest' }),
      SF.listPublicProducts(sb, { store_id: store.id, best_seller: true, pageSize: 8 }),
      SF.listPublicProducts(sb, { store_id: store.id, on_sale: true, pageSize: 8 }),
    ]);
    return {
      store,
      featured: featured.rows,
      novelties: novelties.rows,
      best_sellers: bestSellers.rows,
      on_sale: sale.rows,
    };
  });

/* ---- categoria ---- */
export const listStorefrontProducts = createServerFn({ method: 'POST' })
  .inputValidator((d: Omit<SF.ListPublicProductsInput, 'store_id'>) => d)
  .handler(async ({ data }) => {
    const sb = await admin();
    const store = await getDefaultStore(sb);
    return SF.listPublicProducts(sb, { ...data, store_id: store.id });
  });

export const getStorefrontCategory = createServerFn({ method: 'POST' })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const sb = await admin();
    const store = await getDefaultStore(sb);
    const category = await SF.getCategoryBySlug(sb, store.id, data.slug);
    return { store, category };
  });

/* ---- filtros (marcas/coleções para sidebar) ---- */
export const getStorefrontFilters = createServerFn({ method: 'GET' })
  .handler(async () => {
    const sb = await admin();
    const store = await getDefaultStore(sb);
    const [brands, collections] = await Promise.all([
      SF.listBrands(sb, store.id),
      SF.listCollections(sb, store.id),
    ]);
    return { brands, collections };
  });

/* ---- PDP ---- */
export const getStorefrontProduct = createServerFn({ method: 'POST' })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const sb = await admin();
    const store = await getDefaultStore(sb);
    const product = await SF.getPublicProductBySlug(sb, store.id, data.slug);
    if (!product) return { store, product: null, related: [] };
    const related = await SF.listRelatedProducts(sb, store.id, product.id, 8);
    return { store, product, related };
  });
