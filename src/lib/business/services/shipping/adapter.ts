/**
 * Shipping Adapter Layer — interface pública para integrar transportadoras
 * (Correios, Melhor Envio, Frenet, etc.).
 *
 * Regras:
 *  - Adapters NÃO acessam DB diretamente. Recebem credenciais já decifradas
 *    via `AdapterContext` e expõem operações puras de transporte.
 *  - Adapters NÃO emitem Outbox/metrics — quem orquestra (services) é quem
 *    publica eventos e métricas. Isso mantém adapters substituíveis.
 *  - Toda chamada externa é idempotente do ponto de vista do caller
 *    (recebe `idempotency_key` quando aplicável).
 */

export type ShippingProviderCode = 'correios' | 'melhor_envio' | 'frenet' | (string & {});

export interface AdapterCredentials {
  // shape livre — cada provider define o seu (validado no próprio adapter)
  [k: string]: unknown;
}

export interface AdapterAccount {
  id: string;
  store_id: string;
  provider_code: ShippingProviderCode;
  display_name: string;
  sandbox: boolean;
  config: Record<string, unknown>;
  capabilities: Record<string, unknown>;
}

export interface AdapterContext {
  account: AdapterAccount;
  credentials: AdapterCredentials | null;
  /** trace_id propagado pelo orquestrador (Observability). */
  traceId?: string;
}

export interface AdapterQuoteRequest {
  origin_postal_code: string;
  destination_postal_code: string;
  weight_g: number;
  declared_value?: number;
  dimensions_cm?: { length: number; width: number; height: number };
  service_codes?: string[]; // PAC, SEDEX, etc. (vazio = todos suportados)
}

export interface AdapterQuoteOption {
  service_code: string;
  service_name: string;
  price: number;
  currency: string; // 'BRL'
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  raw?: Record<string, unknown>;
}

export interface AdapterLabelRequest {
  service_code: string;
  shipment_id: string;
  order_id?: string;
  to: AdapterAddress;
  from: AdapterAddress;
  packages: AdapterPackage[];
  idempotency_key: string;
}

export interface AdapterAddress {
  name: string;
  postal_code: string;
  street: string;
  number?: string;
  complement?: string;
  district?: string;
  city: string;
  state: string;
  country: string; // ISO-2
  document?: string;
  phone?: string;
  email?: string;
}

export interface AdapterPackage {
  weight_g: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  declared_value?: number;
}

export interface AdapterLabelResult {
  tracking_code: string;
  label_url?: string;
  label_format?: 'pdf' | 'zpl' | 'png';
  raw?: Record<string, unknown>;
}

export interface AdapterTrackingEvent {
  occurred_at: string; // ISO
  status: string;
  description: string;
  location?: string;
  raw?: Record<string, unknown>;
}

export interface AdapterTrackingResult {
  tracking_code: string;
  delivered: boolean;
  events: AdapterTrackingEvent[];
}

export type AdapterTestResult =
  | { ok: true; details?: Record<string, unknown> }
  | { ok: false; error: string };

export interface CredentialFieldDef {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number';
  required?: boolean;
  helper?: string;
}

/**
 * Capability Discovery — matriz canônica usada pelo ShippingProviderRegistry
 * para decidir QUE provider pode atender QUE operação. O Registry filtra
 * exclusivamente por essas flags; nenhuma camada superior deve verificar o
 * código do provider (`code === 'xxx'`). Para introduzir um novo provider
 * basta declarar o adapter aqui — todas as demais camadas são agnósticas.
 */
export interface ShippingCapabilities {
  quote: boolean;
  tracking: boolean;
  label: boolean;
  pickup: boolean;
  reverseLogistics: boolean;
  /** Indica se o adapter possui ambiente sandbox/homologação. */
  sandbox: boolean;
}

export type ShippingCapability =
  | 'quote' | 'tracking' | 'label' | 'pickup' | 'reverseLogistics';

export interface AdapterLabelCancelRequest {
  shipment_id: string;
  carrier_label_id?: string;
  reason?: string;
}

export interface AdapterLabelCancelResult {
  ok: boolean;
  refunded?: boolean;
  raw?: Record<string, unknown>;
}

export interface ShippingAdapter {
  /** Identificador único — bate com `shipping_carrier_accounts.provider_code`. */
  readonly code: ShippingProviderCode;
  readonly displayName: string;
  /** Capabilities estáticas (quote/tracking/label/pickup/reverseLogistics/sandbox). */
  readonly capabilities: ShippingCapabilities;
  /** Esquema de credenciais usado pela UI admin. */
  readonly credentialSchema: CredentialFieldDef[];
  /** Esquema de configuração não-secreta (contrato, código admin, etc.). */
  readonly configSchema: CredentialFieldDef[];

  /** Smoke test: verifica conectividade/credenciais sem efeitos colaterais. */
  testConnection(ctx: AdapterContext): Promise<AdapterTestResult>;

  /** Cotação online. Lança se não suportado. Nome canônico: `calculateQuote`. */
  quote?(ctx: AdapterContext, req: AdapterQuoteRequest): Promise<AdapterQuoteOption[]>;
  /** Alias canônico usado pelo ShippingProviderRegistry. */
  calculateQuote?(ctx: AdapterContext, req: AdapterQuoteRequest): Promise<AdapterQuoteOption[]>;

  /** Opcional: emissão de etiqueta. */
  createLabel?(ctx: AdapterContext, req: AdapterLabelRequest): Promise<AdapterLabelResult>;
  /** Opcional: cancelamento/voiding de etiqueta. */
  cancelLabel?(ctx: AdapterContext, req: AdapterLabelCancelRequest): Promise<AdapterLabelCancelResult>;

  /** Opcional: rastreamento. */
  track?(ctx: AdapterContext, tracking_code: string): Promise<AdapterTrackingResult>;

  /**
   * Opcional: retorna o CEP de origem padrão cadastrado no provider remoto
   * (ex.: endereço de remetente do Melhor Envio). Usado como fallback pelo
   * Registry quando nem o caller nem o `config.origin_postal_code` informam.
   */
  getDefaultOrigin?(ctx: AdapterContext): Promise<string | null>;
}

export class AdapterNotConfiguredError extends Error {
  constructor(public providerCode: string) {
    super(`Adapter "${providerCode}" não está configurado (credenciais ausentes).`);
    this.name = 'AdapterNotConfiguredError';
  }
}

export class AdapterCapabilityError extends Error {
  constructor(public providerCode: string, public capability: string) {
    super(`Adapter "${providerCode}" não suporta a capability "${capability}".`);
    this.name = 'AdapterCapabilityError';
  }
}
