/**
 * OAuth callback do Melhor Envio.
 *
 * Path: /api/public/hooks/melhor-envio-callback?code=...&state=...
 *
 * Não escreve nada sem antes validar o `state` via RPC SECURITY DEFINER
 * `shipping_oauth_consume_state` (uso único, TTL 10min). Em sucesso,
 * persiste tokens cifrados e redireciona para o admin.
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/hooks/melhor-envio-callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const errorParam = url.searchParams.get('error');

        if (errorParam) {
          return redirectToAdmin(request, { error: errorParam });
        }
        if (!code || !state) {
          return redirectToAdmin(request, { error: 'missing_params' });
        }

        try {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          const oauth = await import('@/lib/business/services/shipping/melhor-envio-oauth.server');

          const stateRow = await oauth.consumeOAuthState(supabaseAdmin, state);
          if (!stateRow) return redirectToAdmin(request, { error: 'invalid_state' });
          if (!stateRow.account_id) return redirectToAdmin(request, { error: 'no_account' });

          const tokens = await oauth.exchangeCodeForTokens({
            code,
            code_verifier: stateRow.code_verifier,
            redirect_uri: stateRow.redirect_uri,
          });
          await oauth.persistTokens(supabaseAdmin, stateRow.account_id, tokens);

          return redirectToAdmin(request, { connected: 'melhor_envio' }, stateRow.return_to);
        } catch (err) {
          console.error('[melhor-envio-callback] erro:', err);
          const msg = err instanceof Error ? err.message : 'erro_desconhecido';
          return redirectToAdmin(request, { error: msg.slice(0, 200) });
        }
      },
    },
  },
});

function redirectToAdmin(
  request: Request,
  params: Record<string, string>,
  returnTo?: string | null,
): Response {
  const origin = new URL(request.url).origin;
  const target = new URL(returnTo || '/admin/integracoes', origin);
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { location: target.toString() } });
}
