
-- 1) DAM storage bucket policies — scope by store + DAM permission
DROP POLICY IF EXISTS dam_select_authenticated ON storage.objects;
DROP POLICY IF EXISTS dam_insert_authenticated ON storage.objects;
DROP POLICY IF EXISTS dam_update_authenticated ON storage.objects;
DROP POLICY IF EXISTS dam_delete_authenticated ON storage.objects;

CREATE POLICY dam_select_authenticated ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'dam'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_permission(auth.uid(), 'dam.read', ((storage.foldername(name))[1])::uuid)
    )
  );

CREATE POLICY dam_insert_authenticated ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dam'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_permission(auth.uid(), 'dam.upload', ((storage.foldername(name))[1])::uuid)
    )
  );

CREATE POLICY dam_update_authenticated ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'dam'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_permission(auth.uid(), 'dam.update', ((storage.foldername(name))[1])::uuid)
    )
  )
  WITH CHECK (
    bucket_id = 'dam'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_permission(auth.uid(), 'dam.update', ((storage.foldername(name))[1])::uuid)
    )
  );

CREATE POLICY dam_delete_authenticated ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'dam'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_permission(auth.uid(), 'dam.delete', ((storage.foldername(name))[1])::uuid)
    )
  );

-- 2) Public catalog — restrict anon reads to rows belonging to active, non-deleted stores
DROP POLICY IF EXISTS categories_public_select ON public.categories;
CREATE POLICY categories_public_select ON public.categories
  FOR SELECT TO anon
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = categories.store_id
        AND s.status = 'active'
        AND s.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS brands_public_select ON public.brands;
CREATE POLICY brands_public_select ON public.brands
  FOR SELECT TO anon
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = brands.store_id
        AND s.status = 'active'
        AND s.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS collections_public_select ON public.collections;
CREATE POLICY collections_public_select ON public.collections
  FOR SELECT TO anon
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = collections.store_id
        AND s.status = 'active'
        AND s.deleted_at IS NULL
    )
  );

-- 3) shipping_zone_postal_ranges — public read only for active zones
DROP POLICY IF EXISTS "Postal ranges: public read" ON public.shipping_zone_postal_ranges;
CREATE POLICY "Postal ranges: public read" ON public.shipping_zone_postal_ranges
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shipping_zones z
      WHERE z.id = shipping_zone_postal_ranges.zone_id
        AND z.active = true
    )
  );

-- 4) product_relations — scope permission checks by the product's store
DROP POLICY IF EXISTS "Staff can manage product relations" ON public.product_relations;
DROP POLICY IF EXISTS "Staff can read all product relations" ON public.product_relations;

CREATE POLICY "Staff can read all product relations" ON public.product_relations
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'products.read', public.product_store_id(product_id))
  );

CREATE POLICY "Staff can manage product relations" ON public.product_relations
  FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'products.write', public.product_store_id(product_id))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'products.write', public.product_store_id(product_id))
  );
