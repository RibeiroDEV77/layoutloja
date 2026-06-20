
-- =========================================================================
-- FASE 2.5 — Bootstrap de autenticação
-- =========================================================================

-- 1) super_admin recebe TODAS as permissões
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'super_admin'
on conflict do nothing;

-- 2) admin recebe todas exceto system.logs.read e audit.read avançados (na verdade recebe tudo também)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'admin'
on conflict do nothing;

-- 3) gerente — operacional amplo, sem manage users/finance
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'gerente' and p.code in (
  'products.read','products.create','products.update','products.publish',
  'orders.read','orders.manage',
  'inventory.read','inventory.adjust',
  'purchases.read','purchases.create','purchases.receive',
  'suppliers.manage','customers.read','companies.approve',
  'shipping.manage','marketing.manage','dashboard.customize'
) on conflict do nothing;

-- 4) financeiro
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'financeiro' and p.code in (
  'orders.read','orders.refund','finance.manage','costs.read',
  'purchases.read','customers.read','dashboard.customize'
) on conflict do nothing;

-- 5) estoquista
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'estoquista' and p.code in (
  'products.read','inventory.read','inventory.adjust',
  'purchases.read','purchases.receive','dashboard.customize'
) on conflict do nothing;

-- 6) expedicao
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'expedicao' and p.code in (
  'orders.read','shipping.manage','dashboard.customize'
) on conflict do nothing;

-- 7) marketing
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'marketing' and p.code in (
  'products.read','products.update','products.publish',
  'marketing.manage','customers.read','dashboard.customize'
) on conflict do nothing;

-- 8) representante
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'representante' and p.code in (
  'products.read','orders.read','orders.manage','customers.read','dashboard.customize'
) on conflict do nothing;

-- 9) cliente_atacado / cliente_varejo — leitura básica de catálogo via anon; aqui sem permissões admin
-- (intencionalmente vazio)

-- =========================================================================
-- claim_first_super_admin() — apenas se ainda não existir nenhum
-- =========================================================================
create or replace function public.claim_first_super_admin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role_id uuid;
  v_existing int;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  select count(*) into v_existing
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where r.code = 'super_admin';

  if v_existing > 0 then
    raise exception 'Já existe um super administrador no sistema';
  end if;

  select id into v_role_id from public.roles where code = 'super_admin';

  insert into public.user_roles (user_id, role_id, store_id)
  values (v_user_id, v_role_id, null)
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'user_id', v_user_id);
end;
$$;

revoke execute on function public.claim_first_super_admin() from public, anon;
grant execute on function public.claim_first_super_admin() to authenticated;

-- =========================================================================
-- super_admin_exists() — função pública leve para a UI decidir mostrar botão
-- =========================================================================
create or replace function public.super_admin_exists()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where r.code = 'super_admin'
  );
$$;

revoke execute on function public.super_admin_exists() from public;
grant execute on function public.super_admin_exists() to anon, authenticated;

-- =========================================================================
-- current_user_context() — retorna profile + roles + permissions
-- =========================================================================
create or replace function public.current_user_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    return jsonb_build_object('authenticated', false);
  end if;

  select jsonb_build_object(
    'authenticated', true,
    'user_id', v_user_id,
    'profile', (select to_jsonb(p) from public.profiles p where p.user_id = v_user_id),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('code', r.code, 'name', r.name, 'store_id', ur.store_id))
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = v_user_id
    ), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(distinct p.code)
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions p on p.id = rp.permission_id
      where ur.user_id = v_user_id
    ), '[]'::jsonb),
    'stores', coalesce((
      select jsonb_agg(distinct ur.store_id) filter (where ur.store_id is not null)
      from public.user_roles ur
      where ur.user_id = v_user_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.current_user_context() from public, anon;
grant execute on function public.current_user_context() to authenticated;
