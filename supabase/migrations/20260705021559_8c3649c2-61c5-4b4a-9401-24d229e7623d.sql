
-- Helper: usuário autenticado é cliente aprovado do atacado desta loja?
CREATE OR REPLACE FUNCTION public.is_approved_wholesale_customer(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.wholesale_applications wa
    JOIN public.customers c ON c.id = wa.customer_id
    WHERE c.auth_user_id = _user_id
      AND wa.store_id    = _store_id
      AND wa.status      = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION public.is_approved_wholesale_customer(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_approved_wholesale_customer(uuid, uuid) TO authenticated, service_role;

-- Leitura da Tabela Atacado por cliente aprovado (não altera as políticas existentes).
DROP POLICY IF EXISTS pricelists_wholesale_approved_select ON public.price_lists;
CREATE POLICY pricelists_wholesale_approved_select
ON public.price_lists
FOR SELECT
TO authenticated
USING (
  is_active
  AND code = 'WHOLESALE-' || store_id::text
  AND public.is_approved_wholesale_customer(auth.uid(), store_id)
);

DROP POLICY IF EXISTS pli_wholesale_approved_select ON public.price_list_items;
CREATE POLICY pli_wholesale_approved_select
ON public.price_list_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.price_lists pl
    WHERE pl.id = price_list_items.price_list_id
      AND pl.is_active
      AND pl.code = 'WHOLESALE-' || pl.store_id::text
      AND public.is_approved_wholesale_customer(auth.uid(), pl.store_id)
  )
);
