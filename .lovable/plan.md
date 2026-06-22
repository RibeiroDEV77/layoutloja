# Integração Melhor Envio (OAuth 2.0)

## Observação importante sobre stack

Este projeto é **TanStack Start** (Cloudflare Worker) — não usa Supabase Edge Functions como camada padrão. Toda lógica server-side equivalente vive em **server functions** (`createServerFn`) e **server routes** (`/api/...`), que rodam no mesmo backend, com acesso a Secrets via `process.env`, e nunca expõem segredos ao browser. Funcionalmente atende 100% do requisito ("toda comunicação via backend, nunca expor Client Secret"). Vou implementar nesse formato, mantendo os nomes lógicos pedidos.

Também já existe infraestrutura completa de Shipping no projeto (`shipping_carrier_accounts`, `shipping_labels`, `shipping_quotes`, `tracking_events`, adapter `melhor-envio.server.ts`, registry, webhook inbox). **Vou reutilizar** em vez de criar tabelas paralelas — o requisito "não alterar banco existente" é respeitado (nenhuma tabela existente sofre ALTER); apenas adiciono o que falta para OAuth.

## O que será criado

### 1. Migration (somente adições)

- `shipping_oauth_states` — nonce + PKCE por tentativa de autorização (TTL 10 min).
- `shipping_oauth_tokens` — `provider_code`, `store_id`, `access_token` (cifrado via keyring existente), `refresh_token` (cifrado), `expires_at`, `scope`, `token_type`. Uma linha por (provider, store).
- GRANTs + RLS: leitura/escrita só via service_role (server functions). Admin lê status agregado por RPC `get_shipping_oauth_status(store_id)` (sem expor tokens).

Nenhuma tabela existente é alterada.

### 2. Secrets (via add_secret)

- `MELHOR_ENVIO_CLIENT_ID` (= 26270)
- `MELHOR_ENVIO_CLIENT_SECRET` (admin cola)
- `MELHOR_ENVIO_REDIRECT_URI` (derivado do domínio publicado)
- `MELHOR_ENVIO_ENV` = `sandbox` | `production`

`ACCESS_TOKEN` / `REFRESH_TOKEN` **não** ficam em Secrets — ficam cifrados em `shipping_oauth_tokens` (multi-store, rotacionáveis sem redeploy). Isso é mais seguro e segue o padrão já usado por payments/fiscal/shipping no projeto.

### 3. Server functions / routes (equivalente às Edge Functions pedidas)

| Pedido | Implementação |
|---|---|
| `authorize-melhor-envio` | `GET /api/public/shipping/melhor-envio/authorize` → redirect 302 para `oauth/authorize` com `state` + PKCE |
| `oauth-callback` | `GET /api/public/shipping/melhor-envio/callback` → troca `code` por tokens, persiste cifrado, redireciona p/ `/admin/integracoes` |
| `refresh-token` | helper interno `refreshMelhorEnvioToken()` chamado automaticamente quando `expires_at < now()+60s` |
| `calculate-shipping` | server fn `quoteMelhorEnvio({cart_id, postal_code})` — já existe via adapter, exposta no checkout |
| `create-label` | server fn `createMelhorEnvioLabel({order_id})` (cart→checkout→generate→print, já implementado no adapter) |
| `tracking` | server fn `trackMelhorEnvioShipment({shipment_id})` + cron diário |
| `webhook-handler` | `POST /api/public/shipping/melhor-envio/webhook` — valida assinatura, grava em `payment_webhook_inbox` análogo (criar `shipping_webhook_inbox`) e processa idempotente |

Adapter `melhor-envio.server.ts` é estendido para ler tokens de `shipping_oauth_tokens` (em vez de `credentials.access_token` fixo) e disparar refresh transparente.

### 4. Frontend

- **Nova rota**: `/admin/integracoes` (mínima, só lista provedores + status Melhor Envio). Não toca em nenhuma página admin existente.
- **Checkout** (`src/routes/checkout.tsx` se existir, senão card no carrinho): input de CEP → chama `quoteMelhorEnvio` → lista serviços ordenados por preço → seleção → grava em `cart.shipping_quote_id`. Reutiliza `persistOrderShippingSnapshot` já existente ao concluir pedido.

### 5. Pedido (somente leitura — sem alterar schema)

Dados de transportadora/rastreio/etiqueta/prazo já existem em `shipments`, `shipping_labels`, `tracking_events`, `order_shipping_snapshots`. Nada a alterar.

## Arquivos novos previstos

```
supabase/migrations/<ts>_melhor_envio_oauth.sql
src/lib/business/services/shipping/oauth/melhor-envio-oauth.server.ts
src/lib/business/services/shipping/oauth/token-store.server.ts
src/lib/business/shipping-oauth.functions.ts
src/routes/api/public/shipping/melhor-envio/authorize.ts
src/routes/api/public/shipping/melhor-envio/callback.ts
src/routes/api/public/shipping/melhor-envio/webhook.ts
src/routes/_authenticated/admin.integracoes.tsx
src/components/checkout/shipping-quote-picker.tsx
```

Arquivos editados (mínimos):
- `src/lib/business/services/shipping/providers/melhor-envio.server.ts` — ler token do store (refresh transparente)
- `src/components/app-sidebar.tsx` — entrada "Integrações" no menu admin

## Fluxo OAuth resumido

```text
Admin /admin/integracoes
  → "Conectar Melhor Envio"
  → GET /api/public/shipping/melhor-envio/authorize?store_id=X
       (gera state+PKCE, salva em shipping_oauth_states)
  → 302 melhorenvio.com.br/oauth/authorize?...
  → usuário autoriza
  → 302 /api/public/shipping/melhor-envio/callback?code=...&state=...
       (valida state, POST /oauth/token, cifra e salva tokens)
  → 302 /admin/integracoes?connected=melhor_envio
```

Refresh: qualquer chamada do adapter chama `getValidAccessToken(store_id)` que renova se faltar <60s para expirar, persiste novos tokens, e segue.

## Pontos a confirmar antes de eu implementar

1. **Ambiente**: começo em **sandbox** (`sandbox.melhorenvio.com.br`) e adiciono toggle p/ produção depois? (recomendo sim — evita queimar etiquetas reais durante testes).
2. **Webhook**: o Melhor Envio assina via `X-Signature` HMAC com o `client_secret`. OK validar com timing-safe compare?
3. **Outras 2 demandas pendentes** (Padronizar tipografia da Loja Pública + corrigir Hero) ficam para depois desta integração, ou prefere intercalar?

Aprovando, executo migration + secrets + código numa sequência só.
