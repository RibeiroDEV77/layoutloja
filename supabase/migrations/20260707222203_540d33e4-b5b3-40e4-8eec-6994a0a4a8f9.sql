
-- ============================================================
-- Fix 1: customers — restringir campos que o próprio cliente pode alterar
-- ============================================================

CREATE OR REPLACE FUNCTION public.customers_self_update_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean := false;
BEGIN
  -- Se não há usuário autenticado (service_role/admin/trigger interno), permite.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verifica se o chamador é staff da loja do cliente ou super admin.
  is_staff := public.is_super_admin(auth.uid())
           OR public.has_permission(auth.uid(), 'customers.update', OLD.store_id);

  IF is_staff THEN
    RETURN NEW;
  END IF;

  -- Chamador é o próprio cliente (auth_user_id = auth.uid()). Bloqueia
  -- alteração de campos administrativos/financeiros preservando OLD.
  NEW.store_id                 := OLD.store_id;
  NEW.auth_user_id             := OLD.auth_user_id;
  NEW.credit_limit             := OLD.credit_limit;
  NEW.credit_balance           := OLD.credit_balance;
  NEW.score                    := OLD.score;
  NEW.segment                  := OLD.segment;
  NEW.status                   := OLD.status;
  NEW.default_price_list_id    := OLD.default_price_list_id;
  NEW.doc_number               := OLD.doc_number;
  NEW.doc_type                 := OLD.doc_type;
  NEW.customer_type            := OLD.customer_type;
  NEW.tax_regime               := OLD.tax_regime;
  NEW.state_registration       := OLD.state_registration;
  NEW.municipal_registration   := OLD.municipal_registration;
  NEW.created_by               := OLD.created_by;
  NEW.created_at               := OLD.created_at;
  NEW.deleted_at               := OLD.deleted_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customers_self_update_guard_trg ON public.customers;
CREATE TRIGGER customers_self_update_guard_trg
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.customers_self_update_guard();

-- ============================================================
-- Fix 2: wholesale_applications — impedir reatribuição em self update
-- ============================================================

DROP POLICY IF EXISTS wholesale_apps_self_update ON public.wholesale_applications;

CREATE POLICY wholesale_apps_self_update
ON public.wholesale_applications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = wholesale_applications.customer_id
      AND c.auth_user_id = auth.uid()
  )
  AND status = ANY (ARRAY['draft'::wholesale_application_status, 'submitted'::wholesale_application_status])
)
WITH CHECK (
  -- Re-valida ownership com o customer_id resultante (impede troca de dono)
  EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = wholesale_applications.customer_id
      AND c.auth_user_id = auth.uid()
  )
  AND status = ANY (ARRAY[
    'draft'::wholesale_application_status,
    'submitted'::wholesale_application_status,
    'cancelled'::wholesale_application_status
  ])
);

-- Guard extra: impede o próprio cliente de trocar customer_id / grupo / tabela
CREATE OR REPLACE FUNCTION public.wholesale_apps_self_update_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  is_staff := public.is_super_admin(auth.uid())
           OR public.has_permission(auth.uid(), 'customers.update', OLD.store_id);

  IF is_staff THEN
    RETURN NEW;
  END IF;

  -- Cliente comum: preserva campos que só staff pode mudar
  NEW.customer_id           := OLD.customer_id;
  NEW.store_id              := OLD.store_id;
  NEW.requested_group_id    := OLD.requested_group_id;
  NEW.requested_price_list_id := OLD.requested_price_list_id;
  NEW.decided_by            := OLD.decided_by;
  NEW.decided_at            := OLD.decided_at;
  NEW.decision_reason       := OLD.decision_reason;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wholesale_apps_self_update_guard_trg ON public.wholesale_applications;
CREATE TRIGGER wholesale_apps_self_update_guard_trg
BEFORE UPDATE ON public.wholesale_applications
FOR EACH ROW
EXECUTE FUNCTION public.wholesale_apps_self_update_guard();
