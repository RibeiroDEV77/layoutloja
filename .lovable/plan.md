## Contexto atual (auditoria rápida)

- O navbar é data-driven a partir de `src/lib/storefront-navigation.ts` (`STOREFRONT_NAV_ITEMS`) e das categorias reais do banco.
- Já existe "Botas" como item raiz no navbar (slug `botas`) e como subcategoria filha de "Calçados" (slug `b`) — mas **não** aparece dentro do mega-menu de "Masculino".
- O mega-menu de cada item hoje monta a coluna "Subcategorias" só a partir de `childrenOf(categoryId)` — não considera links curados extra.
- `/produtos` (`src/routes/produtos.tsx`, 125 linhas) hoje **não tem barra lateral de filtros por categoria via checkbox** — a filtragem por categoria é feita em `/categoria/$slug`.

## Escopo proposto

### 1. Sub-links curados no navbar (Masculino, Feminino, Infantil/Unissex)

- Estender `StorefrontNavItem` com um campo opcional `extraLinks: { label: string; slug: string }[]`.
- Popular `masculino.extraLinks` com `Botas` (slug `botas`) + as demais categorias de calçado já cadastradas (Sapatos, Tênis, Sapatênis, Sandálias) apontando para os slugs reais do DB.
- Popular `feminino.extraLinks` e (se existir) `infantil` de forma equivalente, listando o que já está cadastrado no DB e não aparece hoje no dropdown.
- Renderizar `extraLinks` na coluna "Subcategorias" do mega-menu (concatenando/prevalecendo sobre `childrenOf`) e no drawer mobile como sub-itens recuados sob o pai.

Sem mudanças estéticas: mesmos estilos, hover `--brand-red`, transições e tipografia existentes.

### 2. Filtro "Botas" e pré-seleção via URL

- Em `/produtos`, adicionar uma barra lateral simples com checkboxes de categoria (Masculino, Feminino, Botas, Acessórios, Calçados…). Não mexer nas queries do canal — apenas filtrar client-side sobre `category_ids` como já é feito em `categoria.$slug`.
- Ler `?cat=botas&dep=masculino` da URL para pré-selecionar os checkboxes.
- Link do "Botas" dentro do dropdown "Masculino" navega para `/produtos?cat=botas&dep=masculino`.
- Empty state limpo ("Nenhum produto encontrado nesta combinação") mantendo o layout.

### 3. UI/UX

- Preservar Tailwind, cores, hover e transições atuais.
- Drawer mobile: sub-itens indentados com o mesmo divisor `#F8F8F8` e hover `--brand-red`.

## Arquivos afetados

- `src/lib/storefront-navigation.ts` — novo campo `extraLinks`.
- `src/components/storefront/storefront.tsx` — render dos extraLinks no mega-menu desktop e no drawer mobile.
- `src/routes/produtos.tsx` — sidebar de filtros + leitura de query params + empty state.

## Fora do escopo

- Não altero categorias no banco.
- Não altero `categoria.$slug.tsx`, canal atacado, pricing, checkout, carrinho.
- Não redesenho o navbar nem o mega-menu.

## Pergunta de confirmação

1. Você quer os **mesmos sub-links** em Masculino/Feminino (Botas, Sapatos, Tênis, Sapatênis, Sandálias, Chinelos), ou uma lista específica?
2. `/produtos` hoje não tem sidebar de filtros — posso criar uma nova ou você prefere que "Botas no navbar" leve para `/categoria/botas` (já existente) em vez de `/produtos?cat=botas`?