/**
 * Cron endpoint público — sincroniza tracking de envios pendentes para todas
 * as lojas (ou uma específica via querystring `?store_id=`).
 *
 * Segurança:
 *  - Roda em `/api/public/*` (bypass de auth no published), portanto exige
 *    um secret compartilhado (Bearer) cadastrado em `SHIPPING_TRACKING_CRON_SECRET`.
 *  - Toda escrita acontece via RPC SECURITY DEFINER `fulfillment_apply_tracking`.
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/hooks/shipping-tracking-sync')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.SHIPPING_TRACKING_CRON_SECRET;
        if (secret) {
          const auth = request.headers.get('authorization') ?? '';
          const token = auth.replace(/^Bearer\s+/i, '').trim();
          if (token !== secret) {
            return new Response(JSON.stringify({ error: 'unauthorized' }), {
              status: 401,
              headers: { 'content-type': 'application/json' },
            });
          }
        }
        let body: { store_id?: string | null; limit?: number; stale_minutes?: number } = {};
        try {
          const raw = await request.text();
          if (raw) body = JSON.parse(raw);
        } catch {
          body = {};
        }

        const { syncPendingShipmentsTracking } = await import(
          '@/lib/business/services/shipping/tracking.server'
        );
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        try {
          const result = await syncPendingShipmentsTracking(supabaseAdmin, {
            store_id: body.store_id ?? null,
            limit: typeof body.limit === 'number' ? body.limit : 50,
            stale_minutes: typeof body.stale_minutes === 'number' ? body.stale_minutes : 30,
          });
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          });
        }
      },
    },
  },
});
