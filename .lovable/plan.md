
# Arquitetura Técnica — Layout Indústria do Vestuário

E-commerce premium (varejo + atacado), multi-tenant-ready, integrações futuras (Mercado Pago, Correios, NF-e). Documento **somente de arquitetura** — nenhuma tabela, código ou tela será criada até aprovação.

---

## 1. Princípios Arquiteturais

- **Multi-tenant desde o dia 1, mono-tenant na prática.** Toda tabela de domínio carrega `store_id` (FK para `stores`). Inicialmente existirá 1 registro em `stores`; nenhuma migração estrutural será necessária para adicionar novas lojas.
- **EAV controlado para atributos de produto.** Atributos dinâmicos por categoria, sem colunas fixas em `products`.
- **Separação rígida de papéis.** `auth.users` (Supabase Auth) ⇆ `profiles` (dados públicos) ⇆ `user_roles` (RBAC, tabela separada — nunca role no profile) ⇆ `customers` / `companies` (entidades de negócio).
- **Pedidos unificados, segmentados por canal.** Uma única tabela `orders` com `channel ∈ {retail, wholesale}` evita duplicação de lógica (pagamento, expedição, NF, cupons).
- **Integrações como adaptadores.** `payment_providers`, `shipping_carriers`, `fiscal_providers` — tabelas de configuração + colunas `provider_*` nas transações. Trocar/adicionar provedor não altera schema central.
- **Auditoria e logs nativos.** `audit_log` genérico (entity, entity_id, action, diff, actor) + `system_logs` para eventos técnicos.
- **Soft delete + timestamps** em todas as tabelas de domínio (`created_at`, `updated_at`, `deleted_at`).
- **Storage Supabase** com buckets segmentados por loja (`store-{id}/products/{color_id}/...`).

---

## 2. Lista Completa de Tabelas

### 2.1 Núcleo / Multi-tenant
- `stores` — lojas (multi-tenant root)
- `store_settings` — configs por loja (chave/valor: SEO defaults, moeda, fuso, e-mails)

### 2.2 Identidade & Acesso
- `profiles` — 1:1 com `auth.users`
- `roles` — papéis (admin, gerente, estoquista, financeiro, expedição, cliente_varejo, cliente_atacado, …)
- `permissions` — permissões atômicas (`products.create`, `orders.refund`, …)
- `role_permissions` — N:N
- `user_roles` — usuário ↔ papel ↔ loja (escopo por loja)
- `user_sessions` — controle de sessões ativas
- `audit_log` — auditoria de alterações
- `system_logs` — logs técnicos

### 2.3 Catálogo
- `categories` — árvore (self-reference `parent_id`), substitui "subcategorias"
- `brands`
- `collections` (ex.: "Verão 2026")
- `product_collections` — N:N
- `products` — dados gerais (nome, slug, descrição, marca, categoria principal, status, tipo)
- `product_categories` — N:N (produto em múltiplas categorias)
- `attributes` — Cor, Tamanho, Numeração, Material, Manga, Gola, Cano, Modelagem, Comprimento, Tecido…
- `attribute_values` — valores possíveis por atributo (Azul, P/M/G, 38/39/40…)
- `category_attributes` — quais atributos cada categoria expõe (+ flag `is_required`, `is_variant_axis`)
- `product_attributes` — atributos não-variantes (descritivos) do produto

### 2.4 Variações (fluxo Produto → Cor → Galeria → Tamanho → Estoque/SKU/Preço)
- `product_colors` — instância da cor para o produto (FK produto + FK attribute_value tipo "cor")
- `product_color_images` — galeria por cor (ordem, principal, alt, url, mime, size)
- `product_variants` — variante final (FK product_color + FK attribute_value tamanho/numeração) — guarda **SKU**, **barcode**, **preço base**, **preço promocional**, **peso**, **dimensões**
- `variant_attribute_values` — quando uma variante envolver mais de 2 eixos (extensibilidade)
- `inventory` — estoque por variante por localização
- `inventory_locations` — depósito/loja física
- `inventory_movements` — entradas, saídas, ajustes, reservas (auditoria de estoque)

### 2.5 Preços (varejo + atacado + grupos futuros)
- `customer_groups` — Varejo, Atacado, Revendedor, Distribuidor, VIP…
- `price_lists` — listas de preço (vinculadas a grupo + loja)
- `price_list_items` — preço por variante por lista (+ min_qty para atacado escalonado)

### 2.6 Clientes & Empresas
- `customers` — pessoa física (FK profile, CPF, telefone, data_nasc, customer_group_id)
- `customer_addresses`
- `companies` — pessoa jurídica (razão social, fantasia, CNPJ, IE, segmento, status, customer_group_id)
- `company_addresses`
- `company_users` — N:N (usuários vinculados a uma empresa, com papel: comprador, gestor)
- `company_registration_requests` — fila de solicitações (status: pending/approved/rejected, motivo, revisor, datas)

### 2.7 Pedidos
- `carts` + `cart_items`
- `orders` — `channel ∈ {retail, wholesale}`, `customer_id` OU `company_id`, snapshot de totais
- `order_items` — snapshot de variante (sku, nome, preço unit., qty, totais)
- `order_status_history` — histórico de status
- `order_notes` — notas internas/cliente

### 2.8 Pagamentos
- `payment_providers` — Mercado Pago (e futuros) — credenciais cifradas
- `payments` — 1:N com order (permite split/retry), provider, status, valor, método, txid externo, raw payload
- `payment_events` — webhooks recebidos (idempotência + auditoria)
- `refunds`

### 2.9 Expedição
- `shipping_carriers` — Correios, transportadoras futuras
- `shipping_methods` — Retirada, PAC, SEDEX, Frete próprio
- `shipments` — 1:N com order (envio parcial), método, status, código de rastreio, etiqueta URL
- `shipment_events` — eventos de tracking
- `shipment_items` — quais order_items vão em cada envio

### 2.10 Fiscal
- `fiscal_providers` — emissor NF-e externo
- `invoices` — NF-e por order, número, série, chave, status, XML/PDF URL, payload provider

### 2.11 Marketing
- `coupons` — código, tipo (%, fixo, frete), escopo (canal, grupo, categoria, produto), validade, limites
- `coupon_redemptions`
- `banners` — slot, loja, imagem desktop/mobile, link, agendamento, ordem

### 2.12 SEO
- `seo_metadata` — polimórfico (entity_type, entity_id): title, description, og_image, canonical, robots
- `url_redirects` — 301/302 para preservar SEO em renomeações

### 2.13 Relatórios
- Views materializadas (não tabelas): `mv_sales_daily`, `mv_top_products`, `mv_stock_low`, `mv_customer_ltv`

---

## 3. Relacionamentos-Chave

```text
stores 1─N (quase tudo)

auth.users 1─1 profiles
profiles 1─N user_roles N─1 roles N─N permissions
roles N─1 stores (escopo)

categories ──self (parent_id)
categories N─N attributes  (category_attributes)
products N─1 categories, brands
products N─N collections, categories
products 1─N product_colors 1─N product_color_images
product_colors 1─N product_variants N─1 attribute_values (tamanho)
product_variants 1─N inventory N─1 inventory_locations
product_variants 1─N price_list_items N─1 price_lists N─1 customer_groups

customers N─1 customer_groups, profiles
companies N─1 customer_groups
companies 1─N company_users N─1 profiles
company_registration_requests 1─1 companies (após aprovação)

orders N─1 customers | companies   (XOR via channel)
orders 1─N order_items N─1 product_variants
orders 1─N payments N─1 payment_providers
orders 1─N shipments N─1 shipping_methods N─1 shipping_carriers
orders 1─N invoices N─1 fiscal_providers
orders N─N coupons (coupon_redemptions)

seo_metadata ──polimórfico→ (products | categories | collections | brands | pages)
audit_log    ──polimórfico→ qualquer entidade
```

---

## 4. Modelo Lógico (DER simplificado)

```text
                ┌─────────┐
                │ stores  │
                └────┬────┘
       ┌─────────────┼──────────────┬──────────────┐
       ▼             ▼              ▼              ▼
  ┌─────────┐  ┌──────────┐   ┌──────────┐   ┌──────────┐
  │profiles │  │categories│   │ products │   │  orders  │
  └────┬────┘  └────┬─────┘   └────┬─────┘   └────┬─────┘
       │            │ N─N           │ 1─N         │ 1─N
       │            ▼               ▼             ▼
       │      category_attributes  product_colors order_items
       │            │ N─1           │ 1─N         │ N─1
       │            ▼               ▼             ▼
       │      attributes ──1─N─ attribute_values product_variants
       │                                          │
       ▼                                          ▼
  user_roles─roles─role_permissions─permissions  inventory
       │                                          │
       ▼                                          ▼
 customers / companies ──── carts ──── orders ──── payments
                                          │           │
                                          ├──── shipments ──── shipment_events
                                          └──── invoices

  Marketing: coupons ── coupon_redemptions ── orders
             banners (por store)
  SEO:       seo_metadata (polimórfico)
  Auditoria: audit_log / system_logs / user_sessions
```

---

## 5. Organização do Painel Administrativo

Agrupado por domínio (em vez de lista plana):

```text
Dashboard

Catálogo
  ├─ Produtos
  ├─ Categorias            (árvore — substitui Subcategorias)
  ├─ Marcas
  ├─ Coleções
  ├─ Atributos             (+ Valores)
  └─ Variações             (visão consolidada)

Estoque
  ├─ Posição atual
  ├─ Movimentações
  └─ Locais de estoque

Vendas
  ├─ Pedidos Varejo
  ├─ Pedidos Atacado
  ├─ Pagamentos
  ├─ Expedição (envios + rastreio)
  └─ Notas Fiscais

Clientes
  ├─ Clientes (Varejo)
  ├─ Empresas (Atacado)
  ├─ Solicitações de Cadastro
  └─ Grupos de Clientes

Marketing
  ├─ Cupons
  ├─ Banners
  └─ Listas de Preço

Relatórios
  ├─ Vendas, Produtos, Clientes, Estoque

Configurações
  ├─ Loja (multi-store)
  ├─ Integrações (Pagamento, Frete, Fiscal)
  ├─ SEO global
  └─ E-mails / Notificações

Sistema
  ├─ Usuários & Permissões
  ├─ Perfis (Roles)
  ├─ Logs do Sistema
  └─ Auditoria
```

---

## 6. Fluxo Completo do Sistema

```text
Visitante → Vitrine (varejo) ───┐
Empresa  → Solicita cadastro → Admin aprova → Login → Vitrine (atacado preços exclusivos)
                                  │
Cliente logado → Carrinho → Checkout → Pagamento (MP) → Pedido criado
       → Reserva estoque → Aprovação pagamento (webhook) → Confirma pedido
       → Geração NF-e (provider) → Expedição (etiqueta Correios) → Rastreio
       → Entregue → Pós-venda (avaliações, devolução)
Admin acompanha cada etapa via painel; toda mudança gera audit_log.
```

## 7. Fluxo Cliente Varejo

```text
Navega → Adiciona ao carrinho → Login/Cadastro rápido (CPF)
→ Seleciona endereço → Calcula frete (Correios) → Aplica cupom
→ Paga (Mercado Pago: Pix/Cartão/Boleto) → Pedido channel=retail
→ Acompanha em "Meus Pedidos"
```

## 8. Fluxo Cliente Atacado

```text
Empresa preenche solicitação (Razão, CNPJ, IE, etc.)
→ Status pending → Admin revisa → Aprova/Reprova (+ motivo)
→ Usuário responsável recebe e-mail → Define senha
→ Login → Vê catálogo com price_list do grupo "Atacado"
→ Mínimos por SKU/pedido validados → Checkout
→ Pedido channel=wholesale → Condições de pagamento específicas
→ Faturamento e NF-e com dados da empresa
```

## 9. Fluxo de Pedidos (estados)

```text
draft → pending_payment → paid → in_separation → invoiced
     → shipped → delivered → completed
                              ↘ returned / refunded
     → canceled (a partir de pending_payment ou paid)
```
Cada transição grava `order_status_history` + `audit_log`.

## 10. Fluxo de Pagamentos

```text
Checkout cria payment (status=initiated, provider=mercadopago)
→ Redirect/SDK → Provider processa
→ Webhook /api/public/payments/mercadopago → valida assinatura
→ payment_events (idempotente por external_id)
→ Atualiza payment.status (approved/rejected/refunded)
→ Se approved → order.status=paid + dispara expedição
Refund: cria refunds + chamada provider + ajusta inventory_movements
```

## 11. Fluxo de Expedição

```text
order.status=paid → cria shipment(s) (split se múltiplos locais)
→ Seleciona shipping_method (Retirada | Correios PAC/SEDEX | Próprio)
→ Se Correios: chama API → recebe etiqueta + tracking_code
→ shipment.status=label_generated → packed → shipped
→ Webhook/cron consulta tracking → grava shipment_events
→ delivered → atualiza order
Retirada na loja: pula etiqueta, gera código de retirada.
```

## 12. Fluxo de Notas Fiscais

```text
order.status=paid (ou shipped, conforme regra fiscal)
→ Monta payload (itens, impostos, destinatário PF/PJ)
→ Envia ao fiscal_provider
→ invoice.status=processing → authorized (chave + XML + PDF)
→ Anexa ao pedido, disponibiliza download
→ Em caso de cancelamento de pedido: solicita cancelamento NF
```

---

## 12. Sugestões Arquiteturais Extras (escalabilidade)

1. **Multi-tenant via `store_id` + RLS** — políticas Supabase filtram por `store_id` do usuário; um único codebase serve N lojas.
2. **RBAC com escopo de loja** — `user_roles(user_id, role_id, store_id)` permite o mesmo usuário ter papéis diferentes por loja.
3. **EAV com category_attributes** — evita migrations para cada novo atributo de moda (gola, cano, etc.).
4. **Pedidos unificados (`channel`)** — reaproveita pagamentos, expedição, NF, cupons; relatórios segmentam por `channel`.
5. **Price lists por customer_group** — adicionar "Revendedor/VIP" no futuro = inserir linhas, não alterar schema.
6. **Adapters para integrações** — `payment_providers`, `shipping_carriers`, `fiscal_providers` permitem trocar/empilhar provedores.
7. **Webhooks idempotentes** — tabela `payment_events`/`shipment_events` com unique `(provider, external_id)`.
8. **Snapshots em order_items** — preço, nome e SKU congelados no pedido (catálogo pode mudar sem afetar histórico).
9. **Inventory reservations** — estoque reservado no checkout (TTL) evita oversell.
10. **Storage segmentado** — `store-{id}/products/{color_id}/...` + URLs assinadas para arquivos privados (NF XML).
11. **SEO polimórfico + redirects 301** — renomear produto/categoria não quebra Google.
12. **Auditoria genérica** — `audit_log(entity_type, entity_id, action, diff_jsonb, actor_id, store_id)`.
13. **Views materializadas para relatórios** — separa carga analítica do transacional.
14. **Edge functions (server functions TanStack)** apenas para: webhooks, integrações externas, geração de etiqueta, sitemap. Resto via PostgREST + RLS.
15. **Feature flags em `store_settings`** — habilitar Atacado/NF-e/Cupom por loja.

---

## Próximo Passo

Após sua aprovação desta arquitetura, a ordem de execução proposta é:

1. **Fundação** — `stores`, `profiles`, `roles/permissions/user_roles`, `audit_log`, RLS base.
2. **Catálogo** — categorias, marcas, atributos, produtos, cores, variações, estoque, imagens.
3. **Clientes & Empresas** — incluindo fluxo de solicitação/aprovação.
4. **Preços & Grupos** — price lists.
5. **Pedidos, Carrinho, Checkout** — sem provedores reais ainda.
6. **Painel Administrativo** — telas na ordem acima.
7. **Loja Virtual** — varejo, depois atacado.
8. **Integrações** — Mercado Pago → Correios → NF-e.

Nenhuma migration, código ou tela será criada até seu "aprovado".
