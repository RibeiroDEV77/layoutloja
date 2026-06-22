import { createFileRoute } from '@tanstack/react-router';

const ME_ACCOUNT_ID = '184d81d2-a7f5-4f16-a6b1-84be8d30f68f';

export const Route = createFileRoute('/api/public/diag-me')({
  server: {
    handlers: {
      GET: async () => {
        const out: Record<string, unknown> = {};
        try {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const creds = await supabaseAdmin.rpc('shipping_get_credentials', { _account_id: ME_ACCOUNT_ID });
          const c = (creds.data as Record<string, unknown> | null) ?? null;
          out.has_creds = Boolean(c);
          const token = c?.access_token as string | undefined;
          out.has_token = Boolean(token);
          if (!token) return new Response(JSON.stringify(out, null, 2));
          const ua = (c?.user_agent as string | undefined) ?? 'LayoutLoja (contato@layoutloja.com)';

          async function fetchJson(path: string) {
            const r = await fetch(`https://melhorenvio.com.br${path}`, {
              headers: {
                accept: 'application/json',
                authorization: `Bearer ${token}`,
                'user-agent': ua,
              },
            });
            const txt = await r.text();
            try { return { status: r.status, body: JSON.parse(txt) }; }
            catch { return { status: r.status, body: txt }; }
          }

          out.me = await fetchJson('/api/v2/me');
          out.addresses = await fetchJson('/api/v2/me/addresses');
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
