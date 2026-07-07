
-- 1) Carts anon policies: require session_token length >= 32 (defense in depth)
DROP POLICY IF EXISTS "carts_anon_select" ON public.carts;
DROP POLICY IF EXISTS "carts_anon_insert" ON public.carts;
DROP POLICY IF EXISTS "carts_anon_update" ON public.carts;

CREATE POLICY "carts_anon_select" ON public.carts FOR SELECT TO anon
USING (
  customer_id IS NULL
  AND session_token IS NOT NULL
  AND length(session_token) >= 32
  AND session_token = current_setting('request.cart_session_token', true)
);

CREATE POLICY "carts_anon_insert" ON public.carts FOR INSERT TO anon
WITH CHECK (
  customer_id IS NULL
  AND session_token IS NOT NULL
  AND length(session_token) >= 32
);

CREATE POLICY "carts_anon_update" ON public.carts FOR UPDATE TO anon
USING (
  customer_id IS NULL
  AND session_token IS NOT NULL
  AND length(session_token) >= 32
  AND session_token = current_setting('request.cart_session_token', true)
)
WITH CHECK (
  customer_id IS NULL
  AND session_token IS NOT NULL
  AND length(session_token) >= 32
  AND session_token = current_setting('request.cart_session_token', true)
);

-- 2) Orders delete: align with has_permission model
DROP POLICY IF EXISTS "orders_delete" ON public.orders;
CREATE POLICY "orders_delete" ON public.orders FOR DELETE TO authenticated
USING (
  is_super_admin(auth.uid())
  OR has_permission(auth.uid(), 'orders.delete', store_id)
);

-- 3) System settings: remove is_secret=false fallback; require explicit permission
DROP POLICY IF EXISTS "settings_read" ON public.system_settings;
CREATE POLICY "settings_read" ON public.system_settings FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR has_permission(auth.uid(), 'observability.settings.manage', store_id)
);

-- 4) Wishlists: prevent customer_id leakage through public policy
--    Revoke column-level SELECT on customer_id for anon and authenticated,
--    so the "public" SELECT policy cannot expose the owner id via joins.
--    Owners and super admins keep access through wishlists_owner_all + explicit
--    grants at the application layer using service_role/RPCs.
REVOKE SELECT (customer_id) ON public.wishlists FROM anon;
REVOKE SELECT (customer_id) ON public.wishlists FROM authenticated;
-- Re-grant every other column to preserve current behaviour
GRANT SELECT (
  id, store_id, name, is_default, is_public, share_token,
  items_count, created_at, updated_at
) ON public.wishlists TO anon, authenticated;
