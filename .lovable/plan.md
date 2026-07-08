## Hardening gradual de `customers.doc_number`

Objetivo: reduzir exposição do CPF/CNPJ em plaintext sem quebrar admin, wholesale, checkout, painel do cliente ou criação de cliente. **Nenhum DROP nesta fase.**

### Situação atual (auditada agora)

- `customers.doc_number` (text, plaintext) e `customers.doc_number_encrypted` (bytea) coexistem.
- **Não existe** `doc_number_hash` — precisa ser criado.
- RLS de `customers`: sem policy para `anon`; `authenticated` vê apenas a própria linha OU precisa de `customers.read` na store. Já é fail-closed contra PostgREST público.
- Busca admin usa `ILIKE` em `doc_number` plaintext (`customers.server.ts:54`).
- Índice único vive em `customers(store_id, doc_number)`.
- Grava plaintext em: `storefront-account.functions.ts`, `customers.server.ts`, wholesale application service.

### Fase 1 — Coluna `doc_number_hash` + índice paralelo

Migration única:

1. `ALTER TABLE customers ADD COLUMN doc_number_hash text`.
2. Function `public.hash_doc_number(text)` — `SECURITY DEFINER`, `STABLE`, normaliza (remove não-dígitos) e retorna `encode(hmac(v, current_setting('app.doc_hash_pepper', true), 'sha256'), 'hex')`. Pepper como GUC setado em migration (`ALTER DATABASE ... SET app.doc_hash_pepper = '<secret>'`).
3. Trigger `BEFORE INSERT OR UPDATE OF doc_number ON customers` que popula `doc_number_hash` sempre que `doc_number` mudar.
4. Backfill: `UPDATE customers SET doc_number_hash = hash_doc_number(doc_number) WHERE doc_number IS NOT NULL`.
5. `CREATE UNIQUE INDEX customers_store_dochash_uq ON customers(store_id, doc_number_hash) WHERE doc_number_hash IS NOT NULL AND deleted_at IS NULL` — **paralelo**, sem tocar no índice antigo.
6. Grants — apenas leitura do hash para `authenticated` (via SELECT já coberto pela policy existente); nenhum grant para `anon`.

Segurança do hash: HMAC-SHA256 com pepper server-side. Sem o pepper, um dump da tabela não permite rainbow-table sobre CPF/CNPJ (baixa entropia).

### Fase 2 — Server functions: mascarar por padrão, buscar por hash

Alterações apenas em código (`src/lib/business/services/customers.server.ts` e adjacentes):

1. Adicionar helper `maskDoc(doc: string | null)` → retorna `***.***.***-XX` / `**.***.***/****-XX`.
2. Em `listCustomers` e afins: remover `doc_number` do `select(...)`; adicionar `doc_number_masked` derivado server-side. Nenhum payload de lista retorna plaintext.
3. Busca (`customers.server.ts:54`): se o termo normalizado tiver 11 (CPF) ou 14 (CNPJ) dígitos, buscar via `doc_number_hash = hash_doc_number($term)` (chamada RPC ou reuso via `.eq`). Caso contrário, ILIKE apenas em `name/legal_name/trade_name/email/code`. **Sem ILIKE em doc_number.**
4. Detalhe de cliente admin (`getCustomer`): retornar `doc_number_masked` por padrão. Novo server fn `revealCustomerDocument({ customer_id })` gated por `has_permission('customers.read.pii')` — retorna plaintext descriptografado sob demanda, com log em `audit_log`.
5. Wholesale applications (`wholesale-applications.server.ts:320,355`): trocar select para retornar apenas `doc_number_masked`; se admin precisar do plaintext no detalhe, usar o mesmo `revealCustomerDocument`.
6. Painel do cliente (`storefront-account.functions.ts`): mantém retorno do próprio documento descriptografado (é o próprio dono — não é vazamento).
7. Criação/edição: continuar gravando `doc_number` + `doc_number_encrypted`; o trigger popula o hash. Anti-duplicidade passa a bater no índice do hash (mensagem de erro amigável).

### Fase 3 — UI admin

Alterações em `src/routes/_authenticated/admin.customers.tsx`, `admin.customers.$customerId.tsx`, `admin.wholesale-applications.tsx`:

1. Lista renderiza `doc_number_masked` (já vem do server).
2. Detalhe mostra máscara + botão "Revelar documento" que chama `revealCustomerDocument` (checa permissão, registra audit).
3. Formulários de criação/edição não mudam a UX de digitação; ao salvar, o server valida duplicidade via hash e devolve mensagem clara.

### Fase 4 — Relatório de dependências (para o DROP futuro)

Entregar antes de qualquer DROP:

- SQL: `customers_store_doc_uq` (antigo), trigger de normalização.
- Server: `customers.server.ts`, `storefront-account.functions.ts`, `wholesale-applications.server.ts`, migration `20260707222203_*` (COPY em OLD.doc_number).
- UI: `admin.customers.tsx`, `admin.customers.$customerId.tsx`, `admin.wholesale-applications.tsx`, `minha-conta.dados.tsx`.
- Índices e constraints que ainda referenciam a coluna.

### Não fazer nesta fase

- Não dropar `customers.doc_number`.
- Não remover o índice único antigo antes do novo estar validado em produção.
- Não alterar RLS de `customers` (já é fail-closed contra anon; a exposição residual é intra-staff, mitigada por mascaramento no server).

### Critérios de aceite

1. `SELECT doc_number FROM customers` como `anon` continua bloqueado (já é).
2. Server functions de lista/wholesale não retornam mais `doc_number` plaintext.
3. Busca admin por CPF/CNPJ completo funciona via hash.
4. Busca por nome/e-mail/telefone continua funcionando.
5. Criação de cliente falha em duplicidade via hash com mensagem clara.
6. Painel do próprio cliente continua mostrando o próprio documento.
7. Wholesale, checkout, pedidos e produtos: intocados.
8. Auditoria registra reveals de plaintext.

### Ordem de execução

1. Aprovar plano.
2. **Adicionar secret** `DOC_HASH_PEPPER` (valor forte, 32+ bytes aleatórios) — necessário antes da migration.
3. Migration da Fase 1.
4. Refactor server (Fase 2).
5. Refactor UI (Fase 3).
6. Smoke: criar cliente, buscar por CPF, listar, revelar, wholesale.
7. Entregar relatório da Fase 4 como issue separado para o DROP definitivo.
