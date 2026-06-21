/**
 * Webhook público da Nuvem Fiscal.
 *
 * Path: /api/public/hooks/nuvemfiscal  (bypass do gate de auth no published).
 *
 * Regra crítica: NENHUMA escrita ocorre aqui. A rota apenas:
 *   1) lê o corpo bruto + headers + query
 *   2) chama `ingestProviderWebhook('nuvem_fiscal', ...)`, que delega ao
 *      NuvemFiscalAdapter para normalizar/validar assinatura e depois
 *      aciona as RPCs SECURITY DEFINER do Fiscal Engine
 *      (`fiscal_webhook_ingest` + `fiscal_update_status`).
 *
 * Resposta sempre 2xx para eventos válidos (mesmo duplicados) — o provider
 * refaz a entrega em caso de 5xx; a deduplicação é feita por
 * `fiscal_webhook_inbox(provider_code, external_event_id)`.
 */
import { createFileRoute } from '@tanstack/react-router';
import { ingestProviderWebhook } from '@/lib/business/services/fiscal.server';

export const Route = createFileRoute('/api/public/hooks/nuvemfiscal')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const headers: Record<string, string> = {};
        request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
        const url = new URL(request.url);
        const query: Record<string, string> = {};
        url.searchParams.forEach((v, k) => { query[k] = v; });

        try {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const result = await ingestProviderWebhook(supabaseAdmin as never, {
            provider_code: 'nuvem_fiscal',
            rawBody, headers, query,
            source_ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
          });
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[webhook nuvemfiscal] erro:', msg);
          return new Response(`error: ${msg}`, { status: 422 });
        }
      },
      GET: async () => new Response('ok', { status: 200 }),
    },
  },
});
