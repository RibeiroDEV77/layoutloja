## Sistema de Filtros por Categoria — Painel + Loja

Implementar um sistema de filtros 100% dinâmico, administrado pelo Painel e consumido pela Loja Pública. Sem listas fixas no código.

### 1. Banco (migração)

O schema já tem `attributes`, `attribute_values`, `category_attributes`, `product_attribute_values`. Vou apenas complementar:

- Adicionar em `attributes`: `is_filterable boolean default true`, `filter_ui text default 'checkbox'` (`checkbox` | `color` | `size` | `range`), `filter_order int default 0`.
- Adicionar em `category_attributes`: `show_in_filters boolean default true`, `filter_order int default 0`.
- View `public.v_category_filters` que retorna, por `category_id`, a lista de atributos visíveis + seus valores ativos, ordenados.
- View `public.v_category_filter_counts` (opcional, fase 2) com contagem de produtos por valor para a categoria atual.
- GRANTs e políticas: `SELECT TO anon` nas views (somente leitura pública).

Nenhum dado é semeado em código. O Painel cria tudo.

### 2. Server functions (`src/lib/business/filters.functions.ts`)

- `getCategoryFilters({ categorySlug })` → público (cliente publishable), retorna `[{ attribute, values[] }]` + faixa de preço min/max calculada dos produtos da categoria.
- `listAttributes()`, `getAttribute({id})`, `upsertAttribute(...)`, `deleteAttribute({id})` — admin (`requireSupabaseAuth` + `has_role admin`).
- `upsertAttributeValue(...)`, `deleteAttributeValue(...)` — admin.
- `setCategoryAttributes({ categoryId, attributeIds[] })` — admin (vínculo many-to-many com ordem).
- `setProductAttributeValues({ productId, values[] })` — admin (usado ao editar produto).

### 3. Loja Pública

- `src/routes/categoria.$slug.tsx`: substituir `buildFilterGroups` hardcoded por `useSuspenseQuery(categoryFiltersQuery(slug))`. Renderização:
  - `filter_ui='color'` → swatches.
  - `filter_ui='size'` → chips compactos.
  - `filter_ui='range'` → slider de faixa de preço.
  - default → checkboxes.
- Aplicar filtros via search params (`?attr[<code>]=val1,val2&price=min-max`), filtragem feita no `loader` chamando server fn.
- Mesmo componente reaproveitado em `/marcas`, `/promocoes`, `/novidades` e busca, sempre lendo da categoria contextual (ou "todas").

### 4. Painel Administrativo — módulo "Atributos e Filtros"

Nova rota `src/routes/_authenticated/admin/atributos.tsx`:

- Lista de atributos com: nome, código, tipo (`select`/`multiselect`/`color`/`size`/`number`/`text`), `is_filterable`, UI de filtro, ordem.
- Drawer "Editar atributo": campos básicos + tabela de valores (label, code, ordem, hex se cor, ativo).
- Drawer "Categorias deste atributo": multi-select de categorias + ordem + `show_in_filters`.

Nova aba dentro de `admin/categorias/$id`:

- "Filtros desta categoria": tabela ordenável de atributos vinculados, toggle "exibir no filtro", botão "Adicionar atributo".

Na tela de edição de produto, seção "Atributos":

- Inputs gerados dinamicamente a partir dos atributos vinculados à categoria do produto. Salva em `product_attribute_values`.

### 5. Comportamento

- Sem produtos cadastrados → filtros mostram skeleton + estado vazio ("Nenhum filtro disponível").
- Admin cadastra atributo "Tipo de Produto" com valores "Polos, Camisas, …", vincula à categoria Masculino → aparece automaticamente em `/categoria/masculino` sem deploy.
- Faixa de preço é sempre derivada dos produtos reais da categoria (não é atributo).
- Cores e tamanhos usam `is_color`/`is_size` já existentes para renderização especial.

### 6. Não alterar

Hero, Home, Carrosséis, Navbar, Footer, Product Engine, Variant Engine, Pricing, Inventory, DAM, Audit, RLS/RBAC base. Apenas leitura adicional em `attributes`/`attribute_values`/`category_attributes`/`product_attribute_values` + novas telas admin.

### Entregáveis

1. Migração SQL (colunas + views + grants + policies).
2. `src/lib/business/filters.functions.ts`.
3. Refactor de `src/routes/categoria.$slug.tsx` para usar filtros dinâmicos.
4. Componente `src/components/storefront/DynamicFilters.tsx`.
5. Tela admin `src/routes/_authenticated/admin/atributos.tsx` + drawers.
6. Aba "Filtros" em `admin/categorias/$id`.
7. Bloco "Atributos" no editor de produto.
