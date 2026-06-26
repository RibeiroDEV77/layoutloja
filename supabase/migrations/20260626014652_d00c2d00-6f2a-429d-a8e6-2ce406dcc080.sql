
-- Sprint 7: Sales Channel infrastructure
DO $$ BEGIN
  CREATE TYPE public.sales_channel AS ENUM ('retail','wholesale');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.carts
  ADD COLUMN IF NOT EXISTS sales_channel public.sales_channel NOT NULL DEFAULT 'retail';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sales_channel public.sales_channel NOT NULL DEFAULT 'retail';

CREATE INDEX IF NOT EXISTS carts_sales_channel_idx ON public.carts (sales_channel);
CREATE INDEX IF NOT EXISTS orders_sales_channel_idx ON public.orders (sales_channel);

-- Garante no máximo 1 carrinho ativo por (cliente, canal)
CREATE UNIQUE INDEX IF NOT EXISTS carts_active_customer_channel_uidx
  ON public.carts (customer_id, sales_channel)
  WHERE status = 'active' AND customer_id IS NOT NULL;

-- Snapshot automático do canal do carrinho no pedido
CREATE OR REPLACE FUNCTION public.orders_snapshot_sales_channel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel public.sales_channel;
BEGIN
  IF NEW.source_cart_id IS NOT NULL THEN
    SELECT sales_channel INTO v_channel FROM public.carts WHERE id = NEW.source_cart_id;
    IF v_channel IS NOT NULL THEN
      NEW.sales_channel := v_channel;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_snapshot_sales_channel_trg ON public.orders;
CREATE TRIGGER orders_snapshot_sales_channel_trg
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_snapshot_sales_channel();
