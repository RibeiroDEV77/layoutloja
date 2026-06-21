/**
 * Shipping Adapter Registry — fonte única de verdade dos providers
 * suportados pela plataforma. Server-only.
 */
import type { ShippingAdapter, ShippingProviderCode } from './adapter';
import { correiosAdapter } from './providers/correios.server';

const REGISTRY = new Map<string, ShippingAdapter>();

function register(adapter: ShippingAdapter) {
  REGISTRY.set(adapter.code, adapter);
}

register(correiosAdapter);

export function getShippingAdapter(code: ShippingProviderCode): ShippingAdapter | null {
  return REGISTRY.get(code) ?? null;
}

export function listShippingAdapters(): ShippingAdapter[] {
  return Array.from(REGISTRY.values());
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
