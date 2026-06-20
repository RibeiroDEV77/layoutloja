
INSERT INTO public.permissions (code, module, description) VALUES
  ('products.archive',   'products', 'Arquivar/desarquivar produtos'),
  ('products.duplicate', 'products', 'Duplicar produtos existentes'),
  ('products.import',    'products', 'Importar produtos em lote'),
  ('products.export',    'products', 'Exportar produtos')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('admin','manager','super_admin')
  AND p.code IN ('products.archive','products.duplicate','products.import','products.export',
                 'products.publish','products.create','products.update','products.delete','products.read')
ON CONFLICT DO NOTHING;
