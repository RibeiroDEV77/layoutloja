## Objetivo
Transformar o storefront em experiência profissional reutilizando `useStorefrontCart`, server functions e Supabase já existentes. Sem novas tabelas, sem duplicar estado.

## Escopo

### 1. Mini Cart global (drawer)
- Novo componente `src/components/storefront/mini-cart.tsx` usando `Sheet` (shadcn) — lateral direita, animação suave, fecha com ESC/click-fora (já nativo do Sheet).
- Estado de abertura via novo `CartUIProvider` (`src/components/storefront/cart-ui-context.tsx`) com `openCart()`, `closeCart()`, `isOpen`. Provider montado no layout do storefront, NÃO substitui o hook do carrinho.
- Conteúdo: thumb, nome, cor, tamanho, qty (+/−), preço unit., subtotal linha, remover. Footer: subtotal, botões "Continuar comprando" (fecha), "Ver sacola" (`/sacola`), "Finalizar compra" (`/checkout`).
- Tudo lê de `useStorefrontCart()`.

### 2. Ícone do carrinho com contador
- Já existe no header do storefront. Garantir que use `itemsCount` reativo do hook (mesma instância via provider). Sem refresh — o hook já refaz `refresh()` após mutações.
- Click no ícone → `openCart()`.

### 3. Imagens do carrinho (corrigir placeholder)
- Backend: estender `anonGetCart` em `src/lib/business/services/cart.server.ts` para hidratar `snapshot.image_url` resolvido a partir de `product_color_media` da variante (preferência: media da cor da variante; fallback: media principal do produto). Reaproveitar a mesma query usada no storefront (`storefront.functions.ts`).
- Persistir em `snapshot` no `addItem`/`upsert` para evitar joins repetidos. Reusar lógica de resolução existente — não duplicar.
- Frontend usa `item.snapshot.image_url` com fallback para placeholder só se ausente.

### 4. Página da Sacola (`/sacola`)
Refatorar `src/routes/sacola.tsx`:
- Breadcrumb (Home › Sacola), título.
- Layout 2 colunas (lg): lista de itens à esquerda, resumo sticky à direita.
- Item: foto, nome, cor/tamanho/SKU (do snapshot), qty stepper, remover, subtotal linha.
- Resumo: subtotal, campo cupom (disabled "em breve"), campo CEP (disabled "Frete calculado no checkout"), botão Finalizar.
- Seções inferiores: Produtos relacionados (reusa `getRelatedProducts` se existir, senão lista mesma categoria via `storefront.functions`), Vistos recentemente (localStorage `storefront.recent`), botão Continuar comprando.

### 5. Página do Produto (`/produto/$slug`)
Acrescentar SEM remover existente:
- Breadcrumb (Home › Categoria › Produto).
- Marca (se `product.brand`).
- Bloco avaliações (estático "Sem avaliações ainda" + estrelas placeholder).
- Parcelamento ("ou 10x de R$ X sem juros" calculado client-side) e Pix ("R$ Y à vista no Pix -5%" — apenas display, sem mudar pricing).
- Botões: Guia de medidas (modal placeholder), Compartilhar (Web Share API + fallback copy), Favoritar (localStorage `storefront.wishlist`).
- Bloco "Calcular frete" (input CEP disabled com tooltip "Disponível no checkout").
- Carrosséis inferiores: relacionados + mesma categoria (lista horizontal scroll).
- Registrar produto em `storefront.recent` (localStorage, max 12).

### 6. Add to cart UX
- Em `produto.$slug.tsx`: após `addVariant()` sucesso → `openCart()` + toast (já existe sonner). Animação no badge do carrinho (pulse via classe `animate-scale-in` no contador quando muda).

### 7. Responsivo
- Mini Cart: `Sheet` ocupa 100% até `sm`, 420px desktop.
- Sacola: grid colapsa para 1 coluna em mobile, resumo vira sticky bottom.
- Produto: grid colapsa, carrosséis com scroll horizontal.

### 8. Sem duplicação
- Único `useStorefrontCart` instanciado no provider do storefront; demais consumidores recebem via context wrapper `useCart()` que retorna o mesmo objeto.
- Reusa `anonAddCartItem`, `anonUpdateCartItemQty`, `anonRemoveCartItem`.

### 9. Auditoria final
Manual: verificar build (`tsgo`), navegar Home → Produto → Add → Mini Cart → Sacola → Checkout. Confirmar contador, subtotal, imagens, qty, remover.

## Arquivos
**Novos:**
- `src/components/storefront/cart-ui-context.tsx` (provider + hook compartilhado)
- `src/components/storefront/mini-cart.tsx`
- `src/components/storefront/breadcrumb.tsx`
- `src/components/storefront/product-card-mini.tsx` (carrossel)

**Editados:**
- `src/components/storefront/storefront.tsx` (montar provider + MiniCart + click no ícone)
- `src/routes/sacola.tsx` (refatoração completa)
- `src/routes/produto.$slug.tsx` (breadcrumb, marca, parcelamento, pix, ações, carrosséis, openCart após add)
- `src/lib/business/services/cart.server.ts` (hidratar image_url no snapshot)
- `src/hooks/use-storefront-cart.ts` (sem mudança estrutural; só garantir tipo `image_url` no snapshot)

## Não escopo
- Nenhuma nova tabela, nenhuma alteração em pricing/checkout/Melhor Envio, nenhuma mudança no admin.
- Cupom e CEP ficam como UI preparada (disabled) — integração futura.
