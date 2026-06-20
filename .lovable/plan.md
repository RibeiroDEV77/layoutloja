
# Documento Técnico Completo — Arquitetura Layout

> Apenas arquitetura. Nada será criado até sua aprovação explícita.

Convenções globais (valem para TODAS as tabelas, não serão repetidas):
- PK `id uuid default gen_random_uuid()`
- `store_id uuid not null references stores(id)` em toda tabela de domínio (multi-tenant-ready)
- `created_at`, `updated_at timestamptz default now()` + trigger de update
- `deleted_at timestamptz null` (soft delete)
- Índice em `store_id` e em toda FK
- RLS habilitado; políticas escopadas por `store_id` + papel

---

## 1. Estrutura do Banco de Dados

### 1.1 Núcleo / Multi-tenant

**stores** — raiz multi-tenant.
Campos: `name, slug (unique), legal_name, cnpj, status, default_currency, timezone, logo_url, settings jsonb`.
PK: id. Índices: `slug unique`, `status`.

**store_settings** — configs chave/valor por loja (SEO defaults, e-mails, feature flags).
Campos: `store_id, key, value jsonb`.
PK: id. FK: `store_id`. Índice: `unique(store_id, key)`.

### 1.2 Identidade & Acesso (RBAC)

**profiles** — 1:1 com `auth.users` (NÃO usa FK direta — apenas `user_id uuid`).
Campos: `user_id (unique), full_name, avatar_url, phone, locale`.
PK: id. Índice: `unique(user_id)`.

**roles** — papéis: `super_admin, admin, gerente, estoquista, financeiro, expedicao, marketing, cliente_varejo, cliente_atacado, representante`.
Campos: `code (unique), name, description, is_system`.
PK: id. Índice: `unique(code)`.

**permissions** — permissões atômicas (`products.create`, `orders.refund`, `companies.approve`…).
Campos: `code (unique), module, description`.
PK: id. Índice: `unique(code)`, `module`.

**role_permissions** — N:N roles↔permissions.
PK: id. FKs: `role_id, permission_id`. Índice: `unique(role_id, permission_id)`.

**user_roles** — usuário ↔ papel ↔ loja (escopo).
Campos: `user_id, role_id, store_id`.
PK: id. Índice: `unique(user_id, role_id, store_id)`, `user_id`, `role_id`.

**user_sessions** — sessões ativas (auditoria, logout remoto).
Campos: `user_id, ip, user_agent, last_seen_at, revoked_at`.
PK: id. Índice: `user_id`, `revoked_at`.

**audit_log** — auditoria genérica.
Campos: `store_id, actor_user_id, entity_type, entity_id, action, diff jsonb, ip, user_agent`.
PK: id. Índice: `(entity_type, entity_id)`, `actor_user_id`, `created_at`.

**system_logs** — eventos técnicos.
Campos: `store_id, level, source, message, context jsonb`.
PK: id. Índice: `level, created_at`.

### 1.3 Catálogo

**categories** — árvore (parent_id self-ref). Substitui "subcategorias".
Campos: `store_id, parent_id (self FK), name, slug, description, image_url, position, is_active`.
PK: id. Índice: `unique(store_id, slug)`, `parent_id`, `position`.

**brands**
Campos: `store_id, name, slug, logo_url, description, is_active`.
PK: id. Índice: `unique(store_id, slug)`.

**collections** — ex.: "Verão 2026".
Campos: `store_id, name, slug, description, banner_url, starts_at, ends_at, is_active`.
PK: id. Índice: `unique(store_id, slug)`.

**product_collections** — N:N.
PK: id. FKs: `product_id, collection_id`. Índice: `unique(product_id, collection_id)`.

**products** — dados gerais (sem atributos fixos).
Campos: `store_id, brand_id, primary_category_id, name, slug, short_description, description (rich), status (draft/active/archived), product_type, tax_class, base_weight_g, base_dimensions jsonb, published_at`.
PK: id. Índice: `unique(store_id, slug)`, `status`, `brand_id`, `primary_category_id`.

**product_categories** — N:N.
PK: id. FKs: `product_id, category_id`. Índice: `unique(product_id, category_id)`.

**attributes** — Cor, Tamanho, Numeração, Material, Manga, Gola, Cano, Modelagem, Comprimento, Tecido…
Campos: `store_id, code (unique), name, input_type (select/color/text/number), is_variant_axis_default`.
PK: id. Índice: `unique(store_id, code)`.

**attribute_values** — valores possíveis (Azul #1f3a8a, P, 38…).
Campos: `attribute_id, value, label, hex (cor), position`.
PK: id. Índice: `attribute_id`, `unique(attribute_id, value)`.

**category_attributes** — quais atributos cada categoria expõe.
Campos: `category_id, attribute_id, is_required, is_variant_axis, position`.
PK: id. Índice: `unique(category_id, attribute_id)`.

**product_attributes** — atributos descritivos (não-variantes) do produto.
Campos: `product_id, attribute_id, attribute_value_id (ou raw value)`.
PK: id. Índice: `unique(product_id, attribute_id, attribute_value_id)`.

### 1.4 Variações

**product_colors** — instância de COR para o produto (raiz da galeria + tamanhos).
Campos: `product_id, attribute_value_id (cor), name_override, hex_override, position, is_default, is_active`.
PK: id. Índice: `unique(product_id, attribute_value_id)`, `product_id`.

**product_color_images** — galeria POR cor.
Campos: `product_color_id, storage_path, url, alt, mime, width, height, size_bytes, position, is_primary`.
PK: id. Índice: `product_color_id`, `unique(product_color_id, position)`, parcial `unique(product_color_id) where is_primary`.

**product_variants** — variante final (SKU vendável).
Campos: `product_color_id, size_attribute_value_id (tamanho/numeração), sku (unique), barcode, base_price, sale_price, sale_starts_at, sale_ends_at, weight_g, dimensions jsonb, is_active`.
PK: id. Índice: `unique(sku)`, `product_color_id`, `unique(product_color_id, size_attribute_value_id)`.

**variant_attribute_values** — eixos extras (>2 eixos), extensibilidade.
PK: id. FKs: `variant_id, attribute_value_id`. Índice: `unique(variant_id, attribute_value_id)`.

**inventory_locations** — depósitos / lojas físicas.
Campos: `store_id, name, code, type (warehouse/store/dropship), address jsonb, is_active`.
PK: id. Índice: `unique(store_id, code)`.

**inventory** — estoque por variante por localização.
Campos: `variant_id, location_id, on_hand, reserved, safety_stock`.
PK: id. Índice: `unique(variant_id, location_id)`.

**inventory_movements** — entradas/saídas/ajustes/reservas.
Campos: `variant_id, location_id, type (in/out/adjust/reserve/release), qty, reason, reference_type, reference_id, actor_user_id`.
PK: id. Índice: `variant_id, created_at`, `(reference_type, reference_id)`.

### 1.5 Preços

**customer_groups** — Varejo, Atacado, Revendedor, Distribuidor, VIP.
Campos: `store_id, code (unique), name, channel (retail/wholesale/both), is_default`.
PK: id. Índice: `unique(store_id, code)`.

**price_lists** — listas de preço.
Campos: `store_id, customer_group_id, name, currency, starts_at, ends_at, is_active`.
PK: id. Índice: `store_id, customer_group_id`.

**price_list_items** — preço por variante + min_qty (atacado escalonado).
Campos: `price_list_id, variant_id, price, min_qty, max_qty`.
PK: id. Índice: `unique(price_list_id, variant_id, min_qty)`.

### 1.6 Clientes & Empresas

**customers** — PF.
Campos: `store_id, profile_id, customer_group_id, cpf, birth_date, phone, gender, marketing_opt_in, status`.
PK: id. Índice: `unique(store_id, cpf)`, `profile_id`.

**customer_addresses** — endereços do cliente.
Campos: `customer_id, label, recipient, zip, street, number, complement, district, city, state, country, is_default_shipping, is_default_billing`.

**companies** — PJ.
Campos: `store_id, customer_group_id, legal_name, trade_name, cnpj, state_registration, municipal_registration, segment, status (pending/approved/rejected/suspended), responsible_name, phone, email, website, approved_at, approved_by`.
PK: id. Índice: `unique(store_id, cnpj)`, `status`.

**company_addresses** — análogo a customer_addresses.

**company_users** — N:N usuários ↔ empresa.
Campos: `company_id, profile_id, role_in_company (buyer/manager/owner), is_active`.
PK: id. Índice: `unique(company_id, profile_id)`.

**company_registration_requests** — fila de solicitação.
Campos: `store_id, payload jsonb (snapshot do form), status (pending/approved/rejected), reviewer_user_id, review_notes, reviewed_at, resulting_company_id`.
PK: id. Índice: `store_id, status`.

### 1.7 Pedidos

**carts** + **cart_items**
Carts: `store_id, customer_id|company_id|session_id, currency, coupon_id, expires_at`.
Cart_items: `cart_id, variant_id, qty, unit_price_snapshot`.

**orders**
Campos: `store_id, order_number (sequencial por loja), channel (retail/wholesale), customer_id, company_id, status, currency, subtotal, discount_total, shipping_total, tax_total, grand_total, notes, placed_at`.
PK: id. Índice: `unique(store_id, order_number)`, `status`, `channel`, `customer_id`, `company_id`, `placed_at`.

**order_items** — snapshot.
Campos: `order_id, variant_id, sku_snapshot, name_snapshot, qty, unit_price, discount, tax, total`.

**order_status_history**
Campos: `order_id, from_status, to_status, actor_user_id, notes`.

**order_notes** — internas/cliente.
Campos: `order_id, author_user_id, visibility (internal/customer), body`.

### 1.8 Pagamentos

**payment_providers** — Mercado Pago e futuros.
Campos: `store_id, code (mercadopago/...), name, credentials_secret_ref (referência a Secret, NUNCA o segredo em si), config jsonb, is_active, sandbox`.

**payments** — 1:N por order.
Campos: `order_id, provider_id, method (pix/credit_card/boleto/...), status (initiated/pending/approved/rejected/refunded/charged_back), amount, installments, external_id, raw_response jsonb, paid_at`.
Índice: `order_id`, `unique(provider_id, external_id)`.

**payment_events** — webhooks (idempotência).
Campos: `provider_id, external_event_id, payment_id, event_type, payload jsonb, processed_at`.
Índice: `unique(provider_id, external_event_id)`.

**refunds**
Campos: `payment_id, amount, reason, status, external_id, raw_response jsonb`.

### 1.9 Expedição

**shipping_carriers** — Correios, transportadoras.
Campos: `store_id, code, name, credentials_secret_ref, config jsonb, is_active`.

**shipping_methods** — Retirada/PAC/SEDEX/Próprio.
Campos: `store_id, carrier_id, code, name, type (pickup/freight), default_eta_days, is_active`.

**shipments** — envio (suporta envio parcial).
Campos: `order_id, method_id, status (pending/label_generated/packed/shipped/delivered/returned), tracking_code, label_url, freight_cost, packed_at, shipped_at, delivered_at`.
Índice: `order_id`, `tracking_code`.

**shipment_items** — quais order_items vão em cada shipment.
Campos: `shipment_id, order_item_id, qty`.

**shipment_events** — tracking timeline.
Campos: `shipment_id, external_event_id, status, description, occurred_at, raw jsonb`.
Índice: `unique(shipment_id, external_event_id)`.

### 1.10 Fiscal

**fiscal_providers**
Campos: `store_id, code, name, credentials_secret_ref, config jsonb, environment (homolog/prod), is_active`.

**invoices** — NF-e.
Campos: `order_id, provider_id, number, series, access_key, status (queued/processing/authorized/rejected/canceled), xml_url, pdf_url, issued_at, raw_response jsonb`.
Índice: `order_id`, `unique(provider_id, access_key)`.

### 1.11 Marketing

**coupons**
Campos: `store_id, code (unique store), type (percent/fixed/free_shipping), value, scope jsonb (channels, groups, categories, products), min_order_value, usage_limit, usage_limit_per_customer, starts_at, ends_at, is_active`.

**coupon_redemptions**
Campos: `coupon_id, order_id, customer_id|company_id, amount_discounted`.
Índice: `unique(coupon_id, order_id)`.

**banners**
Campos: `store_id, slot (home_hero/category_top/...), title, image_desktop_url, image_mobile_url, link_url, starts_at, ends_at, position, is_active`.

### 1.12 SEO

**seo_metadata** — polimórfico.
Campos: `store_id, entity_type, entity_id, title, description, og_image_url, canonical, robots, jsonld jsonb`.
Índice: `unique(entity_type, entity_id)`.

**url_redirects**
Campos: `store_id, from_path, to_path, status_code (301/302)`.
Índice: `unique(store_id, from_path)`.

### 1.13 Relatórios
Views materializadas: `mv_sales_daily`, `mv_top_products`, `mv_stock_low`, `mv_customer_ltv` (refresh agendado).

---

## 2. Relacionamentos

```text
stores 1─N quase tudo

auth.users 1─1 profiles 1─N user_roles N─1 roles N─N permissions
                       └─N customers / company_users

categories ── self (parent_id) [árvore: categoria → subcategoria → subsub…]
categories N─N attributes  (category_attributes)
brands     1─N products
collections N─N products  (product_collections)
categories N─N products   (product_categories) + products.primary_category_id

products 1─N product_colors 1─N product_color_images
                            1─N product_variants
product_variants N─1 attribute_values (tamanho)
product_variants 1─N inventory N─1 inventory_locations
product_variants 1─N inventory_movements
product_variants 1─N price_list_items N─1 price_lists N─1 customer_groups

customers / companies 1─N addresses
companies 1─N company_users  (profile ↔ company)
company_registration_requests 1─0..1 companies (após aprovar)

carts 1─N cart_items N─1 product_variants
orders N─1 customers | companies   (XOR validado por trigger; channel define)
orders 1─N order_items N─1 product_variants
orders 1─N payments N─1 payment_providers
payments 1─N payment_events
payments 1─N refunds
orders 1─N shipments N─1 shipping_methods N─1 shipping_carriers
shipments 1─N shipment_items N─1 order_items
shipments 1─N shipment_events
orders 1─N invoices N─1 fiscal_providers
orders 1─N order_status_history / order_notes
orders N─N coupons (coupon_redemptions)

seo_metadata ──polimórfico→ products | categories | collections | brands | pages
url_redirects ── por store
audit_log / system_logs / user_sessions ── transversais
```

Fluxo principal:
```
Produto → Cor → (Galeria) + Tamanhos → Variante (SKU/Preço/Estoque) → CartItem → OrderItem → Shipment/Payment/Invoice
```

---

## 3. DER (Modelo Lógico — textual)

```text
stores ──┬── store_settings
         ├── inventory_locations
         ├── categories ──self
         │     └── category_attributes ── attributes ── attribute_values
         ├── brands
         ├── collections
         ├── products ──┬── product_categories ── categories
         │              ├── product_collections ── collections
         │              ├── product_attributes ── attribute_values
         │              └── product_colors ──┬── product_color_images
         │                                   └── product_variants ──┬── variant_attribute_values
         │                                                          ├── inventory ── inventory_locations
         │                                                          ├── inventory_movements
         │                                                          └── price_list_items
         ├── customer_groups ── price_lists ── price_list_items
         ├── customers ── customer_addresses
         ├── companies ──┬── company_addresses
         │               ├── company_users ── profiles
         │               └── company_registration_requests
         ├── carts ── cart_items ── product_variants
         ├── orders ──┬── order_items ── product_variants
         │            ├── order_status_history
         │            ├── order_notes
         │            ├── payments ──┬── payment_events
         │            │              └── refunds
         │            ├── shipments ──┬── shipment_items ── order_items
         │            │               └── shipment_events
         │            └── invoices ── fiscal_providers
         ├── payment_providers
         ├── shipping_carriers ── shipping_methods
         ├── fiscal_providers
         ├── coupons ── coupon_redemptions ── orders
         ├── banners
         ├── seo_metadata (polimórfico)
         ├── url_redirects
         ├── audit_log
         └── system_logs

auth.users ── profiles ── user_roles ── roles ── role_permissions ── permissions
```

---

## 4. Sistema de Produtos

- **products** guarda apenas o "tronco" (nome, marca, descrição, status, categoria principal). **Nenhum atributo de moda é coluna fixa**.
- **categories** é uma árvore self-referencing (`parent_id`). "Subcategoria" = categoria com pai. Profundidade ilimitada (Camisas → Country → Manga Longa).
- **brands** e **collections** são entidades independentes; produto N:N com coleções.
- **attributes** define o tipo de característica (Cor, Tamanho, Numeração, Manga, Material…). **attribute_values** define os valores possíveis.
- **category_attributes** liga categoria → atributo. Cada flag:
  - `is_required`: obrigatório no cadastro.
  - `is_variant_axis`: este atributo gera variação (Cor e Tamanho geralmente; Material é descritivo).
- **product_attributes**: atributos descritivos do produto (ex.: Material = Algodão), não gera variação.
- **product_colors + product_variants**: atributos que geram variação são materializados aqui.
- **inventory**: por variante por localização.

Garantia de não-retrabalho: adicionar um novo atributo (ex.: "Punho") = inserir 1 linha em `attributes` + N em `attribute_values` + ligar em `category_attributes`. **Zero migration**, zero alteração de schema.

---

## 5. Sistema de Variações

Hierarquia exata pedida:

```
products
  └─ product_colors                 (1 linha por COR do produto)
        ├─ product_color_images     (galeria EXCLUSIVA da cor)
        └─ product_variants         (1 linha por TAMANHO daquela cor)
              ├─ sku, barcode       (independente por tamanho)
              ├─ base_price/sale_price (preço por tamanho — opcional)
              └─ inventory          (estoque por variante × location)
```

Confirmações:
- Cada **cor** = 1 `product_colors` com sua **galeria própria** (`product_color_images`).
- Cada **tamanho** de cada cor = 1 `product_variants` com **SKU próprio**, **preço próprio** e **estoque próprio**.
- Cores podem ter conjuntos DIFERENTES de tamanhos (Azul tem P/M/G; Verde só tem M/G).
- `variant_attribute_values` cobre eixos extras (ex.: Modelagem) sem mudar schema.

Exemplo concreto — Camisa Country:
```
Camisa Country (product)
├─ Azul (product_color)
│   ├─ imgs: principal.jpg, lateral.jpg, costas.jpg
│   └─ variantes: P (SKU-001), M (SKU-002), G (SKU-003)
└─ Verde (product_color)
    ├─ imgs: principal.jpg, detalhe.jpg
    └─ variantes: M (SKU-010), G (SKU-011)
```

---

## 6. Sistema de Imagens

**Vinculação**: imagens pertencem a `product_colors`, NUNCA a `products` ou `product_variants`.

**Storage** (Supabase Storage):
- Bucket privado por padrão; URLs públicas para vitrine via política de leitura.
- Caminho: `store-{store_id}/products/{product_id}/colors/{color_id}/{uuid}.{ext}`.
- Bucket separado privado: `store-{store_id}/invoices/` (XML/PDF NF-e, signed URLs).

**Fluxo de upload (cliente → server function)**:
1. Cliente seleciona arquivos.
2. Validação no cliente: extensão (jpg/png/webp), tamanho máx (ex.: 8 MB), dimensão mín.
3. Compressão/resize no cliente (gera webp + variantes responsivas se aplicável).
4. Preview local (object URL).
5. Server function gera **signed upload URL** + valida permissão (`products.update`).
6. Upload direto para Storage.
7. Server function confirma: lê metadados (mime, size, dimensões), insere em `product_color_images` (status `pending`).
8. Validação final (HEAD no Storage para garantir presença) → status `ok`.
9. Em falha em qualquer passo → rollback (deleta do Storage + remove registro).

**Foto principal**: coluna `is_primary` em `product_color_images`; índice **único parcial** `where is_primary = true` por `product_color_id` garante apenas 1.

**Ordenação**: coluna `position` (int). Drag-and-drop no admin emite update em lote. Índice `unique(product_color_id, position)` evita conflitos.

**Validações resumidas**: formato, tamanho, dimensões, vírus opcional (futuro), presença no Storage, URL acessível, gravação no banco — todos antes de marcar `ok`.

---

## 7. Sistema de Estoque

Confirmado: **estoque é por VARIANTE (cor × tamanho) × LOCALIZAÇÃO**, nunca por produto.

`inventory(variant_id, location_id, on_hand, reserved, safety_stock)`:
- `on_hand` = físico.
- `reserved` = reservado em carrinho/checkout (com TTL).
- Disponível para venda = `on_hand - reserved - safety_stock`.

`inventory_movements` registra TODA alteração (entrada NF, venda, devolução, ajuste manual, reserva, liberação) com `reference_type/reference_id` apontando para a origem (order, shipment, manual). Isso dá auditoria completa e permite reconstruir saldo.

Exemplo:
```
Camisa Azul P  (variant 001) @ Depósito Central → on_hand 20, reserved 2
Camisa Azul M  (variant 002) @ Depósito Central → on_hand 0,  reserved 0  → SEM ESTOQUE
Camisa Verde G (variant 011) @ Depósito Central → on_hand 5,  reserved 1
```
Independentes, como solicitado.

---

## 8. Sistema de Clientes

- **profiles** = identidade base (1:1 auth.users).
- **customer_groups** = agrupamento comercial (Varejo, Atacado, Revendedor, Distribuidor, VIP, Representante). Adicionar novo grupo = INSERT, nunca migration.
- **customers** (PF) e **companies** (PJ) são entidades de NEGÓCIO distintas, ambas com `customer_group_id`.
- **company_users** liga vários `profiles` a uma `company` (comprador, gestor, dono).
- **Representante**: implementado como `customer_group = representante` + permissão extra `orders.create_on_behalf` (vende em nome de empresas). Nada novo de schema.
- **Permissões**: vêm de `roles` + `permissions`, escopadas por `store_id`. Cliente recebe role `cliente_varejo` ou `cliente_atacado` ao logar.

---

## 9. Sistema de Atacado

```
Empresa preenche solicitação pública  (cria company_registration_requests, status=pending)
  ↓
Admin recebe na fila "Solicitações de Cadastro"
  ↓
Admin valida (CNPJ, IE, segmento) → Aprovar ou Rejeitar
  ↓ Aprovar:
      - Cria companies (status=approved, customer_group=atacado)
      - Cria/convida profile do responsável → e-mail para definir senha
      - Vincula via company_users (role_in_company=owner)
      - Atribui user_role = cliente_atacado
  ↓ Rejeitar:
      - Salva motivo, dispara e-mail
  ↓
Empresa faz login
  ↓
App detecta company_users ativo → ativa "modo atacado":
      - Aplica price_list do customer_group "Atacado"
      - Mostra preço/min_qty escalonado de price_list_items
      - Exige CNPJ no checkout (já vem da company)
  ↓
Checkout → orders.channel='wholesale', company_id preenchido
  ↓
NF-e emitida para a PJ; condições de pagamento próprias (ex.: boleto 30/60/90)
```

---

## 10. Sistema de Pedidos

Tabelas envolvidas: `orders, order_items, order_status_history, order_notes, payments, payment_events, refunds, shipments, shipment_items, shipment_events, invoices, coupon_redemptions`.

**Snapshot** em `order_items` (preço, nome, SKU congelados) — catálogo pode mudar sem afetar o histórico.

**Estados de `orders.status`**:
```
draft → pending_payment → paid → in_separation → invoiced → shipped → delivered → completed
                                                                  ↘ returned / refunded
                                                                  ↘ canceled
```
Toda transição grava `order_status_history` + `audit_log`.

**Segmentação**: `channel ∈ {retail, wholesale}` separa relatórios e regras, mas o pipeline (pagto/expedição/NF) é compartilhado.

**XOR cliente/empresa**: trigger garante exatamente um de `customer_id`/`company_id` conforme `channel`.

---

## 11. Sistema de Pagamentos (preparado para Mercado Pago)

- `payment_providers` lista provedores (Mercado Pago inicialmente). **Credenciais ficam em Supabase Secrets**; a tabela guarda apenas `credentials_secret_ref` (nome do secret) — nunca o segredo.
- `payments` permite múltiplas tentativas/splits por order (1:N).
- `payment_events` armazena cada webhook recebido com `unique(provider_id, external_event_id)` → **idempotência garantida**.
- `refunds` controla estornos parciais/totais.
- Endpoint webhook futuro: `app/routes/api/public/webhooks/mercadopago.ts` — valida assinatura, grava em `payment_events`, atualiza `payments`, dispara transição de `orders.status`.
- Adicionar PagSeguro/Stripe = inserir provider + novo webhook. Schema intacto.

---

## 12. Sistema de Expedição (preparado para Correios)

- `shipping_carriers` (Correios, transportadoras futuras) com credenciais via Secret.
- `shipping_methods` por carrier: `Retirada na Loja` (type=pickup, sem etiqueta), `PAC`, `SEDEX`, `Frete Próprio`.
- `shipments` por order (suporta envio parcial → `shipment_items`):
  - `tracking_code`, `label_url`, `freight_cost`, datas (packed/shipped/delivered).
- `shipment_events` para timeline de tracking (idempotente por `external_event_id`).
- Retirada na Loja: pula etiqueta, gera `pickup_code`, status segue mesmo fluxo terminando em `delivered` no ato da retirada.
- Frete no checkout: server function chama API Correios, retorna prazos/valores; valor escolhido vira `shipping_total` e `shipments.freight_cost`.
- Trocar de Correios para Loggi/Melhor Envio = novo carrier + adapter. Schema intacto.

---

## 13. Sistema de Notas Fiscais (preparado para emissor externo)

- `fiscal_providers` lista emissores (ex.: Focus NFe, eNotas, NFE.io) com credenciais via Secret + `environment (homolog/prod)`.
- `invoices` (1:N por order — permite reemissão/cancelamento): `number, series, access_key, status, xml_url, pdf_url, raw_response`.
- XML/PDF em bucket **privado** (`store-{id}/invoices/`) com signed URLs.
- Fluxo futuro: trigger ao mudar order para `paid`/`shipped` enfileira chamada ao provider; webhook do provider atualiza `invoices.status` para `authorized`.
- Cancelamento de pedido aciona endpoint de cancelamento de NF no provider.
- Trocar de provider = novo registro em `fiscal_providers`. Schema intacto.

---

## 14. Segurança

**RBAC**:
- `roles` + `permissions` + `role_permissions` + `user_roles(user_id, role_id, store_id)`.
- Função `has_permission(uid, perm_code, store_id)` SECURITY DEFINER consulta `user_roles → role_permissions → permissions`.
- Usada tanto no app quanto em políticas RLS.

**RLS** (habilitado em TODAS as tabelas de domínio):
- Padrão por `store_id`: usuário só vê linhas das lojas em que possui `user_roles`.
- Dados pessoais (`customers`, `customer_addresses`, `carts`, `orders` do cliente): política `auth.uid() = profile_id` ou via `customer_id` do usuário.
- Dados de empresa: usuário só vê `companies` em que está em `company_users`.
- Admin/staff: políticas `using (has_permission(auth.uid(), 'X.read', store_id))`.
- Catálogo público (products ativos, categories, brands, banners, seo): policy `TO anon SELECT USING (status='active' AND deleted_at IS NULL)`.

**Perfis**: definidos em `roles` com `code` estável; permissões editáveis sem mexer em código.

**Auditoria**:
- `audit_log` populado por triggers em tabelas críticas (products, variants, inventory, orders, payments, companies, user_roles).
- `actor_user_id` capturado via `auth.uid()`.

**Logs**:
- `system_logs` para eventos técnicos (falha webhook, erro provider).
- `user_sessions` para sessões/logout remoto.

**Segredos**: somente em Supabase Secrets (`MERCADOPAGO_*`, `CORREIOS_*`, `NFE_*`). Tabelas guardam apenas referência ao nome.

---

## 15. Escalabilidade — Análise e Melhorias

Pontos já blindados:
1. **Multi-tenant via `store_id`** desde o início → adicionar 2ª loja = INSERT.
2. **EAV controlado (attributes/category_attributes)** → novo atributo de moda sem migration.
3. **Galeria por cor** (modelagem correta de moda).
4. **Estoque por variante × localização** → multi-CD futuro sem mudança.
5. **Snapshots em order_items** → histórico íntegro.
6. **Adapters de integração** (providers/carriers) → trocar/adicionar gateway sem mexer em pedidos.
7. **Idempotência de webhooks** por `unique(provider, external_id)`.
8. **SEO polimórfico + url_redirects** → renomear não quebra Google.
9. **Soft delete + audit_log** → recuperação e compliance.
10. **Secrets fora do banco** → segurança e portabilidade.

Melhorias incluídas após revisão crítica do seu briefing original:
- **`primary_category_id` em products** + N:N `product_categories` (você pediu só categoria/subcategoria; sem isso, produtos em múltiplas categorias seriam impossíveis).
- **`category_attributes.is_variant_axis`** (separa atributo descritivo de atributo de variação — sem isso, você seria forçado a tratar Material como eixo).
- **`variant_attribute_values`** (você pediu Cor→Tamanho; isso garante que um terceiro eixo no futuro — ex.: Modelagem — não exija refatorar `product_variants`).
- **`inventory_locations` + `inventory_movements`** desde o dia 1 (mesmo com 1 depósito) — adicionar 2º CD/dropship depois é trivial.
- **`price_lists` + `price_list_items` com `min_qty`** (atacado escalonado real, não apenas "preço único de atacado").
- **`company_users` N:N** (uma empresa pode ter vários compradores — caso comum no atacado).
- **`company_registration_requests` separada de `companies`** (auditoria do processo de aprovação).
- **`shipment_items` parciais** (pedidos grandes do atacado quase sempre são enviados em lotes).
- **`payment_events` / `shipment_events` separadas** (webhook é evento, não estado — separar facilita reprocessamento).
- **`seo_metadata` polimórfico + `url_redirects`** (você não pediu redirects; sem eles, qualquer rename quebra SEO existente).
- **`url_redirects` por loja** (multi-tenant também no SEO).
- **`audit_log` genérico via trigger** (em vez de tabelas de histórico por entidade).

Pontos de atenção operacional (não-schema):
- Definir **política de reserva de estoque** (TTL do `reserved`) antes de implementar checkout.
- Definir **sequência de `order_number` por loja** (sequência postgres por store) antes do primeiro pedido.
- Definir **regime tributário** antes de modelar `tax_class` em produtos (Simples vs Lucro Real muda payload NF).
- Imagens: definir **tamanhos responsivos** padrão (ex.: 1600/800/400) antes do primeiro upload.

Nenhum ponto identificado exige rever a arquitetura para evitar retrabalho. Está pronto para Fase 1 quando você aprovar.

---

## Próximo Passo

Aguardando "**APROVADO**" para iniciar a **Fase 1 — Fundação**:
- `stores`, `store_settings`
- `profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`
- `audit_log`, `system_logs`, `user_sessions`
- Função `has_permission(uid, perm, store_id)`
- RLS base + seed de roles/permissions padrão + 1 store inicial "Layout"

Nada será criado antes da sua aprovação explícita.

---

# ADDENDUM — Melhorias Aprovadas (pré-Fase 1)

Incorporadas sem alterar a arquitetura já aprovada. Implementadas nas fases correspondentes.

## A1. Funcionários (HR) — separado da autenticação

Identidade base continua em `profiles` (1:1 `auth.users`). A entidade de negócio "colaborador" fica isolada:

- **departments** — `store_id, name, code (unique store), parent_id (self FK), manager_employee_id, is_active`.
- **job_positions** — `store_id, department_id, title, code, level (junior/pleno/senior/coord/gerente), description, is_active`.
- **employees** — `store_id, profile_id (nullable, vínculo com login), department_id, job_position_id, employee_code (matrícula, unique store), full_name, cpf, rg, birth_date, phone, whatsapp, email, hire_date, termination_date, employment_type (clt/pj/estagio/temporario), status (active/on_leave/terminated), photo_url, address jsonb, emergency_contact jsonb, salary_band_ref`.
- **employee_documents** — `employee_id, kind (contrato/rg/cpf/comprovante/asos/...), storage_path, url, mime, issued_at, expires_at`.
- **employee_role_assignments** — `employee_id, role_id, store_id, granted_by_employee_id, granted_at, revoked_at`. Quando um employee tem `profile_id` vinculado, esta tabela é a fonte de verdade que materializa registros em `user_roles` via trigger (mantém RBAC do app consistente com gestão de RH).
- **employee_history** — `employee_id, event_type (hire/promotion/department_change/salary_change/leave/return/termination), from_value jsonb, to_value jsonb, effective_date, registered_by`.

Regras:
- `employees.profile_id` é opcional → permite cadastrar colaborador sem login (ex.: equipe de produção sem acesso ao sistema).
- Acessar o sistema = ter `profile_id` + `employee_role_assignments` ativas que populam `user_roles`.
- Permissão `hr.manage` (novo) controla esse módulo. RLS escopado por `store_id`.

## A2. Fluxo formal de Compras

Já havia esqueleto de `suppliers` + `product_suppliers` + `purchase_orders` no item §2.15 anterior. Formalização completa:

```
Fornecedor (suppliers)
  ↓
Pedido de Compra (purchase_orders + purchase_order_items)
  ↓
Recebimento (goods_receipts + goods_receipt_items)   ← suporta recebimento parcial
  ↓
Entrada no Estoque  → inventory_movements(type='in', reference_type='goods_receipt')
  ↓
Atualização de custo (avg_cost ponderado) → trigger em inventory_movements
  ↓
Histórico em cost_history (com referência ao recebimento)
```

Tabelas:

- **suppliers** — conforme item 1 da revisão anterior.
- **product_suppliers** / **variant_suppliers** — vínculo N:N com `supplier_sku, cost, currency, min_order_qty, lead_time_days, is_primary, last_purchased_at`.
- **purchase_orders** — `store_id, supplier_id, po_number (sequencial por loja), status (draft/sent/confirmed/partial/received/canceled), currency, subtotal, freight_cost, tax_total, grand_total, expected_at, sent_at, confirmed_at, received_at, created_by_employee_id, notes`.
- **purchase_order_items** — `purchase_order_id, variant_id, qty_ordered, qty_received, unit_cost, discount, tax, total`.
- **goods_receipts** — `purchase_order_id, store_id, location_id (FK inventory_locations), received_by_employee_id, received_at, invoice_number, invoice_key, notes, status (draft/posted/canceled)`.
- **goods_receipt_items** — `goods_receipt_id, purchase_order_item_id, variant_id, qty, unit_cost, condition (ok/damaged/divergent)`.
- **supplier_invoices** — `supplier_id, goods_receipt_id, number, series, access_key, xml_url, pdf_url, status, issued_at, total`.

Integração:
- Ao "postar" um `goods_receipt` (status=posted):
  - Trigger gera N `inventory_movements(type='in', qty, unit_cost, reference_type='goods_receipt', reference_id)`.
  - Mesmo trigger recalcula `product_variants.avg_cost` (custo médio ponderado: `((on_hand * avg_cost) + (qty_in * unit_cost)) / (on_hand + qty_in)`) e atualiza `cost_price` (último).
  - Registra em `cost_history`.
  - Atualiza `purchase_order_items.qty_received` e move `purchase_orders.status` para `partial` ou `received`.

Permissões novas: `purchases.read`, `purchases.create`, `purchases.receive`, `suppliers.manage`.

## A3. Dashboard personalizável por perfil

Dashboard deixa de ser layout fixo e vira composição de widgets por papel/usuário:

- **dashboard_widgets** — catálogo de widgets disponíveis: `code (unique), name, description, component_key, default_size (sm/md/lg/xl), data_source (mv_name ou server_fn), default_permissions text[] (códigos que liberam o widget)`. Seed inicial: `sales_today, sales_mtd, avg_ticket, new_customers, approved_companies, top_products, low_stock, out_of_stock, pending_orders, abandoned_carts, payments_pending, shipments_in_transit, returns_open, reviews_pending, marketing_coupons_active`.
- **dashboard_layouts** — `store_id, owner_type (role/user), owner_id (role_id ou user_id), name, is_default, layout jsonb (grid posicional: [{widget_code,x,y,w,h,config}])`. Permite layout padrão **por papel** + override **por usuário**.
- **dashboard_role_defaults** (view ou seed em dashboard_layouts com owner_type='role') — define o dashboard padrão de cada papel:
  - **admin**: KPIs gerais + alertas operacionais + top produtos + faturamento.
  - **financeiro**: pagamentos pendentes, faturamento, ticket médio, devoluções/estornos, custos/margem.
  - **estoquista**: estoque baixo, sem estoque, recebimentos pendentes, ajustes recentes.
  - **marketing**: cupons ativos, carrinhos abandonados, avaliações pendentes, novos clientes, top produtos.
  - **expedicao**: pedidos a separar, etiquetas pendentes, envios em trânsito, atrasos de entrega.
  - **gerente**: visão consolidada (subset do admin + atalhos de aprovação).

Resolução em runtime:
1. Buscar layout `owner_type='user', owner_id=auth.uid()` (se existir = personalização do usuário).
2. Caso não exista, união dos layouts `owner_type='role'` para todos os roles do usuário.
3. Filtrar widgets cujos `default_permissions` o usuário NÃO possua via `has_permission`.

Permissão nova: `dashboard.customize` (libera o usuário a editar seu próprio layout).

## Resumo do impacto

- **+18 tabelas** (departments, job_positions, employees, employee_documents, employee_role_assignments, employee_history, suppliers, product_suppliers, variant_suppliers, purchase_orders, purchase_order_items, goods_receipts, goods_receipt_items, supplier_invoices, dashboard_widgets, dashboard_layouts) sobre o que já estava no documento.
- **+5 permissões** novas (`hr.manage`, `purchases.read`, `purchases.create`, `purchases.receive`, `suppliers.manage`, `dashboard.customize`).
- Zero impacto na Fase 1 — todas as adições entram em fases posteriores (HR e Compras na Fase 6/7; Dashboard composicional na Fase 6 do Admin).

