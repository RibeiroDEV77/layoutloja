/**
 * MercadoPagoAdapter — implementação oficial do Mercado Pago para o
 * Payment Engine. Stateless: recebe credenciais (Access Token por loja) e
 * só faz chamadas HTTP normalizando entrada/saída.
 *
 * Métodos suportados nesta etapa:
 *   - PIX            (POST /v1/payments + qr_code)
 *   - Credit Card    (POST /v1/payments com card token + parcelas)
 *   - Boleto         (POST /v1/payments com payment_method_id = 'bolbradesco')
 *
 * Webhook: valida assinatura `x-signature` (HMAC SHA256 sobre
 * "id:<data.id>;request-id:<x-request-id>;ts:<ts>;") e normaliza eventos.
 *
 * Docs:
 *  - https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/post
 *  - https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
import { createHmac, timingSafeEqual } from 'crypto';
import type {
  AdapterAuthorizeRequest,
  AdapterAuthorizeResult,
  AdapterCancelRequest,
  AdapterCancelResult,
  AdapterCaptureRequest,
  AdapterCaptureResult,
  AdapterContext,
  AdapterPaymentStatus,
  AdapterRefundRequest,
  AdapterRefundResult,
  AdapterStatusResult,
  AdapterTestResult,
  AdapterWebhookEvent,
  AdapterWebhookEventKind,
  AdapterWebhookInput,
  AdapterWebhookParseResult,
  PaymentAdapter,
  PaymentCapabilities,
} from '../adapter';

const PROD_BASE = 'https://api.mercadopago.com';

function getAccessToken(ctx: AdapterContext): string {
  const tok = (ctx.credentials?.access_token as string | undefined)?.trim();
  if (!tok) throw new Error('Mercado Pago: access_token ausente nas credenciais');
  return tok;
}

function mapMpStatus(s: string | undefined, status_detail?: string): AdapterPaymentStatus {
  switch (s) {
    case 'pending':
    case 'in_process':
    case 'in_mediation':
      return 'pending';
    case 'authorized':
      return 'authorized';
    case 'approved':
      return 'captured';
    case 'rejected':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
    case 'charged_back':
      return 'chargedback';
    default:
      // status_detail "partially_refunded" pode vir junto com approved
      if (status_detail === 'partially_refunded') return 'partially_refunded';
      return 'pending';
  }
}

function digitsOnly(s: string | undefined | null): string | undefined {
  if (!s) return undefined;
  const d = s.replace(/\D/g, '');
  return d.length ? d : undefined;
}

interface MpHttpOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  token: string;
  body?: unknown;
  idempotencyKey?: string;
}

async function mpFetch(opts: MpHttpOptions): Promise<unknown> {
  const url = `${PROD_BASE}${opts.path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (opts.idempotencyKey) headers['X-Idempotency-Key'] = opts.idempotencyKey;
  const res = await fetch(url, {
    method: opts.method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) {
    const j = json as { message?: string; error?: string } | null;
    const msg = j?.message || j?.error || `HTTP ${res.status}`;
    throw new Error(`Mercado Pago ${opts.method} ${opts.path} ${res.status}: ${msg}`);
  }
  return json;
}

// ----------------------------- buildPaymentBody ----------------------------

function buildPayerBody(req: AdapterAuthorizeRequest) {
  const doc = digitsOnly(req.payer.document);
  const docType = req.payer.document_type ?? (doc && doc.length === 14 ? 'CNPJ' : 'CPF');
  return {
    email: req.payer.email,
    first_name: req.payer.name?.split(' ')[0],
    last_name: req.payer.name?.split(' ').slice(1).join(' ') || undefined,
    identification: doc ? { type: docType, number: doc } : undefined,
  };
}

function buildAuthorizeBody(req: AdapterAuthorizeRequest): Record<string, unknown> {
  const base: Record<string, unknown> = {
    transaction_amount: Number(req.amount.toFixed(2)),
    description: req.description ?? `Pagamento ${req.payment_id}`,
    statement_descriptor: req.statement_descriptor,
    external_reference: req.payment_id,
    notification_url: undefined as string | undefined, // configurado no painel
    payer: buildPayerBody(req),
    metadata: { ...(req.metadata ?? {}), payment_id: req.payment_id },
  };
  if (req.method === 'pix') {
    base.payment_method_id = 'pix';
    if (req.expires_at) base.date_of_expiration = req.expires_at;
  } else if (req.method === 'boleto') {
    base.payment_method_id = 'bolbradesco';
    if (req.expires_at) base.date_of_expiration = req.expires_at;
  } else if (req.method === 'credit_card' || req.method === 'debit_card') {
    if (!req.card_token) throw new Error('Mercado Pago: card_token obrigatório para cartão');
    base.token = req.card_token;
    base.installments = req.installments ?? 1;
    base.capture = req.capture ?? true;
    // payment_method_id é detectado pelo MP a partir do token; opcionalmente
    // o caller pode passar via metadata.
  }
  return base;
}

// ----------------------------- Adapter -------------------------------------

const capabilities: PaymentCapabilities = {
  pix: true,
  creditCard: true,
  debitCard: false,        // não habilitado nesta etapa
  boleto: true,
  refund: true,
  partialRefund: true,
  chargeback: true,
  recurring: false,
  splitPayment: false,
  sandbox: true,
};

export const mercadoPagoAdapter: PaymentAdapter = {
  code: 'mercado_pago',
  displayName: 'Mercado Pago',
  capabilities,

  credentialSchema: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true,
      helper: 'Production ou TEST do painel Mercado Pago → Suas integrações.' },
    { key: 'public_key', label: 'Public Key', type: 'text', required: false,
      helper: 'Usada apenas no front (SDK MP.js).' },
  ],
  configSchema: [
    { key: 'statement_descriptor', label: 'Statement descriptor', type: 'text' },
    { key: 'notification_url', label: 'Webhook URL (read-only)', type: 'text' },
  ],

  async testConnection(ctx) {
    try {
      const token = getAccessToken(ctx);
      // /users/me requer o token; é uma chamada read-only barata.
      await mpFetch({ method: 'GET', path: '/users/me', token });
      return { ok: true } satisfies AdapterTestResult;
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async authorizePayment(ctx, req) {
    const token = getAccessToken(ctx);
    const body = buildAuthorizeBody(req);
    const json = (await mpFetch({
      method: 'POST',
      path: '/v1/payments',
      token,
      body,
      idempotencyKey: ctx.idempotencyKey ?? req.payment_id,
    })) as Record<string, unknown>;

    const id = String((json as { id?: string | number }).id ?? '');
    const status = mapMpStatus(
      (json as { status?: string }).status,
      (json as { status_detail?: string }).status_detail,
    );
    const amountAuth = Number((json as { transaction_amount?: number }).transaction_amount ?? req.amount);
    const amountCaptured = Number(
      (json as { transaction_details?: { total_paid_amount?: number } })
        .transaction_details?.total_paid_amount ?? (status === 'captured' ? amountAuth : 0),
    );

    // PIX details
    const poi = (json as {
      point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } };
    }).point_of_interaction;
    const pix = req.method === 'pix' && poi?.transaction_data?.qr_code ? {
      qr_code: poi.transaction_data.qr_code,
      qr_code_base64: poi.transaction_data.qr_code_base64,
      ticket_url: poi.transaction_data.ticket_url,
      expires_at: (json as { date_of_expiration?: string }).date_of_expiration,
    } : undefined;

    // Boleto details
    const td = (json as { transaction_details?: { external_resource_url?: string }; barcode?: { content?: string } });
    const boleto = req.method === 'boleto' ? {
      barcode: td.barcode?.content ?? '',
      pdf_url: td.transaction_details?.external_resource_url,
      expires_at: (json as { date_of_expiration?: string }).date_of_expiration,
    } : undefined;

    return {
      status,
      external_id: id,
      authorization_id: status === 'authorized' ? id : undefined,
      amount_authorized: amountAuth,
      amount_captured: amountCaptured || undefined,
      method_details: { pix, boleto },
      expires_at: (json as { date_of_expiration?: string }).date_of_expiration,
      raw: json,
    } satisfies AdapterAuthorizeResult;
  },

  async capturePayment(ctx, req) {
    const token = getAccessToken(ctx);
    const body: Record<string, unknown> = { capture: true };
    if (req.amount) body.transaction_amount = Number(req.amount.toFixed(2));
    const json = (await mpFetch({
      method: 'PUT', path: `/v1/payments/${encodeURIComponent(req.external_id)}`,
      token, body,
    })) as Record<string, unknown>;
    return {
      status: mapMpStatus((json as { status?: string }).status),
      external_id: String((json as { id?: string | number }).id ?? req.external_id),
      amount_captured: Number(
        (json as { transaction_details?: { total_paid_amount?: number } })
          .transaction_details?.total_paid_amount ?? req.amount ?? 0,
      ),
      capture_id: String((json as { id?: string | number }).id ?? ''),
      raw: json,
    } satisfies AdapterCaptureResult;
  },

  async cancelPayment(ctx, req) {
    const token = getAccessToken(ctx);
    const json = (await mpFetch({
      method: 'PUT', path: `/v1/payments/${encodeURIComponent(req.external_id)}`,
      token, body: { status: 'cancelled' },
    })) as Record<string, unknown>;
    return {
      status: mapMpStatus((json as { status?: string }).status),
      external_id: String((json as { id?: string | number }).id ?? req.external_id),
      raw: json,
    } satisfies AdapterCancelResult;
  },

  async refundPayment(ctx, req) {
    const token = getAccessToken(ctx);
    const body = req.amount ? { amount: Number(req.amount.toFixed(2)) } : {};
    const json = (await mpFetch({
      method: 'POST',
      path: `/v1/payments/${encodeURIComponent(req.external_id)}/refunds`,
      token, body, idempotencyKey: req.idempotency_key,
    })) as Record<string, unknown>;
    const status = (json as { status?: string }).status;
    return {
      external_refund_id: String((json as { id?: string | number }).id ?? ''),
      status: status === 'approved' ? 'succeeded' : status === 'rejected' ? 'failed' : 'pending',
      amount: Number((json as { amount?: number }).amount ?? req.amount ?? 0),
      raw: json,
    } satisfies AdapterRefundResult;
  },

  async getPaymentStatus(ctx, externalId) {
    const token = getAccessToken(ctx);
    const json = (await mpFetch({
      method: 'GET', path: `/v1/payments/${encodeURIComponent(externalId)}`, token,
    })) as Record<string, unknown>;
    const td = (json as { transaction_details?: { total_paid_amount?: number } }).transaction_details;
    return {
      external_id: String((json as { id?: string | number }).id ?? externalId),
      status: mapMpStatus(
        (json as { status?: string }).status,
        (json as { status_detail?: string }).status_detail,
      ),
      amount_authorized: Number((json as { transaction_amount?: number }).transaction_amount ?? 0),
      amount_captured: Number(td?.total_paid_amount ?? 0),
      amount_refunded: Number((json as { transaction_amount_refunded?: number }).transaction_amount_refunded ?? 0),
      paid_at: (json as { date_approved?: string }).date_approved ?? undefined,
      failure_code: (json as { status_detail?: string }).status_detail,
      raw: json,
    } satisfies AdapterStatusResult;
  },

  async processWebhook(_ctx, input): Promise<AdapterWebhookParseResult> {
    // 1) Validar assinatura quando houver secret + cabeçalho.
    const sigHeader = input.headers['x-signature'] ?? input.headers['X-Signature'];
    const reqIdHeader = input.headers['x-request-id'] ?? input.headers['X-Request-Id'];
    const dataId =
      input.query['data.id'] ??
      (safeJson(input.rawBody) as { data?: { id?: string } } | null)?.data?.id ??
      '';

    let signatureValid: boolean | null = null;
    if (input.webhookSecret && sigHeader && dataId) {
      signatureValid = false;
      // x-signature: "ts=1700000000,v1=hex"
      const parts = Object.fromEntries(
        sigHeader.split(',').map((p) => p.trim().split('=') as [string, string]),
      );
      const ts = parts['ts'];
      const v1 = parts['v1'];
      if (ts && v1) {
        const manifest = `id:${dataId};request-id:${reqIdHeader ?? ''};ts:${ts};`;
        const expected = createHmac('sha256', input.webhookSecret).update(manifest).digest('hex');
        try {
          signatureValid =
            expected.length === v1.length &&
            timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
        } catch { signatureValid = false; }
      }
    }

    // 2) Normalizar evento.
    const body = (safeJson(input.rawBody) ?? {}) as Record<string, unknown>;
    const type = (body.type as string) ?? input.query['type'] ?? 'payment';
    const action = (body.action as string) ?? '';
    const externalEventId = String(
      (body.id as string | number | undefined) ??
      `${type}:${dataId}:${(body.date_created as string) ?? Date.now()}`,
    );
    const kind: AdapterWebhookEventKind = mapWebhookKind(type, action);

    const event: AdapterWebhookEvent = {
      external_event_id: externalEventId,
      event_type: action ? `${type}.${action}` : type,
      kind,
      external_payment_id: dataId || undefined,
      occurred_at: (body.date_created as string) ?? new Date().toISOString(),
      raw: { body, query: input.query },
    };
    return { signature_valid: signatureValid, events: [event] };
  },
};

function safeJson(s: string): unknown {
  try { return s ? JSON.parse(s) : null; } catch { return null; }
}

function mapWebhookKind(type: string, action: string): AdapterWebhookEventKind {
  if (type === 'payment') {
    if (action.includes('refund')) return 'payment.refund.succeeded';
    return 'payment.unknown'; // o orquestrador chama getPaymentStatus para decidir
  }
  if (type === 'chargebacks' || type === 'chargeback') {
    if (action.includes('opened') || action === 'created') return 'payment.chargeback.opened';
    if (action.includes('closed') || action.includes('resolved')) return 'payment.chargeback.resolved';
  }
  return 'payment.unknown';
}
