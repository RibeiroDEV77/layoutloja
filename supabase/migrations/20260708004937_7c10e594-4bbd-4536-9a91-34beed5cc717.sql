DROP POLICY IF EXISTS "order_addresses_read"  ON public.order_addresses;
DROP POLICY IF EXISTS "order_addresses_write" ON public.order_addresses;

CREATE POLICY "order_addresses_read"
ON public.order_addresses
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    store_id IN (SELECT public.user_store_ids(auth.uid()))
    AND public.has_permission(auth.uid(), 'orders.read', store_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.customers c ON c.id = o.customer_id
    WHERE o.id = order_addresses.order_id
      AND c.auth_user_id = auth.uid()
  )
);

CREATE POLICY "order_addresses_write"
ON public.order_addresses
FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    store_id IN (SELECT public.user_store_ids(auth.uid()))
    AND public.has_permission(auth.uid(), 'orders.write', store_id)
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    store_id IN (SELECT public.user_store_ids(auth.uid()))
    AND public.has_permission(auth.uid(), 'orders.write', store_id)
  )
);