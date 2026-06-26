
CREATE TYPE public.wholesale_application_status AS ENUM (
  'draft', 'submitted', 'in_review', 'approved', 'rejected', 'cancelled'
);

CREATE TABLE public.wholesale_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  status public.wholesale_application_status NOT NULL DEFAULT 'draft',
  workflow_instance_id uuid REFERENCES public.workflow_instances(id) ON DELETE SET NULL,
  requested_group_id uuid REFERENCES public.customer_groups(id) ON DELETE SET NULL,
  requested_price_list_id uuid REFERENCES public.price_lists(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decision_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wholesale_applications_store_status_idx
  ON public.wholesale_applications(store_id, status);
CREATE INDEX wholesale_applications_customer_idx
  ON public.wholesale_applications(customer_id);
CREATE UNIQUE INDEX wholesale_applications_one_open_per_customer
  ON public.wholesale_applications(customer_id)
  WHERE status IN ('draft','submitted','in_review');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wholesale_applications TO authenticated;
GRANT ALL ON public.wholesale_applications TO service_role;

ALTER TABLE public.wholesale_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY wholesale_apps_self_select ON public.wholesale_applications
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = wholesale_applications.customer_id
        AND c.auth_user_id = auth.uid()
    )
  );

CREATE POLICY wholesale_apps_self_insert ON public.wholesale_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = wholesale_applications.customer_id
        AND c.auth_user_id = auth.uid()
    )
    AND status IN ('draft','submitted')
    AND decided_at IS NULL
    AND decided_by IS NULL
  );

CREATE POLICY wholesale_apps_self_update ON public.wholesale_applications
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = wholesale_applications.customer_id
        AND c.auth_user_id = auth.uid()
    )
    AND status IN ('draft','submitted')
  )
  WITH CHECK (
    status IN ('draft','submitted','cancelled')
  );

CREATE POLICY wholesale_apps_staff_select ON public.wholesale_applications
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'customers.read', store_id)
  );

CREATE POLICY wholesale_apps_staff_write ON public.wholesale_applications
  FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'customers.update', store_id)
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'customers.update', store_id)
  );

CREATE TRIGGER wholesale_applications_set_updated_at
  BEFORE UPDATE ON public.wholesale_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
