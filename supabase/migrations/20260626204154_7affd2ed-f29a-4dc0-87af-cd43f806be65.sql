
-- Fix enum values used by storefront user trigger
CREATE OR REPLACE FUNCTION public.handle_new_storefront_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_store_id uuid;
  v_full_name text;
BEGIN
  SELECT id INTO v_store_id FROM public.stores ORDER BY created_at ASC LIMIT 1;
  IF v_store_id IS NULL THEN RETURN NEW; END IF;
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
    v_store_id, 'pf'::customer_type, 'active'::customer_status,
    NEW.email, v_full_name, NEW.id, false, false
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_storefront_user failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- Backfill: create missing customer rows for existing auth.users
INSERT INTO public.customers (store_id, type, status, email, name, auth_user_id, marketing_opt_in, consent_marketing_email)
SELECT
  (SELECT id FROM public.stores ORDER BY created_at ASC LIMIT 1),
  'pf'::customer_type,
  'active'::customer_status,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  u.id,
  false,
  false
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.auth_user_id = u.id)
  AND (SELECT id FROM public.stores ORDER BY created_at ASC LIMIT 1) IS NOT NULL;
