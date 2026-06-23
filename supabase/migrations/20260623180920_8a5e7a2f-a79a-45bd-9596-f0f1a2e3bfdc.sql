
CREATE TABLE public.product_categories (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX product_categories_category_idx ON public.product_categories(category_id);
CREATE INDEX product_categories_product_idx ON public.product_categories(product_id);

GRANT SELECT ON public.product_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_categories_public_select ON public.product_categories
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_categories.product_id
        AND p.status = 'published'::product_status
        AND p.visibility = ANY (ARRAY['published'::product_visibility, 'catalog_only'::product_visibility])
    )
  );

CREATE POLICY product_categories_member_select ON public.product_categories
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_categories.product_id
        AND p.store_id IN (SELECT user_store_ids(auth.uid()))
    )
  );

CREATE POLICY product_categories_write ON public.product_categories
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_categories.product_id
        AND has_permission(auth.uid(), 'products.update'::text, p.store_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_categories.product_id
        AND has_permission(auth.uid(), 'products.update'::text, p.store_id)
    )
  );

-- Seed inicial a partir da categoria primária existente
INSERT INTO public.product_categories (product_id, category_id, is_primary)
SELECT id, category_id, true FROM public.products WHERE category_id IS NOT NULL
ON CONFLICT (product_id, category_id) DO UPDATE SET is_primary = true;
