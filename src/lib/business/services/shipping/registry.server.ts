/**
 * Shipping Adapter Registry — fonte única de verdade dos providers
 * suportados pela plataforma. Server-only.
 *
 * Capability Discovery: o Registry expõe `findAdaptersByCapability()` e
 * `supportsCapability()` para que os orquestradores (provider-registry,
 * tracking, labels) decidam quem pode atender uma operação sem JAMAIS
 * olhar o `code` do provider. Isto desacopla 100% as camadas superiores.
 */
import type {
  ShippingAdapter,
  ShippingCapability,
  ShippingProviderCode,
} from './adapter';
import { correiosAdapter } from './providers/correios.server';
import { melhorEnvioAdapter } from './providers/melhor-envio.server';

const REGISTRY = new Map<string, ShippingAdapter>();

function register(adapter: ShippingAdapter) {
  REGISTRY.set(adapter.code, adapter);
}

// Auto-registro: adicionar um provider novo é uma linha aqui — nenhuma
// outra camada (service/registry/UI) precisa ser modificada.
register(correiosAdapter);
register(melhorEnvioAdapter);

export function getShippingAdapter(code: ShippingProviderCode): ShippingAdapter | null {
  return REGISTRY.get(code) ?? null;
}

export function listShippingAdapters(): ShippingAdapter[] {
  return Array.from(REGISTRY.values());
}

/** Capability Discovery — filtra exclusivamente pela matriz de capabilities. */
export function findAdaptersByCapability(cap: ShippingCapability): ShippingAdapter[] {
  return listShippingAdapters().filter((a) => Boolean(a.capabilities[cap]));
}

export function supportsCapability(
  code: ShippingProviderCode,
  cap: ShippingCapability,
): boolean {
  const a = REGISTRY.get(code);
  return Boolean(a?.capabilities[cap]);
}

export function listShippingProviderDescriptors() {
  return listShippingAdapters().map((a) => ({
    code: a.code,
    display_name: a.displayName,
    capabilities: a.capabilities,
    credential_schema: a.credentialSchema,
    config_schema: a.configSchema,
  }));
}

/** Matriz humana de capabilities — útil para UI admin / auditoria. */
export function capabilityMatrix(): Array<{
  code: string;
  display_name: string;
  capabilities: ShippingAdapter['capabilities'];
}> {
  return listShippingAdapters().map((a) => ({
    code: a.code,
    display_name: a.displayName,
    capabilities: a.capabilities,
  }));
}
