## Diagnóstico

Auditei a "Calça Country Balão" no banco. Ela já está atribuída à categoria **Masculino › Calças › Country** (slug `masc-calcas-country`) — então não está realmente em "Esporte Fino". O que aparece em Esporte Fino é outro produto, ou houve confusão visual entre os dropdowns.

Independente disso, o problema de fundo é real: **cada produto hoje só pode ficar em UMA categoria** (`products.category_id`). Você quer poder marcar o mesmo produto em várias seções (ex.: Country **e** Calças **e** Masculino, ou Country **e** Promoções).

## Plano

### 1. Banco — tabela de junção (migration)
- Criar `public.product_categories(product_id, category_id, is_primary)` com PK composta, FKs com `ON DELETE CASCADE`, índice por categoria.
- GRANTs (`anon SELECT`, `authenticated ALL`, `service_role ALL`) + RLS espelhando as políticas de `products`.
- **Seed**: para cada produto existente, inserir uma linha com seu `category_id` atual marcada como `is_primary=true`. Mantém `products.category_id` como a "categoria primária" para compatibilidade.

### 2. Server functions (`storefront.functions.ts`)
- `listStorefrontProducts` continua igual (sem filtro por categoria).
- Adicionar `listProductCategoryMap({ product_ids })` retornando `Record<product_id, category_id[]>`, lendo de `product_categories`.

### 3. Vitrine (`src/routes/categoria.$slug.tsx`)
- No loader, buscar o mapa de categorias dos produtos da loja e considerar um produto pertencente à categoria atual quando **qualquer** uma de suas categorias (primária + extras) estiver no conjunto de IDs descendentes. Isso faz a "Calça Country Balão" aparecer corretamente em Country, Calças e Masculino simultaneamente.

### 4. Admin — `admin.products.$id.edit.tsx`
- Adicionar bloco "Seções adicionais" abaixo do seletor atual de categoria.
- Componente: lista de checkboxes agrupada por departamento (árvore de `categories`), pré-marcando as linhas existentes em `product_categories`.
- Server function `setProductCategories({ product_id, category_ids })` (com `requireSupabaseAuth` + checagem de role admin) que faz upsert/delete diff e garante que a primária (`category_id` do produto) sempre fique presente.
- Ao salvar o produto, chamar a nova função.

### 5. Admin — criação (`admin.products.new.tsx`)
- Após criar o produto com a categoria primária, opcionalmente abrir o mesmo painel de seções adicionais (ou deixar para a tela de edição). Para escopo mínimo: deixar só na edição.

## Detalhes técnicos

- O fallback de exibição da categoria principal continua sendo `products.category_id` (breadcrumbs, edição inicial).
- A política RLS de leitura em `product_categories` é pública (`TO anon SELECT`) para que a vitrine SSR funcione sem auth.
- Sem mudanças em `product_collections` (são coleções de marketing, não categorização).

## Fora de escopo

- Reordenar/priorizar categorias além de "primária vs extras".
- Migrar `products.category_id` para puramente derivado da junção (mantemos os dois por simplicidade).
- Corrigir mapeamento do item de nav "Country" (slug `country` não casa com nenhuma categoria do banco) — posso fazer em seguida se quiser.
