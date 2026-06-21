
-- 1. feature_flags: remove anon read entirely (use server fn for storefront if needed)
DROP POLICY IF EXISTS flags_read_anon ON public.feature_flags;
REVOKE SELECT ON public.feature_flags FROM anon;

-- 2. fiscal_webhook_inbox: drop NULL store branch
DROP POLICY IF EXISTS fiscal_webhook_inbox_read ON public.fiscal_webhook_inbox;
CREATE POLICY fiscal_webhook_inbox_read ON public.fiscal_webhook_inbox
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (store_id IS NOT NULL AND has_permission(auth.uid(), 'fiscal.audit', store_id))
  );

-- 3. payment_adapters: restrict to authenticated staff
DROP POLICY IF EXISTS payment_adapters_public_select ON public.payment_adapters;
CREATE POLICY payment_adapters_authenticated_select ON public.payment_adapters
  FOR SELECT TO authenticated
  USING (status = ANY (ARRAY['active'::payment_adapter_status, 'deprecated'::payment_adapter_status]));
REVOKE SELECT ON public.payment_adapters FROM anon;

-- 4. orders_search: ensure no anon access
REVOKE SELECT ON public.orders_search FROM anon, PUBLIC;

-- 5. Product child tables: require parent product to be published & visible
DROP POLICY IF EXISTS variants_select ON public.product_variants;
CREATE POLICY variants_select ON public.product_variants FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_variants.product_id
    AND p.status = 'published'
    AND p.visibility IN ('published','catalog_only')
));

DROP POLICY IF EXISTS colors_select ON public.product_colors;
CREATE POLICY colors_select ON public.product_colors FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_colors.product_id
    AND p.status = 'published'
    AND p.visibility IN ('published','catalog_only')
));

DROP POLICY IF EXISTS pcm_select ON public.product_color_media;
CREATE POLICY pcm_select ON public.product_color_media FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM public.product_colors c
  JOIN public.products p ON p.id = c.product_id
  WHERE c.id = product_color_media.product_color_id
    AND p.status = 'published'
    AND p.visibility IN ('published','catalog_only')
));

DROP POLICY IF EXISTS vav_select ON public.variant_attribute_values;
CREATE POLICY vav_select ON public.variant_attribute_values FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM public.product_variants v
  JOIN public.products p ON p.id = v.product_id
  WHERE v.id = variant_attribute_values.variant_id
    AND p.status = 'published'
    AND p.visibility IN ('published','catalog_only')
));

DROP POLICY IF EXISTS pav_select ON public.product_attribute_values;
CREATE POLICY pav_select ON public.product_attribute_values FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_attribute_values.product_id
    AND p.status = 'published'
    AND p.visibility IN ('published','catalog_only')
));

DROP POLICY IF EXISTS product_tags_select ON public.product_tags;
CREATE POLICY product_tags_select ON public.product_tags FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_tags.product_id
    AND p.status = 'published'
    AND p.visibility IN ('published','catalog_only')
));

DROP POLICY IF EXISTS product_collections_select ON public.product_collections;
CREATE POLICY product_collections_select ON public.product_collections FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.id = product_collections.product_id
    AND p.status = 'published'
    AND p.visibility IN ('published','catalog_only')
));

-- 6. Shipping public reads: require store status='active' and not deleted
DROP POLICY IF EXISTS "Shipping zones: public read active" ON public.shipping_zones;
CREATE POLICY "Shipping zones: public read active" ON public.shipping_zones FOR SELECT TO anon, authenticated
USING (
  active = true
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = shipping_zones.store_id AND s.status = 'active' AND s.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "Shipping methods: public read active" ON public.shipping_methods;
CREATE POLICY "Shipping methods: public read active" ON public.shipping_methods FOR SELECT TO anon, authenticated
USING (
  active = true
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = shipping_methods.store_id AND s.status = 'active' AND s.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "Shipping rates: public read" ON public.shipping_rates;
CREATE POLICY "Shipping rates: public read" ON public.shipping_rates FOR SELECT TO anon, authenticated
USING (
  active = true
  AND EXISTS (
    SELECT 1 FROM public.shipping_zones z
    JOIN public.stores s ON s.id = z.store_id
    WHERE z.id = shipping_rates.zone_id
      AND z.active = true
      AND s.status = 'active' AND s.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "Postal ranges: public read" ON public.shipping_zone_postal_ranges;
CREATE POLICY "Postal ranges: public read" ON public.shipping_zone_postal_ranges FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.shipping_zones z
  JOIN public.stores s ON s.id = z.store_id
  WHERE z.id = shipping_zone_postal_ranges.zone_id
    AND z.active = true
    AND s.status = 'active' AND s.deleted_at IS NULL
));
