
-- =========================================================================
-- AUDIT ENGINE — Canonical rewrite
-- Aligns audit trigger functions with the current public.audit_log schema
-- (entity_type, entity_id, action, diff jsonb). No table/trigger changes.
-- Defensive: audit failures never block business writes.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id   uuid;
  v_entity     text := TG_TABLE_NAME;
  v_entity_id  uuid;
  v_action     text := lower(TG_TABLE_NAME) || '.' || lower(TG_OP);
  v_old        jsonb;
  v_new        jsonb;
  v_diff       jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_entity_id := NULLIF(v_old->>'id','')::uuid;
    v_store_id  := NULLIF(v_old->>'store_id','')::uuid;
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_entity_id := NULLIF(v_new->>'id','')::uuid;
    v_store_id  := NULLIF(v_new->>'store_id','')::uuid;
  ELSE -- UPDATE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_entity_id := NULLIF(v_new->>'id','')::uuid;
    v_store_id  := NULLIF(v_new->>'store_id','')::uuid;
  END IF;

  v_diff := jsonb_build_object('op', lower(TG_OP))
         || CASE WHEN v_old IS NOT NULL THEN jsonb_build_object('old', v_old) ELSE '{}'::jsonb END
         || CASE WHEN v_new IS NOT NULL THEN jsonb_build_object('new', v_new) ELSE '{}'::jsonb END;

  BEGIN
    INSERT INTO public.audit_log (store_id, actor_user_id, entity_type, entity_id, action, diff)
    VALUES (v_store_id, auth.uid(), v_entity, v_entity_id, v_action, v_diff);
  EXCEPTION WHEN OTHERS THEN
    -- Defensive backstop: never let audit failures roll back business writes.
    RAISE WARNING 'audit_row_change failed for %.%: %', TG_TABLE_NAME, TG_OP, SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Order subtree: keep detailed write to public.order_audit AND fan out a
-- summary row to public.audit_log so the global timeline stays complete.
CREATE OR REPLACE FUNCTION public.order_audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id   uuid;
  v_store_id   uuid;
  v_entity     text := TG_TABLE_NAME;
  v_entity_id  uuid;
  v_action     text := lower(TG_OP);
  v_old        jsonb;
  v_new        jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_entity_id := NULLIF(v_old->>'id','')::uuid;
    v_store_id  := NULLIF(v_old->>'store_id','')::uuid;
    v_order_id  := COALESCE(NULLIF(v_old->>'order_id','')::uuid, v_entity_id);
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_entity_id := NULLIF(v_new->>'id','')::uuid;
    v_store_id  := NULLIF(v_new->>'store_id','')::uuid;
    v_order_id  := COALESCE(NULLIF(v_new->>'order_id','')::uuid, v_entity_id);
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_entity_id := NULLIF(v_new->>'id','')::uuid;
    v_store_id  := NULLIF(v_new->>'store_id','')::uuid;
    v_order_id  := COALESCE(NULLIF(v_new->>'order_id','')::uuid, v_entity_id);
  END IF;

  BEGIN
    INSERT INTO public.order_audit (order_id, store_id, entity, entity_id, action, actor_user_id, old_data, new_data)
    VALUES (v_order_id, v_store_id, v_entity, v_entity_id, v_action, auth.uid(), v_old, v_new);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'order_audit insert failed for %.%: %', TG_TABLE_NAME, TG_OP, SQLERRM;
  END;

  BEGIN
    INSERT INTO public.audit_log (store_id, actor_user_id, entity_type, entity_id, action, diff)
    VALUES (
      v_store_id, auth.uid(), v_entity, v_entity_id,
      lower(TG_TABLE_NAME) || '.' || lower(TG_OP),
      jsonb_build_object('op', lower(TG_OP), 'order_id', v_order_id)
        || CASE WHEN v_old IS NOT NULL THEN jsonb_build_object('old', v_old) ELSE '{}'::jsonb END
        || CASE WHEN v_new IS NOT NULL THEN jsonb_build_object('new', v_new) ELSE '{}'::jsonb END
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit_log fanout failed for %.%: %', TG_TABLE_NAME, TG_OP, SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;
