/**
 * Server Functions — Integração Melhor Envio (OAuth, status, ações admin).
 *
 * Todas as fns são autenticadas e exigem permissão `shipping.manage` (ou
 * super-admin). Nenhuma fn devolve tokens em texto-claro.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import { Errors } from './errors';
import { hasPermission, isSuperAdmin } from './services/permissions.server';
import type { SbClient } from './events/dispatcher.server';

async function assertManage(supabase: SbClient, userId: string, storeId: string) {
  if (await isSuperAdmin(supabase, userId)) return;
  if (await hasPermission(supabase, userId, 'shipping.manage', storeId)) return;
  throw Errors.forbidden('Permissão necessária: shipping.manage');
}

export const getMelhorEnvioStatus = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { store_id: string }) => d)
  .handler(
    withBusiness(async ({ data, context }) => {
      await assertManage(context.supabase, context.userId, data.store_id);
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const oauth = await import('./services/shipping/melhor-envio-oauth.server');
      const env = (() => {
        try {
          const melhorEnvioEnv = oauth.getEnv();
          return { configured: true, sandbox: melhorEnvioEnv.sandbox, redirect_uri: melhorEnvioEnv.redirect_uri };
        }
        catch (e) { return { configured: false, sandbox: true, redirect_uri: null, error: (e as Error).message }; }
      })();
      const status = await oauth.getConnectionStatus(supabaseAdmin, data.store_id);
      return { ...status, env };
    }),
  );

export const startMelhorEnvioOAuth = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { store_id: string; return_to?: string }) => d)
  .handler(
    withBusiness(async ({ data, context }) => {
      await assertManage(context.supabase, context.userId, data.store_id);
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const oauth = await import('./services/shipping/melhor-envio-oauth.server');
      const env = oauth.getEnv();
      const accountId = await oauth.ensureMelhorEnvioAccount(supabaseAdmin, data.store_id, {
        sandbox: env.sandbox,
        createdBy: context.userId,
      });
      const { url } = await oauth.buildAuthorizationUrl(supabaseAdmin, {
        storeId: data.store_id,
        accountId,
        returnTo: data.return_to,
      });
      return { authorize_url: url };
    }),
  );

export const refreshMelhorEnvioToken = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { store_id: string }) => d)
  .handler(
    withBusiness(async ({ data, context }) => {
      await assertManage(context.supabase, context.userId, data.store_id);
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const oauth = await import('./services/shipping/melhor-envio-oauth.server');
      const accountId = await oauth.getMelhorEnvioAccountId(supabaseAdmin, data.store_id);
      if (!accountId) throw Errors.notFound('Conta Melhor Envio');
      const tokens = await oauth.ensureFreshAccessToken(supabaseAdmin, accountId);
      return { expires_at: tokens.expires_at };
    }),
  );

export const disconnectMelhorEnvio = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { store_id: string }) => d)
  .handler(
    withBusiness(async ({ data, context }) => {
      await assertManage(context.supabase, context.userId, data.store_id);
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const oauth = await import('./services/shipping/melhor-envio-oauth.server');
      const accountId = await oauth.getMelhorEnvioAccountId(supabaseAdmin, data.store_id);
      if (!accountId) return { ok: true };
      await oauth.disconnectAccount(supabaseAdmin, accountId);
      return { ok: true };
    }),
  );

/**
 * Cotação manual (admin). Útil para validar a conexão. O checkout público
 * usa o caminho normal do Shipping Engine (ShippingProviderRegistry).
 */
export const calculateMelhorEnvioQuote = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    store_id: string;
    origin_postal_code: string;
    destination_postal_code: string;
    weight_g: number;
    declared_value?: number;
    dimensions_cm?: { length: number; width: number; height: number };
  }) => d)
  .handler(
    withBusiness(async ({ data, context }) => {
      await assertManage(context.supabase, context.userId, data.store_id);
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const oauth = await import('./services/shipping/melhor-envio-oauth.server');
      const { melhorEnvioAdapter } = await import('./services/shipping/providers/melhor-envio.server');
      const accountId = await oauth.getMelhorEnvioAccountId(supabaseAdmin, data.store_id);
      if (!accountId) throw Errors.rule('Melhor Envio não conectado para esta loja');
      const tokens = await oauth.ensureFreshAccessToken(supabaseAdmin, accountId);
      const { data: acc } = await supabaseAdmin
        .from('shipping_carrier_accounts')
        .select('id, store_id, provider_code, display_name, sandbox, config, capabilities')
        .eq('id', accountId).single();
      if (!acc) throw Errors.notFound('Conta');
      const quotes = await melhorEnvioAdapter.quote!(
        {
          account: {
            id: acc.id, store_id: acc.store_id, provider_code: acc.provider_code,
            display_name: acc.display_name, sandbox: !!acc.sandbox,
            config: (acc.config ?? {}) as Record<string, unknown>,
            capabilities: (acc.capabilities ?? {}) as Record<string, unknown>,
          },
          credentials: tokens as unknown as Record<string, unknown>,
        },
        {
          origin_postal_code: data.origin_postal_code,
          destination_postal_code: data.destination_postal_code,
          weight_g: data.weight_g,
          declared_value: data.declared_value,
          dimensions_cm: data.dimensions_cm,
        },
      );
      // Remove `raw` (Record<string, unknown>) — não é serializável pelo RPC.
      return quotes
        .map(({ raw: _raw, ...q }) => q)
        .sort((a, b) => a.price - b.price);
    }),
  );
