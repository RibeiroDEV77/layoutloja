
-- Fase 6.1 Etapa 3 — Inventory MVP: read model
-- View denormalizada para listagem administrativa de estoque.
-- Inclui dados de produto/variante/armazém + saldo, reservado, disponível, status low/out.

CREATE OR REPLACE VIEW public.stock_admin_list_v
WITH (security_invoker = on)
AS
SELECT
  sl.id                                    AS id,
  sl.store_id                              AS store_id,
  sl.warehouse_id                          AS warehouse_id,
  w.code                                   AS warehouse_code,
  w.name                                   AS warehouse_name,
  sl.variant_id                            AS variant_id,
  pv.sku                                   AS sku,
  pv.barcode                               AS barcode,
  pv.internal_reference                    AS internal_reference,
  pv.product_id                            AS product_id,
  p.name                                   AS product_name,
  p.sku_root                               AS sku_root,
  p.status                                 AS product_status,
  p.brand_id                               AS brand_id,
  p.category_id                            AS category_id,
  sl.quantity_on_hand                      AS quantity_on_hand,
  sl.quantity_reserved                     AS quantity_reserved,
  sl.quantity_incoming                     AS quantity_incoming,
  GREATEST(
    0,
    COALESCE(sl.quantity_on_hand, 0) - COALESCE(sl.quantity_reserved, 0)
  )                                        AS quantity_available,
  sl.reorder_point                         AS reorder_point,
  sl.reorder_quantity                      AS reorder_quantity,
  CASE
    WHEN COALESCE(sl.quantity_on_hand, 0) - COALESCE(sl.quantity_reserved, 0) <= 0 THEN 'out_of_stock'
    WHEN sl.reorder_point IS NOT NULL
         AND (COALESCE(sl.quantity_on_hand,0) - COALESCE(sl.quantity_reserved,0)) <= sl.reorder_point THEN 'low_stock'
    ELSE 'in_stock'
  END                                      AS stock_status,
  sl.last_movement_at                      AS last_movement_at,
  sl.created_at                            AS created_at,
  sl.updated_at                            AS updated_at
FROM public.stock_levels sl
JOIN public.warehouses w        ON w.id = sl.warehouse_id
JOIN public.product_variants pv ON pv.id = sl.variant_id
JOIN public.products p          ON p.id = pv.product_id;

GRANT SELECT ON public.stock_admin_list_v TO authenticated;
GRANT SELECT ON public.stock_admin_list_v TO service_role;
