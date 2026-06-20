# Fase 4.2 — Central de Produtos

Implementação em 3 partes, 100% sobre a Business Layer (Server Functions + RBAC + RLS). Nenhuma tela toca o banco diretamente.

---

## Arquitetura Geral

```text
src/lib/business/
  products.functions.ts          # CRUD base + duplicate/archive/export
  product-colors.functions.ts    # cores + galeria
  product-variants.functions.ts  # geração automática SKUs
  product-attributes.functions.ts
  product-prices.functions.ts    # price_list_items por variante
  product-seo.functions.ts
  product-publish.functions.ts   # validação + publicação
  services/
    products.server.ts           # regras de negócio
    variants-generator.server.ts # combinatória cor × tamanho
    product-validator.server.ts  # checklist + readiness
```

Eventos emitidos: `product.created`, `product.updated`, `product.published`, `product.archived`, `product.duplicated`, `variant.generated`, `color.media.updated`.

---

## FASE 4.2A — Assistente de Criação (modal compacto)

Rota: `/admin/products` (lista) + botão **"Novo Produto"** abre Drawer Assistant.

Campos mínimos obrigatórios:
- Categoria (select async — `listCategories`)
- Marca (select async — `listBrands`)
- Coleção (select async, opcional)
- Nome
- SKU Root (auto-sugestão a partir do nome; validação de unicidade via server fn)

Server function: `createProductDraft` → cria `products` com `status='draft'`, devolve `id` e redireciona para o Wizard `/admin/products/$id/edit`.

Componente: `src/components/admin/products/product-assistant-drawer.tsx`.

---

## FASE 4.2B — Wizard de Configuração

Rota: `/admin/products/$id/edit` (layout próprio com sidebar de etapas + barra de progresso + painel de preview).

```text
┌─────────────────────────────────────────────────────────┐
│ Header: nome do produto | status | ações rápidas        │
├──────────────┬──────────────────────────┬───────────────┤
│ Stepper      │ Etapa ativa              │ Preview Live  │
│ + Checklist  │ (formulário)             │ (iframe-like) │
│ + Progresso  │                          │               │
└──────────────┴──────────────────────────┴───────────────┘
```

### Etapas

1. **Informações Gerais** — nome, descrição rica, categoria, marca, coleção, tags, fornecedor.
2. **Atributos** — herda `category_attributes`; preenche `product_attribute_values`.
3. **Cores** — adiciona N cores (`product_colors`), define cor default.
4. **Galeria da Cor** — por cor selecionada: upload/URL de mídia (`product_color_media`), capa, hover, ordem, YouTube/Vimeo.
5. **Geração de Variantes** — escolhe atributo "tamanho" (ou similar) com seus valores selecionados; server fn `generateVariants` cria combinações `cor × tamanho` em `product_variants` com SKU = `{SKU_ROOT}-{CorCode}-{TamCode}`. Idempotente (skip de existentes).
6. **Preços** — tabela por variante × `price_lists` (preço, preço promocional). Server fn em lote.
7. **SEO** — slug, meta_title, meta_description, OG image (usa capa por padrão).
8. **Publicação** — valida readiness checklist (cores ≥ 1, variante default, capa por cor, preço na price list default, SEO mínimo). Server fn `publishProduct` muda `status='active'`.

### Componentes
- `product-wizard-layout.tsx`
- `product-wizard-stepper.tsx` (checklist + progresso calculado server-side via `getProductReadiness`)
- `product-preview-panel.tsx` (renderiza preview com dados do React Query — sem fetch direto)
- `steps/` (um arquivo por etapa)

### Readiness (server)
`getProductReadiness(productId)` retorna `{ steps: [{ key, label, complete, issues[] }], progress: 0-100, canPublish: bool }`. Usado pelo stepper e pelo botão Publicar.

---

## FASE 4.2C — Operações

Painel de ações no header do produto + menu na lista:

| Ação | Server Function | Efeito |
|---|---|---|
| Duplicar | `duplicateProduct` | clona produto + cores + mídias + variantes (novo SKU root) |
| Arquivar | `archiveProduct` | `status='archived'` + evento |
| Exportar | `exportProducts` | JSON/CSV via server fn (download) |
| Importar | `importProducts` | upload JSON validado por Zod, em lote |
| Histórico | `listProductHistory` | lê `domain_events` filtrado por aggregate |
| Auditoria | `listProductAudit` | lê `audit_log` filtrado por entity |
| Preview Loja | link público `/p/$slug` (futuro) | apenas link |
| Compartilhar | client-side copy link |  |

UI: `product-operations-menu.tsx` + `product-history-drawer.tsx` + `product-import-dialog.tsx`.

---

## Detalhes Técnicos

- **Permissões** novas (migration): `products.create`, `products.update`, `products.delete`, `products.publish`, `products.archive`, `products.duplicate`, `products.import`, `products.export`. Atribuídas a `admin`, `manager`. Verificadas em cada server fn via `requirePermission`.
- **Multi-tenant**: todas as fns recebem/derivam `store_id` ativo (hook `useActiveStore`). RLS já cobre.
- **Validação**: Zod em `inputValidator` de cada server fn.
- **React Query**: query keys `['product', id]`, `['product', id, 'readiness']`, `['product', id, 'variants']`, etc. Mutations invalidam chaves relevantes.
- **Upload de mídia**: usa Supabase Storage via server fn que retorna signed URL (bucket `product-media` criado por migration).
- **Sem acesso direto ao banco** no client: toda leitura/escrita por `useServerFn` + Query.

---

## Ordem de execução

1. Migration: permissões novas + bucket `product-media` + storage policies.
2. Server layer: products / colors / variants / prices / seo / publish / operations.
3. UI 4.2A (assistant drawer + lista de produtos com filtros).
4. UI 4.2B (wizard layout + 8 etapas + preview + readiness).
5. UI 4.2C (operações + histórico + import/export).
6. Relatório final.

Confirma para eu começar pela migration + camada server?
