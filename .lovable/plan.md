## Objetivo

Vitrine com checkout próprio onde o cliente informa o CEP, recebe automaticamente cotações Melhor Envio (PAC, SEDEX e demais), escolhe a modalidade, preenche dados e finaliza o pedido (sem gateway). A modalidade, valor e código do serviço ficam salvos no pedido. No admin do pedido, um botão "Gerar etiqueta" emite a etiqueta via Melhor Envio.

Reusa toda a infraestrutura já existente (Cart Engine, Shipping Adapter Registry com Melhor Envio, `shipment_purchase_label` RPC, `order_persist_shipping_snapshot` RPC). Adiciona somente o que falta: RPC de conversão carrinho→pedido, endpoints anônimos, a UI da loja, e o botão do admin.

## Backend

### 1. Migration SQL
- `order_create_from_cart(_cart_id, _email, _name, _phone, _address jsonb)` — RPC SECURITY DEFINER que:
  - Cria/recupera customer pelo email
  - Insere `orders` (status `pending_payment`) com totais copiados do carrinho
  - Copia `cart_items` → `order_items`
  - Insere `order_addresses` (billing+shipping iguais)
  - Chama internamente `order_persist_shipping_snapshot(order_id, cart_id)` para gravar carrier, service_code, price, ETA
  - Marca o carrinho como `converted`
  - Retorna `order_id`
- GRANT EXECUTE para `anon` e `authenticated` (write controlada inteiramente dentro da função)

### 2. Server functions novas (`src/lib/business/checkout.functions.ts`)
Todas via cliente publishable + `session_token` opaco no cookie/localStorage, sem auth (carrinho anônimo) — exceto a etiqueta, que é admin.

- `anonGetOrCreateCart({ store_id, session_token })`
- `anonGetCart({ cart_id, session_token })`
- `anonAddCartItem({ cart_id, variant_id, qty, session_token })`
- `anonRemoveCartItem({ cart_id, item_id, session_token })`
- `anonQuoteShipping({ cart_id, postal_code, session_token })` — chama o serviço já existente (`quoteShippingForCart`), que já mescla Melhor Envio via Registry
- `anonSelectShipping({ cart_id, quote_id, session_token })`
- `placeOrder({ cart_id, session_token, email, name, phone, address })` — chama `order_create_from_cart`
- `purchaseOrderLabel({ order_id })` *(autenticada, `fulfillment.ship`/`shipping.manage`)* — resolve `shipment_id` do pedido, monta `to`/`from` a partir de `order_addresses` + endereço da `stores`, chama `purchaseShippingLabel`

## Frontend

### 3. Vitrine (loja)
- Botão "Adicionar à sacola" no card de produto e na página de categoria/produto (cria/usa cart anônimo via `session_token` em localStorage).
- Drawer/badge da Sacola no `StorefrontNavbar` mostrando contagem + link `/sacola`.
- Página `/sacola` — lista itens, qty +/-, remover, totais, botão "Finalizar compra" → `/checkout`.
- Página `/checkout`:
  - Form de identificação (nome, email, telefone)
  - Form de endereço com CEP (autocomplete via `lookupPostalCode` já existente)
  - Ao terminar o CEP (8 dígitos), dispara `anonQuoteShipping` automaticamente; mostra spinner; lista PAC, SEDEX e demais serviços ordenados por preço com prazo
  - Cliente escolhe modalidade → `anonSelectShipping`
  - Botão "Finalizar pedido" → `placeOrder` → redireciona para `/pedido/$id` com mensagem de "Aguardando pagamento" e dados do envio escolhido

### 4. Admin
- Em `admin.orders.$orderId.tsx`, no card de Envio, adicionar botão "Gerar etiqueta" (e ao lado, link da etiqueta gerada / tracking) que chama `purchaseOrderLabel({ order_id })`. Estados: loading, sucesso (mostra link da etiqueta + código de rastreio), erro (toast).

## Detalhes técnicos

- O Melhor Envio já está integrado no Shipping Adapter Registry; `quoteShippingForCart` mescla cotações dele para qualquer `shipping_carrier_account` ativa da loja. Nada a alterar na integração.
- `session_token` do carrinho anônimo: UUID gerado no cliente, persistido em `localStorage` (`storefront.cart.session`).
- `store_id` do storefront: ler o primeiro store ativo via fn pública existente (já usada pela vitrine).
- Snapshot do envio no pedido (`order_shipping_snapshots`) é UNIQUE por order_id e já carrega `carrier`, `service_code`, `service_name`, `price`, `eta` — atende o requisito de "salvar modalidade, valor e código do serviço".
- A geração de etiqueta usa `purchaseShippingLabel` existente, que já valida capability, decifra credenciais via RPC `shipping_get_credentials`, registra outbox e métricas.

## Fora do escopo

- Pagamento integrado (Stripe/MP) — pedido criado como `pending_payment`.
- Login do cliente no checkout (compra como guest).
- Endereço de cobrança separado (usa o mesmo do envio).
- Cupons no checkout público (a infra existe, mas adicionamos depois se quiserem).
