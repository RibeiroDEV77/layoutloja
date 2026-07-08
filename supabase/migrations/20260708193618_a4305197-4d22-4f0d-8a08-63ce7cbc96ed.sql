-- Fase 1: doc_number_hash com HMAC-SHA256 + pepper server-side

-- 1) Pepper storage (service_role only, RLS locked)
CREATE TABLE IF NOT EXISTS public._doc_hash_config (
  id boolean PRIMARY KEY DEFAULT true,
  pepper bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT _doc_hash_config_singleton CHECK (id = true)
);
GRANT ALL ON public._doc_hash_config TO service_role;
REVOKE ALL ON public._doc_hash_config FROM anon, authenticated;
ALTER TABLE public._doc_hash_config ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (bypasses RLS) can read; SECURITY DEFINER function accesses it.

-- Seed pepper (32 random bytes) if not present.
INSERT INTO public._doc_hash_config (id, pepper)
VALUES (true, gen_random_bytes(32))
ON CONFLICT (id) DO NOTHING;

-- 2) Hash function — SECURITY DEFINER, owned by postgres, reads pepper from locked table.
CREATE OR REPLACE FUNCTION public.hash_doc_number(_doc text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_norm text;
  v_pepper bytea;
BEGIN
  IF _doc IS NULL THEN RETURN NULL; END IF;
  v_norm := regexp_replace(_doc, '\D', '', 'g');
  IF length(v_norm) = 0 THEN RETURN NULL; END IF;
  SELECT pepper INTO v_pepper FROM public._doc_hash_config WHERE id = true;
  IF v_pepper IS NULL THEN
    RAISE EXCEPTION 'doc hash pepper not initialized';
  END IF;
  RETURN encode(extensions.hmac(v_norm::bytea, v_pepper, 'sha256'), 'hex');
END;
$$;

-- Do NOT grant execute to anon; authenticated may hash their own doc to search but
-- prefer to keep it strict. Server functions call via service_role/definer chain.
REVOKE ALL ON FUNCTION public.hash_doc_number(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hash_doc_number(text) TO authenticated, service_role;

-- 3) Column
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS doc_number_hash text;

-- 4) Trigger to auto-populate on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.tg_customers_doc_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.doc_number IS DISTINCT FROM OLD.doc_number THEN
    NEW.doc_number_hash := public.hash_doc_number(NEW.doc_number);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_customers_doc_hash() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_customers_doc_hash ON public.customers;
CREATE TRIGGER trg_customers_doc_hash
  BEFORE INSERT OR UPDATE OF doc_number ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.tg_customers_doc_hash();

-- 5) Backfill existing rows
UPDATE public.customers
   SET doc_number_hash = public.hash_doc_number(doc_number)
 WHERE doc_number IS NOT NULL
   AND doc_number_hash IS NULL;

-- 6) Parallel unique index on hash (does not touch legacy customers_store_doc_uq)
CREATE UNIQUE INDEX IF NOT EXISTS customers_store_dochash_uq
  ON public.customers(store_id, doc_number_hash)
  WHERE doc_number_hash IS NOT NULL AND deleted_at IS NULL;

-- Index for hash-based search (non-unique, covers lookups)
CREATE INDEX IF NOT EXISTS customers_dochash_idx
  ON public.customers(doc_number_hash)
  WHERE doc_number_hash IS NOT NULL;