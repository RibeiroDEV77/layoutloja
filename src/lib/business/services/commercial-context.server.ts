/**
 * Commercial Context Resolver (Sprint 10.5) — SERVER-ONLY.
 *
 * Resolve, a partir da requisição corrente, todo o contexto comercial
 * necessário para uma consulta de catálogo:
 *  - `sales_channel`            (retail | wholesale)
 *  - `product_sale_channels`    (mapeado via `sales-channel.ts`)
 *  - `price_list_code`          (código da tabela a aplicar, ou null = públicas)
 *  - `customer_group_id`        (placeholder; preenchido em sprints futuras
 *                                quando o catálogo passar a aceitar
 *                                contexto autenticado)
 *
 * O canal é resolvido por: (1) parâmetro explícito da server fn,
 * (2) cookie `lv_sales_channel` da requisição, (3) default `retail`.
 *
 * Esta camada não duplica regras — toda tradução `retail/wholesale`
 * ↔ `varejo/atacado/ambos` vem de `@/lib/business/sales-channel`.
 *
 * Convenção de price list de atacado (Sprint 9):
 *   code = `WHOLESALE-{store_id}` (`is_active = true`)
 */
import { getCookie } from '@tanstack/react-start/server';
import {
  SALES_CHANNEL_COOKIE,
  normalizeSalesChannel,
  productSaleChannelsFor,
  type ProductSaleChannel,
  type SalesChannel,
} from '../sales-channel';

export interface CommercialContext {
  sales_channel: SalesChannel;
  product_sale_channels: ProductSaleChannel[];
  /** Código da tabela de preços a filtrar; null → usar tabelas públicas. */
  price_list_code: string | null;
  /** Reservado: grupo do cliente autenticado. Sempre null nesta Sprint. */
  customer_group_id: string | null;
}

/** Lê o canal da requisição (cookie) ou usa o explícito quando fornecido. */
export function resolveSalesChannelFromRequest(explicit?: SalesChannel | null): SalesChannel {
  if (explicit) return normalizeSalesChannel(explicit);
  try {
    const raw = getCookie(SALES_CHANNEL_COOKIE);
    return normalizeSalesChannel(raw);
  } catch {
    // Fora de contexto de requisição (ex.: chamadas internas isoladas).
    return 'retail';
  }
}

export interface ResolveCommercialContextInput {
  explicit_channel?: SalesChannel | null;
  store_id?: string | null;
}

export async function resolveCommercialContext(
  input: ResolveCommercialContextInput = {},
): Promise<CommercialContext> {
  const channel = resolveSalesChannelFromRequest(input.explicit_channel ?? null);
  const priceListCode =
    channel === 'wholesale' && input.store_id
      ? `WHOLESALE-${input.store_id}`
      : null;
  return {
    sales_channel: channel,
    product_sale_channels: productSaleChannelsFor(channel),
    price_list_code: priceListCode,
    customer_group_id: null,
  };
}
