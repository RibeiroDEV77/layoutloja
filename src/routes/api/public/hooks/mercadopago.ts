/**
 * Webhook público do Mercado Pago.
 *
 * Path: /api/public/hooks/mercadopago  (bypass do gate de auth no published).
 *
 * Regra crítica: NENHUMA escrita ocorre aqui. A rota apenas:
 *   1) lê o corpo bruto + headers + query.
 *   2) chama `ingestProviderWebhook('mercado_pago', ...)`, que delega ao
 *      MercadoPagoAdapter para normalizar/validar assinatura e depois
 *      aciona as RPCs SECURITY DEFINER do Payment Engine.
 *
 * Resposta sempre 2xx para eventos válidos (mesmo duplicados) — o MP refaz
 * a entrega em caso de erro 5xx, e a deduplicação é feita por
 * `payment_webhook_inbox(provider, external_event_id)`.
 */
import { createFileRoute } from '@tanstack/react-router';
import { ingestProviderWebhook } from '@/lib/business/services/payments.server';

export const Route = createFileRoute('/api/public/hooks/mercadopago')({
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
            provider_code: 'mercado_pago',
            rawBody, headers, query,
            source_ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
          });
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[webhook mercadopago] erro:', msg);
          // 422: payload válido porém não-acionável; MP não reenvia indefinidamente.
          return new Response(`error: ${msg}`, { status: 422 });
        }
      },
      GET: async () => new Response('ok', { status: 200 }),
    },
  },
});
