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
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

function publicClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type StorefrontStore = { id: string; name: string; slug: string };
export type StorefrontCategory = {
  id: string; name: string; slug: string;
  parent_id: string | null; image_url: string | null;
  level: number | null; sort_order: number;
};
export type StorefrontProduct = {
  id: string; name: string; slug: string;
  short_description: string | null;
  on_sale: boolean; new_product: boolean;
  featured: boolean; best_seller: boolean;
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
      .select('id,name,slug,parent_id,image_url,level,sort_order')
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
  }) => input ?? {})
  .handler(async ({ data }): Promise<{ rows: StorefrontProduct[] }> => {
    const sb = publicClient();
    let q = sb
      .from('products')
      .select('id,name,slug,short_description,on_sale,new_product,featured,best_seller')
      .order('updated_at', { ascending: false })
      .limit(Math.min(data.limit ?? 8, 24));
    if (data.store_id) q = q.eq('store_id', data.store_id);
    if (data.flag === 'new') q = q.eq('new_product', true);
    if (data.flag === 'sale') q = q.eq('on_sale', true);
    if (data.flag === 'featured') q = q.eq('featured', true);
    const { data: rows } = await q;
    return { rows: (rows ?? []) as StorefrontProduct[] };
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

