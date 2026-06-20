# Fase 4.2 — Central de Produtos ✅ Concluída

Implementação 100% sobre a Business Layer (Server Functions + RBAC + RLS). Nenhuma tela acessa o banco diretamente.

---

## Relatório técnico de entrega

### Migration

- `permissions`: novos códigos `products.archive`, `products.duplicate`, `products.import`, `products.export`.
- `role_permissions`: vinculadas a `admin`, `manager`, `super_admin`.
- Bucket de mídia: **não criado por SQL** (bloqueado pela plataforma). Galerias usam URLs externas (imagem direta, YouTube, Vimeo). Upload via Storage pode ser adicionado depois pela UI do Supabase.

### Camada de Negócio

```text
src/lib/business/
  products.functions.ts           # controllers principais
  product-children.functions.ts   # controllers de cores / mídia / atributos / variantes / preços
  services/
    products.server.ts            # CRUD, publicação, readiness, operações
    product-children.server.ts    # sub-entidades + gerador de variantes
```

Server functions expostas:
- **CRUD/Publicação**: `listProducts`, `getProduct`, `createProductDraft`, `updateProduct`, `deleteProduct`, `publishProduct`, `unpublishProduct`, `getProductReadiness`.
- **Operações 4.2C**: `archiveProduct`, `duplicateProduct`, `exportProducts`, `importProducts`, `listProductHistory`, `listProductAudit`.
- **Cores**: `listProductColors`, `createProductColor`, `updateProductColor`, `deleteProductColor`.
- **Galeria**: `listColorMedia`, `addColorMedia`, `updateColorMedia`, `deleteColorMedia`.
- **Atributos**: `listProductAttributes`, `setProductAttribute`.
- **Variantes**: `listProductVariants`, `generateProductVariants` (combinatória idempotente cor × tamanho), `deleteProductVariant`.
- **Preços**: `listProductPrices`, `setVariantPrice` (upsert por `price_list × variant`).

Todas validam permissões via `requirePermission` (super-admin sempre passa) e emitem eventos no `domain_events` via `dispatchEvent`.

### Readiness (checklist server-side)

`getProductReadiness` calcula no servidor 8 etapas — geral, atributos obrigatórios, cores, capa por cor, variantes, preços, SEO, publicação — devolvendo `{ steps, progress (0-100), canPublish, issues[] }`. É a fonte de verdade do stepper, da barra de progresso e do botão Publicar.

### UI Administrativa

```text
src/components/admin/products/
  product-assistant-drawer.tsx    # Fase 4.2A — wizard de criação
  product-operations-menu.tsx     # Fase 4.2C — duplicar/arquivar/exportar/...
  product-history-drawer.tsx      # histórico (domain_events) + auditoria (audit_log)
  product-wizard-stepper.tsx      # stepper + progresso + checklist
  product-preview.tsx             # preview da página do produto

src/routes/_authenticated/
  admin.products.tsx              # lista com filtros (status, busca)
  admin.products.$id.edit.tsx     # wizard 8 etapas (Fase 4.2B)
```

Wizard layout em 3 colunas (stepper • etapa ativa • preview live).

### Eventos emitidos

`product.created`, `product.updated` (com sub-tipos `published`, `variants_generated`, `archived`), `product.deleted`. Disponíveis para futuros consumidores (e-mail, WhatsApp, ERP, marketplace, analytics) via `domain_events`.

### Segurança

- RBAC: cada operação exige a permissão correspondente.
- Tenant: toda escrita filtrada por `store_id` resolvido server-side.
- RLS no banco como último cinto.
- `inputValidator` em todas as Server Functions.

---

## Próximos passos sugeridos

1. Upload nativo no bucket `product-media` (criar via Supabase Studio, depois adicionar UI `UploadField` na galeria).
2. Importação via CSV/XLSX (parser no front + chamada em lote).
3. Drag-and-drop para reordenar mídias e cores.
4. Editor rich-text para `description`.
5. Página pública `/p/$slug` para o preview/share funcionarem.
