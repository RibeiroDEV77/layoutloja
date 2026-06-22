
DROP POLICY IF EXISTS products_member_select ON public.products;
CREATE POLICY products_member_select ON public.products FOR SELECT TO authenticated USING (store_id IN (SELECT user_store_ids(auth.uid())));

DROP POLICY IF EXISTS categories_member_select ON public.categories;
CREATE POLICY categories_member_select ON public.categories FOR SELECT TO authenticated USING (store_id IN (SELECT user_store_ids(auth.uid())));

DROP POLICY IF EXISTS brands_member_select ON public.brands;
CREATE POLICY brands_member_select ON public.brands FOR SELECT TO authenticated USING (store_id IN (SELECT user_store_ids(auth.uid())));
