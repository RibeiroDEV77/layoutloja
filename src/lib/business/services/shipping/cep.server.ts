/**
 * Consulta de CEP (ViaCEP). Server-only, sem credenciais.
 * Mantido como utilitário do módulo de Shipping; reaproveitável pelo
 * checkout, perfil do cliente, etc.
 */
import { Errors } from '../../errors';

export interface PostalLookup {
  postal_code: string;          // só dígitos
  street: string;
  district: string;
  city: string;
  state: string;
  country: string;              // 'BR'
  ibge?: string | null;
  raw?: Record<string, unknown>;
}

function digits(s: string) { return (s ?? '').replace(/\D/g, ''); }

export async function lookupViaCep(rawCep: string): Promise<PostalLookup> {
  const cep = digits(rawCep);
  if (cep.length !== 8) {
    throw Errors.validation('CEP inválido', { postal_code: rawCep });
  }
  let res: Response;
  try {
    res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    throw Errors.internal('Serviço de CEP indisponível', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  if (!res.ok) {
    throw Errors.internal(`Falha ao consultar CEP (HTTP ${res.status})`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  if (json.erro) throw Errors.notFound('CEP', cep);
  return {
    postal_code: cep,
    street:   String(json.logradouro ?? ''),
    district: String(json.bairro ?? ''),
    city:     String(json.localidade ?? ''),
    state:    String(json.uf ?? ''),
    country:  'BR',
    ibge:     (json.ibge as string) ?? null,
    raw:      json,
  };
}
