/**
 * Payment Adapter Registry — fonte única de verdade dos gateways
 * suportados pela plataforma. Server-only.
 *
 * Capability Discovery: o Registry expõe `findAdaptersByCapability()` e
 * `supportsCapability()` para que os orquestradores decidam quem pode
 * atender uma operação sem JAMAIS olhar o `code` do provider. Isto
 * desacopla 100% as camadas superiores.
 *
 * Para adicionar um novo gateway (Stripe, Asaas, PagSeguro, …):
 *   1. Criar `providers/<nome>.server.ts` exportando um `PaymentAdapter`.
 *   2. Adicionar uma linha `register(...)` abaixo.
 *   3. Pronto. Nenhuma outra camada precisa ser modificada.
 */
import type {
  PaymentAdapter,
  PaymentCapability,
  PaymentMethod,
  PaymentProviderCode,
} from './adapter';
import { mercadoPagoAdapter } from './providers/mercado-pago.server';

const REGISTRY = new Map<string, PaymentAdapter>();

function register(adapter: PaymentAdapter) {
  REGISTRY.set(adapter.code, adapter);
}

// Auto-registro --------------------------------------------------------
register(mercadoPagoAdapter);
// register(stripeAdapter);    // futuro
// register(asaasAdapter);     // futuro
// register(pagseguroAdapter); // futuro

export function getPaymentAdapter(code: PaymentProviderCode): PaymentAdapter | null {
  return REGISTRY.get(code) ?? null;
}

export function listPaymentAdapters(): PaymentAdapter[] {
  return Array.from(REGISTRY.values());
}

/** Capability Discovery — filtra exclusivamente pela matriz de capabilities. */
export function findAdaptersByCapability(cap: PaymentCapability): PaymentAdapter[] {
  return listPaymentAdapters().filter((a) => Boolean(a.capabilities[cap]));
}

export function supportsCapability(
  code: PaymentProviderCode,
  cap: PaymentCapability,
): boolean {
  const a = REGISTRY.get(code);
  return Boolean(a?.capabilities[cap]);
}

const METHOD_CAPABILITY: Record<PaymentMethod, PaymentCapability> = {
  pix: 'pix',
  credit_card: 'creditCard',
  debit_card: 'debitCard',
  boleto: 'boleto',
};

export function findAdaptersForMethod(method: PaymentMethod): PaymentAdapter[] {
  return findAdaptersByCapability(METHOD_CAPABILITY[method]);
}

export function supportsMethod(code: PaymentProviderCode, method: PaymentMethod): boolean {
  return supportsCapability(code, METHOD_CAPABILITY[method]);
}

export function listPaymentProviderDescriptors() {
  return listPaymentAdapters().map((a) => ({
    code: a.code,
    display_name: a.displayName,
    capabilities: a.capabilities,
    credential_schema: a.credentialSchema,
    config_schema: a.configSchema,
  }));
}

/** Matriz humana de capabilities — usada por UI admin / auditoria. */
export function capabilityMatrix() {
  return listPaymentAdapters().map((a) => ({
    code: a.code,
    display_name: a.displayName,
    capabilities: a.capabilities,
  }));
}
