/**
 * Webhook público do Melhor Envio.
 *
 * Path: /api/public/hooks/melhor-envio-webhook
 *
 * O Melhor Envio envia POST JSON com `event` + `data` (tracking, label,
 * cancellation). A entrega é validada por HMAC-SHA256 do corpo bruto usando
 * `MELHOR_ENVIO_WEBHOOK_SECRET`, comparado em tempo constante com o header
 * `x-melhorenvio-signature`.
 *
 * Para eventos de tracking, dispara `syncShipmentTracking` (que consulta o
 * Melhor Envio e atualiza `shipments`/`tracking_events`/`order_shipments`).
 * Para qualquer outro evento, registra em log e retorna 2xx (idempotência
 * via deduplicação no provedor).
 */
import { createFileRoute } from '@tanstack/react-router';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const Route = createFileRoute('/api/public/hooks/melhor-envio-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get('x-melhorenvio-signature') ?? '';

        const secret = process.env.MELHOR_ENVIO_WEBHOOK_SECRET;
        if (!secret) {
          console.error('[melhor-envio-webhook] MELHOR_ENVIO_WEBHOOK_SECRET ausente');
          return new Response('webhook not configured', { status: 503 });
        }
        const expected = await hmacSha256Hex(secret, rawBody);
        if (!timingSafeEqual(signature.toLowerCase(), expected.toLowerCase())) {
          return new Response('invalid signature', { status: 401 });
        }

        let payload: { event?: string; data?: Record<string, unknown> } = {};
        try { payload = JSON.parse(rawBody); } catch { /* ignored */ }
        const event = String(payload.event ?? '');
        const data = (payload.data ?? {}) as Record<string, unknown>;

        try {
          if (event.startsWith('tracking') || event.startsWith('shipment') || event.includes('order')) {
            const code = (data.tracking ?? data.tracking_code ?? data.protocol ?? data.id) as string | undefined;
            if (code) {
              const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
              const { data: ship } = await supabaseAdmin
                .from('shipments')
                .select('id')
                .eq('tracking_number', String(code))
                .maybeSingle();
              if (ship?.id) {
                const { syncShipmentTracking } = await import(
                  '@/lib/business/services/shipping/tracking.server'
                );
                await syncShipmentTracking(supabaseAdmin as never, { shipment_id: ship.id });
              }
            }
          }
          return Response.json({ ok: true });
        } catch (err) {
          console.error('[melhor-envio-webhook] erro ao processar', event, err);
          // 2xx para não disparar retries em loop — o estado interno se recompõe na próxima sync.
          return Response.json({ ok: true, warning: 'processing_error' });
        }
      },
    },
  },
});
