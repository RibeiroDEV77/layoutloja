## Situação atual (auditoria do existente)

A tela `/admin/users` e o service `users.server.ts` já existem com fluxo mínimo (listar, convidar, atribuir papel). Porém o RBAC chamado pelo código **não está completo no banco**:

| Recurso citado | Existe? | Observação |
|---|---|---|
| Tabelas `profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_sessions` | Sim | OK |
| RPC `is_super_admin` | **Não** | usado em `permissions.server.ts` → toda chamada de `requireUserManage` falha |
| RPC `has_permission` | **Não** | usado em `requirePermission` |
| RPC `user_store_ids` | **Não** | usado em `requireStoreAccess` |
| RPC `current_user_context` / `claim_first_super_admin` | **Não** | citados no pedido |
| Tabela `audit_log` colunas `actor_user_id`, `entity_type`, `entity_id`, `action`, `diff` | Existe (10 cols) | Confirmar nomes antes de gravar |
| Hook `usePermissions`, componente `<Can>` | Existem (`src/hooks/use-permissions.tsx`) | OK |
| `AuthProvider` / `useAuth` | Assumido existir; verificar | |

Sem essas RPCs, o módulo atual já está quebrado em produção — qualquer ação responde "Falha ao verificar super admin". A Fase 6.3.5 (homologação) deveria ter pego isso.

## Escopo da entrega

Vou completar o módulo em duas frentes, **em uma migration única + código**.

### Frente A — Backend RBAC (migration)

1. **Funções SECURITY DEFINER** (`search_path=public`):
   - `is_super_admin(_user_id uuid) → bool`
   - `has_role(_user_id uuid, _role_code text, _store_id uuid default null) → bool`
   - `has_permission(_user_id uuid, _permission_code text, _store_id uuid default null) → bool`
   - `user_store_ids(_user_id uuid) → setof uuid`
   - `current_user_context() → jsonb` (roles + permissions + stores do `auth.uid()`)
   - `claim_first_super_admin()` — concede `super_admin` ao primeiro `auth.uid()` se não existir nenhum
   - `admin_invite_user`, `admin_set_user_active`, `admin_unlock_user`, `admin_force_password_change`, `admin_reset_password` — wrappers SECURITY DEFINER que verificam `is_super_admin(auth.uid())` e gravam em `audit_log`
2. **Seed mínimo** de papéis/permissões padrão (super_admin, admin, manager, operator, viewer) com `is_system=true` — idempotente (`ON CONFLICT DO NOTHING`).
3. **Campos faltantes** em `profiles`: `email text`, `is_active bool default true`, `is_blocked bool default false`, `must_change_password bool default false`, `last_login_at timestamptz` + trigger para sincronizar `email` com `auth.users` no signup.
4. **Outbox**: usar tabela `event_outbox` existente — gatilho em `user_roles` (insert/delete) e em `profiles` (update de `is_active`/`is_blocked`) emite eventos `user.role_assigned`, `user.role_revoked`, `user.blocked`, `user.unblocked`.

### Frente B — Service + Server Functions + UI

Reaproveita `CrudPage`, `DataTable`, `CrudDrawer`, `StatusBadge`, `Can`, `usePermissions`, `Admin Shell`.

**Service (`services/users.server.ts`)** — expandido:
- `listUsers({ q, page, pageSize, status, role_code, store_id })` — filtros + total
- `getUser(user_id)` — perfil + papéis + permissões efetivas (origem) + lojas + sessões
- `createUser` (via convite, redireciona para `inviteUser`)
- `updateProfile(user_id, { full_name, phone, avatar_url, locale, email })`
- `setUserActive(user_id, active)`
- `blockUser(user_id, reason)` / `unblockUser(user_id)`
- `forcePasswordChange(user_id)`
- `resetPassword(user_id)` — Auth admin API gera link
- `assignRole`, `revokeRole(user_role_id)`, `setDefaultStore(user_id, store_id)`
- `listEffectivePermissions(user_id)` — JOIN role_permissions → mostra origem (qual role concedeu)
- `usersDashboard()` — `{ active, super_admins, pending_invites, blocked }`

Todas as mutações chamam `requireUserManage` (→ `is_super_admin`) e gravam `audit_log` com `actor_user_id`, `entity_type='user'`, `entity_id`, `action`, `diff`.

**Server Functions (`users.functions.ts`)** — wraps com `requireSupabaseAuth` + `withBusiness`.

**UI (`/admin/users`)**:
- Dashboard topo: 4 widgets (Ativos / Admins / Convites Pendentes / Bloqueados).
- Toolbar: busca + filtro de status + filtro de papel + filtro de loja.
- Tabela: avatar, nome, e-mail, papéis (chips), lojas, status, último login.
- Drawer de detalhe (clicar na linha) com abas:
  - **Perfil** — editar nome, telefone, avatar, locale, e-mail
  - **Papéis** — atribuir/revogar (com `user_role_id`); botão "definir loja padrão"
  - **Permissões** — lista efetiva read-only com badge da role de origem
  - **Lojas** — vincular/desvincular (atalho que cria/remove um papel `viewer` na loja)
  - **Segurança** — ativar/desativar, bloquear/desbloquear, forçar troca de senha, enviar reset
  - **Sessões** — listar `user_sessions` ativas + botão revogar
  - **Auditoria** — `audit_log` filtrado por `entity_type='user' AND entity_id=user_id`
- Botão "Convidar usuário" no header (drawer existente, expandido com cargo/telefone).

Todas as ações usam `runAction` (toast loading/success/error), `<Can permission="users.manage">` para ocultar botões, e invalidam `["admin-users"]` no React Query.

### Frente C — Bootstrap de acesso

- Banner no topo de `/admin/users` quando `current_user_context().roles` está vazio **e** não há super admin no sistema → botão "Tornar-me super admin" chama `claim_first_super_admin()`. Some após o primeiro uso.

## Detalhes técnicos

- **RLS** mantida em `user_roles`, `profiles`, `audit_log`; novas policies usam `is_super_admin(auth.uid())` para leituras/escritas de admin.
- **GRANTs** completos em novas funções (`GRANT EXECUTE ... TO authenticated`) e tabelas alteradas.
- **Audit**: toda mutação → `audit_log` (já existente). Não duplica em outbox; outbox emite eventos para integração externa (e-mail, webhooks).
- **Performance**: índices em `user_roles(user_id)`, `user_roles(store_id)`, `audit_log(entity_type, entity_id, created_at desc)`.
- **Segurança**: nenhum `service_role_key` no client; `inviteUser`/`resetPassword` carregam `supabaseAdmin` via `await import` dentro do handler.

## Arquivos

**Criar**
- migration única com tudo da Frente A
- `src/components/admin/users/profile-tab.tsx`
- `src/components/admin/users/roles-tab.tsx`
- `src/components/admin/users/permissions-tab.tsx`
- `src/components/admin/users/stores-tab.tsx`
- `src/components/admin/users/security-tab.tsx`
- `src/components/admin/users/sessions-tab.tsx`
- `src/components/admin/users/audit-tab.tsx`
- `src/components/admin/users/user-detail-drawer.tsx`
- `src/components/admin/users/invite-drawer.tsx`
- `src/components/admin/users/dashboard-widgets.tsx`

**Alterar**
- `src/lib/business/services/users.server.ts` — expandir
- `src/lib/business/services/permissions.server.ts` — manter (passa a funcionar)
- `src/lib/business/users.functions.ts` — adicionar funções
- `src/routes/_authenticated/admin.users.tsx` — reescrever com abas/widgets

## Fora de escopo (não vou fazer)

- SSO/MFA (não pedido)
- Criação de novos papéis/permissões pela UI (apenas atribuição) — pode virar Fase B
- Edição de `role_permissions` (essa matriz fica como seed do sistema)

## Ordem de execução

1. **Migration** (Frente A) — aguarda aprovação.
2. Após migration aprovada e types regenerados: services + functions + UI (Frente B) em paralelo.
3. Smoke test: claim super admin → convidar usuário → atribuir papel → bloquear/desbloquear → ver auditoria.

Posso prosseguir com a migration?