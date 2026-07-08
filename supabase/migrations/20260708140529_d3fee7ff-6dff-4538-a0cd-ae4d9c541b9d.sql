
-- wishlist_items had two ALL policies with different helpers:
--   wishlist_items_self_all (current_customer_id())
--   wli_owner_all           (_is_customer_owner)
-- Same policy-drift risk we already fixed for wishlists. Keep only wli_owner_all
-- (aligned with wishlists_owner_all).
DROP POLICY IF EXISTS wishlist_items_self_all ON public.wishlist_items;
