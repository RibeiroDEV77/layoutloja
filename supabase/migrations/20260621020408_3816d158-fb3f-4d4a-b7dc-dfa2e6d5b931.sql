
-- ============================================================
-- FASE 5.3.1 — SECURITY HARDENING (RLS)
-- ============================================================

-- 1) NOVAS COLUNAS is_public + BACKFILL ----------------------
ALTER TABLE public.attributes  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE public.tags        ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE public.price_lists ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

UPDATE public.attributes  SET is_public = true WHERE is_public = false;
UPDATE public.tags        SET is_public = true WHERE is_public = false;
UPDATE public.price_lists SET is_public = true WHERE is_public = false AND is_active = true;

-- 2) RPCs HELPERS --------------------------------------------

-- 2.1) Helper canônico: cart_accessible
CREATE OR REPLACE FUNCTION public.cart_accessible(_cart_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.carts c
    LEFT JOIN public.customers cu ON cu.id = c.customer_id
    WHERE c.id = _cart_id
      AND (
        -- staff
        (auth.uid() IS NOT NULL AND (
          is_super_admin(auth.uid())
          OR has_permission(auth.uid(), 'carts.read', c.store_id)
          OR has_permission(auth.uid(), 'carts.write', c.store_id)
        ))
        -- cliente dono autenticado
        OR (cu.auth_user_id IS NOT NULL AND cu.auth_user_id = auth.uid())
        -- anônimo com token declarado na sessão
        OR (
          c.customer_id IS NULL
          AND c.session_token IS NOT NULL
          AND c.session_token = current_setting('request.cart_session_token', true)
        )
      )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.cart_accessible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cart_accessible(uuid) TO anon, authenticated, service_role;

-- 2.2) Registrar o token de carrinho na sessão (anônimos)
CREATE OR REPLACE FUNCTION public.cart_set_session_v1(_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Implementação transitória. Arquitetura-alvo: claims JWT customizadas
  -- propagadas via Authorization header. Mantida aqui para compatibilidade
  -- com clientes anônimos enquanto a camada de auth claims não é introduzida.
  IF _token IS NULL OR length(_token) < 8 THEN
    RAISE EXCEPTION 'cart_set_session_v1: token inválido';
  END IF;
  PERFORM set_config('request.cart_session_token', _token, true);
END $$;
REVOKE EXECUTE ON FUNCTION public.cart_set_session_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cart_set_session_v1(text) TO anon, authenticated, service_role;

-- 2.3) Lookup nominal de cupom (anti-enumeração)
CREATE OR REPLACE FUNCTION public.coupon_lookup_by_code_v1(_store_id uuid, _code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.coupons%ROWTYPE;
BEGIN
  IF _store_id IS NULL OR _code IS NULL OR length(_code) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v FROM public.coupons
    WHERE store_id = _store_id AND lower(code) = lower(_code)
    LIMIT 1;

  IF NOT FOUND OR NOT v.active THEN RETURN NULL; END IF;
  IF v.valid_from IS NOT NULL AND now() < v.valid_from THEN RETURN NULL; END IF;
  IF v.valid_until IS NOT NULL AND now() > v.valid_until THEN RETURN NULL; END IF;

  -- Observação: proteção contra brute force (rate limit por IP/cart/session)
  -- prevista para fase de Observability; não implementada nesta migration por
  -- não haver primitiva oficial de rate limiting no backend.

  RETURN jsonb_build_object(
    'id', v.id, 'code', v.code, 'type', v.type, 'value', v.value,
    'min_subtotal', v.min_subtotal, 'max_discount', v.max_discount,
    'valid_from', v.valid_from, 'valid_until', v.valid_until
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.coupon_lookup_by_code_v1(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coupon_lookup_by_code_v1(uuid, text) TO anon, authenticated, service_role;

-- 3) ROTAÇÃO DE TOKEN DE CARRINHO NO MERGE -------------------
CREATE OR REPLACE FUNCTION public.merge_anonymous_cart(_anonymous_cart_id uuid, _customer_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_anon public.carts%ROWTYPE;
  v_target public.carts%ROWTYPE;
  v_target_id uuid;
  r record;
BEGIN
  SELECT * INTO v_anon FROM public.carts WHERE id = _anonymous_cart_id FOR UPDATE;
  IF NOT FOUND OR v_anon.status <> 'active' THEN RAISE EXCEPTION 'Anonymous cart invalid'; END IF;

  SELECT * INTO v_target FROM public.carts
    WHERE store_id = v_anon.store_id AND customer_id = _customer_id AND status = 'active'
    LIMIT 1;

  IF NOT FOUND THEN
    -- Adoção: anula token (cart passa a ser do cliente autenticado)
    UPDATE public.carts SET customer_id = _customer_id, session_token = NULL,
                            last_activity_at = now()
      WHERE id = _anonymous_cart_id
    RETURNING id INTO v_target_id;
    PERFORM public.record_cart_timeline_event(v_target_id, 'merged',
      jsonb_build_object('mode','adopt','customer_id',_customer_id,'token_rotated',true));
    PERFORM public.cart_apply_pricing(v_target_id);
    RETURN v_target_id;
  END IF;

  v_target_id := v_target.id;

  FOR r IN SELECT * FROM public.cart_items WHERE cart_id = _anonymous_cart_id LOOP
    INSERT INTO public.cart_items(cart_id, variant_id, product_id, qty, list_price, unit_price, line_total, snapshot)
    VALUES (v_target_id, r.variant_id, r.product_id, r.qty, r.list_price, r.unit_price, r.line_total, r.snapshot)
    ON CONFLICT (cart_id, variant_id) DO UPDATE SET
      qty = cart_items.qty + excluded.qty,
      line_total = (cart_items.qty + excluded.qty) * cart_items.unit_price - cart_items.discount_amount;
  END LOOP;

  -- Combine: invalida token do anônimo e rotaciona o token do alvo (se existir)
  UPDATE public.carts
     SET status='merged', merged_into_cart_id = v_target_id, session_token = NULL,
         last_activity_at = now()
     WHERE id = _anonymous_cart_id;
  UPDATE public.carts
     SET session_token = CASE WHEN session_token IS NOT NULL
                              THEN gen_random_uuid()::text
                              ELSE NULL END,
         last_activity_at = now()
     WHERE id = v_target_id;

  PERFORM public.record_cart_timeline_event(v_target_id, 'merged',
    jsonb_build_object('mode','combine','source_cart_id',_anonymous_cart_id,'token_rotated',true));
  PERFORM public.record_cart_timeline_event(_anonymous_cart_id, 'merged',
    jsonb_build_object('target_cart_id', v_target_id));
  PERFORM public.cart_apply_pricing(v_target_id);
  RETURN v_target_id;
END $function$;

-- ============================================================
-- 4) HARDENING DE POLICIES
-- ============================================================

-- 4.1) CARTS ------------------------------------------------
DROP POLICY IF EXISTS "Carts: admin delete" ON public.carts;
DROP POLICY IF EXISTS "Carts: anon insert" ON public.carts;
DROP POLICY IF EXISTS "Carts: anon read by session token" ON public.carts;
DROP POLICY IF EXISTS "Carts: anon update by token" ON public.carts;
DROP POLICY IF EXISTS "Carts: insert by self or session" ON public.carts;
DROP POLICY IF EXISTS "Carts: own customer can read" ON public.carts;
DROP POLICY IF EXISTS "Carts: update own" ON public.carts;

CREATE POLICY "carts_anon_select" ON public.carts FOR SELECT TO anon
USING (
  customer_id IS NULL AND session_token IS NOT NULL
  AND session_token = current_setting('request.cart_session_token', true)
);
CREATE POLICY "carts_anon_insert" ON public.carts FOR INSERT TO anon
WITH CHECK (customer_id IS NULL AND session_token IS NOT NULL);
CREATE POLICY "carts_anon_update" ON public.carts FOR UPDATE TO anon
USING (
  customer_id IS NULL AND session_token IS NOT NULL
  AND session_token = current_setting('request.cart_session_token', true)
)
WITH CHECK (
  customer_id IS NULL AND session_token IS NOT NULL
  AND session_token = current_setting('request.cart_session_token', true)
);

CREATE POLICY "carts_auth_select" ON public.carts FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR has_permission(auth.uid(), 'carts.read', store_id)
  OR (customer_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = carts.customer_id AND c.auth_user_id = auth.uid()))
);
CREATE POLICY "carts_auth_insert" ON public.carts FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR has_permission(auth.uid(), 'carts.write', store_id)
  OR (customer_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = carts.customer_id AND c.auth_user_id = auth.uid()))
);
CREATE POLICY "carts_auth_update" ON public.carts FOR UPDATE TO authenticated
USING (
  is_super_admin(auth.uid())
  OR has_permission(auth.uid(), 'carts.write', store_id)
  OR (customer_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = carts.customer_id AND c.auth_user_id = auth.uid()))
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR has_permission(auth.uid(), 'carts.write', store_id)
  OR (customer_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = carts.customer_id AND c.auth_user_id = auth.uid()))
);
CREATE POLICY "carts_auth_delete" ON public.carts FOR DELETE TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'carts.write', store_id));

-- 4.2) CART_ITEMS / CART_COUPONS / CART_SNAPSHOTS / CART_TIMELINE
DROP POLICY IF EXISTS "Cart items: read via cart" ON public.cart_items;
DROP POLICY IF EXISTS "Cart items: write via cart owner" ON public.cart_items;
CREATE POLICY "cart_items_access" ON public.cart_items FOR ALL TO anon, authenticated
USING (public.cart_accessible(cart_id)) WITH CHECK (public.cart_accessible(cart_id));

DROP POLICY IF EXISTS "Cart coupons: via cart" ON public.cart_coupons;
CREATE POLICY "cart_coupons_access" ON public.cart_coupons FOR ALL TO anon, authenticated
USING (public.cart_accessible(cart_id)) WITH CHECK (public.cart_accessible(cart_id));

DROP POLICY IF EXISTS "Cart snapshots: read via cart" ON public.cart_snapshots;
DROP POLICY IF EXISTS "Cart snapshots: insert via cart" ON public.cart_snapshots;
CREATE POLICY "cart_snapshots_select" ON public.cart_snapshots FOR SELECT TO anon, authenticated
USING (public.cart_accessible(cart_id));
CREATE POLICY "cart_snapshots_insert" ON public.cart_snapshots FOR INSERT TO anon, authenticated
WITH CHECK (public.cart_accessible(cart_id));

DROP POLICY IF EXISTS "Cart timeline: read via cart" ON public.cart_timeline;
DROP POLICY IF EXISTS "Cart timeline: insert via cart" ON public.cart_timeline;
CREATE POLICY "cart_timeline_select" ON public.cart_timeline FOR SELECT TO anon, authenticated
USING (public.cart_accessible(cart_id));
-- timeline insert exclusivamente via RPC SECURITY DEFINER (record_cart_timeline_event)
-- nenhuma policy de INSERT para usuários comuns

-- 4.3) STOCK RESERVATIONS / LEDGER ---------------------------
DROP POLICY IF EXISTS "Reservations: read by store ops or cart" ON public.stock_reservations;
DROP POLICY IF EXISTS "Reservations: insert via cart" ON public.stock_reservations;
DROP POLICY IF EXISTS "Reservations: update via cart or admin" ON public.stock_reservations;

CREATE POLICY "reservations_select" ON public.stock_reservations FOR SELECT TO anon, authenticated
USING (
  (cart_id IS NOT NULL AND public.cart_accessible(cart_id))
  OR (auth.uid() IS NOT NULL AND (
        is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'stock.read', store_id)))
);
CREATE POLICY "reservations_admin_write" ON public.stock_reservations FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'stock.write', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'stock.write', store_id));
-- INSERT/UPDATE para anônimos e clientes: bloqueado.
-- Toda escrita flui por reserve_stock_for_cart_item / release_stock_reservation (SECURITY DEFINER).

DROP POLICY IF EXISTS "Res ledger: read via reservation" ON public.stock_reservation_ledger;
DROP POLICY IF EXISTS "Res ledger: insert via reservation" ON public.stock_reservation_ledger;
CREATE POLICY "res_ledger_select" ON public.stock_reservation_ledger FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stock_reservations r
    WHERE r.id = stock_reservation_ledger.reservation_id
      AND (
        (r.cart_id IS NOT NULL AND public.cart_accessible(r.cart_id))
        OR (auth.uid() IS NOT NULL AND (
              is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'stock.read', r.store_id)))
      )
  )
);
-- ledger é append-only via trigger/RPC SECURITY DEFINER. Sem INSERT/UPDATE/DELETE de usuário.

-- 4.4) COUPONS / REDEMPTIONS / LEDGER ------------------------
DROP POLICY IF EXISTS "Coupons: public read active" ON public.coupons;
DROP POLICY IF EXISTS "Coupons: manage" ON public.coupons;
CREATE POLICY "coupons_staff_select" ON public.coupons FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'pricing.manage', store_id));
CREATE POLICY "coupons_staff_write" ON public.coupons FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'pricing.manage', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'pricing.manage', store_id));
-- Consulta anônima/cliente é feita exclusivamente via coupon_lookup_by_code_v1.

DROP POLICY IF EXISTS "Redemptions: insert via cart" ON public.coupon_redemptions;
DROP POLICY IF EXISTS "Redemptions: read store ops or self" ON public.coupon_redemptions;
CREATE POLICY "redemptions_select" ON public.coupon_redemptions FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR has_permission(auth.uid(), 'pricing.manage', store_id)
  OR (customer_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = coupon_redemptions.customer_id AND c.auth_user_id = auth.uid()))
);
-- Sem policy de INSERT/UPDATE/DELETE: redemptions registradas apenas via RPC SECURITY DEFINER ou service_role.

DROP POLICY IF EXISTS "Coupon ledger: insert" ON public.coupon_ledger;
DROP POLICY IF EXISTS "Coupon ledger: read store ops or via cart" ON public.coupon_ledger;
CREATE POLICY "coupon_ledger_select" ON public.coupon_ledger FOR SELECT TO anon, authenticated
USING (
  (cart_id IS NOT NULL AND public.cart_accessible(cart_id))
  OR (auth.uid() IS NOT NULL AND (
        is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'pricing.manage', store_id)))
);
-- INSERT exclusivamente via apply_coupon_to_cart / remove_coupon_from_cart (SECURITY DEFINER).

-- 4.5) CATÁLOGO PÚBLICO OPT-IN -------------------------------
-- attributes
DROP POLICY IF EXISTS "attributes_public_select" ON public.attributes;
DROP POLICY IF EXISTS "attributes_member_select" ON public.attributes;
DROP POLICY IF EXISTS "attributes_write" ON public.attributes;
CREATE POLICY "attributes_anon_select" ON public.attributes FOR SELECT TO anon
USING (is_public = true);
CREATE POLICY "attributes_auth_select" ON public.attributes FOR SELECT TO authenticated
USING (is_public = true OR store_id IN (SELECT user_store_ids(auth.uid())));
CREATE POLICY "attributes_write" ON public.attributes FOR ALL TO authenticated
USING (has_permission(auth.uid(), 'products.update', store_id))
WITH CHECK (has_permission(auth.uid(), 'products.update', store_id));

-- attribute_values
DROP POLICY IF EXISTS "attribute_values_select" ON public.attribute_values;
DROP POLICY IF EXISTS "attribute_values_write" ON public.attribute_values;
CREATE POLICY "attribute_values_anon_select" ON public.attribute_values FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.attributes a WHERE a.id = attribute_values.attribute_id AND a.is_public));
CREATE POLICY "attribute_values_auth_select" ON public.attribute_values FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.attributes a
  WHERE a.id = attribute_values.attribute_id
    AND (a.is_public OR a.store_id IN (SELECT user_store_ids(auth.uid())))
));
CREATE POLICY "attribute_values_write" ON public.attribute_values FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.attributes a
  WHERE a.id = attribute_values.attribute_id
    AND has_permission(auth.uid(), 'products.update', a.store_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.attributes a
  WHERE a.id = attribute_values.attribute_id
    AND has_permission(auth.uid(), 'products.update', a.store_id)
));

-- tags
DROP POLICY IF EXISTS "tags_public_select" ON public.tags;
DROP POLICY IF EXISTS "tags_member_select" ON public.tags;
DROP POLICY IF EXISTS "tags_write" ON public.tags;
CREATE POLICY "tags_anon_select" ON public.tags FOR SELECT TO anon
USING (is_public = true);
CREATE POLICY "tags_auth_select" ON public.tags FOR SELECT TO authenticated
USING (is_public = true OR store_id IN (SELECT user_store_ids(auth.uid())));
CREATE POLICY "tags_write" ON public.tags FOR ALL TO authenticated
USING (has_permission(auth.uid(), 'products.update', store_id))
WITH CHECK (has_permission(auth.uid(), 'products.update', store_id));

-- price_lists
DROP POLICY IF EXISTS "pricelists_public_select" ON public.price_lists;
DROP POLICY IF EXISTS "pricelists_member_select" ON public.price_lists;
DROP POLICY IF EXISTS "pricelists_write" ON public.price_lists;
CREATE POLICY "pricelists_anon_select" ON public.price_lists FOR SELECT TO anon
USING (is_active = true AND is_public = true);
CREATE POLICY "pricelists_auth_select" ON public.price_lists FOR SELECT TO authenticated
USING ((is_active AND is_public) OR store_id IN (SELECT user_store_ids(auth.uid())));
CREATE POLICY "pricelists_write" ON public.price_lists FOR ALL TO authenticated
USING (has_permission(auth.uid(), 'finance.manage', store_id))
WITH CHECK (has_permission(auth.uid(), 'finance.manage', store_id));

-- price_list_items
DROP POLICY IF EXISTS "pli_select" ON public.price_list_items;
DROP POLICY IF EXISTS "pli_write" ON public.price_list_items;
CREATE POLICY "pli_anon_select" ON public.price_list_items FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM public.price_lists pl
  WHERE pl.id = price_list_items.price_list_id AND pl.is_active AND pl.is_public
));
CREATE POLICY "pli_auth_select" ON public.price_list_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.price_lists pl
  WHERE pl.id = price_list_items.price_list_id
    AND ((pl.is_active AND pl.is_public) OR pl.store_id IN (SELECT user_store_ids(auth.uid())))
));
CREATE POLICY "pli_write" ON public.price_list_items FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.price_lists pl
  WHERE pl.id = price_list_items.price_list_id
    AND has_permission(auth.uid(), 'finance.manage', pl.store_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.price_lists pl
  WHERE pl.id = price_list_items.price_list_id
    AND has_permission(auth.uid(), 'finance.manage', pl.store_id)
));

-- price_list_customer_groups (mapeamento privado: sem leitura anônima)
DROP POLICY IF EXISTS "plcg_select" ON public.price_list_customer_groups;
DROP POLICY IF EXISTS "plcg_write" ON public.price_list_customer_groups;
CREATE POLICY "plcg_staff_select" ON public.price_list_customer_groups FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.price_lists pl
  WHERE pl.id = price_list_customer_groups.price_list_id
    AND (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'finance.manage', pl.store_id))
));
CREATE POLICY "plcg_staff_write" ON public.price_list_customer_groups FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.price_lists pl
  WHERE pl.id = price_list_customer_groups.price_list_id
    AND has_permission(auth.uid(), 'finance.manage', pl.store_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.price_lists pl
  WHERE pl.id = price_list_customer_groups.price_list_id
    AND has_permission(auth.uid(), 'finance.manage', pl.store_id)
));

-- 4.6) SYSTEM SETTINGS ---------------------------------------
DROP POLICY IF EXISTS "settings_read" ON public.system_settings;
DROP POLICY IF EXISTS "settings_manage" ON public.system_settings;
CREATE POLICY "settings_read" ON public.system_settings FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR has_permission(auth.uid(), 'observability.settings.manage', store_id)
  OR (
    is_secret = false
    AND (store_id IS NULL OR store_id IN (SELECT user_store_ids(auth.uid())))
  )
);
CREATE POLICY "settings_manage" ON public.system_settings FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'observability.settings.manage', store_id))
WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'observability.settings.manage', store_id));
