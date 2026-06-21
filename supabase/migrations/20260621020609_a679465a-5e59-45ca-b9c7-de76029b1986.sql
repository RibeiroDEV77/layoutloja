
-- shipping_quotes
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='shipping_quotes' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.shipping_quotes', r.policyname);
  END LOOP;
END $$;
CREATE POLICY "shipping_quotes_access" ON public.shipping_quotes FOR ALL TO anon, authenticated
USING (public.cart_accessible(cart_id))
WITH CHECK (public.cart_accessible(cart_id));

-- shipping_snapshots
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='shipping_snapshots' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.shipping_snapshots', r.policyname);
  END LOOP;
END $$;
CREATE POLICY "shipping_snapshots_select" ON public.shipping_snapshots FOR SELECT TO anon, authenticated
USING (public.cart_accessible(cart_id));
CREATE POLICY "shipping_snapshots_insert" ON public.shipping_snapshots FOR INSERT TO anon, authenticated
WITH CHECK (public.cart_accessible(cart_id));
