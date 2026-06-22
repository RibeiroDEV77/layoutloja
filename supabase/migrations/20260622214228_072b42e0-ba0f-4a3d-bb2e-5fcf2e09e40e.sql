
-- 1. Promove "Botas" para departamento de topo (atualmente sob Calçados)
UPDATE public.categories
SET parent_id = NULL,
    sort_order = 3,
    slug = 'botas'
WHERE id = 'cec78f21-89ab-4c64-b6ee-5f242672857b';

-- 2. Reordena Acessórios para sort_order = 4
UPDATE public.categories
SET sort_order = 4
WHERE id = 'efc68546-b0d1-46a1-92ec-df816582b9d3';

-- 3. Cria subcategorias de Calças (Feminino): Country, Sport Fino, Jeans, Social
--    (Masculino já possui Country, Jeans, Social, Sport Fino)
INSERT INTO public.categories (store_id, parent_id, name, slug, sort_order, is_active)
SELECT '4ea8e8f6-fdab-493f-964a-2eeaad55fe4a',
       '8aa50a42-9f7d-495a-9a43-4fec936db406',
       v.name, v.slug, v.so, true
FROM (VALUES
  ('Country',    'fem-calcas-country',    1),
  ('Sport Fino', 'fem-calcas-sport-fino', 2),
  ('Jeans',      'fem-calcas-jeans-sub',  3),
  ('Social',     'fem-calcas-social',     4)
) AS v(name, slug, so)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c
  WHERE c.parent_id = '8aa50a42-9f7d-495a-9a43-4fec936db406'
    AND c.slug = v.slug
);
