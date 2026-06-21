CREATE OR REPLACE FUNCTION public.claim_first_super_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_role_id uuid;
  v_store_id uuid;
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
  if v_role_id is null then
    raise exception 'Papel super_admin não encontrado';
  end if;

  select id into v_store_id from public.stores order by created_at asc limit 1;
  if v_store_id is null then
    insert into public.stores (name, slug)
    values ('Loja Principal', 'loja-principal')
    returning id into v_store_id;
  end if;

  insert into public.user_roles (user_id, role_id, store_id)
  values (v_user_id, v_role_id, v_store_id)
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'user_id', v_user_id, 'store_id', v_store_id);
end;
$function$;