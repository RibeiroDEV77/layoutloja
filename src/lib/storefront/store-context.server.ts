/**
 * Resolve a "loja default" do storefront público.
 *
 * Hoje: primeira store com status='active' por ordem de criação.
 * Futuro multi-tenant por domínio: trocar aqui por lookup via Host header.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

let cached: { id: string; name: string; slug: string } | null = null;

export async function getDefaultStore(
  supabase: SupabaseClient<Database>,
): Promise<{ id: string; name: string; slug: string }> {
  if (cached) return cached;
  const { data, error } = await supabase
    .from('stores')
    .select('id, name, slug')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('store_lookup_failed: ' + error.message);
  if (!data) throw new Error('no_active_store');
  cached = data as { id: string; name: string; slug: string };
  return cached;
}
