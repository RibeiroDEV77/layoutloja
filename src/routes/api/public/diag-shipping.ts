import { createFileRoute } from '@tanstack/react-router';

const STORE_ID = '4ea8e8f6-fdab-493f-964a-2eeaad55fe4a';

export const Route = createFileRoute('/api/public/diag-shipping')({
  server: {
    handlers: {
      GET: async () => {
        const out: Record<string, unknown> = {};
        try {
          out.has_url = Boolean(process.env.SUPABASE_URL);
          out.has_srk = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY);
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const res = await supabaseAdmin
            .from('shipping_carrier_accounts')
            .select('id, store_id, provider_code, display_name, sandbox, config, is_active')
            .eq('store_id', STORE_ID)
            .eq('is_active', true);
          out.error = res.error?.message ?? null;
          out.count = res.data?.length ?? 0;
          out.rows = res.data ?? [];
        } catch (err) {
          out.crash = err instanceof Error ? err.message : String(err);
        }
        return new Response(JSON.stringify(out, null, 2), {
          headers: { 'content-type': 'application/json' },
        });
      },
    },
  },
});
