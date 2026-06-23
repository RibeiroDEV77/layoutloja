## Objetivo

Tornar o cadastro de produtos mental e visualmente mais simples, no modelo que você descreveu:

> "Calça → Azul Escuro / Azul Médio / Azul Claro → cada cor tem suas fotos e seus tamanhos"

Hoje existem 3 blocos separados ("Fotos", "Variações", "Estoque e Preços") que falam da mesma coisa em lugares diferentes. Vou unificar tudo em **um único bloco por cor**.

## Nova estrutura da página de cadastro

```text
1. Informações básicas
   Nome • Descrição • Categoria • Marca • SKU raiz

2. Esse produto tem cores/tamanhos?  [Não] [Sim]

   Se NÃO:
     Preço • Estoque • Fotos do produto

   Se SIM:
     Tamanhos disponíveis: [P] [M] [G] [GG] (+ adicionar)

     ── Card por cor (ex: "Azul Escuro") ──────────────
       Nome da cor + amostra de hex
       [Fotos desta cor]  ← upload inline
       [Tamanho | SKU | Estoque | Preço]   ← grade enxuta
       Botão: aplicar preço/estoque a todos os tamanhos
     ──────────────────────────────────────────────────
     [+ Adicionar outra cor]

3. Publicar
   Status + botão salvar
```

Resultado: para cadastrar a calça você só precisa pensar em "qual é a cor → quais fotos dela → quais tamanhos e quanto custa". Sem pular entre seções.

## Mudanças técnicas

- `src/routes/_authenticated/admin.products.new.tsx`
  - Remover os blocos `PhotosBlock`, `VariationsBlock`, `StockPriceBlock` separados.
  - Criar um único `ColorBlock` que reúne, por cor: galeria (`ColorGallerySection`) + linha de tamanhos (preço/estoque/SKU) + ações em massa.
  - Manter toggle "tem variantes" para produtos simples (sem cor/tamanho).
  - Reaproveitar as server functions já existentes (`createProductColor`, `addColorMedia`, `generateProductVariants`, `updateProductVariant`) — sem mudanças no backend.

- `src/routes/_authenticated/admin.products.$id.edit.tsx`
  - Mesma reorganização na aba "Variantes + fotos": substituir a grade atual pelo mesmo `ColorBlock`, para que criar e editar tenham a mesma cara.

- Nenhuma alteração de banco, RLS, ou storefront.

## O que NÃO muda

- Modelo de dados (produto → cores → mídia + variantes por tamanho) continua igual.
- Fotos continuam sendo enviadas via DAM (bucket `dam`) e resolvidas no storefront via signed URL.
- Permissões e auditoria seguem iguais.

Posso seguir com essa reorganização?
