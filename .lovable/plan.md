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
| 3.5 — Business Layer | Server Functions + Services + Repositories + Event Dispatcher | ✅ |

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

---

## 12. Fase 4 — Painel Administrativo (Infraestrutura Visual) ✅

Biblioteca de componentes administrativos genéricos em `src/components/admin/`, totalmente desacoplada de domínio. Toda interação com dados deve ocorrer via Server Functions da Business Layer (`src/lib/business/*.functions.ts`); nenhuma página acessa Supabase diretamente.

### Layout & Navegação
- `BreadcrumbProvider` + `usePageBreadcrumbs([...])` — trilha controlada pelas páginas
- `AdminBreadcrumb` — render do trail (chevron + links tipados)
- `AdminHeader` — sticky, integra `SidebarTrigger`, breadcrumb, avatar + menu de usuário, logout higienizado
- `AppSidebar` — já existente, filtragem por `hasPermission` (RBAC)
- `AdminLayout` (`_authenticated/admin.tsx`) — envolve tudo com `BreadcrumbProvider` + `SidebarProvider`

### Estrutura de página
- `CrudPage` — header (título/descrição/ações) + toolbar slot + conteúdo; registra breadcrumbs automaticamente
- `CrudToolbar` — grid responsivo `[content | actions]`

### Listagem & dados
- `DataTable<T>` genérico — colunas tipadas, ordenação controlada, seleção múltipla, row click, integra estados de loading/erro/vazio nativamente
- `CrudPagination` — page/pageSize/total com `pageSizes` configurável
- `CrudSearch` — input debounced com clear button
- `CrudFilters` — popover de filtros com badge de count + clear
- `CrudActions` — dropdown de ações por linha (suporta `destructive`, `hidden`, `disabled`)

### Formulários & diálogos
- `CrudDrawer` — sheet lateral com footer padrão (`onSubmit`/`submitLabel`) ou customizado
- `CrudDeleteDialog` — confirmação destrutiva especializada
- `ConfirmDialog` — confirmação genérica com loading state
- `FormField` / `FormRow` / `FormSection` — wrappers com label, descrição, erro, hint, required
- `SelectField` — select com options tipadas
- `MultiSelectField` — combobox com chips removíveis
- `UploadField` — upload único (validação de tamanho, preview de imagem)
- `ImageGalleryField` — galeria multi-upload com drag-to-reorder
- `ColorPicker` — color input + hex manual + presets

### Feedback
- `StatusBadge` + `statusToTone()` — badges com 6 tons semânticos (success/warning/danger/info/muted/default)
- `EmptyState` — ícone + título + descrição + ação customizável
- `ErrorState` — extrai mensagem de qualquer erro, botão "tentar novamente"
- `LoadingSpinner` / `FullPageLoading` / `TableSkeleton` / `CardSkeleton` / `FormSkeleton`
- `notify` — wrapper sonner (`success`/`error`/`info`/`warning`/`loading`/`promise`)
- `unwrap(result)` — converte `BizResult<T>` em `T` ou lança erro tipado
- `runAction(fn, msgs)` — executa server function com toast de loading/success/error automático

### Widgets
- `Widget` — card base com size (`sm`/`md`/`lg`/`xl`/`full`), título, ícone, ações, footer, loading
- `WidgetGrid` — grid responsivo 12 colunas
- `StatWidget` — KPI card (valor + hint + trend %)

### Princípios
- **Genéricos**: nenhum componente conhece domínio (suppliers/products/etc.)
- **Tipados**: `DataTable<T>`, `BizResult<T>`, `SelectOption`, `Crumb`, `WidgetSize` etc.
- **Responsivos**: padrão `grid-cols-[minmax(0,1fr)_auto]` + `min-w-0` + `shrink-0`
- **Acessíveis**: labels, aria, focus-visible
- **Reutilização**: import único `from "@/components/admin"`

### Próximo passo (Fase 4.1)
Módulos funcionais consumindo essa biblioteca — começar por **Fornecedores** (`/admin/suppliers`) usando `listSuppliers`/`createSupplier`/`updateSupplier`/`deleteSupplier`, seguindo depois Categorias, Marcas, Coleções, Produtos, Atributos, Variações, Galeria, Preços, Estoque.

---

## 13. Fase 4.1 — Cadastro Mestre ✅

Construção por fluxo operacional (não por módulos isolados): todos os cadastros base que servirão de fundação para a Fase 4.2 (Produtos).

### Camada de Negócio (extensão)
Novo serviço genérico `services/master.server.ts` (`listGeneric`, `createGeneric`, `updateGeneric`, `deleteGeneric`) parametrizado por `MasterConfig { table, permission, readPermission, searchCols, defaultSort, defaultSortDir }`. Toda escrita verifica `requirePermission(supabase, userId, perm, storeId)`; toda leitura verifica `requireStoreAccess` + permissão de read OU write.

Serviços especializados (parent-scoped) — não usam o generic:
- `services/attribute-values.server.ts` — escopo herdado de `attributes.store_id`
- `services/category-attributes.server.ts` — pivot category × attribute, valida que ambos pertencem à mesma loja

Suppliers ganhou `listSuppliers` (paginação, busca por razão/fantasia/CNPJ/código, filtro `is_active`).

### Server Functions (controllers)
- `categories.functions.ts` — list/create/update/delete (perm: `products.update`)
- `brands.functions.ts` — list/create/update/delete (perm: `products.update`)
- `collections.functions.ts` — list/create/update/delete (perm: `products.update`)
- `attributes.functions.ts` — list/create/update/delete (perm: `products.update`)
- `attribute-values.functions.ts` — list/create/update/delete (parent-scoped)
- `category-attributes.functions.ts` — list/create/update/delete (pivot)
- `customer-groups.functions.ts` — list/create/update/delete (perm: `settings.manage`)
- `price-lists.functions.ts` — list/create/update/delete (perm: `settings.manage`)
- `suppliers.functions.ts` — agora exporta `listSuppliers` (além de create/update/delete)

Toda controller envolvida em `withBusiness()` → resposta `BizResult<T>` serializável.

### Infraestrutura UI
- `useActiveStore()` + `ActiveStoreProvider` — gerencia a loja ativa (persiste em `localStorage`, fallback para primeira loja do usuário / primeira loja acessível para super admin).
- `StoreSwitcher` — popover no `AdminHeader`. Esconde-se com 0 lojas, mostra label com 1, mostra picker com 2+.
- `MasterCrudPage<T>` — componente reutilizável: orquestra `useQuery` (lista), `useServerFn`, `CrudDrawer` (form), `CrudDeleteDialog`, `CrudSearch`, `CrudPagination`, `CrudActions`, `DataTable`, paginação, busca, breadcrumbs. Plug-and-play com qualquer trio create/update/delete + columns + renderForm.

### Páginas (9)
Todas em `src/routes/_authenticated/admin.*`:
- `/admin/categories` — `MasterCrudPage`, com seletor de categoria pai (slug auto-gerado)
- `/admin/brands` — `MasterCrudPage`, com preview do logo na tabela
- `/admin/collections` — `MasterCrudPage`, com tipo manual/smart
- `/admin/attributes` — `MasterCrudPage`, com flags `is_color`/`is_size` (eixos de variação)
- `/admin/attribute-values` — bespoke (parent-scoped), seletor de atributo no toolbar
- `/admin/category-attributes` — bespoke (pivot), seletor de categoria + atributos disponíveis filtrados
- `/admin/customer-groups` — `MasterCrudPage`, com enum `kind` e `default_discount_pct`
- `/admin/price-lists` — `MasterCrudPage`, com moeda, prioridade e vigência
- `/admin/suppliers` — `MasterCrudPage` com formulário seccionado (Identificação / Contato / Comercial)

### Sidebar (RBAC)
Sidebar atualizada com todas as novas rotas, filtradas por permissão. Itens "Atributos", "Valores de Atributos", "Atributos × Categoria", "Grupos de Clientes", "Listas de Preço" agora aparecem.

### Garantias
- **Nenhuma tela acessa Supabase diretamente** — toda I/O passa por `useServerFn` → `createServerFn` → service → repository.
- **Multi-tenant rigoroso** — todas as operações são bound a `store_id` (validado server-side).
- **Padrão de feedback** — todas as ações usam `runAction(fn, { loading, success })` para toasts automáticos de loading/sucesso/erro.
- **Reuso visual** — todas as 9 páginas reutilizam a mesma biblioteca da Fase 4 (DataTable, CrudDrawer, CrudDeleteDialog, FormField, etc.). Inclusive as duas páginas bespoke (attribute-values, category-attributes).

### Próximo passo — Fase 4.2: Cadastro Inteligente de Produtos
Wizard de 8 etapas: Básicas → Atributos → Cores → Galeria → Geração de Variantes (auto SKU) → Preços → SEO → Publicação.
