-- Ensure each store has a "wholesale" (Atacado) price list so the Price Engine
-- can persist channel-specific prices through the existing price_lists infrastructure.
INSERT INTO public.price_lists (store_id, code, name, currency, priority, is_active, is_public)
SELECT s.id,
       'WHOLESALE-' || substr(s.id::text, 1, 4),
       'Tabela Atacado',
       COALESCE((SELECT currency FROM public.price_lists pl WHERE pl.store_id = s.id ORDER BY priority DESC LIMIT 1), 'BRL'),
       50,
       true,
       false
FROM public.stores s
WHERE NOT EXISTS (
  SELECT 1 FROM public.price_lists pl
  WHERE pl.store_id = s.id AND pl.code ILIKE 'WHOLESALE-%'
);