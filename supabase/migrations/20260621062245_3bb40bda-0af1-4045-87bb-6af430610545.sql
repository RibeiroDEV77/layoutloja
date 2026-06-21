-- Phase 6.2 — Produtos Relacionados (cross-sell / upsell / related)
CREATE TYPE public.product_relation_type AS ENUM ('related', 'cross_sell', 'up_sell');

CREATE TABLE public.product_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  related_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  relation_type public.product_relation_type NOT NULL DEFAULT 'related',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  CONSTRAINT product_relations_unique UNIQUE (product_id, related_product_id, relation_type),
  CONSTRAINT product_relations_no_self CHECK (product_id <> related_product_id)
);

CREATE INDEX idx_product_relations_product ON public.product_relations(product_id, relation_type, position);
CREATE INDEX idx_product_relations_related ON public.product_relations(related_product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_relations TO authenticated;
GRANT SELECT ON public.product_relations TO anon;
GRANT ALL ON public.product_relations TO service_role;

ALTER TABLE public.product_relations ENABLE ROW LEVEL SECURITY;

-- Public read for relations of published products (storefront)
CREATE POLICY "Public can read relations for published products"
  ON public.product_relations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_relations.product_id AND p.status = 'published'
    )
  );

-- Authenticated staff with products.read can read all relations
CREATE POLICY "Staff can read all product relations"
  ON public.product_relations FOR SELECT
  TO authenticated
  USING (public.has_permission(auth.uid(), 'products.read'));

-- Authenticated staff with products.write can manage relations
CREATE POLICY "Staff can manage product relations"
  ON public.product_relations FOR ALL
  TO authenticated
  USING (public.has_permission(auth.uid(), 'products.write'))
  WITH CHECK (public.has_permission(auth.uid(), 'products.write'));