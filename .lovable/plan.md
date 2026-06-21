## Fase 5.1 — Clientes ✅ CONCLUÍDA

**Entregue:**
- Tabelas: `customers`, `customer_addresses`, `customer_contacts`, `customer_tax_profiles`, `customer_credit_ledger`, `customer_groups_map`.
- Enums: `customer_type`, `customer_status`, `customer_segment`, `address_type`, `tax_regime`, `credit_ledger_kind`.
- RLS por loja + permissão; cliente autenticado lê/atualiza próprio cadastro/endereços.
- Triggers: validação CPF/CNPJ + normalização, single default address, audit_row_change.
- Permissions: `customers.read/create/update/delete/credit.manage` + role `sales`.
- Workflow seed: `customer_onboarding` (lead → active → vip / blocked).
- Feature flag: `customers.enable_credit_ledger` (default false).
- Camada TS: repositories + services + 14 server fns (CRUD + addresses + contacts + tax + credit).
- Integração: Outbox (`customer.created/updated/address.added`) + métricas observability.
- UI: rota `/admin/customers` (MasterCrudPage) + entrada na sidebar (já existente).

---

## Fase 5.1 — Clientes (plano original)

Implementar o módulo Clientes seguindo o padrão estabelecido (UI → server functions → services → repositories → Supabase), reutilizando as Fundações Transversais (Outbox, Workflow, Observability, Idempotency, RBAC).

### Escopo

1. **Banco (migration única)**
   - Tabelas: `customers`, `customer_addresses`, `customer_contacts` (PJ), `customer_tax_profiles`, `customer_credit_ledger`, `customer_groups_map` (M:N com `customer_groups` existente).
   - Enums: `customer_type` (`pf`|`pj`), `customer_status` (`active`|`inactive`|`blocked`), `customer_segment` (retail/wholesale/rep/distributor/reseller/vip), `address_type` (main/shipping/billing/commercial), `tax_regime`.
   - Constraints: UNIQUE parcial `(store_id, doc_number)` quando não-nulo; UNIQUE `(store_id, code)`; FK opcional `auth_user_id → auth.users`.
   - Triggers: `set_updated_at`, `audit_row_change` em `customers`, garantia de 1 endereço default por tipo, validação `doc_number` por `type` (CPF=11, CNPJ=14).
   - Helpers SECURITY DEFINER: `customer_store_id(_id uuid)`, `address_customer_store_id(_id uuid)`.
   - GRANTs: `authenticated` (SELECT/INSERT/UPDATE/DELETE), `service_role` (ALL). Sem `anon`.
   - RLS: leitura/escrita gateadas por `has_permission('customers.*', store_id)` + `is_super_admin`. Cliente autenticado (auth_user_id = auth.uid()) pode ler/atualizar o próprio cadastro e endereços via policy específica.
   - Permissions: `customers.read`, `customers.create`, `customers.update`, `customers.delete`, `customers.credit.manage` — atribuídas a `super_admin` e `admin`; criar role `sales` (se ainda não existir) com `customers.read/create/update`.
   - Realtime: NÃO habilitado nesta fase.

2. **Camada TypeScript (`src/lib/business/customers/`)**
   - `repositories/customers.server.ts` — CRUD baixo nível para `customers`, `customer_addresses`, `customer_contacts`, `customer_tax_profiles`, `customer_credit_ledger`.
   - `services/customers.server.ts` — regras: validação de doc (CPF/CNPJ), normalização (telefone, e-mail lowercase), checagem de duplicidade, segmento default, limite de crédito, ledger append-only, default address enforcement.
   - `services/customer-addresses.server.ts` — CRUD endereços + regra default por tipo.
   - `customers.functions.ts` — server fns (`createServerFn` + `requireSupabaseAuth` + `withBusiness`): `listCustomers`, `getCustomer`, `createCustomer`, `updateCustomer`, `deleteCustomer` (soft), `addAddress`, `updateAddress`, `deleteAddress`, `setDefaultAddress`, `addContact`, `updateContact`, `removeContact`, `upsertTaxProfile`, `addCreditEntry`, `getCreditBalance`.
   - Emissão de Domain Events via **Outbox** (`enqueueOutbox`): `customer.created`, `customer.updated`, `customer.address.added`, `customer.credit.adjusted`, `customer.blocked`.
   - Métricas via `recordMetric` (scope `customers`): `created`, `updated`, `credit_adjusted`.
   - Idempotência via `withIdempotency` em `createCustomer` (chave opcional do client).

3. **UI Admin (`src/routes/_authenticated/admin.customers.tsx` + drawer)**
   - Master CRUD list com filtros: `type`, `status`, `segment`, busca por nome/doc/email.
   - Drawer/Form com abas: Geral, Endereços, Contatos (PJ), Fiscal, Crédito, Auditoria.
   - Reutilizar `MasterCrudPage`, `DataTable`, `CrudDrawer`, `FormField`, `MultiSelectField` (grupos), `StatusBadge`.
   - Tela detalhe `admin.customers.$id.tsx` com tabs e ações (bloquear/desbloquear, lançar crédito).
   - Sidebar: novo item "Clientes" sob seção Comercial.

4. **Observabilidade**
   - Workflow `customer_onboarding` opcional (criado mas sem auto-start) com estados: `lead → active → vip → blocked`. Definido em seed via migration mas instâncias não criadas automaticamente.
   - Feature flag `customers.enable_credit_ledger` (default false) gate na UI de crédito.

### Ordem de execução

1. Migration (tabelas + enums + RLS + GRANT + helpers + permissions + workflow seed).
2. Aprovação automática → tipos regenerados.
3. Repositories + Services + Functions.
4. Rotas UI + sidebar.
5. Atualizar `.lovable/plan.md` marcando 5.1 como concluída.

### Fora de escopo (próximas fases)

- Importação CSV de clientes (5.1.b se solicitado).
- Integração com Receita/Serpro para validação de CNPJ.
- Portal do cliente (área logada pública) — fica em 5.6.
- LGPD/anonimização — fase posterior.
