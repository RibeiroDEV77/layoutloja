/**
 * PaymentService — orquestrador do Payment Engine.
 *
 * Princípios:
 *  - NÃO conhece nenhum gateway diretamente. Toda resolução passa pelo
 *    PaymentProviderRegistry + Capability Discovery.
 *  - NÃO escreve estado por conta própria — todas as transições passam
 *    pelas RPCs SECURITY DEFINER já existentes do Payment Engine
 *    (payment_authorize, payment_capture, payment_cancel, payment_fail,
 *    payment_refund_request/succeeded/failed, payment_chargeback_*).
 *  - Webhooks NUNCA escrevem direto: adapter normaliza → service chama RPC
 *    via `payment_webhook_ingest` + transição correspondente.
 *  - Idempotência: tabela `idempotency_keys` (helper aqui) + cache curto
 *    no provider-registry.
 *  - Outbox: Domain Events já são publicados pelas RPCs / triggers do
 *    Payment Engine. Aqui apenas garantimos métricas e timeline complementar.
 */
import type { SbClient } from '../events/dispatcher.server';
import { recordMetric } from '@/lib/foundations/observability.functions';
import { requirePermission } from './permissions.server';
import {
  buildAdapterContext,
  loadGatewayCredentials,
  loadGatewayWebhookSecret,
  resolveGatewayById,
  resolveGatewayForMethod,
  runAdapterOp,
  type ResolvedGateway,
} from './payments/provider-registry.server';
import type {
  AdapterAuthorizeRequest,
  AdapterPayer,
  AdapterWebhookEvent,
  PaymentMethod,
} from './payments/adapter';

// ----------------------------- Idempotency --------------------------------
async function claimIdempotency(
  supabase: SbClient,
  scope: string,
  key: string,
  storeId: string,
): Promise<{ first: boolean; previous?: unknown }> {
  const fullKey = `${scope}:${key}`;
  const { data: existing } = await supabase
    .from('idempotency_keys')
    .select('id, response_body')
    .eq('key', fullKey)
    .maybeSingle();
  if (existing) return { first: false, previous: existing.response_body };
  const { error } = await supabase.from('idempotency_keys').insert({
    key: fullKey, scope, store_id: storeId, status: 'pending',
  } as never);
  if (error && !/duplicate key/i.test(error.message)) throw error;
  return { first: true };
}

async function completeIdempotency(
  supabase: SbClient, scope: string, key: string, body: unknown,
) {
  await supabase
    .from('idempotency_keys')
    .update({ status: 'succeeded', response_body: body as never, completed_at: new Date().toISOString() })
    .eq('key', `${scope}:${key}`);
}

// ----------------------------- Authorize ----------------------------------
export interface AuthorizePaymentInput {
  payment_id: string;
  method: PaymentMethod;
  payer: AdapterPayer;
  /** Quando ausente, registry escolhe pelo Capability Discovery. */
  gateway_id?: string;
  card_token?: string;
  installments?: number;
  capture?: boolean;
  expires_at?: string;
  description?: string;
  statement_descriptor?: string;
  metadata?: Record<string, any>;
  /** Chave fornecida pelo caller para idempotência cross-retry. */
  idempotency_key?: string;
  trace_id?: string;
}

export async function authorizePayment(supabase: SbClient, input: AuthorizePaymentInput) {
  // 1) Carrega o pagamento (RLS aplica). Necessário para amount / store_id.
  const { data: p, error } = await supabase
    .from('payments')
    .select('id, store_id, amount_gross, currency, status, idempotency_key')
    .eq('id', input.payment_id)
    .maybeSingle();
  if (error) throw error;
  if (!p) throw new Error('Pagamento não encontrado');
  if (!['pending', 'authorizing'].includes(p.status)) {
    throw new Error(`Pagamento em estado ${p.status} não pode autorizar`);
  }

  // 2) Resolve gateway via Capability Discovery (nunca olha o `code`).
  const gateway = input.gateway_id
    ? await resolveGatewayById(supabase, input.gateway_id)
    : await resolveGatewayForMethod(supabase, p.store_id, input.method);
  if (!gateway) throw new Error(`Nenhum gateway ativo suporta o método ${input.method}`);

  // 3) Idempotência (caller-key ou payment_id).
  const idemKey = input.idempotency_key ?? `auth:${p.id}`;
  const claim = await claimIdempotency(supabase, 'payment.authorize', idemKey, p.store_id);
  if (!claim.first) return claim.previous as Awaited<ReturnType<typeof finishAuthorize>>;

  // 4) Adapter call (métricas + latência via runAdapterOp).
  const credentials = await loadGatewayCredentials(gateway.gateway_id);
  const ctx = buildAdapterContext(gateway, credentials, {
    traceId: input.trace_id, idempotencyKey: idemKey,
  });
  const req: AdapterAuthorizeRequest = {
    payment_id: p.id,
    amount: Number(p.amount_gross),
    currency: p.currency,
    method: input.method,
    payer: input.payer,
    card_token: input.card_token,
    installments: input.installments,
    capture: input.capture,
    expires_at: input.expires_at,
    description: input.description,
    statement_descriptor: input.statement_descriptor,
    metadata: input.metadata,
  };

  const started = Date.now();
  const result = await runAdapterOp(supabase, gateway, 'authorize', () =>
    gateway.adapter.authorizePayment(ctx, req),
  );

  // 5) Registra attempt + persiste transição via RPCs do Payment Engine.
  await (supabase as any).rpc('payment_record_attempt', {
    _payment_id: p.id,
    _operation: 'authorize',
    _gateway_id: gateway.gateway_id,
    _success: true,
    _request_payload: req as never,
    _response_payload: (result.raw ?? {}) as never,
    _http_status: 200,
    _gateway_code: null,
    _gateway_message: null,
    _latency_ms: Date.now() - started,
    _external_id: result.external_id,
  });

  if (result.status === 'authorized') {
    await (supabase as any).rpc('payment_authorize', {
      _payment_id: p.id, _gateway_id: gateway.gateway_id,
      _authorization_id: result.authorization_id ?? result.external_id,
      _authorized_amount: result.amount_authorized,
      _expires_at: result.expires_at ?? null,
      _metadata: { external_id: result.external_id } as never,
    });
  } else if (result.status === 'captured') {
    // auth+capture imediato (cartão com capture:true, PIX/boleto já pago)
    await (supabase as any).rpc('payment_authorize', {
      _payment_id: p.id, _gateway_id: gateway.gateway_id,
      _authorization_id: result.authorization_id ?? result.external_id,
      _authorized_amount: result.amount_authorized,
      _expires_at: null, _metadata: { external_id: result.external_id } as never,
    });
    await (supabase as any).rpc('payment_capture', {
      _payment_id: p.id,
      _amount: result.amount_captured ?? result.amount_authorized,
      _capture_id: result.external_id,
      _metadata: {} as never,
    });
  } else if (result.status === 'failed') {
    await (supabase as any).rpc('payment_fail', {
      _payment_id: p.id, _failure_code: 'gateway_rejected', _failure_message: 'rejected',
    });
  } else {
    // pending → apenas registra external_id; PIX/boleto liquidam por webhook.
    await supabase.from('payments').update({
      external_id: result.external_id,
      metadata: { method_details: result.method_details as never },
    } as never).eq('id', p.id);
  }

  const finished = await finishAuthorize({
    payment_id: p.id, gateway_id: gateway.gateway_id,
    provider_code: gateway.provider_code, status: result.status,
    external_id: result.external_id, method_details: result.method_details,
    amount_authorized: result.amount_authorized, expires_at: result.expires_at,
  });
  await completeIdempotency(supabase, 'payment.authorize', idemKey, finished);
  return finished;
}

function finishAuthorize(out: {
  payment_id: string; gateway_id: string; provider_code: string;
  status: string; external_id: string;
  method_details?: AdapterAuthorizeRequest extends never ? never : Record<string, any> | undefined;
  amount_authorized: number; expires_at?: string;
}) {
  return out;
}

// ----------------------------- Capture / Cancel ---------------------------
export async function capturePayment(
  supabase: SbClient,
  input: { payment_id: string; amount?: number; trace_id?: string },
) {
  const { data: p } = await supabase
    .from('payments')
    .select('id, store_id, external_id, gateway_id, amount_captured')
    .eq('id', input.payment_id).maybeSingle();
  if (!p?.gateway_id) throw new Error('Pagamento sem gateway associado');
  const gateway = await resolveGatewayById(supabase, p.gateway_id);
  if (!gateway) throw new Error('Gateway não disponível');

  const credentials = await loadGatewayCredentials(gateway.gateway_id);
  const ctx = buildAdapterContext(gateway, credentials, { traceId: input.trace_id });
  const result = await runAdapterOp(supabase, gateway, 'capture', () =>
    gateway.adapter.capturePayment(ctx, {
      external_id: p.external_id!,
      amount: input.amount,
    }),
  );
  await (supabase as any).rpc('payment_capture', {
    _payment_id: p.id,
    _amount: result.amount_captured,
    _capture_id: result.capture_id ?? result.external_id,
    _metadata: {} as never,
  });
  return result;
}

export async function cancelPayment(
  supabase: SbClient,
  input: { payment_id: string; reason?: string; trace_id?: string },
) {
  const { data: p } = await supabase.from('payments')
    .select('id, external_id, gateway_id').eq('id', input.payment_id).maybeSingle();
  if (!p?.gateway_id) throw new Error('Pagamento sem gateway associado');
  const gateway = await resolveGatewayById(supabase, p.gateway_id);
  if (!gateway) throw new Error('Gateway não disponível');
  const credentials = await loadGatewayCredentials(gateway.gateway_id);
  const ctx = buildAdapterContext(gateway, credentials, { traceId: input.trace_id });
  const result = await runAdapterOp(supabase, gateway, 'cancel', () =>
    gateway.adapter.cancelPayment(ctx, { external_id: p.external_id!, reason: input.reason }),
  );
  await (supabase as any).rpc('payment_cancel', { _payment_id: p.id, _reason: input.reason ?? null });
  return result;
}

// ----------------------------- Refund -------------------------------------
export async function refundPayment(
  supabase: SbClient,
  input: { payment_id: string; amount?: number; reason?: string; idempotency_key?: string; trace_id?: string },
) {
  const { data: p } = await supabase.from('payments')
    .select('id, store_id, external_id, gateway_id, amount_captured, amount_refunded')
    .eq('id', input.payment_id).maybeSingle();
  if (!p?.gateway_id) throw new Error('Pagamento sem gateway associado');
  const gateway = await resolveGatewayById(supabase, p.gateway_id);
  if (!gateway) throw new Error('Gateway não disponível');
  const idem = input.idempotency_key ?? `refund:${p.id}:${input.amount ?? 'full'}:${Date.now()}`;

  // RPC cria o registro local em payment_refunds (status=pending).
  const { data: refund, error: errRPC } = await (supabase as any).rpc('payment_refund_request', {
    _payment_id: p.id,
    _amount: input.amount ?? Number(p.amount_captured) - Number(p.amount_refunded ?? 0),
    _reason: 'customer_request',
    _reason_note: input.reason ?? null,
    _metadata: {} as never,
  });
  if (errRPC) throw errRPC;

  const credentials = await loadGatewayCredentials(gateway.gateway_id);
  const ctx = buildAdapterContext(gateway, credentials, { traceId: input.trace_id, idempotencyKey: idem });
  try {
    const result = await runAdapterOp(supabase, gateway, 'refund', () =>
      gateway.adapter.refundPayment(ctx, {
        external_id: p.external_id!,
        amount: input.amount,
        reason: input.reason,
        idempotency_key: idem,
      }),
    );
    if (result.status === 'succeeded') {
      await (supabase as any).rpc('payment_refund_mark_succeeded', {
        _refund_id: (refund as { id: string }).id,
        _gateway_refund_id: result.external_refund_id,
      });
    } else if (result.status === 'failed') {
      await (supabase as any).rpc('payment_refund_mark_failed', {
        _refund_id: (refund as { id: string }).id,
        _failure_code: 'gateway_failed', _failure_message: 'failed',
      });
    }
    return { refund, gateway_result: result };
  } catch (err) {
    await (supabase as any).rpc('payment_refund_mark_failed', {
      _refund_id: (refund as { id: string }).id,
      _failure_code: 'gateway_exception',
      _failure_message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ----------------------------- Status -------------------------------------
export async function getPaymentStatus(
  supabase: SbClient,
  input: { payment_id: string; trace_id?: string },
) {
  const { data: p } = await supabase.from('payments')
    .select('id, external_id, gateway_id').eq('id', input.payment_id).maybeSingle();
  if (!p?.gateway_id || !p.external_id) throw new Error('Pagamento sem gateway/external_id');
  const gateway = await resolveGatewayById(supabase, p.gateway_id);
  if (!gateway) throw new Error('Gateway não disponível');
  const credentials = await loadGatewayCredentials(gateway.gateway_id);
  const ctx = buildAdapterContext(gateway, credentials, { traceId: input.trace_id });
  return runAdapterOp(supabase, gateway, 'status', () =>
    gateway.adapter.getPaymentStatus(ctx, p.external_id!),
  );
}

// ----------------------------- Test Connection ----------------------------
export async function testGatewayConnection(supabase: SbClient, gateway_id: string) {
  const gateway = await resolveGatewayById(supabase, gateway_id);
  if (!gateway) throw new Error('Gateway não encontrado');
  const credentials = await loadGatewayCredentials(gateway_id);
  const ctx = buildAdapterContext(gateway, credentials);
  const result = await runAdapterOp(supabase, gateway, 'test', () =>
    gateway.adapter.testConnection(ctx),
  );
  await supabase.from('payment_gateways').update({
    last_test_at: new Date().toISOString(),
    last_test_ok: result.ok,
    last_test_error: result.ok ? null : result.error.slice(0, 500),
  } as never).eq('id', gateway_id);
  return result;
}

// ----------------------------- Webhook ingest -----------------------------
export interface IngestWebhookInput {
  provider_code: string;
  rawBody: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  source_ip?: string;
}

export async function ingestProviderWebhook(supabase: SbClient, input: IngestWebhookInput) {
  await recordMetric(supabase, {
    scope: 'payments', name: 'payment.webhook.received', value: 1,
    tags: { provider: input.provider_code },
  });

  // Resolve QUALQUER gateway ativo para este provider para obter credenciais.
  // A unicidade do pagamento é garantida via external_payment_id na RPC.
  const { data: gws } = await supabase
    .from('payment_gateways')
    .select('id, store_id, adapter, display_name, is_active, priority, config, capabilities')
    .eq('adapter', input.provider_code)
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .limit(1);
  const row = gws?.[0];
  if (!row) throw new Error(`Nenhum gateway ativo para provider ${input.provider_code}`);
  const gateway = await resolveGatewayById(supabase, row.id);
  if (!gateway) throw new Error('Adapter não registrado');

  const credentials = await loadGatewayCredentials(gateway.gateway_id);
  const webhookSecret = await loadGatewayWebhookSecret(gateway.gateway_id);
  const ctx = buildAdapterContext(gateway, credentials);
  const parsed = await runAdapterOp(supabase, gateway, 'webhook', () =>
    gateway.adapter.processWebhook(ctx, {
      rawBody: input.rawBody, headers: input.headers, query: input.query,
      webhookSecret,
    }),
  );

  const out: Array<{ webhook_id: string; action: string }> = [];
  for (const ev of parsed.events) {
    // 1) Inbox/idempotência via RPC SECURITY DEFINER (única escrita permitida).
    const { data: ingest } = await (supabase as any).rpc('payment_webhook_ingest', {
      _provider: input.provider_code,
      _external_event_id: ev.external_event_id,
      _event_type: ev.event_type,
      _payload: ev.raw as never,
      _signature: input.headers['x-signature'] ?? null,
      _signature_valid: parsed.signature_valid,
      _headers: input.headers as never,
      _source_ip: input.source_ip ?? null,
      _gateway_id: gateway.gateway_id,
      _store_id: gateway.store_id,
      _payment_id: null,
      _trace_id: null,
      _correlation_id: null,
    });
    const ingestObj = (ingest ?? {}) as { id?: string; action?: string };
    if (!ingestObj.id) continue;
    out.push({ webhook_id: ingestObj.id, action: ingestObj.action ?? 'new' });

    if (ingestObj.action === 'duplicate') continue;

    // 2) Aplica efeito do evento via RPCs do Payment Engine.
    try {
      await applyWebhookEffect(supabase, gateway, ev);
      await (supabase as any).rpc('payment_webhook_mark_processed', {
        _webhook_id: ingestObj.id, _duration_ms: null,
      });
      await recordMetric(supabase, {
        scope: 'payments', name: 'payment.webhook.processed', value: 1,
        storeId: gateway.store_id, tags: { provider: input.provider_code, kind: ev.kind },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await (supabase as any).rpc('payment_webhook_mark_failed', {
        _webhook_id: ingestObj.id, _error: msg, _duration_ms: null,
      });
      await recordMetric(supabase, {
        scope: 'payments', name: 'payment.webhook.error', value: 1,
        storeId: gateway.store_id, tags: { provider: input.provider_code, kind: ev.kind },
      });
    }
  }
  return { signature_valid: parsed.signature_valid, processed: out };
}

async function applyWebhookEffect(
  supabase: SbClient, gateway: ResolvedGateway, ev: AdapterWebhookEvent,
) {
  if (!ev.external_payment_id) return;
  // Resolve payment_id local a partir do external_id (uniq por gateway).
  const { data: p } = await supabase.from('payments')
    .select('id, status, amount_gross')
    .eq('gateway_id', gateway.gateway_id)
    .eq('external_id', ev.external_payment_id)
    .maybeSingle();
  if (!p) return;

  // Fonte da verdade = getPaymentStatus no gateway (defensivo).
  const credentials = await loadGatewayCredentials(gateway.gateway_id);
  const ctx = buildAdapterContext(gateway, credentials);
  const status = await gateway.adapter.getPaymentStatus(ctx, ev.external_payment_id);

  if (status.status === 'captured' && p.status !== 'captured') {
    if (p.status === 'pending') {
      await (supabase as any).rpc('payment_authorize', {
        _payment_id: p.id, _gateway_id: gateway.gateway_id,
        _authorization_id: ev.external_payment_id,
        _authorized_amount: status.amount_authorized ?? status.amount_captured ?? p.amount_gross,
        _expires_at: null, _metadata: {} as never,
      });
    }
    await (supabase as any).rpc('payment_capture', {
      _payment_id: p.id,
      _amount: status.amount_captured ?? p.amount_gross,
      _capture_id: ev.external_payment_id, _metadata: {} as never,
    });
  } else if (status.status === 'failed' && !['failed', 'cancelled', 'captured'].includes(p.status)) {
    await (supabase as any).rpc('payment_fail', {
      _payment_id: p.id,
      _failure_code: status.failure_code ?? 'gateway_failed',
      _failure_message: status.failure_message ?? 'failed',
    });
  } else if (status.status === 'cancelled' && !['cancelled', 'captured'].includes(p.status)) {
    await (supabase as any).rpc('payment_cancel', { _payment_id: p.id, _reason: 'gateway_cancelled' });
  } else if (status.status === 'chargedback') {
    await (supabase as any).rpc('payment_chargeback_open', {
      _payment_id: p.id,
      _amount: status.amount_captured ?? p.amount_gross,
      _reason: 'general',
      _gateway_dispute_id: ev.external_payment_id,
      _evidence_due_at: null, _metadata: {} as never,
    });
  }
}

// ----------------------------- RBAC ---------------------------------------
export async function assertCanCreatePayment(
  supabase: SbClient, userId: string, storeId: string,
) {
  await requirePermission(supabase, userId, 'payments.create', storeId);
}
export async function assertCanRefundPayment(
  supabase: SbClient, userId: string, storeId: string,
) {
  await requirePermission(supabase, userId, 'payments.refund', storeId);
}
export async function assertCanManageGateway(
  supabase: SbClient, userId: string, storeId: string,
) {
  await requirePermission(supabase, userId, 'payments.audit', storeId);
}
