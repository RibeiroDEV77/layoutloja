
-- 1) Drop broad DAM storage policies; rely on store-scoped dam_* policies
DROP POLICY IF EXISTS "Authenticated can read dam" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can insert dam" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update dam" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete dam" ON storage.objects;

-- 2) Restrict customer_groups SELECT to authenticated only (not public/anon)
DROP POLICY IF EXISTS cgroups_member_select ON public.customer_groups;
CREATE POLICY cgroups_member_select ON public.customer_groups
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.user_store_ids(auth.uid())));

-- 3) Restrict support_ticket_categories SELECT to store members only
DROP POLICY IF EXISTS support_cat_select ON public.support_ticket_categories;
CREATE POLICY support_cat_select ON public.support_ticket_categories
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.user_store_ids(auth.uid())));
