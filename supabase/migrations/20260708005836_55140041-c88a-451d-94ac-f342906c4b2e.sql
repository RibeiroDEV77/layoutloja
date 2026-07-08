
-- Sprint 0 / P3: seed defensivo de stock_levels.
-- Cria linha zerada apenas para variantes ATIVAS que hoje não têm nenhum
-- stock_level em nenhum depósito. Não toca em linhas existentes.
INSERT INTO public.stock_levels (
  store_id, warehouse_id, variant_id,
  quantity_on_hand, quantity_reserved, quantity_incoming
)
SELECT
  p.store_id,
  w.id                AS warehouse_id,
  pv.id               AS variant_id,
  0                   AS quantity_on_hand,
  0                   AS quantity_reserved,
  0                   AS quantity_incoming
FROM public.product_variants pv
JOIN public.products   p ON p.id = pv.product_id
JOIN LATERAL (
  SELECT w.id
  FROM public.warehouses w
  WHERE w.store_id = p.store_id
  ORDER BY w.is_default DESC NULLS LAST, w.created_at ASC
  LIMIT 1
) w ON TRUE
WHERE pv.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM public.stock_levels sl
    WHERE sl.variant_id = pv.id
  )
ON CONFLICT (warehouse_id, variant_id) DO NOTHING;
