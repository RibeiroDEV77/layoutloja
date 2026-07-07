
## Causa raiz identificada (auditoria do banco + código)

**Dados reais no banco (loja Layout, `store_id=4ea8…fe4a`)**:

| Nível | Nome | Slug | parent_id | Produtos publicados |
|---|---|---|---|---|
| 1 | Masculino | `masculino` | — | 12 |
| 1 | Feminino | `feminino` | — | 5 |
| 1 | **Botas** | `botas` | — | **8** |
| 1 | **Calçados** | `calcados` | — | 7 (direto) |
| 1 | Acessórios | `acessorios` | — | 0 |
| 1 | Promoções | `promocoes` | — | 0 |
| 1 | Novidades | `novidades` | — | 0 |
| 2 | Botas (duplicada) | **`b`** | Calçados | 4 |
| 2 | Tênis / Sapatos / Sandálias | `calc-*` | Calçados | 0 |
| 2 | Camisas Fem. | `fem-camisas` | Feminino | 1 |
| 2 | Calças Masc. | `masc-cal…` | Masculino | 2 |

**Problemas encontrados**:

1. **Navbar hardcoded** (`src/lib/storefront-navigation.ts`) tem itens que não existem no banco (`Country`, `Sport Fino`, `Social`) e **não tem `Calçados`**. Não é dirigido pelo banco. Não bate com a auditoria.
2. **`listStorefrontProducts` limita a 24 produtos globais** (`src/lib/business/storefront.functions.ts:93`), sem filtro por categoria — a página `/categoria/$slug` filtra tudo client-side. Se um produto de Botas não estiver entre os 24 mais recentes, some da listagem — este é o motivo direto de "Calçados/Botas sem produtos" e "filtro Botas não funciona".
3. **Categoria duplicada "Botas"** (top-level `botas` e subcategoria `b` de Calçados) causa contagem/nav ambígua. `resolveStorefrontCategories` usa `name.includes(alias)` — combina as duas Botas.
4. **Filtros lateral (cor/tamanho)** só filtram o subset já carregado — herdam o mesmo bug do limit 24.

## Plano de correção (somente storefront público — sem tocar produtos, preços, estoque, variantes, admin)

### Passo 1 — Consulta de categoria correta no servidor
Adicionar parâmetro `category_ids?: string[]` em `listStorefrontProducts` e aplicar `.in('category_id', ids)` UNION com match via `product_categories`. Elevar limite quando `category_ids` está presente (ex.: 200). Loader de `/categoria/$slug` passa a expansão de subcategorias já calculada.

### Passo 2 — Navbar dirigido pelo banco
Substituir `STOREFRONT_NAV_ITEMS` hardcoded por derivação a partir de `categories` (`is_active=true`, `level=1`, com produtos publicados). Preservar `Marcas`, `Promoções`, `Novidades` como itens curados. Manter aliases para retro-compat de URLs antigas (`country`, `sport-fino`, `social`) redirecionando para `/produtos`. Desktop e mobile consomem a mesma lista.

### Passo 3 — Deduplicar "Botas"
Migração leve: mover subcategoria "Botas (slug=`b`)" para ficar sob a top-level `botas` OU tornar a top-level a única exibida (unir contagem). Optar por **tornar a top-level canônica** e desativar/mesclar a duplicada, mantendo os 4 produtos vinculados também à top-level via `product_categories` (sem alterar produto/preço/estoque). Requer migração — apresentar antes de rodar.

### Passo 4 — Filtros server-driven
`getCategoryFilters` já existe. Garantir que os produtos passados ao filtro venham da nova consulta com `category_ids`, e que ao clicar em atributo (cor/numeração) a URL atualize (já faz) — o resultado deixará de ser vazio pois a lista base agora vem completa da categoria.

### Passo 5 — Cache / query keys
Loader do TanStack já usa route + params + search para o cache; após incluir `category_ids` na chamada server, o resultado passa a ser específico da categoria e o SSR/hydration ficam consistentes.

### Passo 6 — Validação
Playwright headless: `/categoria/calcados`, `/categoria/botas`, `/produtos`, filtro Botas, filtro cor, mobile viewport, sales channel varejo. Screenshots + contagens.

## Arquivos a alterar

- `src/lib/business/storefront.functions.ts` — aceitar `category_ids` + subir limite.
- `src/routes/categoria.$slug.tsx` — enviar `category_ids` já expandido.
- `src/lib/storefront-navigation.ts` — derivar itens do banco (ou remover); manter aliases.
- `src/components/storefront/storefront.tsx` — usar lista dinâmica.
- Migração Supabase (Passo 3) — apenas se você aprovar a mescla das duas "Botas".

## O que NÃO será alterado

Produtos, preços, estoque, variantes, imagens, atacado, carrinho, checkout, RLS, RBAC.

## Perguntas antes de executar

1. **Mesclar as duas "Botas"?** Top-level `botas` (8 produtos) vs subcategoria `b` sob Calçados (4 produtos). Recomendo tornar a top-level canônica e vincular também os 4 produtos via `product_categories`. OK?
2. **Navbar 100% dinâmico** (só categorias do banco + Marcas/Promoções/Novidades) OU **híbrido** (mantém alguns itens curados como Country/Sport Fino apontando para `/produtos?cat=`)?
