/**
 * NuvemFiscalAdapter — primeiro provider do Fiscal Engine.
 *
 * Stateless: recebe credenciais (client_id + client_secret OAuth2) e fala
 * com a API da Nuvem Fiscal (https://dev.nuvemfiscal.com.br/).
 *
 * Capabilities suportadas nesta etapa:
 *   - NFe, NFC-e
 *   - cancel, correctionLetter (CC-e)
 *   - consultation, downloadXml, downloadDanfe
 *   - sandbox
 *
 * Webhook: a Nuvem Fiscal entrega via HTTP POST com header `X-NuvemFiscal-Signature`
 * (HMAC-SHA256 sobre o corpo bruto). O adapter normaliza e valida; quem
 * persiste é o FiscalService via RPC SECURITY DEFINER.
 *
 * Docs: https://dev.nuvemfiscal.com.br/docs/api/
 */
import { createHmac, timingSafeEqual } from 'crypto';
import type {
  FiscalAdapter,
  FiscalAdapterContext,
  FiscalAdapterTestResult,
  FiscalAdapterWebhookEvent,
  FiscalAdapterWebhookInput,
  FiscalAdapterWebhookParseResult,
  FiscalCancelRequest,
  FiscalCancelResult,
  FiscalCapabilities,
  FiscalConsultResult,
  FiscalCorrectionRequest,
  FiscalCorrectionResult,
  FiscalCredentialFieldDef,
  FiscalDownloadResult,
  FiscalIssueRequest,
  FiscalIssueResult,
  FiscalAdapterStatus,
} from '../adapter';

const PROD_BASE = 'https://api.nuvemfiscal.com.br';
const SANDBOX_BASE = 'https://api.sandbox.nuvemfiscal.com.br';

interface Creds {
  client_id: string;
  client_secret: string;
  /** Token cache TTL (não persistido; renovado por chamada quando ausente). */
  access_token?: string;
}

function base(ctx: FiscalAdapterContext): string {
  return ctx.provider.environment === 'sandbox' ? SANDBOX_BASE : PROD_BASE;
}

async function getAccessToken(ctx: FiscalAdapterContext): Promise<string> {
  const c = (ctx.credentials ?? {}) as unknown as Creds;
  if (c.access_token) return c.access_token;
  if (!c.client_id || !c.client_secret) {
    throw new Error('NuvemFiscal: client_id/client_secret ausentes');
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: c.client_id,
    client_secret: c.client_secret,
    scope: 'nfe nfce cep empresa',
  });
  const r = await fetch(`${base(ctx)}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) throw new Error(`NuvemFiscal oauth ${r.status}: ${await r.text()}`);
  const j = (await r.json()) as { access_token?: string };
  if (!j.access_token) throw new Error('NuvemFiscal: access_token ausente');
  return j.access_token;
}

async function nf<T = any>(
  ctx: FiscalAdapterContext, method: string, path: string, body?: unknown,
): Promise<T> {
  const token = await getAccessToken(ctx);
  const r = await fetch(`${base(ctx)}${path}`, {
    method,
    headers: {
      'authorization': `Bearer ${token}`,
      'content-type': 'application/json',
      ...(ctx.idempotencyKey ? { 'idempotency-key': ctx.idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`NuvemFiscal ${method} ${path} ${r.status}: ${text.slice(0, 400)}`);
  return (text ? JSON.parse(text) : ({} as T));
}

function mapStatus(s?: string): FiscalAdapterStatus {
  switch ((s ?? '').toLowerCase()) {
    case 'autorizado': case 'authorized': case 'aprovado':
      return 'authorized';
    case 'denegado':   case 'denied':
      return 'denied';
    case 'cancelado':  case 'cancelled':
      return 'cancelled';
    case 'rejeitado':  case 'rejected': case 'erro': case 'error':
      return 'error';
    case 'pendente':   case 'pending': case 'em_processamento': case 'processing':
      return 'processing';
    default:
      return 'pending';
  }
}

// ----------------------------- Mapping NFe ------------------------------
function toNfePayload(req: FiscalIssueRequest) {
  return {
    infNFe: {
      versao: '4.00',
      ide: {
        natOp: req.operation_nature,
        serie: Number(req.series ?? 1),
        nNF: req.number ? Number(req.number) : undefined,
        mod: req.document_type === 'nfce' ? 65 : 55,
        tpAmb: 2, // ambiente é controlado por base url; mantido por compat
      },
      emit: {
        CNPJ: req.issuer.cnpj,
        xNome: req.issuer.legal_name,
        xFant: req.issuer.trade_name,
        IE: req.issuer.ie,
        CRT: req.issuer.crt ?? 3,
        enderEmit: addr(req.issuer.address),
      },
      dest: {
        [req.recipient.document_type === 'CNPJ' ? 'CNPJ' : 'CPF']: req.recipient.document,
        xNome: req.recipient.name,
        email: req.recipient.email,
        IE: req.recipient.ie,
        enderDest: addr(req.recipient.address),
      },
      det: req.items.map((it, i) => ({
        nItem: i + 1,
        prod: {
          cProd: it.code, xProd: it.description, NCM: it.ncm, CFOP: it.cfop,
          uCom: it.unit, qCom: it.quantity, vUnCom: it.unit_price, vProd: it.total,
          uTrib: it.unit, qTrib: it.quantity, vUnTrib: it.unit_price,
          CEST: it.cest, cEAN: it.ean ?? 'SEM GTIN', cEANTrib: it.ean ?? 'SEM GTIN',
          indTot: 1,
        },
        imposto: {
          ICMS: it.icms ?? { ICMS00: { orig: it.origin ?? 0, CST: '00', vBC: 0, pICMS: 0, vICMS: 0 } },
          PIS:  it.pis  ?? { PISNT: { CST: '07' } },
          COFINS: it.cofins ?? { COFINSNT: { CST: '07' } },
        },
      })),
      total: {
        ICMSTot: {
          vNF: req.totals.total, vProd: req.totals.products,
          vFrete: req.totals.freight ?? 0, vSeg: req.totals.insurance ?? 0,
          vDesc: req.totals.discount ?? 0, vOutro: req.totals.other ?? 0,
        },
      },
      pag: {
        detPag: (req.payments ?? [{ method: '99', amount: req.totals.total }]).map((p) => ({
          tPag: p.method, vPag: p.amount, ...(p.installments ? { card: { tpIntegra: 2 } } : {}),
        })),
      },
      infAdic: req.additional_info ? { infCpl: req.additional_info } : undefined,
    },
  };
}
function addr(a: FiscalIssueRequest['issuer']['address']) {
  return {
    xLgr: a.street, nro: a.number, xCpl: a.complement,
    xBairro: a.district, xMun: a.city, cMun: a.city_code,
    UF: a.state, CEP: a.zip.replace(/\D/g, ''),
    cPais: '1058', xPais: a.country ?? 'BRASIL',
  };
}

// =========================================================================
const CAPS: FiscalCapabilities = {
  nfe: true, nfce: true, nfse: false, cte: false,
  cancel: true, correctionLetter: true, inutilization: true,
  downloadXml: true, downloadDanfe: true, consultation: true,
  sandbox: true,
};

const CRED_SCHEMA: FiscalCredentialFieldDef[] = [
  { key: 'client_id',     label: 'Client ID',     type: 'text',     required: true },
  { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
];

const CFG_SCHEMA: FiscalCredentialFieldDef[] = [
  { key: 'cnpj_emitente', label: 'CNPJ Emitente (default)', type: 'text', helper: 'Apenas dígitos' },
  { key: 'serie_default', label: 'Série padrão', type: 'number' },
];

export const nuvemFiscalAdapter: FiscalAdapter = {
  code: 'nuvem_fiscal',
  displayName: 'Nuvem Fiscal',
  capabilities: CAPS,
  credentialSchema: CRED_SCHEMA,
  configSchema: CFG_SCHEMA,

  async testConnection(ctx): Promise<FiscalAdapterTestResult> {
    try {
      const token = await getAccessToken(ctx);
      return { ok: true, details: { token_prefix: token.slice(0, 6) } };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },

  async issueInvoice(ctx, req): Promise<FiscalIssueResult> {
    const path = req.document_type === 'nfce' ? '/nfce' : '/nfe';
    const payload = {
      ambiente: ctx.provider.environment === 'sandbox' ? 'homologacao' : 'producao',
      referencia: req.reference ?? req.invoice_id,
      ...toNfePayload(req),
    };
    const r = await nf<any>(ctx, 'POST', path, payload);
    return {
      status: mapStatus(r.status),
      external_id: String(r.id ?? r.referencia ?? req.invoice_id),
      series: r.serie?.toString(),
      number: r.numero?.toString(),
      access_key: r.chave,
      protocol: r.protocolo ?? r.numero_protocolo,
      issue_date: r.data_emissao,
      total_amount: r.valor_total,
      xml_url: r.xml_url ?? r.url_xml,
      danfe_url: r.danfe_url ?? r.url_danfe,
      rejection_code: r.motivo_status,
      rejection_reason: r.mensagem_sefaz,
      raw: r,
    };
  },

  async cancelInvoice(ctx, req): Promise<FiscalCancelResult> {
    const path = `/nfe/${encodeURIComponent(req.external_id)}/cancelamento`;
    const r = await nf<any>(ctx, 'POST', path, { justificativa: req.reason });
    return { status: mapStatus(r.status), protocol: r.protocolo ?? r.numero_protocolo, raw: r };
  },

  async issueCorrectionLetter(ctx, req): Promise<FiscalCorrectionResult> {
    const path = `/nfe/${encodeURIComponent(req.external_id)}/carta-correcao`;
    const r = await nf<any>(ctx, 'POST', path, {
      correcao: req.text, sequencia: req.sequence ?? 1,
    });
    return { status: 'corrected', protocol: r.protocolo ?? r.numero_protocolo, raw: r };
  },

  async consultInvoice(ctx, externalIdOrKey): Promise<FiscalConsultResult> {
    const r = await nf<any>(ctx, 'GET', `/nfe/${encodeURIComponent(externalIdOrKey)}`);
    return {
      status: mapStatus(r.status),
      external_id: String(r.id ?? externalIdOrKey),
      access_key: r.chave,
      protocol: r.protocolo,
      number: r.numero?.toString(),
      series: r.serie?.toString(),
      issue_date: r.data_emissao,
      total_amount: r.valor_total,
      xml_url: r.xml_url ?? r.url_xml,
      danfe_url: r.danfe_url ?? r.url_danfe,
      rejection_code: r.motivo_status,
      rejection_reason: r.mensagem_sefaz,
      raw: r,
    };
  },

  async downloadXML(ctx, externalIdOrKey): Promise<FiscalDownloadResult> {
    const token = await getAccessToken(ctx);
    const r = await fetch(`${base(ctx)}/nfe/${encodeURIComponent(externalIdOrKey)}/xml`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error(`NuvemFiscal XML ${r.status}: ${await r.text()}`);
    const buf = Buffer.from(await r.arrayBuffer());
    return { content_base64: buf.toString('base64'), mime_type: 'application/xml',
             filename: `${externalIdOrKey}.xml` };
  },

  async downloadDANFE(ctx, externalIdOrKey): Promise<FiscalDownloadResult> {
    const token = await getAccessToken(ctx);
    const r = await fetch(`${base(ctx)}/nfe/${encodeURIComponent(externalIdOrKey)}/pdf`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error(`NuvemFiscal DANFE ${r.status}: ${await r.text()}`);
    const buf = Buffer.from(await r.arrayBuffer());
    return { content_base64: buf.toString('base64'), mime_type: 'application/pdf',
             filename: `${externalIdOrKey}.pdf` };
  },

  async processWebhook(_ctx, input: FiscalAdapterWebhookInput): Promise<FiscalAdapterWebhookParseResult> {
    // Validação de assinatura HMAC-SHA256 (X-NuvemFiscal-Signature: sha256=<hex>).
    let signatureValid: boolean | null = null;
    const header = input.headers['x-nuvemfiscal-signature'] ?? input.headers['x-signature'];
    if (input.webhookSecret && header) {
      const provided = header.replace(/^sha256=/, '').trim();
      const expected = createHmac('sha256', input.webhookSecret).update(input.rawBody).digest('hex');
      try {
        signatureValid = provided.length === expected.length
          && timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
      } catch { signatureValid = false; }
    } else if (input.webhookSecret) {
      signatureValid = false;
    }

    let body: any = {};
    try { body = JSON.parse(input.rawBody || '{}'); } catch { /* keep empty */ }
    const events: FiscalAdapterWebhookEvent[] = [];
    const list = Array.isArray(body?.eventos) ? body.eventos : [body];
    for (const ev of list) {
      const evtType = ev?.tipo ?? ev?.event ?? 'unknown';
      const status = mapStatus(ev?.status);
      const kind: FiscalAdapterWebhookEvent['kind'] =
        status === 'authorized' ? 'invoice.authorized' :
        status === 'denied'     ? 'invoice.denied' :
        status === 'cancelled'  ? 'invoice.cancelled' :
        status === 'corrected'  ? 'invoice.corrected' :
        status === 'error'      ? 'invoice.error' :
        'invoice.unknown';
      events.push({
        external_event_id: String(ev?.id ?? ev?.evento_id ?? `${evtType}:${ev?.referencia ?? ev?.chave ?? Date.now()}`),
        event_type: String(evtType),
        kind,
        external_invoice_id: ev?.documento_id ?? ev?.id ?? ev?.referencia,
        access_key: ev?.chave,
        status,
        protocol: ev?.protocolo,
        occurred_at: ev?.data ?? ev?.created_at,
        raw: ev ?? {},
      });
    }
    return { signature_valid: signatureValid, events };
  },
};
