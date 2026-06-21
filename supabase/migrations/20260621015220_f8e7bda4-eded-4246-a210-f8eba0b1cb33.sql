
-- 1) Eliminar Security Definer View (ERROR)
ALTER VIEW public.customer_timeline_view SET (security_invoker = true);

-- 2) Materialized View fora da API pública
REVOKE ALL ON public.mv_orders_daily FROM anon, authenticated;
GRANT SELECT ON public.mv_orders_daily TO service_role;

-- 3) Revogar EXECUTE de anon em todas as funções SECURITY DEFINER do schema public.
-- Mantém access para authenticated e service_role conforme uso atual.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
                   r.schema_name, r.func_name, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role',
                   r.schema_name, r.func_name, r.args);
  END LOOP;
END $$;

-- 4) Reabrir explicitamente as funções que precisam ser chamáveis por anon
-- (fluxo de bootstrap: contexto do usuário e verificação inicial de super admin).
GRANT EXECUTE ON FUNCTION public.current_user_context() TO anon;
GRANT EXECUTE ON FUNCTION public.super_admin_exists() TO anon;
