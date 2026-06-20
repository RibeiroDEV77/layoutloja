# Plan Técnico — Sistema Layout (ERP de Moda)

> **Status:** Arquitetura congelada após Fase 2.6 (Consolidação).
> Última atualização: Junho/2026.

---

## 0. Stack

- **Frontend/SSR:** TanStack Start v1 + React 19 + Vite 7 + TailwindCSS v4 + shadcn/ui
- **Backend:** Server Functions (`createServerFn`) — sem Edge Functions para lógica interna
- **Banco/Auth/Storage:** Supabase (PostgreSQL + RLS + Auth + Storage)
- **Multi-tenant:** sim, por `store_id` em toda entidade de domínio

---

## 1. Fases concluídas

| Fase | Escopo | Status |
|---|---|---|
| 1 — Fundação | RBAC, RLS, Auditoria, Logs, Multi-tenant | ✅ |
| 2 — Catálogo | Produto → Cor → Galeria → SKU → Preço | ✅ |
| 2.5 — Auth Bootstrap | Login, Reset, Super Admin, Sidebar, Layout Admin | ✅ |
| 2.6 — Consolidação | Auditoria + Congelamento | ✅ |
| 2.7 — Domain Events | `domain_events`, `domain_event_subscriptions`, `emit_domain_event()` | ✅ |
| 3 — Operação Comercial | Fornecedores, Compras, Recebimento, Estoque, Inventários, Transferências, Custos | ✅ Schema |

---

## 2. Banco de Dados (44 tabelas)

### Fundação (10)
`stores`, `store_settings`, `profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_sessions`, `audit_log`, `system_logs`

### Catálogo — Taxonomia (7)
`categories`, `brands`, `collections`, `tags`, `attributes`, `attribute_values`, `category_attributes`

### Catálogo — Produto (4)
`products`, `product_tags`, `product_collections`, `product_attribute_values`

### Catálogo — Cor e Mídia (2)
`product_colors`, `product_color_media` (image / video / youtube / vimeo)

### Catálogo — Variantes (2)
`product_variants`, `variant_attribute_values`

### Catálogo — Preços (4)
`customer_groups`, `price_lists`, `price_list_customer_groups`, `price_list_items`

### Domain Events — Fase 2.7 (2)
`domain_events` (append-only, status: pending/processing/processed/failed/skipped), `domain_event_subscriptions` (canais: webhook/email/whatsapp/internal/erp/marketplace).
Helper: `emit_domain_event(event_type, aggregate_type, aggregate_id, store_id, payload, metadata)`.
Eventos previstos: `product.*`, `inventory.*`, `purchase.*`, `order.*`, `customer.*`, `company.*`, `payment.*`, `shipment.*`, `invoice.*`.

### Operação Comercial — Fase 3 (13)
- **Fornecedores**: `suppliers`, `supplier_contacts`
- **Armazéns/Estoque**: `warehouses`, `stock_levels`, `stock_movements` (append-only)
- **Custos**: `cost_history` (imutável, métodos: average/fifo/lifo/standard/last)
- **Compras**: `purchase_orders`, `purchase_order_items`
- **Recebimento**: `goods_receipts`, `goods_receipt_items`
- **Inventários**: `inventory_counts`, `inventory_count_items`
- **Transferências**: `stock_transfers`, `stock_transfer_items`

Novas permissões RBAC: `suppliers.read/manage`, `purchases.read/manage`, `inventory.read/manage` — concedidas a `super_admin`, `admin`, `manager`.

---

## 3. Hierarquia oficial e imutável

```text
Produto
  └── Cor (product_colors)
        ├── Galeria da Cor (product_color_media)
        └── Tamanho → SKU (product_variants)
                       ├── Preço (price_list_items × customer_groups)
                       └── Estoque (Fase 3)
```

Regras invioláveis:
- Mídia pertence à COR, nunca à variante.
- Toda variante pertence a uma cor (`product_color_id NOT NULL`).
- Atributos de variação são definidos por `category_attributes.is_variant_axis`.

---

## 4. Segurança

### Autenticação
- Supabase Auth (email/senha + Google OAuth).
- Trigger `on_auth_user_created` → `handle_new_user` cria `profiles` automático.
- Bootstrap: `claim_first_super_admin()` (1 único uso, bloqueado depois).

### RBAC
- Modelo: `user_roles → roles → role_permissions → permissions`
- 10 papéis seed + 28 permissões (módulos: products, orders, inventory, purchases, suppliers, customers, finance, costs, marketing, shipping, hr, stores, settings, users, dashboard, audit, system).
- Escopo opcional por loja (`user_roles.store_id`).

### RLS
- Habilitada em **todas** as 29 tabelas.
- Padrão: membros da loja leem, escrita gated por `has_permission(_user, _code, _store)`.
- Leitura pública (`TO anon`) apenas em catálogo publicado (`products.status='published' AND visibility IN (published, catalog_only)`).

### SECURITY DEFINER (12 funções)
RBAC: `has_role`, `has_permission`, `is_super_admin`, `user_store_ids`
Escopo: `product_store_id`, `color_store_id`, `variant_store_id`
Bootstrap/UI: `claim_first_super_admin`, `super_admin_exists`, `current_user_context`
Triggers: `set_updated_at`, `handle_new_user`, `audit_row_change`, `validate_product_color_media`, `enforce_single_default_color`, `enforce_single_cover_media`

Todas com `SET search_path = public`. EXECUTE revogado de `public`/`anon` quando aplicável.

### Auditoria & Logs
- `audit_log` — INSERT/UPDATE/DELETE automáticos em `products`, `product_variants`, `price_list_items` via trigger genérico.
- `system_logs` — eventos técnicos, com policy de escopo.

---

## 5. Storage

### Bucket único: `product-media` (privado)

### Padrão de path
```
{store_id}/{product_id}/{product_color_id}/{uuid}.{ext}
```

### Suporte de mídia
- `image` / `video` → arquivo físico no bucket (`storage_path`)
- `youtube` / `vimeo` → apenas `external_id` + `external_url` (sem upload)
- Validação por trigger garante coerência entre `media_type` e campos

### Escala
- Estrutura por hash de UUID evita hot-partition.
- Acesso via signed URL (24h) para escrita; leitura pública apenas para produtos publicados.
- Compatível com milhões de objetos (R2/S3-class).

> Bucket será criado na primeira tela de upload da Fase 3+.

---

## 6. Escalabilidade-alvo

| Métrica | Capacidade |
|---|---|
| Lojas | 20+ |
| Produtos | 500 mil |
| Mídias | 2 milhões |
| Clientes | 150 mil |
| Pedidos/dia | milhares |

A arquitetura suporta o alvo. Pontos críticos endereçados:
- Particionamento lógico por `store_id` em toda escrita.
- Índices parciais em `products` para flags de vitrine.
- FK em cascata controlada (cascade apenas onde a perda é desejável).
- Catálogo público lê apenas linhas publicadas (subconjunto reduzido).

---

## 7. Performance — índices recomendados antes da Fase 3

Já existem 100+ índices. Adicionar antes da Fase 3:

```sql
-- Buscas frequentes de catálogo público
CREATE INDEX idx_products_store_published
  ON public.products(store_id, published_at DESC)
  WHERE status='published' AND visibility IN ('published','catalog_only');

-- Variantes ativas por produto (ordem natural de listagem)
CREATE INDEX idx_variants_product_active
  ON public.product_variants(product_id) WHERE is_active=true;

-- Preço efetivo por variante (lookup hot path)
CREATE INDEX idx_pli_variant_pricelist
  ON public.price_list_items(variant_id, price_list_id);

-- Auditoria — consulta por entidade
CREATE INDEX idx_audit_entity
  ON public.audit_log(entity, entity_id, created_at DESC);

-- system_logs — recência
CREATE INDEX idx_syslogs_created
  ON public.system_logs(created_at DESC);

-- user_roles — lookup por (user, store)
CREATE INDEX idx_user_roles_user_store
  ON public.user_roles(user_id, store_id);
```

> Estes índices serão emitidos no início da Fase 3 (uma migration única).

---

## 8. Constraints & Cascatas

- `ON DELETE CASCADE`: relações compositivas (categories.parent, products→colors→media→variants, price_list_items, role_permissions, etc.).
- `ON DELETE SET NULL`: associações fracas (products.category_id, products.brand_id).
- `ON DELETE RESTRICT`: atributos referenciados por variantes (proteção contra exclusão acidental).
- Validações usam **triggers** (não CHECK) para suportar lógica temporal.

---

## 9. Frontend / Painel

- `/` Landing pública
- `/auth` Login/Cadastro/Google/Forgot
- `/reset-password` Recovery
- `/_authenticated/` Gate (ssr:false → /auth)
- `/_authenticated/admin/*` Painel + Sidebar com filtragem por permissão
- Hook `useAuth()` central: `hasRole`, `hasPermission`, `isSuperAdmin`, `signOut` higienizado

---

## 10. Fase 3 — Operação (planejada, não implementada)

Escopo aprovado:
- **Fornecedores** (`suppliers`)
- **Compras** (`purchase_orders`, `purchase_order_items`)
- **Recebimento** (`goods_receipts`, `goods_receipt_items`)
- **Movimentações de estoque** (`inventory_movements`)
- **Estoque por local** (`warehouses`, `inventory_levels`)
- **Custos** (`variant_costs` + custo médio recalculado)
- **Histórico de custos** (`cost_history`)
- **Inventários** (`stock_counts`, `stock_count_items`)
- **Transferências entre lojas/depósitos** (`stock_transfers`, `stock_transfer_items`)

Todas as FKs já preparadas em `product_variants.id`.

---

## 11. Arquitetura CONGELADA

A partir desta data, **nenhuma alteração estrutural** deve ser feita sem:
1. Atualização explícita deste documento;
2. Aprovação do plano;
3. Migration revisada.
