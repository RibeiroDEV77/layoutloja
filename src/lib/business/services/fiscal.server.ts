/**
 * FiscalService — orquestrador do Fiscal Engine.
 *
 * Princípios:
 *  - NÃO conhece nenhum provider diretamente. Toda resolução passa pelo
 *    FiscalProviderRegistry + Capability Discovery.
 *  - NÃO escreve estado por conta própria — todas as transições passam
 *    pelas RPCs SECURITY DEFINER (`fiscal_record_issuance`,
 *    `fiscal_update_status`, `fiscal_record_cancellation`,
 *    `fiscal_record_correction`).
 *  - Outbox: as RPCs já publicam `invoice.issued/authorized/cancelled/...`
 *    no Transactional Outbox; o service nunca duplica.
 *  - Webhooks NUNCA escrevem direto: rota pública -> `ingestProviderWebhook`
 *    -> adapter normaliza & valida assinatura -> RPC `fiscal_webhook_ingest`
 *    + `fiscal_update_status`.
 *  - Métricas: `fiscal.issue.request|success|error`, `fiscal.cancel.success`,
 *    `fiscal.webhook.received|processed`, `fiscal.provider.latency`.
 *
 * Integração com OMS:
 *  - O OrderService apenas chama `requestInvoice({ order_id, ... })`.
 *  - Toda a lógica fiscal (provider, documento, captura de erros) vive aqui.
 *  - Nenhum Aggregate existente do OMS é alterado.
 */
import type { SbClient } from '../events/dispatcher.server';
import { recordMetric } from '@/lib/foundations/observability.functions';
import { requirePermission } from './permissions.server';
import {
  buildAdapterContext,
  loadProviderCredentials,
  loadProviderWebhookSecret,
  resolveProviderById,
  resolveProviderForDocument,
  runAdapterOp,
  type ResolvedFiscalProvider,
} from './fiscal/provider-registry.server';
import type {
  FiscalAdapterWebhookEvent,
  FiscalDocumentType,
  FiscalIssueRequest,
} from './fiscal/adapter';

// ============================== RBAC ====================================
export async function assertCanIssueInvoice(supabase: SbClient, userId: string, storeId: string) {
  await requirePermission(supabase, userId, 'fiscal.issue', storeId);
}
export async function assertCanCancelInvoice(supabase: SbClient, userId: string, storeId: string) {
  await requirePermission(supabase, userId, 'fiscal.cancel', storeId);
}
export async function assertCanAuditFiscal(supabase: SbClient, userId: string, storeId: string) {
  await requirePermission(supabase, userId, 'fiscal.audit', storeId);
}

// ============================== Helpers =================================
function makeIdempotencyKey(parts: Array<string | undefined | null>) {
  return parts.filter(Boolean).join(':');
}

async function resolveProvider(
  supabase: SbClient, storeId: string, document: FiscalDocumentType,
  preferredProviderId?: string,
): Promise<ResolvedFiscalProvider> {
  const p = await resolveProviderForDocument(supabase, storeId, document, {
    preferredProviderId,
  });
  if (!p) throw new Error(`Nenhum provider fiscal ativo suporta '${document}' para esta loja.`);
  return p;
}

// ============================== Requests ================================
export interface RequestInvoiceInput {
  store_id: string;
  order_id?: string | null;
  document_type: FiscalDocumentType;
  payload: FiscalIssueRequest;        // já montado pelo caller (OMS)
  provider_id?: string;               // opcional: pin
  idempotency_key?: string;
}

/**
 * Solicita a emissão de uma nota fiscal. Cria o registro pendente via RPC
 * (Outbox emite `invoice.issued`), chama o adapter e em seguida transiciona
 * o status com `fiscal_update_status` (que publica
 * `invoice.authorized|denied|error` no Outbox).
 */
export async function requestInvoice(supabase: SbClient, input: RequestInvoiceInput) {
  const provider = await resolveProvider(
    supabase, input.store_id, input.document_type, input.provider_id,
  );
  const idemp = input.idempotency_key
    ?? makeIdempotencyKey(['fiscal', input.store_id, input.order_id ?? 'n/a', input.document_type, input.payload.reference ?? '']);

  // 1) registra emissão (pending) — RPC SECURITY DEFINER + Outbox
  const { data: invoiceId, error: insErr } = await (supabase as any).rpc('fiscal_record_issuance', {
    _store_id: input.store_id,
    _provider_id: provider.provider_id,
    _order_id: input.order_id ?? null,
    _document_type: input.document_type,
    _idempotency_key: idemp,
    _payload: input.payload as any,
  });
  if (insErr) throw new Error(`fiscal_record_issuance: ${insErr.message}`);

  // 2) chama adapter
  const creds = await loadProviderCredentials(provider.provider_id);
  const ctx = buildAdapterContext(provider, creds, { idempotencyKey: idemp });

  try {
    const result = await runAdapterOp(supabase, provider, 'issue', () =>
      provider.adapter.issueInvoice(ctx, { ...input.payload, invoice_id: invoiceId as string }),
    );

    // 3) transiciona status via RPC (Outbox publica invoice.authorized|denied|error)
    await (supabase as any).rpc('fiscal_update_status', {
      _invoice_id: invoiceId,
      _status: result.status,
      _patch: {
        series: result.series, number: result.number, access_key: result.access_key,
        external_id: result.external_id, protocol: result.protocol,
        issue_date: result.issue_date, total_amount: result.total_amount,
        rejection_code: result.rejection_code, rejection_reason: result.rejection_reason,
        xml_url: result.xml_url, danfe_url: result.danfe_url,
        metadata: { raw: result.raw ?? {} },
      },
      _message: result.rejection_reason ?? null,
    });

    return { invoice_id: invoiceId as string, status: result.status, external_id: result.external_id,
             access_key: result.access_key, protocol: result.protocol };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await (supabase as any).rpc('fiscal_update_status', {
      _invoice_id: invoiceId, _status: 'error',
      _patch: { rejection_reason: msg.slice(0, 500) }, _message: msg.slice(0, 500),
    });
    throw err;
  }
}

// ============================== Cancel ==================================
export async function cancelInvoice(
  supabase: SbClient,
  input: { invoice_id: string; reason: string },
) {
  const { data: inv, error } = await (supabase as any).from('fiscal_invoices')
    .select('id, store_id, provider_id, external_id, access_key, status')
    .eq('id', input.invoice_id).maybeSingle();
  if (error || !inv) throw new Error('Invoice não encontrada');

  const provider = await resolveProviderById(supabase, inv.provider_id);
  if (!provider) throw new Error('Provider fiscal não disponível');
  const creds = await loadProviderCredentials(provider.provider_id);
  const ctx = buildAdapterContext(provider, creds);

  const r = await runAdapterOp(supabase, provider, 'cancel', () =>
    provider.adapter.cancelInvoice(ctx, {
      external_id: inv.external_id, access_key: inv.access_key, reason: input.reason,
    }),
  );

  await (supabase as any).rpc('fiscal_record_cancellation', {
    _invoice_id: inv.id, _protocol: r.protocol ?? null, _reason: input.reason,
  });
  return { ok: true, protocol: r.protocol };
}

// ============================== Correction ==============================
export async function issueCorrectionLetter(
  supabase: SbClient,
  input: { invoice_id: string; text: string; sequence?: number },
) {
  const { data: inv } = await (supabase as any).from('fiscal_invoices')
    .select('id, store_id, provider_id, external_id, access_key').eq('id', input.invoice_id).maybeSingle();
  if (!inv) throw new Error('Invoice não encontrada');

  const provider = await resolveProviderById(supabase, inv.provider_id);
  if (!provider) throw new Error('Provider fiscal não disponível');
  const creds = await loadProviderCredentials(provider.provider_id);
  const ctx = buildAdapterContext(provider, creds);

  const r = await runAdapterOp(supabase, provider, 'correction', () =>
    provider.adapter.issueCorrectionLetter(ctx, {
      external_id: inv.external_id, access_key: inv.access_key,
      text: input.text, sequence: input.sequence,
    }),
  );
  await (supabase as any).rpc('fiscal_record_correction', {
    _invoice_id: inv.id, _text: input.text, _protocol: r.protocol ?? null,
  });
  return { ok: true, protocol: r.protocol };
}

// ============================== Consult & Download ======================
export async function consultInvoice(supabase: SbClient, invoiceId: string) {
  const { data: inv } = await (supabase as any).from('fiscal_invoices')
    .select('id, provider_id, external_id, access_key').eq('id', invoiceId).maybeSingle();
  if (!inv) throw new Error('Invoice não encontrada');
  const provider = await resolveProviderById(supabase, inv.provider_id);
  if (!provider) throw new Error('Provider fiscal não disponível');
  const creds = await loadProviderCredentials(provider.provider_id);
  const ctx = buildAdapterContext(provider, creds);
  const r = await runAdapterOp(supabase, provider, 'consult', () =>
    provider.adapter.consultInvoice(ctx, inv.external_id ?? inv.access_key),
  );
  // sincroniza estado local
  await (supabase as any).rpc('fiscal_update_status', {
    _invoice_id: inv.id, _status: r.status,
    _patch: {
      access_key: r.access_key, protocol: r.protocol, number: r.number, series: r.series,
      issue_date: r.issue_date, total_amount: r.total_amount,
      xml_url: r.xml_url, danfe_url: r.danfe_url,
      rejection_code: r.rejection_code, rejection_reason: r.rejection_reason,
    },
    _message: 'consultation',
  });
  return r;
}

export async function downloadXML(supabase: SbClient, invoiceId: string) {
  const { data: inv } = await (supabase as any).from('fiscal_invoices')
    .select('provider_id, external_id, access_key').eq('id', invoiceId).maybeSingle();
  if (!inv) throw new Error('Invoice não encontrada');
  const provider = await resolveProviderById(supabase, inv.provider_id);
  if (!provider) throw new Error('Provider fiscal não disponível');
  const creds = await loadProviderCredentials(provider.provider_id);
  const ctx = buildAdapterContext(provider, creds);
  return runAdapterOp(supabase, provider, 'download_xml', () =>
    provider.adapter.downloadXML(ctx, inv.external_id ?? inv.access_key),
  );
}

export async function downloadDANFE(supabase: SbClient, invoiceId: string) {
  const { data: inv } = await (supabase as any).from('fiscal_invoices')
    .select('provider_id, external_id, access_key').eq('id', invoiceId).maybeSingle();
  if (!inv) throw new Error('Invoice não encontrada');
  const provider = await resolveProviderById(supabase, inv.provider_id);
  if (!provider) throw new Error('Provider fiscal não disponível');
  const creds = await loadProviderCredentials(provider.provider_id);
  const ctx = buildAdapterContext(provider, creds);
  return runAdapterOp(supabase, provider, 'download_danfe', () =>
    provider.adapter.downloadDANFE(ctx, inv.external_id ?? inv.access_key),
  );
}

// ============================== Test Connection =========================
export async function testProviderConnection(supabase: SbClient, providerId: string) {
  const provider = await resolveProviderById(supabase, providerId);
  if (!provider) throw new Error('Provider não encontrado');
  const creds = await loadProviderCredentials(provider.provider_id);
  const ctx = buildAdapterContext(provider, creds);
  const r = await runAdapterOp(supabase, provider, 'test', () =>
    provider.adapter.testConnection(ctx),
  );
  await (supabase as any).from('fiscal_providers').update({
    last_test_at: new Date().toISOString(),
    last_test_ok: r.ok,
    last_test_error: r.ok ? null : r.error,
  }).eq('id', provider.provider_id);
  return r;
}

// ============================== Webhook =================================
export interface FiscalWebhookIngressInput {
  provider_code: string;
  rawBody: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  source_ip?: string;
}

/**
 * Ponto único de entrada para webhooks fiscais. A rota pública NUNCA
 * escreve no banco — apenas chama esta função, que:
 *   1) tenta inferir o provider_id (por query/header)
 *   2) usa o adapter para validar assinatura + normalizar eventos
 *   3) chama RPC `fiscal_webhook_ingest` (inbox imutável, idempotente)
 *   4) para cada evento normalizado, chama RPC `fiscal_update_status`
 *      (que publica `invoice.authorized|cancelled|...` no Outbox)
 */
export async function ingestProviderWebhook(
  supabase: SbClient, input: FiscalWebhookIngressInput,
) {
  await recordMetric(supabase, {
    scope: 'fiscal', name: 'fiscal.webhook.received', value: 1,
    tags: { provider: input.provider_code },
  });

  // 1) descobrir provider (header opcional / query) — fallback: 1º provider ativo do code.
  let providerId: string | null = input.query.provider_id ?? input.headers['x-provider-id'] ?? null;
  if (!providerId) {
    const { data: rows } = await (supabase as any).from('fiscal_providers')
      .select('id').eq('adapter', input.provider_code).eq('is_active', true)
      .order('priority', { ascending: true }).limit(1);
    providerId = rows?.[0]?.id ?? null;
  }
  if (!providerId) throw new Error(`Provider '${input.provider_code}' não configurado`);

  const provider = await resolveProviderById(supabase, providerId);
  if (!provider) throw new Error(`Provider id ${providerId} não disponível`);
  const secret = await loadProviderWebhookSecret(providerId);
  const ctx = buildAdapterContext(provider, await loadProviderCredentials(providerId));

  // 2) processa via adapter (sem tocar DB)
  const parsed = await runAdapterOp(supabase, provider, 'webhook', () =>
    provider.adapter.processWebhook(ctx, {
      rawBody: input.rawBody, headers: input.headers, query: input.query, webhookSecret: secret,
    }),
  );

  // 3) inbox + transições
  let processed = 0;
  for (const ev of parsed.events) {
    const { data: inboxId } = await (supabase as any).rpc('fiscal_webhook_ingest', {
      _provider_code: input.provider_code,
      _provider_id: providerId,
      _external_event_id: ev.external_event_id,
      _event_type: ev.event_type,
      _signature_header: input.headers['x-nuvemfiscal-signature'] ?? input.headers['x-signature'] ?? null,
      _signature_valid: parsed.signature_valid,
      _headers: input.headers as any,
      _body: input.rawBody,
    });

    if (parsed.signature_valid === false) continue;

    try {
      await applyWebhookEvent(supabase, providerId, ev);
      await (supabase as any).rpc('fiscal_webhook_mark_processed', {
        _inbox_id: inboxId, _ok: true, _error: null,
      });
      processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await (supabase as any).rpc('fiscal_webhook_mark_processed', {
        _inbox_id: inboxId, _ok: false, _error: msg.slice(0, 500),
      });
    }
  }

  await recordMetric(supabase, {
    scope: 'fiscal', name: 'fiscal.webhook.processed', value: processed,
    tags: { provider: input.provider_code },
  });
  return { received: parsed.events.length, processed, signature_valid: parsed.signature_valid };
}

async function applyWebhookEvent(
  supabase: SbClient, providerId: string, ev: FiscalAdapterWebhookEvent,
) {
  // descobre invoice local por external_id ou access_key
  const ext = ev.external_invoice_id ?? null;
  const key = ev.access_key ?? null;
  if (!ext && !key) return;

  let query = (supabase as any).from('fiscal_invoices').select('id, store_id').eq('provider_id', providerId);
  if (ext) query = query.eq('external_id', ext);
  else if (key) query = query.eq('access_key', key);
  const { data: inv } = await query.maybeSingle();
  if (!inv) return; // ignora se desconhecido — pode ser nota emitida fora do sistema

  if (!ev.status) return;
  await (supabase as any).rpc('fiscal_update_status', {
    _invoice_id: inv.id,
    _status: ev.status,
    _patch: { protocol: ev.protocol ?? null, access_key: ev.access_key ?? null, metadata: { webhook: ev.raw } },
    _message: ev.event_type,
  });
}

// ============================== Reads (Admin) ===========================
import { requireStoreAccess } from './permissions.server';

export interface InvoiceListFilters {
  store_id: string;
  q?: string;
  status?: string[];
  document_type?: string[];
  environment?: 'sandbox' | 'production';
  provider_id?: string;
  page?: number;
  pageSize?: number;
}

export async function listInvoices(supabase: SbClient, userId: string, f: InvoiceListFilters) {
  if (!f.store_id) throw new Error('store_id obrigatório');
  await requireStoreAccess(supabase, userId, f.store_id);
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, f.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = (supabase as any)
    .from('fiscal_invoices')
    .select('*, fiscal_providers(display_name, adapter, environment)', { count: 'exact' })
    .eq('store_id', f.store_id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (f.q) q = q.or(`number.ilike.%${f.q}%,access_key.ilike.%${f.q}%,external_id.ilike.%${f.q}%`);
  if (f.status?.length) q = q.in('status', f.status);
  if (f.document_type?.length) q = q.in('document_type', f.document_type);
  if (f.provider_id) q = q.eq('provider_id', f.provider_id);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as any[];
  if (f.environment) rows = rows.filter((r) => r.fiscal_providers?.environment === f.environment);

  return {
    rows: rows.map((r) => ({
      ...r,
      provider_name: r.fiscal_providers?.display_name ?? null,
      provider_adapter: r.fiscal_providers?.adapter ?? null,
      provider_environment: r.fiscal_providers?.environment ?? null,
    })),
    total: count ?? rows.length,
    page,
    pageSize,
  };
}

export async function getInvoice(supabase: SbClient, userId: string, id: string) {
  const { data: inv, error } = await (supabase as any)
    .from('fiscal_invoices')
    .select('*, fiscal_providers(display_name, adapter, environment)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!inv) throw new Error('Nota fiscal não encontrada');
  await requireStoreAccess(supabase, userId, inv.store_id);
  return inv;
}

export async function getInvoiceTimeline(supabase: SbClient, userId: string, id: string) {
  const inv = await getInvoice(supabase, userId, id);
  const { data, error } = await (supabase as any)
    .from('fiscal_invoice_events')
    .select('id, event_type, status, message, payload, created_at')
    .eq('invoice_id', inv.id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getInvoiceAudit(supabase: SbClient, userId: string, id: string) {
  const inv = await getInvoice(supabase, userId, id);
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, actor_user_id, action, diff, created_at')
    .eq('entity_type', 'fiscal_invoice')
    .eq('entity_id', inv.id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}
