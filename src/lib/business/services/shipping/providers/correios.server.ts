/**
 * Correios Adapter — quote real via CWS (Calculador Web Services).
 *
 * Fluxo:
 *  1. Autentica com Basic auth (idCorreios:access_code) em /token/v1/autentica/cartaopostagem
 *     (quando há cartão de postagem) ou /token/v1/autentica (token "público" para preços).
 *  2. Consulta /preco/v2/nacional com bearer token, body { idLote, parametrosProduto: [...] }.
 *
 * Hosts: sandbox = https://apihom.correios.com.br | produção = https://api.correios.com.br
 *
 * Não implementa label/tracking nesta fase.
 */
import type {
  ShippingAdapter,
  AdapterContext,
  AdapterTestResult,
  AdapterQuoteRequest,
  AdapterQuoteOption,
  CredentialFieldDef,
} from '../adapter';
import { AdapterCapabilityError, AdapterNotConfiguredError } from '../adapter';

const CREDENTIAL_SCHEMA: CredentialFieldDef[] = [
  { key: 'user', label: 'Usuário API Correios', type: 'text', required: true,
    helper: 'Identificador fornecido pelos Correios (idCorreios).' },
  { key: 'access_code', label: 'Código de acesso', type: 'password', required: true,
    helper: 'Senha/Access Code emitido no portal Meu Correios.' },
  { key: 'postcard', label: 'Cartão de postagem', type: 'text', required: false,
    helper: 'Número do cartão de postagem (obrigatório para emissão de etiquetas).' },
];

const CONFIG_SCHEMA: CredentialFieldDef[] = [
  { key: 'contract', label: 'Número do contrato', type: 'text', required: false },
  { key: 'origin_postal_code', label: 'CEP de origem padrão', type: 'text', required: true,
    helper: 'Usado quando o pedido não define um CEP de origem específico.' },
  { key: 'default_services', label: 'Serviços habilitados (CSV)', type: 'text', required: false,
    helper: 'Códigos como 04014 (SEDEX), 04510 (PAC). Vazio = todos os habilitados.' },
];

const DEFAULT_SERVICES = ['04014', '04510']; // SEDEX, PAC

const SERVICE_NAMES: Record<string, string> = {
  '04014': 'SEDEX',
  '04510': 'PAC',
  '04162': 'SEDEX (contrato)',
  '04669': 'PAC (contrato)',
  '03220': 'SEDEX 10',
  '03204': 'Mini Envios',
};

function host(sandbox: boolean) {
  return sandbox ? 'https://apihom.correios.com.br' : 'https://api.correios.com.br';
}

function digits(s: string) { return (s ?? '').replace(/\D/g, ''); }

function assertCredentials(ctx: AdapterContext): asserts ctx is AdapterContext & { credentials: Record<string, unknown> } {
  const creds = ctx.credentials;
  if (!creds) throw new AdapterNotConfiguredError('correios');
  for (const f of CREDENTIAL_SCHEMA) {
    if (f.required && !creds[f.key]) throw new AdapterNotConfiguredError('correios');
  }
}

interface TokenCacheEntry { token: string; exp: number }
const tokenCache = new Map<string, TokenCacheEntry>();

async function fetchJson(url: string, init: RequestInit & { timeoutMs?: number }) {
  const ctrl = AbortSignal.timeout(init.timeoutMs ?? 10_000);
  const res = await fetch(url, { ...init, signal: ctrl });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = typeof body === 'object' && body !== null && 'msgs' in body
      ? JSON.stringify((body as Record<string, unknown>).msgs)
      : typeof body === 'string' ? body : `HTTP ${res.status}`;
    throw new Error(`Correios ${url} ${res.status}: ${msg}`);
  }
  return body as Record<string, unknown>;
}

async function authenticate(ctx: AdapterContext): Promise<string> {
  assertCredentials(ctx);
  const user = String(ctx.credentials.user);
  const code = String(ctx.credentials.access_code);
  const cacheKey = `${ctx.account.id}:${ctx.account.sandbox ? 'h' : 'p'}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.exp - 60_000 > Date.now()) return cached.token;

  const basic = btoa(`${user}:${code}`);
  const body = await fetchJson(`${host(ctx.account.sandbox)}/token/v1/autentica`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic}`,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: '{}',
  });
  const token = String(body.token ?? '');
  const expira = body.expiraEm ? Date.parse(String(body.expiraEm)) : Date.now() + 30 * 60_000;
  if (!token) throw new Error('Correios: token vazio na autenticação');
  tokenCache.set(cacheKey, { token, exp: expira });
  return token;
}

function resolveServices(ctx: AdapterContext, req: AdapterQuoteRequest): string[] {
  if (req.service_codes && req.service_codes.length) return req.service_codes;
  const cfg = ctx.account.config?.default_services;
  if (typeof cfg === 'string' && cfg.trim()) {
    return cfg.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return DEFAULT_SERVICES;
}

interface PrecoItem {
  coProduto?: string;
  pcFinal?: string | number;
  pcBase?: string | number;
  prazoEntrega?: string | number;
  txErro?: string;
  msgErro?: string;
}

/**
 * Mapeia o "tipo" do evento do SRO Rastro para o enum
 * `tracking_event_kind` que o módulo Fulfillment utiliza.
 * Referência: https://cws.correios.com.br/ (SRO Rastro v1).
 */
function mapCorreiosEventKind(tipo: string, status: string, descricao: string): string {
  const t = (tipo || '').toUpperCase();
  const s = String(status ?? '');
  const d = (descricao || '').toLowerCase();
  // Entrega efetuada
  if (['BDE', 'BDI', 'BDR'].includes(t)) return 'delivered';
  // Saiu para entrega
  if (t === 'OEC') return 'out_for_delivery';
  // Tentativa de entrega
  if (['LDE', 'LDI', 'TRI', 'EST'].includes(t)) return 'delivery_attempted';
  // Devolução
  if (t === 'RDV' || d.includes('devolvido')) return 'returned';
  // Extravio/objeto perdido
  if (t === 'PAR' || d.includes('extravio')) return 'lost';
  // Restrição / exceção
  if (['IDC', 'FC', 'AL', 'IE'].includes(t)) return 'exception';
  // Postagem
  if (t === 'PO' && s === '01') return 'pickup_scheduled';
  if (t === 'PO') return 'picked_up';
  // Encaminhamento / trânsito
  if (['RO', 'DO', 'TRI', 'PMT'].includes(t)) return 'in_transit';
  return 'in_transit';
}

interface SroEvento {
  codigo?: string;
  tipo?: string;
  descricao?: string;
  dtHrCriado?: string;
  unidade?: { endereco?: { cidade?: string; uf?: string }; tipo?: string };
}
interface SroObjeto {
  codObjeto?: string;
  mensagem?: string;
  eventos?: SroEvento[];
}

export const correiosAdapter: ShippingAdapter = {
  code: 'correios',
  displayName: 'Correios',
  capabilities: { quote: true, label: false, tracking: true, sandbox: true },
  credentialSchema: CREDENTIAL_SCHEMA,
  configSchema: CONFIG_SCHEMA,

  async testConnection(ctx: AdapterContext): Promise<AdapterTestResult> {
    try {
      assertCredentials(ctx);
      const token = await authenticate(ctx);
      return {
        ok: true,
        details: {
          environment: ctx.account.sandbox ? 'sandbox' : 'production',
          token_prefix: token.slice(0, 10) + '…',
        },
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async quote(ctx, req): Promise<AdapterQuoteOption[]> {
    assertCredentials(ctx);
    const services = resolveServices(ctx, req);
    const origin = digits(req.origin_postal_code);
    const dest = digits(req.destination_postal_code);
    if (origin.length !== 8 || dest.length !== 8) {
      throw new Error('CEP de origem/destino inválido');
    }
    const token = await authenticate(ctx);
    const dim = req.dimensions_cm ?? { length: 20, width: 15, height: 5 };

    const parametros = services.map((co, idx) => ({
      coProduto: co,
      nuRequisicao: String(idx + 1),
      cepOrigem: origin,
      cepDestino: dest,
      psObjeto: String(Math.max(1, Math.round(req.weight_g))), // gramas
      tpObjeto: '2',           // 2 = caixa/pacote
      comprimento: String(dim.length),
      largura:     String(dim.width),
      altura:      String(dim.height),
      vlDeclarado: req.declared_value != null ? String(req.declared_value) : undefined,
    }));

    const body = await fetchJson(`${host(ctx.account.sandbox)}/preco/v2/nacional`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        idLote: '1',
        parametrosProduto: parametros,
      }),
    });

    const items = Array.isArray(body) ? (body as PrecoItem[]) : ((body as { precos?: PrecoItem[] }).precos ?? []);
    const results: AdapterQuoteOption[] = [];
    for (const it of items) {
      if (it.txErro && it.txErro !== '0') continue;
      const code = String(it.coProduto ?? '');
      const price = Number(it.pcFinal ?? it.pcBase ?? 0);
      const days = it.prazoEntrega != null ? Number(it.prazoEntrega) : null;
      if (!code || !Number.isFinite(price) || price <= 0) continue;
      results.push({
        service_code: code,
        service_name: SERVICE_NAMES[code] ?? `Correios ${code}`,
        price,
        currency: 'BRL',
        estimated_days_min: days,
        estimated_days_max: days,
        raw: it as unknown as Record<string, unknown>,
      });
    }
    return results;
  },

  async createLabel(_ctx, _req) {
    throw new AdapterCapabilityError('correios', 'label');
  },
  async track(ctx, code) {
    assertCredentials(ctx);
    const cleaned = String(code ?? '').trim().toUpperCase();
    if (!cleaned) throw new Error('Código de rastreio vazio');
    const token = await authenticate(ctx);
    const body = await fetchJson(
      `${host(ctx.account.sandbox)}/srorastro/v1/objetos/${encodeURIComponent(cleaned)}?resultado=T`,
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/json',
        },
      },
    );
    const objetos = ((body as { objetos?: SroObjeto[] }).objetos ?? []) as SroObjeto[];
    const obj = objetos.find((o) => (o.codObjeto ?? '').toUpperCase() === cleaned) ?? objetos[0] ?? null;
    const eventos = obj?.eventos ?? [];
    const events = eventos
      .map((e) => {
        const tipo = String(e.tipo ?? '');
        const status = String(e.codigo ?? '');
        const desc = String(e.descricao ?? '');
        const cidade = e.unidade?.endereco?.cidade ?? '';
        const uf = e.unidade?.endereco?.uf ?? '';
        const location = [cidade, uf].filter(Boolean).join(' / ');
        return {
          occurred_at: e.dtHrCriado ? new Date(e.dtHrCriado).toISOString() : new Date().toISOString(),
          status: mapCorreiosEventKind(tipo, status, desc),
          description: desc,
          location: location || undefined,
          raw: e as unknown as Record<string, unknown>,
        };
      })
      .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    const delivered = events.some((ev) => ev.status === 'delivered');
    return { tracking_code: cleaned, delivered, events };
  },
};
