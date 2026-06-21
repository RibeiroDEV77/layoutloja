/**
 * Payment Adapter Layer — interface pública para integrar gateways
 * (Mercado Pago, Stripe, Asaas, PagSeguro, ...).
 *
 * Regras (espelham o ShippingAdapter):
 *  - Adapters NÃO acessam DB diretamente. Recebem credenciais já decifradas
 *    via `AdapterContext` e expõem operações puras contra o gateway.
 *  - Adapters NÃO emitem Outbox/metrics — quem orquestra (PaymentService /
 *    PaymentProviderRegistry) é quem publica eventos e métricas.
 *  - Toda chamada externa é idempotente do ponto de vista do caller
 *    (recebe `idempotency_key` quando aplicável).
 *  - Webhook nunca escreve no DB: o adapter normaliza o payload e devolve
 *    um `AdapterWebhookEvent`; o orquestrador chama as RPCs SECURITY DEFINER
 *    do Payment Engine.
 */

export type PaymentProviderCode =
  | 'mercado_pago'
  | 'stripe'
  | 'asaas'
  | 'pagseguro'
  | (string & {});

export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'boleto';

export interface AdapterCredentials { [k: string]: unknown }

export interface AdapterPaymentGateway {
  id: string;
  store_id: string;
  adapter: PaymentProviderCode;
  display_name: string;
  sandbox: boolean;
  config: Record<string, unknown>;
  capabilities: Record<string, unknown>;
}

export interface AdapterContext {
  gateway: AdapterPaymentGateway;
  credentials: AdapterCredentials | null;
  traceId?: string;
  idempotencyKey?: string;
}

// ------------------------- Authorization / Capture -------------------------

export interface AdapterPayer {
  email?: string;
  name?: string;
  document?: string;            // CPF/CNPJ (somente dígitos)
  document_type?: 'CPF' | 'CNPJ';
  phone?: string;
}

export interface AdapterAuthorizeRequest {
  payment_id: string;           // id local em `public.payments`
  amount: number;               // BRL, valor em reais (decimal)
  currency: string;             // 'BRL'
  method: PaymentMethod;
  description?: string;
  statement_descriptor?: string;
  payer: AdapterPayer;
  /** Credit card token vindo da SDK pública (PCI). */
  card_token?: string;
  installments?: number;
  /** Quando true: capture imediato (auth+capture em uma chamada). */
  capture?: boolean;
  /** Vencimento para boleto/PIX. */
  expires_at?: string;          // ISO
  /** URL para o usuário voltar (caso o gateway faça redirect). */
  return_url?: string;
  /** Metadados livres — preservados no DB. */
  metadata?: Record<string, unknown>;
}

export type AdapterPaymentStatus =
  | 'pending'                   // aguardando pagamento (ex.: PIX/boleto criado)
  | 'authorized'                // só cartão: autorizado, aguardando capture
  | 'captured'                  // pago / liquidado
  | 'partially_captured'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded'
  | 'chargedback';

export interface AdapterAuthorizeResult {
  status: AdapterPaymentStatus;
  external_id: string;          // id do pagamento no gateway
  authorization_id?: string;    // quando aplicável (cartão)
  amount_authorized: number;
  amount_captured?: number;
  /** Dados específicos por método (PIX QR code, linha digitável boleto, etc.). */
  method_details?: {
    pix?: {
      qr_code: string;          // copia e cola
      qr_code_base64?: string;  // imagem PNG base64
      expires_at?: string;      // ISO
      ticket_url?: string;
    };
    boleto?: {
      barcode: string;          // linha digitável
      pdf_url?: string;
      expires_at?: string;      // ISO
    };
    redirect_url?: string;      // alguns fluxos pedem redirect
  };
  expires_at?: string;          // ISO
  raw?: Record<string, unknown>;
}

export interface AdapterCaptureRequest {
  external_id: string;
  amount?: number;              // omitido = full capture
}

export interface AdapterCaptureResult {
  status: AdapterPaymentStatus;
  external_id: string;
  amount_captured: number;
  capture_id?: string;
  raw?: Record<string, unknown>;
}

export interface AdapterCancelRequest {
  external_id: string;
  reason?: string;
}

export interface AdapterCancelResult {
  status: AdapterPaymentStatus;
  external_id: string;
  raw?: Record<string, unknown>;
}

// --------------------------------- Refund ----------------------------------

export interface AdapterRefundRequest {
  external_id: string;
  amount?: number;              // omitido = full refund
  reason?: string;
  /** Idempotência por refund. */
  idempotency_key: string;
}

export interface AdapterRefundResult {
  external_refund_id: string;
  status: 'pending' | 'succeeded' | 'failed';
  amount: number;
  raw?: Record<string, unknown>;
}

// --------------------------------- Status ----------------------------------

export interface AdapterStatusResult {
  external_id: string;
  status: AdapterPaymentStatus;
  amount_authorized?: number;
  amount_captured?: number;
  amount_refunded?: number;
  paid_at?: string;
  failure_code?: string;
  failure_message?: string;
  raw?: Record<string, unknown>;
}

// -------------------------------- Webhook ----------------------------------

export type AdapterWebhookEventKind =
  | 'payment.authorized'
  | 'payment.captured'
  | 'payment.failed'
  | 'payment.cancelled'
  | 'payment.refund.succeeded'
  | 'payment.refund.failed'
  | 'payment.chargeback.opened'
  | 'payment.chargeback.resolved'
  | 'payment.unknown';

export interface AdapterWebhookEvent {
  external_event_id: string;
  event_type: string;           // tipo bruto do gateway (mantido para auditoria)
  kind: AdapterWebhookEventKind;
  external_payment_id?: string;
  amount?: number;
  status?: AdapterPaymentStatus;
  occurred_at?: string;         // ISO
  raw: Record<string, unknown>;
}

export interface AdapterWebhookInput {
  rawBody: string;
  headers: Record<string, string>;
  /** Webhook secret decifrado pelo orquestrador (nunca vem do adapter). */
  webhookSecret: string | null;
  /** Querystring relevante (alguns providers usam `?type=...&data.id=...`). */
  query: Record<string, string>;
}

export interface AdapterWebhookParseResult {
  signature_valid: boolean | null;   // null = provider não usa assinatura
  events: AdapterWebhookEvent[];
}

// ------------------------- Capability Discovery ----------------------------
/**
 * Matriz canônica usada pelo PaymentProviderRegistry para decidir QUE
 * gateway pode atender QUE operação. Camadas superiores NUNCA verificam o
 * código do provider (`code === 'mercado_pago'`); a resolução é exclusiva
 * por capability + método suportado.
 */
export interface PaymentCapabilities {
  pix: boolean;
  creditCard: boolean;
  debitCard: boolean;
  boleto: boolean;
  refund: boolean;
  partialRefund: boolean;
  chargeback: boolean;
  recurring: boolean;
  splitPayment: boolean;
  sandbox: boolean;
}

export type PaymentCapability = keyof PaymentCapabilities;

export interface CredentialFieldDef {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number';
  required?: boolean;
  helper?: string;
}

export type AdapterTestResult =
  | { ok: true; details?: Record<string, unknown> }
  | { ok: false; error: string };

export interface PaymentAdapter {
  readonly code: PaymentProviderCode;
  readonly displayName: string;
  readonly capabilities: PaymentCapabilities;
  readonly credentialSchema: CredentialFieldDef[];
  readonly configSchema: CredentialFieldDef[];

  testConnection(ctx: AdapterContext): Promise<AdapterTestResult>;
  authorizePayment(ctx: AdapterContext, req: AdapterAuthorizeRequest): Promise<AdapterAuthorizeResult>;
  capturePayment(ctx: AdapterContext, req: AdapterCaptureRequest): Promise<AdapterCaptureResult>;
  cancelPayment(ctx: AdapterContext, req: AdapterCancelRequest): Promise<AdapterCancelResult>;
  refundPayment(ctx: AdapterContext, req: AdapterRefundRequest): Promise<AdapterRefundResult>;
  getPaymentStatus(ctx: AdapterContext, externalId: string): Promise<AdapterStatusResult>;
  processWebhook(ctx: AdapterContext, input: AdapterWebhookInput): Promise<AdapterWebhookParseResult>;
}

export class PaymentAdapterCapabilityError extends Error {
  constructor(public providerCode: string, public capability: string) {
    super(`Adapter "${providerCode}" não suporta a capability "${capability}".`);
    this.name = 'PaymentAdapterCapabilityError';
  }
}

export class PaymentAdapterNotConfiguredError extends Error {
  constructor(public providerCode: string) {
    super(`Adapter "${providerCode}" não está configurado (credenciais ausentes).`);
    this.name = 'PaymentAdapterNotConfiguredError';
  }
}
