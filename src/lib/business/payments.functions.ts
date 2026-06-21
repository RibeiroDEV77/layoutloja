/**
 * Server Functions do Payment Engine (camada client-safe).
 * Tudo orquestrado via PaymentProviderRegistry — nenhuma referência direta
 * ao Mercado Pago (ou qualquer gateway).
 *
 * Os retornos passam por `toJSON()` para satisfazer o validador serializável
 * do TanStack Server (que rejeita `Record<string, unknown>` cru por causa
 * dos `unknown` em `raw`).
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import * as Svc from './services/payments.server';
import type { PaymentMethod } from './services/payments/adapter';

// JSON-safe roundtrip: garante shape totalmente serializável.
function toJSON<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

interface AuthorizeInput {
  payment_id: string;
  method: PaymentMethod;
  payer: { email?: string; name?: string; document?: string; document_type?: 'CPF' | 'CNPJ'; phone?: string };
  gateway_id?: string;
  card_token?: string;
  installments?: number;
  capture?: boolean;
  expires_at?: string;
  description?: string;
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
}

export const authorizePayment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: AuthorizeInput) => d)
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from('payments')
      .select('store_id').eq('id', data.payment_id).maybeSingle();
    if (!p) throw new Error('Pagamento não encontrado');
    await Svc.assertCanCreatePayment(context.supabase, context.userId, p.store_id);
    return toJSON(await Svc.authorizePayment(context.supabase, data));
  });

export const capturePayment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { payment_id: string; amount?: number }) => d)
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from('payments')
      .select('store_id').eq('id', data.payment_id).maybeSingle();
    if (!p) throw new Error('Pagamento não encontrado');
    await Svc.assertCanCreatePayment(context.supabase, context.userId, p.store_id);
    return toJSON(await Svc.capturePayment(context.supabase, data));
  });

export const cancelPayment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { payment_id: string; reason?: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from('payments')
      .select('store_id').eq('id', data.payment_id).maybeSingle();
    if (!p) throw new Error('Pagamento não encontrado');
    await Svc.assertCanCreatePayment(context.supabase, context.userId, p.store_id);
    return toJSON(await Svc.cancelPayment(context.supabase, data));
  });

export const refundPayment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { payment_id: string; amount?: number; reason?: string; idempotency_key?: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from('payments')
      .select('store_id').eq('id', data.payment_id).maybeSingle();
    if (!p) throw new Error('Pagamento não encontrado');
    await Svc.assertCanRefundPayment(context.supabase, context.userId, p.store_id);
    return toJSON(await Svc.refundPayment(context.supabase, data));
  });

export const getPaymentStatus = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { payment_id: string }) => d)
  .handler(async ({ data, context }) =>
    toJSON(await Svc.getPaymentStatus(context.supabase, data)),
  );

export const testGatewayConnection = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { gateway_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: g } = await context.supabase.from('payment_gateways')
      .select('store_id').eq('id', data.gateway_id).maybeSingle();
    if (!g) throw new Error('Gateway não encontrado');
    await Svc.assertCanManageGateway(context.supabase, context.userId, g.store_id);
    return toJSON(await Svc.testGatewayConnection(context.supabase, data.gateway_id));
  });

export const listPaymentProviders = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listPaymentProviderDescriptors, capabilityMatrix } =
      await import('./services/payments/registry.server');
    return toJSON({
      providers: listPaymentProviderDescriptors(),
      matrix: capabilityMatrix(),
    });
  });
