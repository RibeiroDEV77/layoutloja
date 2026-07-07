
-- 1) category_attributes: scope public reads to active categories
DROP POLICY IF EXISTS category_attributes_select ON public.category_attributes;
CREATE POLICY category_attributes_select ON public.category_attributes
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.id = category_attributes.category_id
        AND c.is_active = true
    )
  );

-- 2) customer_addresses: tighten self-access policy (defense-in-depth)
DROP POLICY IF EXISTS customer_addresses_self_all ON public.customer_addresses;
CREATE POLICY customer_addresses_self_all ON public.customer_addresses
  FOR ALL
  TO authenticated
  USING (
    current_customer_id() IS NOT NULL
    AND customer_id = current_customer_id()
  )
  WITH CHECK (
    current_customer_id() IS NOT NULL
    AND customer_id = current_customer_id()
  );

-- 3) feature_flags & feature_flag_overrides: restrict reads to staff
DROP POLICY IF EXISTS flags_read_auth ON public.feature_flags;
CREATE POLICY flags_read_auth ON public.feature_flags
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR has_permission(auth.uid(), 'observability.flags.manage', NULL)
    OR has_permission(auth.uid(), 'observability.flags.read', NULL)
  );

DROP POLICY IF EXISTS flagov_read ON public.feature_flag_overrides;
CREATE POLICY flagov_read ON public.feature_flag_overrides
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR has_permission(auth.uid(), 'observability.flags.manage', NULL)
    OR has_permission(auth.uid(), 'observability.flags.read', NULL)
  );

-- 4) roles / permissions / role_permissions: restrict SELECT to staff
DROP POLICY IF EXISTS roles_select ON public.roles;
CREATE POLICY roles_select ON public.roles
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR has_permission(auth.uid(), 'users.manage', NULL)
    OR has_permission(auth.uid(), 'users.read', NULL)
  );

DROP POLICY IF EXISTS permissions_select ON public.permissions;
CREATE POLICY permissions_select ON public.permissions
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR has_permission(auth.uid(), 'users.manage', NULL)
    OR has_permission(auth.uid(), 'users.read', NULL)
  );

DROP POLICY IF EXISTS role_permissions_select ON public.role_permissions;
CREATE POLICY role_permissions_select ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR has_permission(auth.uid(), 'users.manage', NULL)
    OR has_permission(auth.uid(), 'users.read', NULL)
  );
