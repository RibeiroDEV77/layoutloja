## Objetivo

Eliminar a percepção de duplicidade no canal atacado, mantendo o varejo intocado.

## Abordagem escolhida

**Opção B — "Catálogo Atacado" único**, renderizado em `/atacado/home`.

Motivo: `/atacado/home` já existe como placeholder para clientes aprovados (`sales_channel = wholesale`). Transformá-lo no catálogo real é a mudança mínima e isolada. A home `/` permanece exatamente como está para o varejo.

## Escopo (o que muda)

1. **`src/routes/atacado.home.tsx`** — substituir o placeholder "Bem-vindo…" por um catálogo único:
   - Faz **uma única chamada** a `listStorefrontProducts({ data: { store_id, limit: 48, sales_channel: 'wholesale' } })`.
   - Renderiza uma grade única "Catálogo Atacado" reutilizando o `ProductCard` já existente (mesmo componente de card usado em `/produtos` — nenhum componente do varejo é modificado).
   - Mantém o gate de autenticação/aprovação (`useWholesaleStatus`) que já existe no arquivo.
   - Mantém `StorefrontShell` para header/footer.

2. **Redirecionamento suave do canal atacado ao entrar no site:**
   - Em `src/components/storefront/sales-channel-provider.tsx` **ou** no handler de "Entrar no Canal Atacado" (`useEnterWholesale`) — **não alterado agora, apenas mencionado**: hoje o clique já leva para `/atacado/home`. Nenhuma mudança necessária.
   - **Não** vamos interceptar `/` para redirecionar usuários wholesale — isso mexeria em rota compartilhada. O usuário atacado já é direcionado para `/atacado/home` no login/troca de canal.

## Escopo (o que NÃO muda)

- `src/routes/index.tsx` (home varejo) — intacto.
- `src/lib/business/storefront.functions.ts` — intacto.
- `src/lib/business/services/commercial-context.server.ts` — intacto.
- `src/lib/business/storefront-product.functions.ts` — intacto.
- Banco, RLS, price lists, migrations — nenhuma alteração.
- Componentes compartilhados (`ProductCard`, `StorefrontShell`, carrossel) — usados por leitura, não modificados.
- Canal varejo, catálogo `/`, PDP `/produto/$slug`, categorias, carrinho, checkout — intactos.

## Layout da nova `/atacado/home`

```text
┌──────────────────────────────────────────┐
│ StorefrontShell (header + footer)        │
├──────────────────────────────────────────┤
│ Chip "Canal ativo: Atacado"              │
│ H1 "Catálogo Atacado"                    │
│ Subtítulo curto                          │
├──────────────────────────────────────────┤
│ Grade responsiva de ProductCards         │
│ (uma única seção, sem carrosséis)        │
│ [card] [card] [card] [card]              │
│ [card] [card] [card] [card] ...          │
├──────────────────────────────────────────┤
│ Estado vazio: "Nenhum produto publicado" │
└──────────────────────────────────────────┘
```

## Verificação após implementação

1. `/` no canal varejo → segue com Novidades/Destaques/Mais Vendidos/Todos (inalterado).
2. `/atacado/home` no canal atacado → uma única grade "Catálogo Atacado" com preços R$ 99,99 (WHOLESALE).
3. Visitante sem aprovação em `/atacado/home` → redireciona para `/atacado` (comportamento atual preservado).
4. Nenhum arquivo de varejo tocado (confirmado via diff).

Aguardando aprovação para executar.