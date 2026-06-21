## Premissas (não-negociáveis)

- **Zero novas tabelas.** O esquema atual já comporta o modelo pedido:
  - `products` (engine principal)
  - `product_colors` (cor com `hex`, `is_default`, ligada a `attribute_values`)
  - `product_color_media` (imagens **por cor**, com `is_cover`, `is_hover_media`, `sort_order`)
  - `product_variants` (SKU, barcode, peso, dimensões, `product_color_id` + `size_attribute_value_id`)
  - `variant_attribute_values` (mapa genérico cor/tamanho/qualquer atributo → variante)
  - `stock_levels`, `price_lists`/`price_list_items`, `product_relations`, `audit_log`, `event_outbox`
- **Zero novos server functions de domínio.** Tudo passa pelos existentes: `products.functions.ts`, `inventory.functions.ts`, `dam.functions.ts`, `price-lists.functions.ts`, `product-relations.functions.ts`, `audit.functions.ts`.
- **Zero migrations.** Só refactor de UI + thin wrappers de orquestração quando faltar uma operação CRUD pontual sobre tabelas já existentes (ex.: `product_colors`, `product_variants`, `variant_attribute_values`, `product_color_media`).
- **RLS/RBAC intactos.** Permissões continuam `products.read` / `products.update` / `products.write` escopadas por `store_id` (já corrigidas no commit de segurança anterior).
- **SKU permanece a única chave operacional** para estoque, pedidos, pagamento, NF e frete. Nada disso é tocado.

## Arquitetura das 9 abas

A tela `admin.products.$id.edit.tsx` (hoje 1235 linhas, monolítica) é quebrada em uma **shell** + 9 abas isoladas, cada uma em seu próprio arquivo:

```text
src/components/admin/products/edit/
  product-edit-shell.tsx          # tabs, breadcrumb, readiness, save bar
  tabs/
    general-tab.tsx               # nome, descrição, tipo, marca, sale_channel
    organization-tab.tsx          # categorias, coleções, tags, atributos do produto-pai
    variants-tab.tsx              # ⭐ centro do sistema (ver abaixo)
    gallery-tab.tsx               # galeria por COR (não por variante)
    pricing-tab.tsx               # preço base, listas de preço, promoção
    seo-tab.tsx                   # slug, meta title/desc, OG image
    relations-tab.tsx             # cross-sell / up-sell / acessórios
    publish-tab.tsx               # status, visibilidade, canais, agenda
    history-tab.tsx               # audit_log + product_history (já existe drawer)
  variants/
    variant-generator.tsx         # seletor de atributos + botão "Gerar Variantes"
    variant-matrix-table.tsx      # tabela editável: cor × tamanho × SKU/EAN/estoque/peso/preço
    color-row-editor.tsx          # cor: nome, hex, swatch, default
    color-gallery-panel.tsx       # galeria filtrada pela cor selecionada
```

A rota `admin.products.$id.edit.tsx` passa a ser um arquivo curto que monta o shell. O conteúdo monolítico antigo é movido para os arquivos acima — não há lógica nova de negócio.

## Aba Variantes — fluxo

1. **Seleção de atributos** (reusa `attributes.functions.ts` + `attribute-values.functions.ts`):
   - Atributo "Cor" obrigatório (mapeia para `product_colors`).
   - Atributo "Tamanho" opcional (mapeia para `product_variants.size_attribute_value_id`).
   - Atributos extras opcionais (mapeados via `variant_attribute_values`).
2. **Gerar Variantes** (botão): produz o produto cartesiano das opções selecionadas.
   - Para cada cor nova: insert em `product_colors` (com `attribute_value_id`, `hex`, `is_default` na primeira).
   - Para cada combinação cor × tamanho × extras: insert em `product_variants` (SKU autogerado `${product.slug}-${color.code}-${size.code}`, editável) + linhas em `variant_attribute_values`.
   - Combinações já existentes são preservadas (idempotente, casa pela tupla de attribute_value_ids).
3. **Tabela editável** com colunas:
   - Cor (read-only, lookup) · Tamanho (read-only) · SKU · Código de barras · Estoque (lê `stock_levels` agregado da loja ativa, edita via `inventory.functions.ts`) · Peso · Preço · Preço promocional · Status (is_active).
   - Edição inline com debounce; salva variante a variante via wrapper de update.
4. **Galeria por cor**: ao clicar numa linha/cor, abre painel lateral mostrando `product_color_media` daquela cor. Upload usa `dam.functions.ts` (cria asset + link `product_color`); a tabela `product_color_media` recebe `storage_path`/`external_url` espelhados a partir do asset (já é o padrão atual). Reordenação por drag-and-drop atualiza `sort_order`.

## Aba Galeria

- View consolidada de todas as cores. Cada cor mostra suas mídias. Não há "imagens do produto" soltas — toda imagem pertence a uma cor (regra do usuário).
- Botão "definir como capa" grava `is_cover=true` (único por cor).

## Loja pública (preparação, não escopo desta entrega de UI admin)

- Os dados ficam prontos para a vitrine: `product_colors` + `product_color_media` + `product_variants` + `variant_attribute_values` já modelam:
  - Troca de galeria ao selecionar cor.
  - Recalcular tamanhos disponíveis: filtrar `product_variants WHERE product_color_id = X AND is_active AND stock>0`.
  - Habilitar "Adicionar ao Carrinho" só com (cor, tamanho) válidos: a variante resultante tem um SKU único.
- Esta entrega **não** mexe na storefront pública — só garante o cadastro correto.

## Server functions reutilizadas (sem alterações)

| Capability | Função existente |
|---|---|
| CRUD produto | `products.functions.ts` (list/get/create/update/publish/unpublish/archive/duplicate/readiness/history/audit) |
| Estoque por SKU | `inventory.functions.ts` |
| Preços / listas | `price-lists.functions.ts` |
| Mídia / upload | `dam.functions.ts` (`createUploadJob`, `signUploadJob`, `completeUploadJob`, `linkAsset`) |
| Relacionados | `product-relations.functions.ts` |
| Auditoria | `audit.functions.ts` + `listProductAudit` |
| Filhos / variantes existentes | `product-children.functions.ts` |
| Atributos / valores | `attributes.functions.ts`, `attribute-values.functions.ts`, `category-attributes.functions.ts` |

## Wrappers thin (apenas se ainda não existirem)

Onde já houver função, **não criar**. Onde faltar, adicionar mínimo necessário em `src/lib/business/services/products.server.ts` + `products.functions.ts`:

- `listProductColors(productId)` / `upsertProductColor(...)` / `deleteProductColor(id)`
- `listProductVariants(productId)` / `upsertProductVariants(rows[])` (bulk para o "Gerar Variantes") / `updateVariant(...)` / `deleteVariant(id)`
- `listColorMedia(colorId)` / `attachAssetToColor(colorId, assetId)` / `reorderColorMedia(items)` / `setColorCover(colorId, mediaId)`

Cada wrapper:
- Resolve `store_id` via `product_store_id(product_id)`.
- Aplica `has_permission(userId, 'products.update', store_id)`.
- Grava `audit_log` (entity `product_variant` / `product_color`) reutilizando o helper de auditoria já existente.
- Emite `event_outbox` (`product.variant.created/updated/deleted`, `product.color.media.attached`) usando o dispatcher já existente — sem nova tabela.

Total esperado: ~250 linhas em `services/products.server.ts`, ~80 em `products.functions.ts`.

## Histórico (aba 9)

Reusa `listProductHistory` + `listProductAudit` (já existem) e o componente `product-history-drawer.tsx` (vira o conteúdo da aba em vez de drawer).

## Telemetria

Eventos de UX via `useTelemetry()` existente: `product.tab.viewed`, `product.variants.generated` (`{combinations, colors, sizes}`), `product.variant.edited`, `product.color.media.uploaded`, `product.published`.

## Detalhes técnicos

- TanStack Query: cada aba tem seu `queryOptions` próprio, invalida só o que mudou (`['product', id, 'variants']`, `['product', id, 'colors']`, etc.). Save bar do shell escuta `isDirty` agregado.
- Tabela de variantes: `@tanstack/react-table` (já é dependência), edição inline com Zod por linha, salvamento otimista e rollback em erro.
- Geração de combinações: util puro `generateVariantCombinations(colors[], sizes[], extras[][])` testável isoladamente.
- Validações de SKU único por loja: tratamento de violação de constraint do banco (já existe `UNIQUE (store_id, sku)` no esquema), com mensagem amigável.
- Acessibilidade: tabs com aria-roles, foco gerenciado ao trocar aba, atalhos `Ctrl/Cmd+S`.

## Arquivos alterados (resumo)

**Refatorados / quebrados:**
- `src/routes/_authenticated/admin.products.$id.edit.tsx` — reduzido a ~80 linhas (shell + tabs router).
- `src/components/admin/products/product-history-drawer.tsx` — adaptado para uso embarcado na aba.

**Novos componentes de UI** (sem nova lógica de negócio):
- 9 arquivos em `src/components/admin/products/edit/tabs/`
- `src/components/admin/products/edit/product-edit-shell.tsx`
- 4 arquivos em `src/components/admin/products/edit/variants/`
- `src/lib/products/variant-combinations.ts` (util puro + testes)

**Backend (apenas wrappers thin)**:
- `src/lib/business/services/products.server.ts` — adiciona seções `colors`, `variants`, `colorMedia`.
- `src/lib/business/products.functions.ts` — adiciona os server fns correspondentes.

**Não tocados** (reuso integral): `inventory.*`, `dam.*`, `price-lists.*`, `product-relations.*`, `audit.*`, `product-children.*`, `attributes*.*`, integração de checkout, pagamento, NF, frete.

## Entrega final

Ao concluir, gero relatório de auditoria técnica listando:
- Diff por arquivo (linhas alteradas/adicionadas/removidas)
- Componentes/services reutilizados (com link)
- Confirmação de zero migrations, zero novas tabelas, zero novos engines
- Mapa "operação UI → server fn existente"
- Checklist de RLS/RBAC validados por aba.
