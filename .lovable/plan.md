## Objetivo

Deixar o painel pronto para que qualquer produto cadastrado já apareça na loja automaticamente, criar a estrutura de categorias/atributos pedida, e cadastrar os 4 produtos iniciais com variações de cor/tamanho e dados de frete.

## Escopo da entrega

### 1. Padrão "publicar automaticamente" no painel
- Ajustar o formulário de criação de produto (`admin.products.new.tsx` e service `products.server.ts`) para que o draft inicial já venha com:
  - `status = active`
  - `is_published = true`
  - `visible_in_storefront = true`
  - `available_for_sale = true`
  - `show_in_catalog = true`
- Mapear os nomes reais das colunas existentes em `products` antes de gravar (alguns desses flags podem já existir com outro nome — uso o que existir, não crio coluna nova sem necessidade).
- Remover/ocultar etapas manuais de "publicar" no wizard, mantendo o botão apenas como reforço opcional.

### 2. Estrutura de categorias (Masculino)
Criar via server functions existentes (`createCategory`) na loja ativa, somente se não existirem:

```
Masculino
├── Calças
│   ├── Sport Fino
│   ├── Country
│   ├── Jeans
│   └── Social
├── Bermudas
│   ├── Sport Fino
│   ├── Jeans
│   └── Sarja
├── Camisas
├── Camisetas
├── Polos
├── Jaquetas
├── Moletons
└── Acessórios
```

### 3. Atributos globais
Criar via `createAttribute` se ausentes: Cor, Tamanho, Tecido, Marca, Composição. Cor e Tamanho marcados como eixos de variação (`is_color`, `is_size`).

### 4. Variações por Cor e Tamanho
Verificar se o editor de produto já suporta variações pelos eixos Cor/Tamanho com SKU, estoque, preço e imagens próprias. Se algum desses campos estiver faltando na UI de variantes, adicionar.

### 5. Campos de frete obrigatórios
Garantir que o formulário de produto exija Peso, Comprimento, Largura e Altura (validação client-side + marcação visual de obrigatório). Banco já tem as colunas.

### 6. Cadastro dos 4 produtos
Criar um script de seed (server function única chamada uma vez via UI ou migração de dados) que insira:
1. Bermuda Sport Fino — Brito & Storari — R$ 99,99
2. Calça Sport Fino — Brito & Storari — R$ 139,99
3. Calça Country Balão — Oreon Jeans — R$ 149,99 (cor Azul)
4. Calça Country Elastano — Brito & Storari — R$ 149,99 (cores Azul Claro, Médio, Escuro)

Cada produto: marca, categoria/subcategoria, descrição, preço, peso/dimensões, atributos (Tecido, Composição), e variações de cor quando aplicável. Tamanhos: criar variações padrão P/M/G/GG com estoque 0 (para o usuário ajustar depois).

## Fora de escopo
- Não vou mexer no fluxo OAuth do Melhor Envio nem em RLS de shipping.
- Não vou redesenhar o painel; apenas defaults, validação e seed.
- Imagens dos produtos ficam vazias (não foram fornecidas) — o usuário sobe depois via DAM.

## Detalhes técnicos

- **Defaults de publicação**: alterar `createProductDraft` em `src/lib/business/services/products.server.ts` para forçar os flags. No formulário (`admin.products.new.tsx`) remover o "passo de publicação" como gate, deixando o produto já publicado.
- **Seed de categorias/atributos/produtos**: criar `src/lib/business/seed-catalog.functions.ts` com uma server function `seedInitialCatalog({ store_id })` protegida por `requireSupabaseAuth` + check de super_admin, idempotente (checa por slug/code antes de inserir). Adicionar um botão "Popular catálogo inicial" em `/admin/settings` (visível só para super admin) que chama essa função.
- **Validação frete**: adicionar `required` + mensagens nos inputs de peso/dimensões no editor de produto.
- **Variações**: confirmar que `product_variants` + `variant_attribute_values` já suportam o modelo; ajustar UI apenas se faltar campo de imagem/preço/estoque por variante.

## Como o usuário usa depois

1. Abre `/admin/settings` e clica em "Popular catálogo inicial" (uma vez).
2. Vai em `/admin/products`, vê os 4 produtos já publicados.
3. Sobe imagens e ajusta estoques das variações.
4. Produtos aparecem na loja imediatamente, com frete via Melhor Envio funcional.

Confirma esse plano? Posso seguir com a implementação completa numa sequência só.
