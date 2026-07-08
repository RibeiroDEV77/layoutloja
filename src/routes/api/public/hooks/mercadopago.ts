/**
 * Webhook público do Mercado Pago.
 *
 * Path: /api/public/hooks/mercadopago  (bypass do gate de auth no published).
 *
 * Contrato HTTP:
 *   200 → evento processado, duplicado ignorado, ou aceito para retry pelo
 *         próprio inbox. MP encerra a entrega.
 *   401 → assinatura inválida (registrado no inbox, NENHUM efeito aplicado).
 *         MP não deve reenviar — a assinatura seguirá inválida.
 *   400 → payload malformado (JSON inválido, sem provider ativo etc.).
 *         MP não deve reenviar.
 *   500 → erro transitório (DB indisponível, RPC falhou). MP DEVE reenviar.
 *
 * Regras críticas:
 *   - Assinatura inválida NUNCA aplica efeito no Payment Engine.
 *   - Webhook duplicado é deduplicado atomicamente por
 *     `payment_webhook_inbox(provider, external_event_id)` via RPC.
 *   - Duas notificações simultâneas → uma vira 'new', outra vira 'duplicate'.
 *   - Toda tentativa (válida ou não) é registrada.
 */
import { createFileRoute } from '@tanstack/react-router';
import {
  ingestProviderWebhook,
  WebhookSignatureError,
} from '@/lib/business/services/payments.server';

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

        console.log('[webhook mercadopago] received', {
          content_length: rawBody.length,
          has_signature: Boolean(headers['x-signature']),
          request_id: headers['x-request-id'] ?? null,
        });

        try {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const result = await ingestProviderWebhook(supabaseAdmin as never, {
            provider_code: 'mercado_pago',
            rawBody, headers, query,
            source_ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
          });
          return Response.json({ ok: true, ...result });
        } catch (err) {
          if (err instanceof WebhookSignatureError) {
            console.warn('[webhook mercadopago] signature invalid — rejected without effect');
            return new Response('signature_invalid', { status: 401 });
          }
          const msg = err instanceof Error ? err.message : String(err);
          // Erros de payload/config → 400 (não reenviar).
          if (/malformed|invalid json|Nenhum gateway ativo|Adapter não registrado/i.test(msg)) {
            console.warn('[webhook mercadopago] client error:', msg);
            return new Response(`bad_request: ${msg}`, { status: 400 });
          }
          // Demais erros → transientes → 500 para permitir retry do MP.
          console.error('[webhook mercadopago] transient error:', msg);
          return new Response(`transient: ${msg}`, { status: 500 });
        }
      },
      GET: async () => new Response('ok', { status: 200 }),
    },
  },
});

