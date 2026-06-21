/**
 * Observability helpers: metrics, traces, health, feature flags, settings.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseClient = any;


/** Fire-and-forget metric recording. Failures are swallowed to never break callers. */
export async function recordMetric(
  supabase: SupabaseClient,
  args: { scope: string; name: string; value: number; unit?: string; tags?: Record<string, unknown>; storeId?: string | null },
): Promise<void> {
  try {
    await supabase.rpc('record_metric', {
      _scope: args.scope,
      _name: args.name,
      _value: args.value,
      _unit: args.unit ?? null,
      _tags: args.tags ?? {},
      _store_id: args.storeId ?? null,
    });
  } catch {
    /* observability must never crash business logic */
  }
}

export async function recordHealth(
  supabase: SupabaseClient,
  args: { component: string; status: 'ok' | 'degraded' | 'down' | 'unknown'; latencyMs?: number; details?: Record<string, unknown> },
): Promise<void> {
  try {
    await supabase.rpc('record_health_check', {
      _component: args.component,
      _status: args.status,
      _latency_ms: args.latencyMs ?? null,
      _details: args.details ?? {},
    });
  } catch { /* noop */ }
}

/** Evaluate a feature flag for a given user/store. */
export const evaluateFlag = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string; storeId?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { data: value, error } = await context.supabase.rpc('evaluate_feature_flag', {
      _key: data.key,
      _user_id: context.userId,
      _store_id: data.storeId ?? undefined,
    });
    if (error) throw error;
    return value;
  });

/** Fetch system setting (non-secret automatically; secret requires admin). */
export const getSetting = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { scope: 'global' | 'store'; storeId?: string | null; key: string }) => d)
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = (context.supabase as any)
      .from('system_settings')
      .select('*')
      .eq('scope', data.scope)
      .eq('key', data.key);
    q = data.storeId ? q.eq('store_id', data.storeId) : q.is('store_id', null);
    const { data: row, error } = await q.maybeSingle();
    if (error) throw error;
    if (row && row.is_secret) {
      return { ...row, value: null };
    }
    return row;
  });
