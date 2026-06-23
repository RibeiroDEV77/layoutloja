/**
 * Server functions for multi-category product assignments.
 *
 * Public read (`listProductCategoryMap`) feeds the storefront filter.
 * Authenticated write (`setProductCategories`) syncs the junction table from
 * the admin UI. RLS already restricts writes to users with
 * `products.update` on the store.
 */
import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const listProductCategoryMap = createServerFn({ method: 'POST' })
  .inputValidator((input: { product_ids: string[] }) => input)
  .handler(async ({ data }): Promise<{ map: Record<string, string[]> }> => {
    const ids = (data.product_ids ?? []).filter(Boolean);
    if (!ids.length) return { map: {} };
    const sb = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: rows } = await sb
      .from('product_categories')
      .select('product_id, category_id')
      .in('product_id', ids);
    const map: Record<string, string[]> = {};
    for (const r of (rows ?? []) as Array<{ product_id: string; category_id: string }>) {
      (map[r.product_id] ??= []).push(r.category_id);
    }
    return { map };
  });

export const listProductCategoryIds = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { product_id: string }) => input)
  .handler(async ({ data, context }): Promise<{ ids: string[]; primary: string | null }> => {
    const { data: rows, error } = await context.supabase
      .from('product_categories')
      .select('category_id, is_primary')
      .eq('product_id', data.product_id);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<{ category_id: string; is_primary: boolean }>;
    return {
      ids: list.map((r) => r.category_id),
      primary: list.find((r) => r.is_primary)?.category_id ?? null,
    };
  });

export const setProductCategories = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { product_id: string; category_ids: string[]; primary_id?: string | null }) => input)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const desired = new Set(data.category_ids.filter(Boolean));
    if (data.primary_id) desired.add(data.primary_id);

    const { data: existing, error: exErr } = await context.supabase
      .from('product_categories')
      .select('category_id')
      .eq('product_id', data.product_id);
    if (exErr) throw new Error(exErr.message);
    const current = new Set((existing ?? []).map((r) => r.category_id));

    const toInsert = [...desired].filter((id) => !current.has(id));
    const toDelete = [...current].filter((id) => !desired.has(id));

    if (toInsert.length) {
      const { error } = await context.supabase
        .from('product_categories')
        .insert(toInsert.map((category_id) => ({
          product_id: data.product_id,
          category_id,
          is_primary: category_id === data.primary_id,
        })));
      if (error) throw new Error(error.message);
    }
    if (toDelete.length) {
      const { error } = await context.supabase
        .from('product_categories')
        .delete()
        .eq('product_id', data.product_id)
        .in('category_id', toDelete);
      if (error) throw new Error(error.message);
    }

    // Ensure exactly one is_primary
    if (data.primary_id) {
      await context.supabase
        .from('product_categories')
        .update({ is_primary: false })
        .eq('product_id', data.product_id)
        .neq('category_id', data.primary_id);
      await context.supabase
        .from('product_categories')
        .update({ is_primary: true })
        .eq('product_id', data.product_id)
        .eq('category_id', data.primary_id);
    }

    return { ok: true };
  });
