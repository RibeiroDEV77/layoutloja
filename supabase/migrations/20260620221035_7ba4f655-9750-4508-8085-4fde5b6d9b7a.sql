
-- Revoke public execute on internal SECURITY DEFINER functions
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.has_role(uuid, text, uuid) from public, anon;
revoke execute on function public.has_permission(uuid, text, uuid) from public, anon;
revoke execute on function public.is_super_admin(uuid) from public, anon;
revoke execute on function public.user_store_ids(uuid) from public, anon;

-- Keep grants for authenticated so RLS policies and app reads can call them
grant execute on function public.has_role(uuid, text, uuid) to authenticated;
grant execute on function public.has_permission(uuid, text, uuid) to authenticated;
grant execute on function public.is_super_admin(uuid) to authenticated;
grant execute on function public.user_store_ids(uuid) to authenticated;

-- service_role retains all
grant execute on function public.has_role(uuid, text, uuid) to service_role;
grant execute on function public.has_permission(uuid, text, uuid) to service_role;
grant execute on function public.is_super_admin(uuid) to service_role;
grant execute on function public.user_store_ids(uuid) to service_role;

-- Tighten system_logs insert policy (no more WITH CHECK (true))
drop policy if exists system_logs_insert on public.system_logs;
create policy system_logs_insert on public.system_logs
  for insert to authenticated
  with check (
    public.is_super_admin(auth.uid())
    or store_id is null
    or store_id in (select public.user_store_ids(auth.uid()))
  );
