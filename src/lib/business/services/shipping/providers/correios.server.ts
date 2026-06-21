/**
 * Correios Adapter — infraestrutura base (Fase 5.x).
 *
 * Esta implementação registra o provider, declara capacidades, valida shape
 * de credenciais/config e expõe a interface `ShippingAdapter`. As chamadas
 * HTTP à API dos Correios serão implementadas em uma fase posterior — aqui
 * tudo retorna `AdapterCapabilityError` ou um `testConnection` neutro que
 * apenas confirma que as credenciais obrigatórias foram providas.
 *
 * Referências:
 *  - API Correios — Token, CWS (Calculador), Pré-postagem.
 *  - Sandbox: https://apihom.correios.com.br
 *  - Produção: https://api.correios.com.br
 */
import type {
  ShippingAdapter,
  AdapterContext,
  AdapterTestResult,
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
    helper: 'Códigos como 04014 (SEDEX), 04510 (PAC). Vazio = todos.' },
];

function assertCredentials(ctx: AdapterContext): asserts ctx is AdapterContext & { credentials: Record<string, unknown> } {
  const creds = ctx.credentials;
  if (!creds) throw new AdapterNotConfiguredError('correios');
  for (const field of CREDENTIAL_SCHEMA) {
    if (field.required && !creds[field.key]) {
      throw new AdapterNotConfiguredError('correios');
    }
  }
}

export const correiosAdapter: ShippingAdapter = {
  code: 'correios',
  displayName: 'Correios',
  capabilities: { quote: true, label: true, tracking: true, sandbox: true },
  credentialSchema: CREDENTIAL_SCHEMA,
  configSchema: CONFIG_SCHEMA,

  async testConnection(ctx: AdapterContext): Promise<AdapterTestResult> {
    try {
      assertCredentials(ctx);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Credenciais ausentes' };
    }
    // Fase base: não chama API ainda. Apenas confirma shape válido.
    return {
      ok: true,
      details: {
        environment: ctx.account.sandbox ? 'sandbox' : 'production',
        note: 'Credenciais válidas. Integração HTTP será habilitada em fase posterior.',
      },
    };
  },

  async quote(_ctx, _req) {
    throw new AdapterCapabilityError('correios', 'quote');
  },

  async createLabel(_ctx, _req) {
    throw new AdapterCapabilityError('correios', 'label');
  },

  async track(_ctx, _code) {
    throw new AdapterCapabilityError('correios', 'tracking');
  },
};
