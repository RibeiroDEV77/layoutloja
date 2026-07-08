
-- 1) Harden guest cart anon policies: require high-entropy tokens (>=43 chars ~ 256-bit)
--    and require the session GUC to be a non-empty match.
DROP POLICY IF EXISTS carts_anon_insert ON public.carts;
DROP POLICY IF EXISTS carts_anon_select ON public.carts;
DROP POLICY IF EXISTS carts_anon_update ON public.carts;

CREATE POLICY carts_anon_insert ON public.carts
  FOR INSERT TO anon
  WITH CHECK (
    customer_id IS NULL
    AND session_token IS NOT NULL
    AND length(session_token) >= 43
  );

CREATE POLICY carts_anon_select ON public.carts
  FOR SELECT TO anon
  USING (
    customer_id IS NULL
    AND session_token IS NOT NULL
    AND length(session_token) >= 43
    AND coalesce(nullif(current_setting('request.cart_session_token', true), ''), '') <> ''
    AND session_token = current_setting('request.cart_session_token', true)
  );

CREATE POLICY carts_anon_update ON public.carts
  FOR UPDATE TO anon
  USING (
    customer_id IS NULL
    AND session_token IS NOT NULL
    AND length(session_token) >= 43
    AND coalesce(nullif(current_setting('request.cart_session_token', true), ''), '') <> ''
    AND session_token = current_setting('request.cart_session_token', true)
  )
  WITH CHECK (
    customer_id IS NULL
    AND session_token IS NOT NULL
    AND length(session_token) >= 43
    AND coalesce(nullif(current_setting('request.cart_session_token', true), ''), '') <> ''
    AND session_token = current_setting('request.cart_session_token', true)
  );

-- Mirror the entropy/binding check inside cart_accessible so linked tables
-- (cart_items, cart_coupons, shipping_quotes, stock_reservations) inherit the same rule.
CREATE OR REPLACE FUNCTION public.cart_accessible(_cart_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.carts c
    LEFT JOIN public.customers cu ON cu.id = c.customer_id
    WHERE c.id = _cart_id
      AND (
        (auth.uid() IS NOT NULL AND (
          is_super_admin(auth.uid())
          OR has_permission(auth.uid(), 'carts.read', c.store_id)
          OR has_permission(auth.uid(), 'carts.write', c.store_id)
        ))
        OR (cu.auth_user_id IS NOT NULL AND cu.auth_user_id = auth.uid())
        OR (
          c.customer_id IS NULL
          AND c.session_token IS NOT NULL
          AND length(c.session_token) >= 43
          AND coalesce(nullif(current_setting('request.cart_session_token', true), ''), '') <> ''
          AND c.session_token = current_setting('request.cart_session_token', true)
        )
      )
  );
$function$;

-- 2) Consolidate wishlist ownership: remove overlapping policy that used a different helper.
DROP POLICY IF EXISTS wishlists_self_all ON public.wishlists;
-- wishlists_owner_all (using _is_customer_owner) remains as the single ownership policy,
-- alongside wishlists_public_select which is scoped to is_public = true.
