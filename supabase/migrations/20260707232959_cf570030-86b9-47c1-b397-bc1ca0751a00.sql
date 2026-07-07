
BEGIN;

UPDATE public.categories
   SET slug = 'botas-legacy', is_active = false, updated_at = now()
 WHERE id = 'cec78f21-89ab-4c64-b6ee-5f242672857b' AND slug = 'botas';

UPDATE public.categories
   SET slug = 'botas', is_active = true, updated_at = now()
 WHERE id = 'd5367cac-69ab-4d81-914b-ee6cbf4e34d0'
   AND parent_id = '8cd967c9-dcee-4ca3-8095-00cb1136f447';

INSERT INTO public.product_categories (product_id, category_id)
SELECT pc.product_id, 'd5367cac-69ab-4d81-914b-ee6cbf4e34d0'
  FROM public.product_categories pc
 WHERE pc.category_id = 'cec78f21-89ab-4c64-b6ee-5f242672857b'
ON CONFLICT (product_id, category_id) DO NOTHING;

DELETE FROM public.product_categories
 WHERE category_id = 'cec78f21-89ab-4c64-b6ee-5f242672857b';

UPDATE public.products
   SET category_id = 'd5367cac-69ab-4d81-914b-ee6cbf4e34d0', updated_at = now()
 WHERE category_id = 'cec78f21-89ab-4c64-b6ee-5f242672857b';

INSERT INTO public.category_attributes
  (category_id, attribute_id, is_required, is_variant_axis, sort_order, show_in_filters, filter_order)
SELECT 'd5367cac-69ab-4d81-914b-ee6cbf4e34d0',
       ca.attribute_id, ca.is_required, ca.is_variant_axis, ca.sort_order, ca.show_in_filters, ca.filter_order
  FROM public.category_attributes ca
 WHERE ca.category_id = 'cec78f21-89ab-4c64-b6ee-5f242672857b'
ON CONFLICT (category_id, attribute_id) DO NOTHING;

DELETE FROM public.category_attributes
 WHERE category_id = 'cec78f21-89ab-4c64-b6ee-5f242672857b';

COMMIT;
