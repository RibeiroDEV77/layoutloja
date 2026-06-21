
# Fase 6.3 — Fechamento do Painel Administrativo

## Diagnóstico atual

Rotas hoje no `NAV_GROUPS` que retornam 404 (não há arquivo em `src/routes/_authenticated/`):

| # | Item do menu | URL | Tabelas backend existentes? |
|---|---|---|---|
| 1 | Empresas | `/admin/companies` | Não há tabela `companies` — só `customers` + `suppliers` |
| 2 | Compras | `/admin/purchases` | Sim: `purchase_orders`, `purchase_order_items`, `goods_receipts` |
| 3 | Notas Fiscais | `/admin/invoices` | Sim: `fiscal_invoices`, `fiscal_invoice_events`, `fiscal_providers`, `fiscal_webhook_inbox` |
| 4 | Marketing | `/admin/marketing` | Parcial: `coupons` (já tem rota), faltam campanhas/automações |
| 5 | Usuários & Papéis | `/admin/users` | Sim: `profiles`, `user_roles`, `roles`, `permissions`, `role_permissions` |
| 6 | Funcionários | `/admin/employees` | Não há tabela dedicada — mapearia em `profiles` + `user_roles` + lojas |
| 7 | Lojas | `/admin/stores` | Sim: `stores`, `store_settings` |
| 8 | Configurações | `/admin/settings` | Sim: `system_settings`, `store_settings`, `feature_flags`, `feature_flag_overrides` |
| 9 | Auditoria | `/admin/audit` | Sim: `audit_log`, `order_audit` |
| 10 | Logs | `/admin/logs` | Sim: `system_logs`, `event_outbox`, `event_outbox_dead_letter`, `payment_webhook_inbox`, `fiscal_webhook_inbox`, `delivery_attempts` |

Itens 1 e 6 (Empresas, Funcionários) **não têm modelo de dados**; entregar “telas funcionais” exige antes uma decisão de modelagem (criar tabelas novas? reusar `customers`/`profiles`?) — não cabem em fase de “fechar 404”.

## Estratégia

- Reutilizar 100% da arquitetura existente: Repository → Service (`*.server.ts`) → Server Functions (`*.functions.ts`) → UI sob `src/routes/_authenticated/`.
- Cada nova rota usa o `AdminShell` já existente (igual às rotas atuais).
- RBAC já no menu (`permission`) — replicar no `requirePermission` de cada server fn.
- Audit/Outbox/Observability: usar os dispatchers já presentes (`dispatchEvent`).
- Para itens sem modelo de dados, abrir a rota com uma tela honesta de “Próximo passo: definir modelo” + botão de issue, em vez de fingir um CRUD.

## Fases

### Fase A — CRUD direto sobre tabelas existentes (entrega imediata)
Cobre 4 módulos completos, todas as telas com listagem real, busca, paginação, criar/editar/arquivar, sem mocks.

1. **Lojas** (`/admin/stores`) — list/create/edit/archive `stores`, editar `store_settings` (chave→valor por aba), upload de logo via DAM já integrado.
2. **Usuários & Papéis** (`/admin/users`) — list `profiles` + roles agregadas, atribuir/remover `user_roles`, ativar/inativar via flag em `profiles`, ver permissões efetivas via `has_role`. Convite por email: usar `supabaseAdmin.auth.admin.inviteUserByEmail` em server fn `requirePermission('users.manage')`.
3. **Auditoria** (`/admin/audit`) — timeline paginada de `audit_log` com filtros (entidade, ação, usuário, período) e export CSV.
4. **Logs** (`/admin/logs`) — abas: System logs, Outbox (pending/dlq com retry/discard), Webhooks (payment + fiscal), Delivery attempts. Reusa fns existentes de outbox; cria fn `retryOutboxEvent`/`discardOutboxEvent`.

### Fase B — CRUD sobre tabelas existentes + workflows
5. **Compras** (`/admin/purchases`) — list/create `purchase_orders`, itens, ações de receber (`goods_receipts`) com lançamento de `stock_movements` (service de inventory já existe).
6. **Notas Fiscais — somente consulta** (`/admin/invoices`) — listagem de `fiscal_invoices`, detalhes, timeline (`fiscal_invoice_events`), download XML/DANFE (URL persistida), webhooks inbox. As ações *emitir/cancelar/CC-e* dependem da Fase D.

### Fase C — Configurações administrativas
7. **Configurações** (`/admin/settings`) — abas:
   - Geral (system_settings/store_settings em editor chave→valor tipado)
   - SEO (subset em store_settings)
   - E-mail (templates + canais já existentes em `notification_*`)
   - Feature Flags (CRUD em `feature_flags` + overrides por store/role)
   - Provedores (lista somente leitura de `fiscal_providers`, `payment_gateways`, `shipping_carrier_accounts` com link para fase D).

### Fase D — Integrações externas (cada uma é um épico)
Cada um destes precisa credenciais, sandbox e adapters próprios. Entregar com tela mas sem botão fake:
- Mercado Pago (já há `payment_gateways` + `payment_adapters`)
- Correios / Melhor Envio (já há `shipping_carrier_accounts`)
- Nuvem Fiscal (já há `fiscal_providers` + `fiscal_webhook_inbox`)
- Marketing avançado (campanhas, automações) — exige modelagem nova
- Empresas / Funcionários — exige modelagem nova

## O que NÃO entrego nesta fase
- Tabela `companies` nova (precisa decisão de domínio antes).
- Tela de Funcionários como entidade separada (será visão filtrada de Users).
- Botões de “emitir NF-e/cancelar/CC-e” — sem o adapter Nuvem Fiscal eles seriam fake.
- Campanhas/automações de marketing — sem modelo de dados.

Para esses 5 itens, crio a rota com uma tela honesta que diz exatamente o que falta para implementar (modelo + integração) e abre um link de “configurar provedor” onde aplicável. Zero placeholders silenciosos, zero botão sem ação.

## Detalhes técnicos

- Cada módulo: 1 arquivo `*.server.ts` (service), 1 `*.functions.ts` (server fns com `requireSupabaseAuth` + `requirePermission`), 1 ou mais rotas em `src/routes/_authenticated/admin.<modulo>.tsx`.
- Padrão de UI igual aos módulos atuais (DataTable + dialog de criar/editar + side sheet de detalhes).
- Convite de usuário: server fn isolada chamando `supabaseAdmin.auth.admin.inviteUserByEmail` (única operação privilegiada — verificada com `has_role('admin')`).
- Export CSV: gerado server-side, baixado via `Blob`.
- Performance: queries paginadas (50/página), índices já existem para `audit_log`, `system_logs`.

## Conclusão

Faz sentido entregar Fase A nesta interação? São ~10 arquivos, todos com CRUD real, sem placeholders, e levam o admin de "10 rotas 404" para "4 rotas 404 honestas + 6 totalmente funcionais". Depois sigo Fase B, C e D em turnos dedicados.
