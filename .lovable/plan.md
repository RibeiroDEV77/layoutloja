## Objetivo

Implementar autenticação completa da loja (separada do admin), usando o ícone de usuário da navbar como ponto de entrada. Aproveitar o schema existente: `customers.auth_user_id`, `customer_addresses`, `wishlists/wishlist_items`, `orders`. Não criar tabelas duplicadas.

## Antes de começar — confirme

1. **CPF criptografado com pgcrypto**: você precisa fornecer (ou autorizo gerar) o secret `CUSTOMER_PII_KEY` (chave AES armazenada via `add_secret`). A criptografia/descriptografia ficará em SECURITY DEFINER functions que recebem a chave via `current_setting`/parâmetro do server — nunca exposta ao cliente. Confirma essa abordagem?
2. **Verificação de e-mail**: deixo o Supabase Auth com confirmação por e-mail habilitada (padrão) ou login imediato sem confirmação para facilitar testes?

---

## 1. Banco de dados (uma migration)

### 1.1 RLS para o cliente final acessar **seus próprios** dados
Hoje as policies de `customers`, `customer_addresses`, `wishlists`, `wishlist_items`, `orders` são todas escopadas para staff (admin). Adicionar policies adicionais para o **cliente logado** (role `authenticated`):

- `customers`: SELECT/UPDATE quando `auth_user_id = auth.uid()`.
- `customer_addresses`: SELECT/INSERT/UPDATE/DELETE quando o `customer_id` pertence a um `customers` com `auth_user_id = auth.uid()` (via função `public.current_customer_id()` SECURITY DEFINER).
- `wishlists` + `wishlist_items`: idem (`current_customer_id()`).
- `orders` + `order_items`: somente SELECT do próprio cliente.

### 1.2 Função helper
```sql
CREATE OR REPLACE FUNCTION public.current_customer_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id FROM public.customers WHERE auth_user_id = auth.uid() LIMIT 1
$$;
```

### 1.3 Trigger pós-signup
`handle_new_storefront_user()` cria a linha em `customers` (type=`pessoa_fisica`, status=`ativo`, store_id default da loja) ao inserir em `auth.users`, copiando email e `raw_user_meta_data.full_name`.

### 1.4 pgcrypto para CPF
- `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
- Coluna nova `customers.doc_number_encrypted bytea` (mantém `doc_number` para o admin já existente — não quebra nada; storefront passa a usar a versão criptografada).
- Funções `encrypt_doc(text)` / `decrypt_doc(bytea)` SECURITY DEFINER usando `pgp_sym_encrypt` com chave passada como parâmetro pelo server.

> Não armazenamos senhas (Supabase Auth cuida) nem dados de cartão.

---

## 2. Server functions (TanStack Start)

`src/lib/business/storefront-account.functions.ts` com `requireSupabaseAuth`:
- `getMyAccount()` — devolve customer + endereços (descriptografando CPF).
- `updateMyProfile({ name, phone, birth_date, doc_number? })` — criptografa CPF.
- `listMyAddresses()`, `upsertMyAddress(...)`, `deleteMyAddress(id)`, `setDefaultAddress(id)`.
- `listMyOrders()`, `getMyOrder(id)`.
- `listMyWishlist()`, `addToWishlist(product_id)`, `removeFromWishlist(item_id)`.

---

## 3. UI

### 3.1 `AccountSheet` — modal (desktop) / drawer (mobile)
Acionado pelo ícone `User` da `StorefrontNavbar` (já existe).
- **Não autenticado**: tabs "Entrar / Cadastrar / Recuperar senha" (Supabase `signInWithPassword`, `signUp` com `emailRedirectTo`, `resetPasswordForEmail` apontando para `/reset-password` — já existe).
- **Autenticado**: header com nome/email + lista "Meus Pedidos · Endereços · Dados Pessoais · Favoritos · Sair". Cada item leva para `/minha-conta/...`.

Componentes: shadcn `Sheet` (mobile) e `Dialog` (desktop), alternados por `useIsMobile`.

### 3.2 Rotas `/minha-conta/*`
Como **rota pública não pode** chamar server fn com `requireSupabaseAuth` durante SSR, criar layout sob `_storefront-account/` com `ssr: false` + redirect para `/` (abrindo o `AccountSheet` em login) quando não há sessão. Estrutura:

```
src/routes/_storefront-account/route.tsx        ← gate ssr:false
src/routes/_storefront-account/minha-conta.tsx  ← layout com sidebar
src/routes/_storefront-account/minha-conta.index.tsx       (resumo)
src/routes/_storefront-account/minha-conta.pedidos.tsx
src/routes/_storefront-account/minha-conta.pedidos.$id.tsx
src/routes/_storefront-account/minha-conta.enderecos.tsx
src/routes/_storefront-account/minha-conta.dados.tsx
src/routes/_storefront-account/minha-conta.favoritos.tsx
```

Sidebar fixa à esquerda no desktop, accordion/colapsada no mobile. Cabeçalho com avatar e botão Sair.

### 3.3 Checkout-ready (preparo, sem alterar fluxo atual)
- Expor `useStorefrontCustomer()` (hook) consumindo `getMyAccount` via TanStack Query.
- No `checkout.tsx`, em PR futuro, basta preencher `defaultValues` dos campos a partir desse hook quando `ctx.authenticated`. Já deixo o ponto preparado com TODO.

---

## 4. Arquivos a criar / editar

**Criar**
- migration única (`auth_storefront_setup`)
- `src/lib/business/storefront-account.functions.ts`
- `src/components/storefront/account-sheet.tsx`
- `src/hooks/use-storefront-customer.ts`
- 7 rotas em `_storefront-account/`

**Editar**
- `src/components/storefront/storefront.tsx` → `StorefrontNavbar` abre `AccountSheet` no clique do ícone User.
- `.env`/secrets → `CUSTOMER_PII_KEY`.

---

## 5. Riscos / observações

- O `_authenticated/route.tsx` atual redireciona para `/auth` (página do admin). Não vou mexer nele — `_storefront-account` é gate separado para clientes e redireciona para `/` (com modal).
- RLS adicional para `authenticated` em tabelas que hoje só liberam para staff é **aditiva** (não revoga policies admin existentes).
- `customer.store_id` é NOT NULL: trigger usa a loja default (primeira `stores` ativa) — confirme se há regra para múltiplas lojas.

Confirme os dois pontos no topo (CPF/secret e confirmação de e-mail) e a regra de `store_id`, e eu executo migration + código.