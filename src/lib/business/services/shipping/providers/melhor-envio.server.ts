/**
 * Melhor Envio Adapter — integra a plataforma de gestão de fretes Melhor
 * Envio (https://docs.melhorenvio.com.br/) reutilizando integralmente a
 * arquitetura do módulo Shipping. Nenhuma camada superior precisa conhecer
 * este adapter: o registro acontece via `registry.server.ts` e a seleção
 * para cada operação é feita por Capability Discovery.
 *
 * Endpoints utilizados (REST/JSON, OAuth2 Bearer):
 *  - POST /api/v2/me/shipment/calculate     → cotação multi-serviço
 *  - POST /api/v2/me/cart                   → adiciona ao carrinho de envio
 *  - POST /api/v2/me/shipment/checkout      → compra etiquetas do carrinho
 *  - POST /api/v2/me/shipment/generate      → gera as etiquetas (PDF)
 *  - GET  /api/v2/me/shipment/print         → URL pública do PDF
 *  - POST /api/v2/me/shipment/cancel        → cancela uma etiqueta
 *  - POST /api/v2/me/shipment/tracking      → consulta eventos de rastreio
 *  - GET  /api/v2/me                        → smoke test
 *
 * Sandbox: https://sandbox.melhorenvio.com.br | Prod: https://melhorenvio.com.br
 *
 * Credenciais (por conta em `shipping_carrier_accounts`, decifradas pelo
 * provider-registry via keyring): { access_token, user_agent? }.
 * O OAuth completo (refresh_token rotation) acontece no painel admin —
 * aqui o adapter consome um access_token já válido (cache de TTL próprio).
 */
import type {
  ShippingAdapter,
  AdapterContext,
  AdapterTestResult,
  AdapterQuoteRequest,
  AdapterQuoteOption,
  AdapterLabelRequest,
  AdapterLabelResult,
  AdapterLabelCancelRequest,
  AdapterLabelCancelResult,
  AdapterTrackingResult,
  AdapterTrackingEvent,
  CredentialFieldDef,
} from '../adapter';
import { AdapterNotConfiguredError } from '../adapter';

const CREDENTIAL_SCHEMA: CredentialFieldDef[] = [
  { key: 'access_token', label: 'Access Token (OAuth2)', type: 'password', required: true,
    helper: 'Token Bearer obtido no fluxo OAuth2 do Melhor Envio (escopo shipping-*).' },
  { key: 'user_agent', label: 'User-Agent (contato)', type: 'text', required: false,
    helper: 'Identificação requisitada pelo Melhor Envio (ex.: "MinhaLoja (suporte@minhaloja.com)").' },
];

const CONFIG_SCHEMA: CredentialFieldDef[] = [
  { key: 'origin_postal_code', label: 'CEP de origem padrão', type: 'text', required: true },
  { key: 'default_services', label: 'IDs de serviços (CSV)', type: 'text', required: false,
    helper: 'IDs do Melhor Envio (ex.: 1=PAC, 2=SEDEX, 3=Jadlog .COM, 4=Jadlog Package). Vazio = todos.' },
  { key: 'agency_id', label: 'Agência padrão', type: 'number', required: false,
    helper: 'Necessário para alguns serviços (ex.: Loggi).' },
];

function host(sandbox: boolean) {
  return sandbox ? 'https://sandbox.melhorenvio.com.br' : 'https://melhorenvio.com.br';
}

function digits(s: string) { return (s ?? '').replace(/\D/g, ''); }

function assertCreds(ctx: AdapterContext): asserts ctx is AdapterContext & { credentials: Record<string, unknown> } {
  const c = ctx.credentials;
  if (!c || !c.access_token) throw new AdapterNotConfiguredError('melhor_envio');
}

function authHeaders(ctx: AdapterContext): Record<string, string> {
  const c = ctx.credentials as Record<string, unknown>;
  return {
    authorization: `Bearer ${String(c.access_token)}`,
    accept: 'application/json',
    'content-type': 'application/json',
    'user-agent': String(c.user_agent ?? 'Lovable Shipping Integration (support@lovable.app)'),
  };
}

async function fetchJson(url: string, init: RequestInit & { timeoutMs?: number }) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(init.timeoutMs ?? 12_000) });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = typeof body === 'object' && body && 'message' in body
      ? String((body as Record<string, unknown>).message)
      : typeof body === 'string' ? body : `HTTP ${res.status}`;
    throw new Error(`MelhorEnvio ${url} ${res.status}: ${msg}`);
  }
  return body;
}

interface MeQuote {
  id?: number;
  name?: string;
  price?: string | number;
  custom_price?: string | number;
  delivery_time?: number;
  delivery_range?: { min?: number; max?: number };
  company?: { name?: string };
  error?: string;
}

function resolveServiceIds(ctx: AdapterContext, req: AdapterQuoteRequest): number[] {
  if (req.service_codes && req.service_codes.length) {
    return req.service_codes.map((s) => Number(s)).filter((n) => Number.isFinite(n) && n > 0);
  }
  const cfg = ctx.account.config?.default_services;
  if (typeof cfg === 'string' && cfg.trim()) {
    return cfg.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
  }
  return [];
}

/**
 * Mapeia o `status`/`tipo` dos eventos do Melhor Envio para
 * `tracking_event_kind` (enum do Fulfillment). Não cobre 100% dos status
 * proprietários — desconhecidos caem em `in_transit` para nunca perder
 * informação no painel.
 */
function mapMeEventKind(status: string, description: string): string {
  const s = String(status ?? '').toLowerCase();
  const d = String(description ?? '').toLowerCase();
  if (s === 'delivered' || d.includes('entregue')) return 'delivered';
  if (s === 'out_for_delivery' || d.includes('saiu para entrega')) return 'out_for_delivery';
  if (s === 'delivery_attempt' || d.includes('tentativa de entrega')) return 'delivery_attempted';
  if (s === 'returned' || d.includes('devolvido') || d.includes('retornado')) return 'returned';
  if (s === 'lost' || d.includes('extraviado') || d.includes('avariado')) return 'lost';
  if (s === 'cancelled' || s === 'canceled') return 'exception';
  if (s === 'released' || s === 'posted' || d.includes('postado')) return 'picked_up';
  if (s === 'generated' || s === 'paid') return 'pickup_scheduled';
  return 'in_transit';
}

export const melhorEnvioAdapter: ShippingAdapter = {
  code: 'melhor_envio',
  displayName: 'Melhor Envio',
  capabilities: {
    quote: true,
    tracking: true,
    label: true,
    pickup: true,
    reverseLogistics: true,
    sandbox: true,
  },
  credentialSchema: CREDENTIAL_SCHEMA,
  configSchema: CONFIG_SCHEMA,

  async testConnection(ctx): Promise<AdapterTestResult> {
    try {
      assertCreds(ctx);
      const body = await fetchJson(`${host(ctx.account.sandbox)}/api/v2/me`, {
        method: 'GET', headers: authHeaders(ctx),
      });
      const me = body as Record<string, unknown>;
      return {
        ok: true,
        details: {
          environment: ctx.account.sandbox ? 'sandbox' : 'production',
          user: me.email ?? me.name ?? null,
        },
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async calculateQuote(ctx, req): Promise<AdapterQuoteOption[]> {
    return this.quote!(ctx, req);
  },

  async quote(ctx, req): Promise<AdapterQuoteOption[]> {
    assertCreds(ctx);
    const from = digits(req.origin_postal_code);
    const to = digits(req.destination_postal_code);
    if (from.length !== 8 || to.length !== 8) throw new Error('CEP de origem/destino inválido');

    const dim = req.dimensions_cm ?? { length: 20, width: 15, height: 5 };
    const services = resolveServiceIds(ctx, req);
    const payload: Record<string, unknown> = {
      from: { postal_code: from },
      to: { postal_code: to },
      package: {
        length: dim.length,
        width: dim.width,
        height: dim.height,
        weight: Math.max(0.1, req.weight_g / 1000), // kg
      },
      options: {
        insurance_value: req.declared_value ?? 0,
        receipt: false,
        own_hand: false,
      },
    };
    if (services.length) payload.services = services.join(',');

    const body = await fetchJson(`${host(ctx.account.sandbox)}/api/v2/me/shipment/calculate`, {
      method: 'POST', headers: authHeaders(ctx), body: JSON.stringify(payload),
    });
    const items = Array.isArray(body) ? (body as MeQuote[]) : [];
    const out: AdapterQuoteOption[] = [];
    for (const it of items) {
      if (it.error) continue;
      const price = Number(it.custom_price ?? it.price ?? 0);
      if (!Number.isFinite(price) || price <= 0) continue;
      const min = it.delivery_range?.min ?? it.delivery_time ?? null;
      const max = it.delivery_range?.max ?? it.delivery_time ?? null;
      const carrier = it.company?.name ? `${it.company.name} ` : '';
      out.push({
        service_code: String(it.id ?? ''),
        service_name: `${carrier}${it.name ?? 'Serviço'}`.trim(),
        price,
        currency: 'BRL',
        estimated_days_min: min ?? null,
        estimated_days_max: max ?? null,
        raw: it as unknown as Record<string, unknown>,
      });
    }
    return out;
  },

  /**
   * Fluxo oficial Melhor Envio: cart → checkout → generate → print.
   *  1. POST /me/cart       → cria o item-de-envio (insurance, packages, to/from).
   *  2. POST /me/checkout   → debita o saldo / aprova a compra.
   *  3. POST /me/generate   → gera a PLP/etiqueta.
   *  4. GET  /me/print      → URL pública do PDF (mode=private).
   * Idempotency: chave do caller é repassada como cabeçalho `X-Idempotency-Key`.
   */
  async createLabel(ctx, req): Promise<AdapterLabelResult> {
    assertCreds(ctx);
    const base = host(ctx.account.sandbox);
    const headers = { ...authHeaders(ctx), 'x-idempotency-key': req.idempotency_key };

    const pkg = req.packages[0] ?? { weight_g: 1000, length_cm: 20, width_cm: 15, height_cm: 5 };
    const cartPayload = {
      service: Number(req.service_code),
      from: {
        name: req.from.name,
        postal_code: digits(req.from.postal_code),
        address: req.from.street,
        number: req.from.number ?? 'S/N',
        complement: req.from.complement ?? '',
        district: req.from.district ?? '',
        city: req.from.city,
        state_abbr: req.from.state,
        country_id: req.from.country || 'BR',
        document: req.from.document ?? '',
        phone: req.from.phone ?? '',
        email: req.from.email ?? '',
      },
      to: {
        name: req.to.name,
        postal_code: digits(req.to.postal_code),
        address: req.to.street,
        number: req.to.number ?? 'S/N',
        complement: req.to.complement ?? '',
        district: req.to.district ?? '',
        city: req.to.city,
        state_abbr: req.to.state,
        country_id: req.to.country || 'BR',
        document: req.to.document ?? '',
        phone: req.to.phone ?? '',
        email: req.to.email ?? '',
      },
      products: [
        { name: `Pedido ${req.order_id ?? req.shipment_id}`, quantity: 1, unitary_value: pkg.declared_value ?? 0 },
      ],
      volumes: req.packages.map((p) => ({
        height: p.height_cm, width: p.width_cm, length: p.length_cm,
        weight: Math.max(0.1, p.weight_g / 1000),
      })),
      options: {
        insurance_value: pkg.declared_value ?? 0,
        receipt: false, own_hand: false, reverse: false, non_commercial: true,
      },
    };

    const cart = await fetchJson(`${base}/api/v2/me/cart`, {
      method: 'POST', headers, body: JSON.stringify(cartPayload),
    }) as Record<string, unknown>;
    const orderId = String(cart.id ?? '');
    if (!orderId) throw new Error('MelhorEnvio: cart não retornou id');

    await fetchJson(`${base}/api/v2/me/shipment/checkout`, {
      method: 'POST', headers, body: JSON.stringify({ orders: [orderId] }),
    });
    await fetchJson(`${base}/api/v2/me/shipment/generate`, {
      method: 'POST', headers, body: JSON.stringify({ orders: [orderId] }),
    });
    const printed = await fetchJson(`${base}/api/v2/me/shipment/print`, {
      method: 'POST', headers, body: JSON.stringify({ mode: 'private', orders: [orderId] }),
    }) as Record<string, unknown>;

    const labelUrl = typeof printed.url === 'string' ? printed.url : undefined;
    const tracking = String(cart.protocol ?? cart.tracking ?? orderId);

    return {
      tracking_code: tracking,
      label_url: labelUrl,
      label_format: 'pdf',
      raw: { cart, printed },
    };
  },

  async cancelLabel(ctx, req): Promise<AdapterLabelCancelResult> {
    assertCreds(ctx);
    if (!req.carrier_label_id) throw new Error('carrier_label_id obrigatório para cancelar');
    const body = await fetchJson(`${host(ctx.account.sandbox)}/api/v2/me/shipment/cancel`, {
      method: 'POST', headers: authHeaders(ctx),
      body: JSON.stringify({ order: { id: req.carrier_label_id, reason_id: 2, description: req.reason ?? 'cancelado' } }),
    }) as Record<string, unknown>;
    return { ok: true, refunded: Boolean(body.refund), raw: body };
  },

  async track(ctx, code): Promise<AdapterTrackingResult> {
    assertCreds(ctx);
    const body = await fetchJson(`${host(ctx.account.sandbox)}/api/v2/me/shipment/tracking`, {
      method: 'POST', headers: authHeaders(ctx),
      body: JSON.stringify({ orders: [code] }),
    });
    // Resposta: { "<order_id>": { status, tracking, events: [...] } }
    const obj = body as Record<string, { status?: string; tracking?: string; events?: Array<{ status?: string; description?: string; created_at?: string; location?: string }> }>;
    const first = Object.values(obj)[0] ?? { events: [] };
    const events: AdapterTrackingEvent[] = (first.events ?? []).map((e) => ({
      occurred_at: e.created_at ? new Date(e.created_at).toISOString() : new Date().toISOString(),
      status: mapMeEventKind(e.status ?? '', e.description ?? ''),
      description: e.description ?? '',
      location: e.location,
      raw: e as unknown as Record<string, unknown>,
    })).sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    const delivered = (first.status ?? '').toLowerCase() === 'delivered'
      || events.some((e) => e.status === 'delivered');
    return { tracking_code: first.tracking ?? code, delivered, events };
  },
};
