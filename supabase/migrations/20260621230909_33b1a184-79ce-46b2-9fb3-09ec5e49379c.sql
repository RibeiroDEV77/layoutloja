
ALTER TABLE public.attributes
  ADD COLUMN IF NOT EXISTS is_filterable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS filter_ui text NOT NULL DEFAULT 'checkbox',
  ADD COLUMN IF NOT EXISTS filter_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.attributes
  DROP CONSTRAINT IF EXISTS attributes_filter_ui_check;
ALTER TABLE public.attributes
  ADD CONSTRAINT attributes_filter_ui_check
  CHECK (filter_ui IN ('checkbox','color','size','range'));

ALTER TABLE public.category_attributes
  ADD COLUMN IF NOT EXISTS show_in_filters boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS filter_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_attributes_filter
  ON public.attributes (store_id, is_filterable, filter_order);
CREATE INDEX IF NOT EXISTS idx_category_attributes_filter
  ON public.category_attributes (category_id, show_in_filters, filter_order);
CREATE INDEX IF NOT EXISTS idx_pav_attr_value
  ON public.product_attribute_values (attribute_id, attribute_value_id);
