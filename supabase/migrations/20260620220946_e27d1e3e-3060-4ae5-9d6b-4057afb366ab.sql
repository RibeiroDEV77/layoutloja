
-- =====================================================
-- FASE 1 — FUNDAÇÃO
-- Multi-tenant, RBAC, Auditoria, Logs
-- =====================================================

create extension if not exists pgcrypto;

-- ============ UTIL ============
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============ 1. STORES ============
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  legal_name text,
  cnpj text,
  status text not null default 'active',
  default_currency text not null default 'BRL',
  timezone text not null default 'America/Sao_Paulo',
  logo_url text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index stores_slug_uidx on public.stores(slug) where deleted_at is null;
create index stores_status_idx on public.stores(status);

grant select, insert, update, delete on public.stores to authenticated;
grant select on public.stores to anon;
grant all on public.stores to service_role;

alter table public.stores enable row level security;

create trigger trg_stores_updated before update on public.stores
for each row execute function public.set_updated_at();

-- ============ 2. STORE_SETTINGS ============
create table public.store_settings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index store_settings_store_key_uidx on public.store_settings(store_id, key);
create index store_settings_store_idx on public.store_settings(store_id);

grant select, insert, update, delete on public.store_settings to authenticated;
grant all on public.store_settings to service_role;

alter table public.store_settings enable row level security;

create trigger trg_store_settings_updated before update on public.store_settings
for each row execute function public.set_updated_at();

-- ============ 3. PROFILES ============
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  full_name text,
  avatar_url text,
  phone text,
  locale text not null default 'pt-BR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_user_idx on public.profiles(user_id);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create trigger trg_profiles_updated before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto-create profile when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ 4. ROLES ============
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.roles to authenticated;
grant all on public.roles to service_role;

alter table public.roles enable row level security;

create trigger trg_roles_updated before update on public.roles
for each row execute function public.set_updated_at();

-- ============ 5. PERMISSIONS ============
create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  module text not null,
  description text,
  created_at timestamptz not null default now()
);
create index permissions_module_idx on public.permissions(module);

grant select on public.permissions to authenticated;
grant all on public.permissions to service_role;

alter table public.permissions enable row level security;

-- ============ 6. ROLE_PERMISSIONS ============
create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index role_permissions_uidx on public.role_permissions(role_id, permission_id);
create index role_permissions_role_idx on public.role_permissions(role_id);
create index role_permissions_perm_idx on public.role_permissions(permission_id);

grant select on public.role_permissions to authenticated;
grant all on public.role_permissions to service_role;

alter table public.role_permissions enable row level security;

-- ============ 7. USER_ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role_id uuid not null references public.roles(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  granted_by uuid,
  created_at timestamptz not null default now()
);
create unique index user_roles_uidx on public.user_roles(user_id, role_id, store_id);
create index user_roles_user_idx on public.user_roles(user_id);
create index user_roles_role_idx on public.user_roles(role_id);
create index user_roles_store_idx on public.user_roles(store_id);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

-- ============ HELPERS (SECURITY DEFINER) ============
create or replace function public.has_role(_user_id uuid, _role_code text, _store_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = _user_id
      and r.code = _role_code
      and (_store_id is null or ur.store_id = _store_id)
  );
$$;

create or replace function public.has_permission(_user_id uuid, _permission_code text, _store_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = _user_id
      and p.code = _permission_code
      and (_store_id is null or ur.store_id = _store_id)
  );
$$;

create or replace function public.is_super_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(_user_id, 'super_admin', null);
$$;

create or replace function public.user_store_ids(_user_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct store_id from public.user_roles where user_id = _user_id;
$$;

-- ============ 8. USER_SESSIONS ============
create table public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  ip inet,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index user_sessions_user_idx on public.user_sessions(user_id);
create index user_sessions_revoked_idx on public.user_sessions(revoked_at);

grant select, insert, update on public.user_sessions to authenticated;
grant all on public.user_sessions to service_role;

alter table public.user_sessions enable row level security;

-- ============ 9. AUDIT_LOG ============
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  actor_user_id uuid,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  diff jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log(entity_type, entity_id);
create index audit_log_actor_idx on public.audit_log(actor_user_id);
create index audit_log_created_idx on public.audit_log(created_at desc);
create index audit_log_store_idx on public.audit_log(store_id);

grant select, insert on public.audit_log to authenticated;
grant all on public.audit_log to service_role;

alter table public.audit_log enable row level security;

-- ============ 10. SYSTEM_LOGS ============
create table public.system_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  level text not null default 'info',
  source text not null,
  message text not null,
  context jsonb,
  created_at timestamptz not null default now()
);
create index system_logs_level_created_idx on public.system_logs(level, created_at desc);
create index system_logs_store_idx on public.system_logs(store_id);

grant insert on public.system_logs to authenticated;
grant all on public.system_logs to service_role;

alter table public.system_logs enable row level security;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- ----- stores -----
create policy stores_public_select on public.stores
  for select to anon
  using (status = 'active' and deleted_at is null);

create policy stores_authenticated_select on public.stores
  for select to authenticated
  using (
    (status = 'active' and deleted_at is null)
    or public.is_super_admin(auth.uid())
    or id in (select public.user_store_ids(auth.uid()))
  );

create policy stores_admin_insert on public.stores
  for insert to authenticated
  with check (public.is_super_admin(auth.uid()));

create policy stores_admin_update on public.stores
  for update to authenticated
  using (public.is_super_admin(auth.uid()) or public.has_permission(auth.uid(), 'stores.manage', id))
  with check (public.is_super_admin(auth.uid()) or public.has_permission(auth.uid(), 'stores.manage', id));

create policy stores_admin_delete on public.stores
  for delete to authenticated
  using (public.is_super_admin(auth.uid()));

-- ----- store_settings -----
create policy store_settings_member_select on public.store_settings
  for select to authenticated
  using (
    public.is_super_admin(auth.uid())
    or store_id in (select public.user_store_ids(auth.uid()))
  );

create policy store_settings_admin_write on public.store_settings
  for all to authenticated
  using (public.is_super_admin(auth.uid()) or public.has_permission(auth.uid(), 'settings.manage', store_id))
  with check (public.is_super_admin(auth.uid()) or public.has_permission(auth.uid(), 'settings.manage', store_id));

-- ----- profiles -----
create policy profiles_self_select on public.profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_super_admin(auth.uid())
    or public.has_permission(auth.uid(), 'users.read', null)
  );

create policy profiles_self_insert on public.profiles
  for insert to authenticated
  with check (user_id = auth.uid());

create policy profiles_self_update on public.profiles
  for update to authenticated
  using (user_id = auth.uid() or public.is_super_admin(auth.uid()))
  with check (user_id = auth.uid() or public.is_super_admin(auth.uid()));

-- ----- roles / permissions / role_permissions (read-only to app) -----
create policy roles_select on public.roles for select to authenticated using (true);
create policy permissions_select on public.permissions for select to authenticated using (true);
create policy role_permissions_select on public.role_permissions for select to authenticated using (true);

-- ----- user_roles -----
create policy user_roles_self_select on public.user_roles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_super_admin(auth.uid())
    or public.has_permission(auth.uid(), 'users.read', store_id)
  );

-- ----- user_sessions -----
create policy user_sessions_self_all on public.user_sessions
  for all to authenticated
  using (user_id = auth.uid() or public.is_super_admin(auth.uid()))
  with check (user_id = auth.uid() or public.is_super_admin(auth.uid()));

-- ----- audit_log -----
create policy audit_log_insert on public.audit_log
  for insert to authenticated
  with check (actor_user_id = auth.uid() or actor_user_id is null);

create policy audit_log_admin_select on public.audit_log
  for select to authenticated
  using (
    public.is_super_admin(auth.uid())
    or public.has_permission(auth.uid(), 'audit.read', store_id)
  );

-- ----- system_logs -----
create policy system_logs_insert on public.system_logs
  for insert to authenticated
  with check (true);

create policy system_logs_admin_select on public.system_logs
  for select to authenticated
  using (
    public.is_super_admin(auth.uid())
    or public.has_permission(auth.uid(), 'system.logs.read', store_id)
  );

-- =====================================================
-- SEEDS
-- =====================================================

-- Permissions catalog
insert into public.permissions (code, module, description) values
  ('stores.manage',      'stores',    'Gerenciar dados da loja'),
  ('settings.manage',    'settings',  'Gerenciar configurações da loja'),
  ('users.read',         'users',     'Visualizar usuários e papéis'),
  ('users.manage',       'users',     'Gerenciar usuários e papéis'),
  ('audit.read',         'security',  'Visualizar audit log'),
  ('system.logs.read',   'security',  'Visualizar logs do sistema'),
  ('products.read',      'catalog',   'Visualizar produtos'),
  ('products.create',    'catalog',   'Criar produtos'),
  ('products.update',    'catalog',   'Editar produtos'),
  ('products.publish',   'catalog',   'Publicar produtos'),
  ('products.delete',    'catalog',   'Excluir produtos'),
  ('inventory.read',     'inventory', 'Visualizar estoque'),
  ('inventory.adjust',   'inventory', 'Ajustar estoque'),
  ('costs.read',         'finance',   'Visualizar custos'),
  ('orders.read',        'sales',     'Visualizar pedidos'),
  ('orders.manage',      'sales',     'Gerenciar pedidos'),
  ('orders.refund',      'sales',     'Estornar pedidos'),
  ('companies.approve',  'customers', 'Aprovar empresas'),
  ('customers.read',     'customers', 'Visualizar clientes'),
  ('marketing.manage',   'marketing', 'Gerenciar marketing'),
  ('shipping.manage',    'shipping',  'Gerenciar expedição'),
  ('finance.manage',     'finance',   'Gerenciar financeiro'),
  ('hr.manage',          'hr',        'Gerenciar funcionários'),
  ('purchases.read',     'purchases', 'Visualizar compras'),
  ('purchases.create',   'purchases', 'Criar pedidos de compra'),
  ('purchases.receive',  'purchases', 'Receber mercadorias'),
  ('suppliers.manage',   'purchases', 'Gerenciar fornecedores'),
  ('dashboard.customize','dashboard', 'Personalizar dashboard pessoal')
on conflict (code) do nothing;

-- Roles
insert into public.roles (code, name, description, is_system) values
  ('super_admin',     'Super Administrador', 'Acesso total ao sistema (cross-store)', true),
  ('admin',           'Administrador',       'Administrador da loja',                  true),
  ('gerente',         'Gerente',             'Gerente operacional',                    true),
  ('estoquista',      'Estoquista',          'Controle de estoque',                    true),
  ('financeiro',      'Financeiro',          'Equipe financeira',                      true),
  ('expedicao',       'Expedição',           'Equipe de expedição',                    true),
  ('marketing',       'Marketing',           'Equipe de marketing',                    true),
  ('cliente_varejo',  'Cliente Varejo',      'Cliente pessoa física',                  true),
  ('cliente_atacado', 'Cliente Atacado',     'Cliente pessoa jurídica (B2B)',          true),
  ('representante',   'Representante',       'Representante comercial',                true)
on conflict (code) do nothing;

-- Bind permissions to roles
-- super_admin: all
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'super_admin'
on conflict do nothing;

-- admin: all permissions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'admin'
on conflict do nothing;

-- gerente
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'gerente'
  and p.code in (
    'products.read','products.create','products.update','products.publish',
    'inventory.read','inventory.adjust',
    'orders.read','orders.manage',
    'customers.read','companies.approve',
    'marketing.manage','shipping.manage',
    'audit.read','costs.read',
    'purchases.read','purchases.create','purchases.receive','suppliers.manage',
    'dashboard.customize'
  )
on conflict do nothing;

-- estoquista
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'estoquista'
  and p.code in (
    'products.read','inventory.read','inventory.adjust',
    'purchases.read','purchases.receive',
    'dashboard.customize'
  )
on conflict do nothing;

-- financeiro
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'financeiro'
  and p.code in (
    'orders.read','orders.refund',
    'costs.read','finance.manage',
    'customers.read','purchases.read',
    'dashboard.customize'
  )
on conflict do nothing;

-- expedicao
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'expedicao'
  and p.code in ('orders.read','shipping.manage','dashboard.customize')
on conflict do nothing;

-- marketing
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'marketing'
  and p.code in ('products.read','marketing.manage','customers.read','dashboard.customize')
on conflict do nothing;

-- Initial store
insert into public.stores (name, slug, legal_name, status, default_currency, timezone)
values ('Layout', 'layout', 'Layout Indústria do Vestuário', 'active', 'BRL', 'America/Sao_Paulo')
on conflict do nothing;
