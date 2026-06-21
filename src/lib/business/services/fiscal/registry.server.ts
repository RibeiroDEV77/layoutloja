/**
 * Fiscal Adapter Registry — fonte única de verdade dos providers fiscais.
 * Server-only.
 *
 * Capability Discovery: o Registry expõe `findAdaptersByCapability()` e
 * `supportsCapability()`. O FiscalService NUNCA olha o `code` do provider.
 *
 * Para adicionar um novo provider (Focus NFe, PlugNotas, Tecnospeed…):
 *   1. Criar `providers/<nome>.server.ts` exportando um `FiscalAdapter`.
 *   2. Adicionar uma linha `register(...)` abaixo.
 *   3. Pronto — nenhuma outra camada precisa ser tocada.
 */
import type {
  FiscalAdapter,
  FiscalCapability,
  FiscalDocumentType,
  FiscalProviderCode,
} from './adapter';
import { nuvemFiscalAdapter } from './providers/nuvem-fiscal.server';

const REGISTRY = new Map<string, FiscalAdapter>();
function register(a: FiscalAdapter) { REGISTRY.set(a.code, a); }

register(nuvemFiscalAdapter);
// register(focusNfeAdapter);   // futuro
// register(plugNotasAdapter);  // futuro
// register(tecnospeedAdapter); // futuro

export function getFiscalAdapter(code: FiscalProviderCode): FiscalAdapter | null {
  return REGISTRY.get(code) ?? null;
}
export function listFiscalAdapters(): FiscalAdapter[] {
  return Array.from(REGISTRY.values());
}

/** Capability Discovery — filtra exclusivamente pela matriz. */
export function findAdaptersByCapability(cap: FiscalCapability): FiscalAdapter[] {
  return listFiscalAdapters().filter((a) => Boolean(a.capabilities[cap]));
}
export function supportsCapability(code: FiscalProviderCode, cap: FiscalCapability): boolean {
  return Boolean(REGISTRY.get(code)?.capabilities[cap]);
}

const DOCUMENT_CAPABILITY: Record<FiscalDocumentType, FiscalCapability> = {
  nfe:  'nfe',
  nfce: 'nfce',
  nfse: 'nfse',
  cte:  'cte',
};
export function findAdaptersForDocument(doc: FiscalDocumentType): FiscalAdapter[] {
  return findAdaptersByCapability(DOCUMENT_CAPABILITY[doc]);
}
export function supportsDocument(code: FiscalProviderCode, doc: FiscalDocumentType): boolean {
  return supportsCapability(code, DOCUMENT_CAPABILITY[doc]);
}

export function listFiscalProviderDescriptors() {
  return listFiscalAdapters().map((a) => ({
    code: a.code,
    display_name: a.displayName,
    capabilities: a.capabilities,
    credential_schema: a.credentialSchema,
    config_schema: a.configSchema,
  }));
}

/** Matriz humana de capabilities — para UI admin / auditoria. */
export function capabilityMatrix() {
  return listFiscalAdapters().map((a) => ({
    code: a.code,
    display_name: a.displayName,
    capabilities: a.capabilities,
  }));
}
