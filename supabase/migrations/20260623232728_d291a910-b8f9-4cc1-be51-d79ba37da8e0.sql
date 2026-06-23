
-- coluna criptografada para CPF
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS doc_number_encrypted bytea;

-- helper: id do customer logado
CREATE OR REPLACE FUNCTION public.current_customer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.customers
  WHERE auth_user_id = auth.uid()
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_customer_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_customer_id() TO authenticated;

-- encrypt/decrypt PII — usa pgcrypto do schema extensions
CREATE OR REPLACE FUNCTION public.encrypt_pii(p_value text, p_key text)
RETURNS bytea
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT CASE
    WHEN p_value IS NULL OR length(p_value) = 0 THEN NULL
    ELSE extensions.pgp_sym_encrypt(p_value, p_key)
  END
$$;

CREATE OR REPLACE FUNCTION public.decrypt_pii(p_value bytea, p_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT CASE
    WHEN p_value IS NULL THEN NULL
    ELSE extensions.pgp_sym_decrypt(p_value, p_key)
  END
$$;

REVOKE ALL ON FUNCTION public.encrypt_pii(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrypt_pii(bytea, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encrypt_pii(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_pii(bytea, text) TO service_role;

-- RLS adicional para o cliente final (aditivo)
DROP POLICY IF EXISTS customers_self_select ON public.customers;
CREATE POLICY customers_self_select ON public.customers FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS customers_self_update ON public.customers;
CREATE POLICY customers_self_update ON public.customers FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS customer_addresses_self_all ON public.customer_addresses;
CREATE POLICY customer_addresses_self_all ON public.customer_addresses FOR ALL TO authenticated
  USING (customer_id = public.current_customer_id())
  WITH CHECK (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS wishlists_self_all ON public.wishlists;
CREATE POLICY wishlists_self_all ON public.wishlists FOR ALL TO authenticated
  USING (customer_id = public.current_customer_id())
  WITH CHECK (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS wishlist_items_self_all ON public.wishlist_items;
CREATE POLICY wishlist_items_self_all ON public.wishlist_items FOR ALL TO authenticated
  USING (wishlist_id IN (SELECT id FROM public.wishlists WHERE customer_id = public.current_customer_id()))
  WITH CHECK (wishlist_id IN (SELECT id FROM public.wishlists WHERE customer_id = public.current_customer_id()));

DROP POLICY IF EXISTS orders_self_select ON public.orders;
CREATE POLICY orders_self_select ON public.orders FOR SELECT TO authenticated
  USING (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS order_items_self_select ON public.order_items;
CREATE POLICY order_items_self_select ON public.order_items FOR SELECT TO authenticated
  USING (order_id IN (SELECT id FROM public.orders WHERE customer_id = public.current_customer_id()));

-- Trigger pós-signup: cria customer vinculado ao auth.users
CREATE OR REPLACE FUNCTION public.handle_new_storefront_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_full_name text;
BEGIN
  SELECT id INTO v_store_id
  FROM public.stores
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_store_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.customers WHERE auth_user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.customers (
    store_id, type, status, email, name, auth_user_id, marketing_opt_in, consent_marketing_email
  ) VALUES (
    v_store_id, 'pessoa_fisica', 'ativo', NEW.email, v_full_name, NEW.id, false, false
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_storefront_user failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_storefront ON auth.users;
CREATE TRIGGER on_auth_user_created_storefront
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_storefront_user();
