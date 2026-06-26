/**
 * Sales Channel (Sprint 10.5) — utilitário ISOMÓRFICO.
 *
 * Ponto único de mapeamento entre o canal comercial do storefront
 * (`'retail' | 'wholesale'`) e o enum `products.sale_channel`
 * (`'varejo' | 'atacado' | 'ambos'`). Não pode haver outra fonte
 * dessa tradução em queries do catálogo.
 *
 * Também define o nome do cookie usado para tornar o canal SSR-safe.
 * Nenhuma dependência de servidor — pode ser importado de qualquer lugar.
 */

export type SalesChannel = 'retail' | 'wholesale';

export const SALES_CHANNEL_COOKIE = 'lv_sales_channel';
export const SALES_CHANNEL_STORAGE_KEY = 'storefront.sales_channel'; // legado (localStorage)
export const DEFAULT_SALES_CHANNEL: SalesChannel = 'retail';
export const SALES_CHANNEL_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano

export type ProductSaleChannel = 'varejo' | 'atacado' | 'ambos';

export function isSalesChannel(v: unknown): v is SalesChannel {
  return v === 'retail' || v === 'wholesale';
}

export function normalizeSalesChannel(v: unknown): SalesChannel {
  return isSalesChannel(v) ? v : DEFAULT_SALES_CHANNEL;
}

/**
 * Mapeamento canônico canal → valores do enum em `products.sale_channel`.
 * Sempre inclui `'ambos'` (produto disponível para os dois canais).
 */
export function productSaleChannelsFor(channel: SalesChannel): ProductSaleChannel[] {
  return channel === 'wholesale' ? ['atacado', 'ambos'] : ['varejo', 'ambos'];
}

// ---------------- Browser helpers (no-op no servidor) ----------------

export function readSalesChannelCookieBrowser(): SalesChannel | null {
  if (typeof document === 'undefined') return null;
  const re = new RegExp('(?:^|; )' + SALES_CHANNEL_COOKIE + '=([^;]+)');
  const m = document.cookie.match(re);
  if (!m) return null;
  try { return normalizeSalesChannel(decodeURIComponent(m[1])); } catch { return null; }
}

export function writeSalesChannelCookieBrowser(channel: SalesChannel): void {
  if (typeof document === 'undefined') return;
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie =
    `${SALES_CHANNEL_COOKIE}=${encodeURIComponent(channel)}; Max-Age=${SALES_CHANNEL_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

export function clearSalesChannelCookieBrowser(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SALES_CHANNEL_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  try { window.localStorage.removeItem(SALES_CHANNEL_STORAGE_KEY); } catch { /* ignore */ }
}

