/**
 * Server Functions do Fiscal Engine (camada client-safe).
 * Tudo orquestrado via FiscalProviderRegistry — nenhuma referência direta
 * a NuvemFiscal (ou qualquer outro provider).
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import * as Svc from './services/fiscal.server';
import type { FiscalDocumentType, FiscalIssueRequest } from './services/fiscal/adapter';
import { listFiscalProviderDescriptors, capabilityMatrix } from './services/fiscal/registry.server';

function toJSON<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T; }

// ============ Catálogo / Capabilities ===================================
export const listFiscalProviders = createServerFn({ method: 'GET' })
  .handler(async () => toJSON(listFiscalProviderDescriptors()));

export const fiscalCapabilityMatrix = createServerFn({ method: 'GET' })
  .handler(async () => toJSON(capabilityMatrix()));

// ============ Emissão ===================================================
interface RequestInvoiceInput {
  store_id: string;
  order_id?: string | null;
  document_type: FiscalDocumentType;
  provider_id?: string;
  idempotency_key?: string;
  payload: FiscalIssueRequest;
}

export const requestInvoice = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: RequestInvoiceInput) => d)
  .handler(async ({ data, context }) => {
    await Svc.assertCanIssueInvoice(context.supabase, context.userId, data.store_id);
    return toJSON(await Svc.requestInvoice(context.supabase, data));
  });

// ============ Cancelamento / Correção ===================================
export const cancelInvoice = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { invoice_id: string; reason: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: inv } = await context.supabase.from('fiscal_invoices' as never)
      .select('store_id').eq('id' as never, data.invoice_id).maybeSingle();
    if (!inv) throw new Error('Invoice não encontrada');
    await Svc.assertCanCancelInvoice(context.supabase, context.userId, (inv as any).store_id);
    return toJSON(await Svc.cancelInvoice(context.supabase, data));
  });

export const issueCorrectionLetter = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { invoice_id: string; text: string; sequence?: number }) => d)
  .handler(async ({ data, context }) => {
    const { data: inv } = await context.supabase.from('fiscal_invoices' as never)
      .select('store_id').eq('id' as never, data.invoice_id).maybeSingle();
    if (!inv) throw new Error('Invoice não encontrada');
    await Svc.assertCanCancelInvoice(context.supabase, context.userId, (inv as any).store_id);
    return toJSON(await Svc.issueCorrectionLetter(context.supabase, data));
  });

// ============ Consulta / Downloads ======================================
export const consultInvoice = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { invoice_id: string }) => d)
  .handler(async ({ data, context }) =>
    toJSON(await Svc.consultInvoice(context.supabase, data.invoice_id)),
  );

export const downloadInvoiceXML = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { invoice_id: string }) => d)
  .handler(async ({ data, context }) =>
    toJSON(await Svc.downloadXML(context.supabase, data.invoice_id)),
  );

export const downloadInvoiceDANFE = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { invoice_id: string }) => d)
  .handler(async ({ data, context }) =>
    toJSON(await Svc.downloadDANFE(context.supabase, data.invoice_id)),
  );

// ============ Provider config / testConnection ==========================
export const testFiscalProvider = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { provider_id: string; store_id: string }) => d)
  .handler(async ({ data, context }) => {
    await Svc.assertCanAuditFiscal(context.supabase, context.userId, data.store_id);
    return toJSON(await Svc.testProviderConnection(context.supabase, data.provider_id));
  });

export const setFiscalProviderCredentials = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { provider_id: string; store_id: string; credentials: Record<string, unknown> }) => d)
  .handler(async ({ data, context }) => {
    await Svc.assertCanAuditFiscal(context.supabase, context.userId, data.store_id);
    const { error } = await (context.supabase as any).rpc('fiscal_set_credentials', {
      _provider_id: data.provider_id, _creds: data.credentials,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setFiscalWebhookSecret = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { provider_id: string; store_id: string; secret: string }) => d)
  .handler(async ({ data, context }) => {
    await Svc.assertCanAuditFiscal(context.supabase, context.userId, data.store_id);
    const { error } = await (context.supabase as any).rpc('fiscal_set_webhook_secret', {
      _provider_id: data.provider_id, _secret: data.secret,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
