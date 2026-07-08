/**
 * Commercial Context Resolver (Sprint 10.5 → P5 Bloco 5) — SERVER-ONLY.
 *
 * Resolve, a partir da requisição corrente, todo o contexto comercial
 * necessário para uma consulta de catálogo:
 *  - `sales_channel`            (retail | wholesale)
 *  - `product_sale_channels`    (mapeado via `sales-channel.ts`)
 *  - `price_list_code`          (código da tabela a aplicar, ou null = públicas)
 *  - `customer_group_id`        (reservado)
 *
 * ⚠️ SEGURANÇA (P5 — Atacado seguro):
 * O canal wholesale é AUTORITATIVO no servidor. O cookie/localStorage
 * `lv_sales_channel` só indica **preferência visual** — nunca autorização.
 *
 * Para retornar `sales_channel = 'wholesale'` (e portanto habilitar
 * `price_list_code = WHOLESALE-{store_id}`), o resolver EXIGE:
 *   1. Requisição autenticada (bearer token no `storefrontClient`);
 *   2. `customers` com `auth_user_id = auth.uid()`;
 *   3. `wholesale_applications.status = 'approved'` para esse cliente.
 *
 * Se qualquer condição falhar (visitante, cliente sem aprovação, chamada
 * fora de contexto de requisição), o canal é **rebaixado silenciosamente
 * para `retail`** — nunca vazamos preço atacado.
 */
import { getCookie } from '@tanstack/react-start/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
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
  /** Reservado: grupo do cliente autenticado. */
  customer_group_id: string | null;
  /** true quando o usuário pediu wholesale mas não é cliente aprovado. */
  wholesale_denied: boolean;
}

/** Lê o canal indicado (explícito ou cookie). Isso é APENAS a preferência
 *  do cliente — a autorização real acontece em {@link resolveCommercialContext}. */
export function resolveSalesChannelFromRequest(explicit?: SalesChannel | null): SalesChannel {
  if (explicit) return normalizeSalesChannel(explicit);
  try {
    const raw = getCookie(SALES_CHANNEL_COOKIE);
    return normalizeSalesChannel(raw);
  } catch {
    return 'retail';
  }
}

export interface ResolveCommercialContextInput {
  explicit_channel?: SalesChannel | null;
  store_id?: string | null;
  /**
   * Cliente Supabase da requisição corrente (idealmente o `storefrontClient`,
   * que encaminha o bearer). Sem ele, wholesale é sempre negado.
   */
  supabase?: SupabaseClient<Database> | null;
}

/**
 * Verifica se o usuário autenticado (bearer forwarded) possui aplicação
 * wholesale aprovada. Retorna null quando não há usuário, não há customer
 * ou não há aplicação aprovada.
 */
async function resolveApprovedWholesaleCustomerId(
  supabase: SupabaseClient<Database> | null | undefined,
): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const authUserId = userRes?.user?.id ?? null;
    if (!authUserId) return null;
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (!customer?.id) return null;
    const { data: approved } = await supabase
      .from('wholesale_applications')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle();
    return approved?.id ? customer.id : null;
  } catch {
    return null;
  }
}

export async function resolveCommercialContext(
  input: ResolveCommercialContextInput = {},
): Promise<CommercialContext> {
  const requested = resolveSalesChannelFromRequest(input.explicit_channel ?? null);

  // Retail nunca exige verificação.
  if (requested !== 'wholesale') {
    return {
      sales_channel: 'retail',
      product_sale_channels: productSaleChannelsFor('retail'),
      price_list_code: null,
      customer_group_id: null,
      wholesale_denied: false,
    };
  }

  // Wholesale só é liberado com aprovação verificada no servidor.
  const approvedCustomerId = await resolveApprovedWholesaleCustomerId(input.supabase ?? null);
  if (!approvedCustomerId) {
    return {
      sales_channel: 'retail',
      product_sale_channels: productSaleChannelsFor('retail'),
      price_list_code: null,
      customer_group_id: null,
      wholesale_denied: true,
    };
  }

  return {
    sales_channel: 'wholesale',
    product_sale_channels: productSaleChannelsFor('wholesale'),
    price_list_code: input.store_id ? `WHOLESALE-${input.store_id}` : null,
    customer_group_id: null,
    wholesale_denied: false,
  };
}
