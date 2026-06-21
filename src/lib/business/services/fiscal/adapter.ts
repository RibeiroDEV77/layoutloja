/**
 * Fiscal Adapter Layer — interface pública para integrar provedores de
 * Nota Fiscal Eletrônica (NuvemFiscal, Focus NFe, PlugNotas, Tecnospeed…).
 *
 * Regras (espelham PaymentAdapter / ShippingAdapter):
 *  - Adapters NÃO acessam DB. Recebem credenciais já decifradas no
 *    `AdapterContext` e retornam DTOs puros.
 *  - Adapters NÃO emitem Outbox/métricas — o FiscalService/Registry orquestra.
 *  - Webhooks nunca escrevem direto: o adapter normaliza o payload e
 *    valida assinatura; o orquestrador chama as RPCs SECURITY DEFINER.
 *  - Camadas superiores (OMS, FiscalService) NUNCA inspecionam o `code`
 *    do provider — toda decisão é por `FiscalCapabilities`.
 */

export type FiscalProviderCode =
  | 'nuvem_fiscal'
  | 'focus_nfe'
  | 'plugnotas'
  | 'tecnospeed'
  | (string & {});

export type FiscalDocumentType = 'nfe' | 'nfce' | 'nfse' | 'cte';

export interface FiscalAdapterCredentials { [k: string]: unknown }

export interface AdapterFiscalProvider {
  id: string;
  store_id: string;
  adapter: FiscalProviderCode;
  display_name: string;
  environment: 'production' | 'sandbox';
  config: Record<string, any>;
  capabilities: Record<string, any>;
}

export interface FiscalAdapterContext {
  provider: AdapterFiscalProvider;
  credentials: FiscalAdapterCredentials | null;
  traceId?: string;
  idempotencyKey?: string;
}

// ------------------------------- DTOs -----------------------------------
export interface FiscalIssuerCompany {
  cnpj: string;
  legal_name: string;
  trade_name?: string;
  ie?: string;
  im?: string;
  crt?: number;                      // 1=Simples,3=Regime normal
  address: FiscalAddress;
}
export interface FiscalRecipient {
  name: string;
  document: string;                  // CPF/CNPJ
  document_type: 'CPF' | 'CNPJ';
  email?: string;
  ie?: string;
  address: FiscalAddress;
}
export interface FiscalAddress {
  street: string; number: string; complement?: string;
  district: string; city: string; city_code?: string;
  state: string; zip: string; country?: string;
}
export interface FiscalItem {
  code: string;                      // SKU / código interno
  description: string;
  ncm: string;                       // 8 dígitos
  cfop: string;                      // 4 dígitos
  unit: string;
  quantity: number;
  unit_price: number;
  total: number;
  cest?: string;
  ean?: string;
  origin?: number;                   // 0–8
  icms?: { cst?: string; csosn?: string; rate?: number; value?: number };
  pis?:  { cst?: string; rate?: number; value?: number };
  cofins?: { cst?: string; rate?: number; value?: number };
}
export interface FiscalTotals {
  products: number;
  freight?: number;
  insurance?: number;
  discount?: number;
  other?: number;
  total: number;
}
export interface FiscalIssueRequest {
  /** id local em `public.fiscal_invoices` */
  invoice_id: string;
  document_type: FiscalDocumentType;
  series?: string;
  number?: string;                   // se ausente, provider numera
  operation_nature: string;          // "Venda de mercadoria"
  issuer: FiscalIssuerCompany;
  recipient: FiscalRecipient;
  items: FiscalItem[];
  totals: FiscalTotals;
  payments?: Array<{ method: string; amount: number; installments?: number }>;
  additional_info?: string;
  reference?: string;                // id do pedido / NF
  metadata?: Record<string, any>;
}

export type FiscalAdapterStatus =
  | 'pending' | 'processing' | 'authorized' | 'denied' | 'cancelled' | 'corrected' | 'error';

export interface FiscalIssueResult {
  status: FiscalAdapterStatus;
  external_id: string;
  series?: string;
  number?: string;
  access_key?: string;
  protocol?: string;
  issue_date?: string;
  total_amount?: number;
  xml_url?: string;
  danfe_url?: string;
  rejection_code?: string;
  rejection_reason?: string;
  raw?: Record<string, any>;
}

export interface FiscalCancelRequest {
  external_id: string;
  access_key?: string;
  reason: string;
}
export interface FiscalCancelResult {
  status: FiscalAdapterStatus;
  protocol?: string;
  raw?: Record<string, any>;
}

export interface FiscalCorrectionRequest {
  external_id: string;
  access_key?: string;
  text: string;                       // mínimo 15, máx 1000
  sequence?: number;
}
export interface FiscalCorrectionResult {
  protocol?: string;
  status: FiscalAdapterStatus;
  raw?: Record<string, any>;
}

export interface FiscalConsultResult {
  status: FiscalAdapterStatus;
  external_id: string;
  access_key?: string;
  protocol?: string;
  number?: string;
  series?: string;
  issue_date?: string;
  total_amount?: number;
  xml_url?: string;
  danfe_url?: string;
  rejection_code?: string;
  rejection_reason?: string;
  raw?: Record<string, any>;
}

export interface FiscalDownloadResult {
  /** Conteúdo binário em base64 (XML ou PDF). */
  content_base64: string;
  /** Mime-type para o caller decidir como devolver. */
  mime_type: string;
  filename?: string;
}

// ------------------------------ Webhook ---------------------------------
export type FiscalAdapterWebhookKind =
  | 'invoice.authorized'
  | 'invoice.denied'
  | 'invoice.cancelled'
  | 'invoice.corrected'
  | 'invoice.error'
  | 'invoice.unknown';

export interface FiscalAdapterWebhookEvent {
  external_event_id: string;
  event_type: string;                 // tipo bruto do provider
  kind: FiscalAdapterWebhookKind;
  external_invoice_id?: string;
  access_key?: string;
  status?: FiscalAdapterStatus;
  protocol?: string;
  occurred_at?: string;
  raw: Record<string, any>;
}
export interface FiscalAdapterWebhookInput {
  rawBody: string;
  headers: Record<string, string>;
  webhookSecret: string | null;
  query: Record<string, string>;
}
export interface FiscalAdapterWebhookParseResult {
  signature_valid: boolean | null;    // null = provider não usa assinatura
  events: FiscalAdapterWebhookEvent[];
}

// ----------------------- Capability Discovery ---------------------------
/**
 * Matriz canônica usada pelo `FiscalProviderRegistry` para decidir QUE
 * provider atende QUE operação. O FiscalService NUNCA inspeciona `code`
 * — apenas capabilities.
 */
export interface FiscalCapabilities {
  nfe: boolean;
  nfce: boolean;
  nfse: boolean;
  cte: boolean;
  cancel: boolean;
  correctionLetter: boolean;
  inutilization: boolean;
  downloadXml: boolean;
  downloadDanfe: boolean;
  consultation: boolean;
  sandbox: boolean;
}

export type FiscalCapability = keyof FiscalCapabilities;

export interface FiscalCredentialFieldDef {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'textarea';
  required?: boolean;
  helper?: string;
}

export type FiscalAdapterTestResult =
  | { ok: true; details?: Record<string, any> }
  | { ok: false; error: string };

export interface FiscalAdapter {
  readonly code: FiscalProviderCode;
  readonly displayName: string;
  readonly capabilities: FiscalCapabilities;
  readonly credentialSchema: FiscalCredentialFieldDef[];
  readonly configSchema: FiscalCredentialFieldDef[];

  testConnection(ctx: FiscalAdapterContext): Promise<FiscalAdapterTestResult>;
  issueInvoice(ctx: FiscalAdapterContext, req: FiscalIssueRequest): Promise<FiscalIssueResult>;
  cancelInvoice(ctx: FiscalAdapterContext, req: FiscalCancelRequest): Promise<FiscalCancelResult>;
  issueCorrectionLetter(ctx: FiscalAdapterContext, req: FiscalCorrectionRequest): Promise<FiscalCorrectionResult>;
  consultInvoice(ctx: FiscalAdapterContext, externalIdOrKey: string): Promise<FiscalConsultResult>;
  downloadXML(ctx: FiscalAdapterContext, externalIdOrKey: string): Promise<FiscalDownloadResult>;
  downloadDANFE(ctx: FiscalAdapterContext, externalIdOrKey: string): Promise<FiscalDownloadResult>;
  processWebhook(ctx: FiscalAdapterContext, input: FiscalAdapterWebhookInput): Promise<FiscalAdapterWebhookParseResult>;
}

export class FiscalAdapterCapabilityError extends Error {
  constructor(public providerCode: string, public capability: string) {
    super(`Adapter fiscal "${providerCode}" não suporta a capability "${capability}".`);
    this.name = 'FiscalAdapterCapabilityError';
  }
}
export class FiscalAdapterNotConfiguredError extends Error {
  constructor(public providerCode: string) {
    super(`Adapter fiscal "${providerCode}" não configurado (credenciais ausentes).`);
    this.name = 'FiscalAdapterNotConfiguredError';
  }
}
