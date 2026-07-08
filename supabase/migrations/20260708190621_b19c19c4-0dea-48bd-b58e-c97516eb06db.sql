-- =====================================================================
-- Hardening Residual — Sprint pós-rescan
-- 1) Trigger: invalidar session_token ao converter/abandonar carrinho.
-- 2) REVOKE EXECUTE ... FROM anon em SECURITY DEFINER que não precisam de anon.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Trigger de invalidação do session_token
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_carts_invalidate_session_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Zera o token quando o carrinho sai de 'active' para um estado terminal.
  -- Não afeta itens, snapshots, histórico ou o pedido gerado.
  IF (NEW.status IN ('converted','abandoned'))
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.session_token IS NOT NULL THEN
    NEW.session_token := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_carts_invalidate_session_token() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_carts_invalidate_session_token ON public.carts;
CREATE TRIGGER trg_carts_invalidate_session_token
BEFORE UPDATE OF status ON public.carts
FOR EACH ROW
EXECUTE FUNCTION public.tg_carts_invalidate_session_token();

-- Backfill defensivo: qualquer carrinho já terminal com token remanescente.
UPDATE public.carts
   SET session_token = NULL
 WHERE status IN ('converted','abandoned')
   AND session_token IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2) REVOKE EXECUTE FROM anon nas SECURITY DEFINER que não precisam
-- ---------------------------------------------------------------------
-- Allowlist: funções que PRECISAM continuar executáveis por anon
-- (bootstrap, fluxo guest, helpers usados em policies avaliadas para anon).
DO $$
DECLARE
  allowlist text[] := ARRAY[
    'current_user_context',
    'super_admin_exists',
    'cart_accessible',
    'cart_set_session_v1',
    'coupon_lookup_by_code_v1',
    'public_tracking_resolve',
    'is_approved_wholesale_customer',
    'current_customer_id',
    '_is_customer_owner',
    'payment_store_id'
  ];
  r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND p.proname <> ALL(allowlist)
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, PUBLIC',
      r.proname, r.args
    );
  END LOOP;
END $$;

-- Sanity: também revoga a família tg_* de authenticated (defesa em profundidade —
-- triggers só rodam no dono, ninguém precisa executá-las via PostgREST).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND (p.proname LIKE 'tg\_%' ESCAPE '\' OR p.proname LIKE '\_%' ESCAPE '\')
      AND p.proname NOT IN ('_is_customer_owner')
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, authenticated, PUBLIC',
      r.proname, r.args
    );
  END LOOP;
END $$;
