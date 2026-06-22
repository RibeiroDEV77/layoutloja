/**
 * Melhor Envio — cliente HTTP direto (sem painel admin / sem keyring).
 *
 * Lê `MELHOR_ENVIO_ACCESS_TOKEN` do ambiente e consome a API oficial:
 *   - GET  /api/v2/me                      → CEP de origem (remetente cadastrado)
 *   - POST /api/v2/me/shipment/calculate   → cotação multi-serviço
 *
 * Sandbox vs produção é controlado por `MELHOR_ENVIO_ENV` ("sandbox" | "production").
 * Não há qualquer dependência de `shipping_carrier_accounts` ou do painel admin —
 * a fonte da verdade é a conta Melhor Envio dona do token.
 */

const ORIGIN_TTL_MS = 10 * 60 * 1000; // 10min
let _originCache: { cep: string; expiresAt: number } | null = null;

function digits(s: string) { return (s ?? '').replace(/\D/g, ''); }

function host(): string {
  const env = (process.env.MELHOR_ENVIO_ENV ?? 'production').toLowerCase();
  return env === 'sandbox'
    ? 'https://sandbox.melhorenvio.com.br'
    : 'https://melhorenvio.com.br';
}

function authHeaders(): Record<string, string> {
  const token = process.env.MELHOR_ENVIO_ACCESS_TOKEN;
  if (!token) throw new Error('MELHOR_ENVIO_ACCESS_TOKEN não configurado');
  return {
    authorization: `Bearer ${token}`,
    accept: 'application/json',
    'content-type': 'application/json',
    'user-agent': process.env.MELHOR_ENVIO_USER_AGENT
      ?? 'Lovable Checkout (suporte@lovable.app)',
  };
}

async function fetchJson(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = typeof body === 'object' && body && 'message' in body
      ? String((body as Record<string, unknown>).message)
      : typeof body === 'string' ? body : `HTTP ${res.status}`;
    throw new Error(`MelhorEnvio ${res.status}: ${msg}`);
  }
  return body;
}

export async function getOriginPostalCode(): Promise<string> {
  const now = Date.now();
  if (_originCache && _originCache.expiresAt > now) return _originCache.cep;
  const body = await fetchJson(`${host()}/api/v2/me`, {
    method: 'GET',
    headers: authHeaders(),
  }) as Record<string, unknown>;
  const cep = digits(String(body.postal_code ?? ''));
  if (cep.length !== 8) {
    throw new Error('Conta Melhor Envio sem CEP de remetente cadastrado');
  }
  _originCache = { cep, expiresAt: now + ORIGIN_TTL_MS };
  return cep;
}

export interface MeQuoteOption {
  service_code: string;
  service_name: string;
  carrier_name: string;
  price: number;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  raw: Record<string, unknown>;
}

export async function calculateQuotes(input: {
  destination_postal_code: string;
  weight_g: number;
  declared_value?: number;
  dimensions_cm?: { length: number; width: number; height: number };
}): Promise<MeQuoteOption[]> {
  const to = digits(input.destination_postal_code);
  if (to.length !== 8) throw new Error('CEP de destino inválido');
  const from = await getOriginPostalCode();
  const dim = input.dimensions_cm ?? { length: 20, width: 15, height: 5 };

  const payload = {
    from: { postal_code: from },
    to: { postal_code: to },
    package: {
      length: dim.length,
      width: dim.width,
      height: dim.height,
      weight: Math.max(0.1, input.weight_g / 1000),
    },
    options: {
      insurance_value: input.declared_value ?? 0,
      receipt: false,
      own_hand: false,
    },
  };

  const body = await fetchJson(`${host()}/api/v2/me/shipment/calculate`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const items = Array.isArray(body) ? body as Array<Record<string, unknown>> : [];
  const out: MeQuoteOption[] = [];
  for (const it of items) {
    if (it.error) continue;
    const price = Number(it.custom_price ?? it.price ?? 0);
    if (!Number.isFinite(price) || price <= 0) continue;
    const range = it.delivery_range as { min?: number; max?: number } | undefined;
    const min = range?.min ?? (it.delivery_time as number | undefined) ?? null;
    const max = range?.max ?? (it.delivery_time as number | undefined) ?? null;
    const company = it.company as { name?: string } | undefined;
    out.push({
      service_code: String(it.id ?? ''),
      service_name: String(it.name ?? 'Serviço'),
      carrier_name: company?.name ?? 'Melhor Envio',
      price,
      estimated_days_min: min,
      estimated_days_max: max,
      raw: it,
    });
  }
  return out;
}
