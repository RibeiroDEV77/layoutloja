import { createFileRoute } from '@tanstack/react-router';

const STORE_ID = '4ea8e8f6-fdab-493f-964a-2eeaad55fe4a';

export const Route = createFileRoute('/api/public/diag-shipping')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const cep = url.searchParams.get('cep') ?? '01001000';
        const out: Record<string, unknown> = { cep };
        try {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const { calculateQuote, resolveActiveProviders } = await import(
            '@/lib/business/services/shipping/provider-registry.server'
          );
          const providers = await resolveActiveProviders(supabaseAdmin as never, STORE_ID);
          out.providers = providers.map((p) => ({
            account_id: p.account_id,
            provider_code: p.provider_code,
            sandbox: p.sandbox,
            config: p.config,
            cap_quote: Boolean(p.adapter.capabilities.quote),
            has_calculateQuote: typeof p.adapter.calculateQuote === 'function',
            has_quote: typeof (p.adapter as { quote?: unknown }).quote === 'function',
            has_getDefaultOrigin: typeof p.adapter.getDefaultOrigin === 'function',
          }));
          const result = await calculateQuote(supabaseAdmin as never, {
            store_id: STORE_ID,
            origin_postal_code: null,
            destination_postal_code: cep,
            weight_g: 800,
            declared_value: 139.99,
          });
          out.result = result;
        } catch (err) {
          out.crash = err instanceof Error ? err.message + '\n' + err.stack : String(err);
        }
        return new Response(JSON.stringify(out, null, 2), {
          headers: { 'content-type': 'application/json' },
        });
      },
    },
  },
});
