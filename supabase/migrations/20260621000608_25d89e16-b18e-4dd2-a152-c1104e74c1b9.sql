
-- ============================================================
-- FASE 5.0 — FUNDAÇÕES TRANSVERSAIS
-- ============================================================

DO $$ BEGIN CREATE TYPE public.workflow_instance_status AS ENUM ('active','completed','cancelled','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.outbox_status AS ENUM ('pending','processing','published','failed','dead'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.idempotency_status AS ENUM ('in_flight','succeeded','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.health_status AS ENUM ('ok','degraded','down','unknown'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.setting_scope AS ENUM ('global','store'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 1. WORKFLOW ENGINE
-- ============================================================
CREATE TABLE public.workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  code text NOT NULL, name text NOT NULL, aggregate_type text NOT NULL,
  version int NOT NULL DEFAULT 1, description text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_definitions TO authenticated;
GRANT ALL ON public.workflow_definitions TO service_role;
ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wfdef_read" ON public.workflow_definitions FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'workflow.read',store_id));
CREATE POLICY "wfdef_manage" ON public.workflow_definitions FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'workflow.manage',store_id))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'workflow.manage',store_id));

CREATE TABLE public.workflow_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id uuid NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
  code text NOT NULL, label text NOT NULL,
  is_initial boolean NOT NULL DEFAULT false,
  is_final boolean NOT NULL DEFAULT false,
  sla_minutes int, color text,
  sort_order int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (definition_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_states TO authenticated;
GRANT ALL ON public.workflow_states TO service_role;
ALTER TABLE public.workflow_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wfstate_read" ON public.workflow_states FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.workflow_definitions d WHERE d.id = definition_id
  AND (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'workflow.read',d.store_id))));
CREATE POLICY "wfstate_manage" ON public.workflow_states FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.workflow_definitions d WHERE d.id = definition_id
  AND (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'workflow.manage',d.store_id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.workflow_definitions d WHERE d.id = definition_id
  AND (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'workflow.manage',d.store_id))));

CREATE TABLE public.workflow_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id uuid NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
  code text NOT NULL, label text NOT NULL,
  from_state_id uuid NOT NULL REFERENCES public.workflow_states(id) ON DELETE CASCADE,
  to_state_id uuid NOT NULL REFERENCES public.workflow_states(id) ON DELETE CASCADE,
  guard_expression text,
  on_enter_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_permission text,
  is_automatic boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (definition_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_transitions TO authenticated;
GRANT ALL ON public.workflow_transitions TO service_role;
ALTER TABLE public.workflow_transitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wftrans_read" ON public.workflow_transitions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.workflow_definitions d WHERE d.id = definition_id
  AND (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'workflow.read',d.store_id))));
CREATE POLICY "wftrans_manage" ON public.workflow_transitions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.workflow_definitions d WHERE d.id = definition_id
  AND (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'workflow.manage',d.store_id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.workflow_definitions d WHERE d.id = definition_id
  AND (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'workflow.manage',d.store_id))));

CREATE TABLE public.workflow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  definition_id uuid NOT NULL REFERENCES public.workflow_definitions(id),
  aggregate_type text NOT NULL, aggregate_id uuid NOT NULL,
  current_state_id uuid NOT NULL REFERENCES public.workflow_states(id),
  status public.workflow_instance_status NOT NULL DEFAULT 'active',
  sla_due_at timestamptz,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aggregate_type, aggregate_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_instances TO authenticated;
GRANT ALL ON public.workflow_instances TO service_role;
ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_wfinst_aggregate ON public.workflow_instances (aggregate_type, aggregate_id);
CREATE INDEX idx_wfinst_status ON public.workflow_instances (status, sla_due_at) WHERE status = 'active';
CREATE POLICY "wfinst_read" ON public.workflow_instances FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'workflow.read',store_id));
CREATE POLICY "wfinst_transition" ON public.workflow_instances FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'workflow.transition',store_id))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'workflow.transition',store_id));

CREATE TABLE public.workflow_state_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
  from_state_id uuid REFERENCES public.workflow_states(id),
  to_state_id uuid NOT NULL REFERENCES public.workflow_states(id),
  transition_id uuid REFERENCES public.workflow_transitions(id),
  actor_user_id uuid REFERENCES auth.users(id),
  reason text, payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms int,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.workflow_state_history TO authenticated;
GRANT ALL ON public.workflow_state_history TO service_role;
ALTER TABLE public.workflow_state_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_wfhist_instance ON public.workflow_state_history (instance_id, occurred_at);
CREATE POLICY "wfhist_read" ON public.workflow_state_history FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.workflow_instances wi WHERE wi.id = instance_id
  AND (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'workflow.read',wi.store_id))));

-- ============================================================
-- 2. TRANSACTIONAL OUTBOX
-- ============================================================
CREATE TABLE public.event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  aggregate_type text NOT NULL, aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id uuid, causation_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  available_at timestamptz NOT NULL DEFAULT now(),
  status public.outbox_status NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 10,
  last_error text, locked_by text, locked_until timestamptz,
  published_at timestamptz,
  ordered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.event_outbox TO authenticated;
GRANT ALL ON public.event_outbox TO service_role;
ALTER TABLE public.event_outbox ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_outbox_dispatch ON public.event_outbox (status, available_at) WHERE status IN ('pending','failed');
CREATE INDEX idx_outbox_aggregate ON public.event_outbox (aggregate_type, aggregate_id);
CREATE INDEX idx_outbox_event_type ON public.event_outbox (event_type);
CREATE INDEX idx_outbox_occurred_brin ON public.event_outbox USING brin (occurred_at);
CREATE POLICY "outbox_read" ON public.event_outbox FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'outbox.read',store_id));

CREATE TABLE public.event_outbox_dead_letter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_outbox_id uuid NOT NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  aggregate_type text NOT NULL, aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts int NOT NULL, last_error text,
  failed_at timestamptz NOT NULL DEFAULT now(),
  reprocessed_at timestamptz,
  reprocessed_by uuid REFERENCES auth.users(id)
);
GRANT SELECT, UPDATE ON public.event_outbox_dead_letter TO authenticated;
GRANT ALL ON public.event_outbox_dead_letter TO service_role;
ALTER TABLE public.event_outbox_dead_letter ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_dlq_store ON public.event_outbox_dead_letter (store_id, failed_at);
CREATE POLICY "dlq_read" ON public.event_outbox_dead_letter FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'outbox.deadletter.manage',store_id));
CREATE POLICY "dlq_manage" ON public.event_outbox_dead_letter FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'outbox.deadletter.manage',store_id))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'outbox.deadletter.manage',store_id));

CREATE TABLE public.event_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id uuid NOT NULL REFERENCES public.event_outbox(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.domain_event_subscriptions(id) ON DELETE SET NULL,
  attempt int NOT NULL, status text NOT NULL,
  http_status int, response_excerpt text, duration_ms int, error text,
  delivered_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.event_delivery_log TO authenticated;
GRANT ALL ON public.event_delivery_log TO service_role;
ALTER TABLE public.event_delivery_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_delivery_outbox ON public.event_delivery_log (outbox_id, attempt);
CREATE POLICY "delivery_read" ON public.event_delivery_log FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.event_outbox o WHERE o.id = outbox_id
  AND (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'outbox.read',o.store_id))));

-- ============================================================
-- 3. IDEMPOTENCY KEYS
-- ============================================================
CREATE TABLE public.idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL, scope text NOT NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id),
  request_hash text NOT NULL,
  response_hash text, response_status int,
  response_body jsonb,
  resource_type text, resource_id uuid,
  status public.idempotency_status NOT NULL DEFAULT 'in_flight',
  error_code text,
  attempts int NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (scope, key, store_id)
);
GRANT SELECT ON public.idempotency_keys TO authenticated;
GRANT ALL ON public.idempotency_keys TO service_role;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_idem_inflight ON public.idempotency_keys (status, expires_at) WHERE status = 'in_flight';
CREATE INDEX idx_idem_expires ON public.idempotency_keys (expires_at);
CREATE INDEX idx_idem_resource ON public.idempotency_keys (resource_type, resource_id);
CREATE POLICY "idem_read" ON public.idempotency_keys FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'idempotency.read',store_id));

-- ============================================================
-- 4. OBSERVABILITY
-- ============================================================
CREATE TABLE public.metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  scope text NOT NULL, name text NOT NULL,
  value numeric NOT NULL, unit text,
  tags jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.metrics TO authenticated;
GRANT ALL ON public.metrics TO service_role;
ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_metrics_name_time ON public.metrics (name, recorded_at DESC);
CREATE INDEX idx_metrics_recorded_brin ON public.metrics USING brin (recorded_at);
CREATE INDEX idx_metrics_tags_gin ON public.metrics USING gin (tags);
CREATE POLICY "metrics_read" ON public.metrics FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'observability.metrics.read',store_id));

CREATE TABLE public.traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  trace_id uuid NOT NULL,
  parent_span_id uuid, span_id uuid NOT NULL,
  operation text NOT NULL,
  kind text NOT NULL DEFAULT 'server',
  started_at timestamptz NOT NULL,
  ended_at timestamptz, duration_ms int,
  status text NOT NULL DEFAULT 'ok',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  actor_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.traces TO authenticated;
GRANT ALL ON public.traces TO service_role;
ALTER TABLE public.traces ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_traces_trace ON public.traces (trace_id);
CREATE INDEX idx_traces_op_time ON public.traces (operation, started_at DESC);
CREATE INDEX idx_traces_started_brin ON public.traces USING brin (started_at);
CREATE POLICY "traces_read" ON public.traces FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'observability.traces.read',store_id));

CREATE TABLE public.health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component text NOT NULL,
  status public.health_status NOT NULL,
  latency_ms int,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.health_checks TO authenticated;
GRANT ALL ON public.health_checks TO service_role;
ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_health_component_time ON public.health_checks (component, checked_at DESC);
CREATE POLICY "health_read" ON public.health_checks FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'observability.health.read',NULL));

CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE, name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'boolean',
  default_value jsonb NOT NULL DEFAULT 'false'::jsonb,
  rollout_strategy jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  store_scope boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;
GRANT SELECT ON public.feature_flags TO anon;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flags_read_auth" ON public.feature_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY "flags_read_anon" ON public.feature_flags FOR SELECT TO anon USING (enabled = true);
CREATE POLICY "flags_manage" ON public.feature_flags FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'observability.flags.manage',NULL))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'observability.flags.manage',NULL));

CREATE TABLE public.feature_flag_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id uuid NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  scope_type text NOT NULL, scope_id uuid,
  value jsonb NOT NULL,
  expires_at timestamptz, reason text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flag_overrides TO authenticated;
GRANT ALL ON public.feature_flag_overrides TO service_role;
ALTER TABLE public.feature_flag_overrides ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_flagov_flag ON public.feature_flag_overrides (flag_id, scope_type, scope_id);
CREATE POLICY "flagov_read" ON public.feature_flag_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "flagov_manage" ON public.feature_flag_overrides FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'observability.flags.manage',NULL))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'observability.flags.manage',NULL));

CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope public.setting_scope NOT NULL DEFAULT 'global',
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  value_type text NOT NULL DEFAULT 'json',
  description text,
  is_secret boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, store_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read" ON public.system_settings FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'observability.settings.manage',store_id) OR is_secret = false);
CREATE POLICY "settings_manage" ON public.system_settings FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'observability.settings.manage',store_id))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'observability.settings.manage',store_id));

-- ============================================================
-- 5. TRIGGERS updated_at
-- ============================================================
CREATE TRIGGER trg_wfdef_upd BEFORE UPDATE ON public.workflow_definitions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_wfinst_upd BEFORE UPDATE ON public.workflow_instances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_flags_upd BEFORE UPDATE ON public.feature_flags FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_settings_upd BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 6. HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.enqueue_outbox_event(
  _store_id uuid, _aggregate_type text, _aggregate_id uuid, _event_type text,
  _payload jsonb DEFAULT '{}'::jsonb, _metadata jsonb DEFAULT '{}'::jsonb,
  _correlation_id uuid DEFAULT NULL, _causation_id uuid DEFAULT NULL,
  _ordered boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.event_outbox (store_id, aggregate_type, aggregate_id, event_type, payload, metadata, correlation_id, causation_id, ordered)
  VALUES (_store_id, _aggregate_type, _aggregate_id, _event_type, _payload, _metadata, _correlation_id, _causation_id, _ordered)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.claim_outbox_batch(
  _worker_id text, _batch_size int DEFAULT 100, _lock_seconds int DEFAULT 120
) RETURNS SETOF public.event_outbox LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE public.event_outbox o
  SET status = 'processing',
      locked_by = _worker_id,
      locked_until = now() + make_interval(secs => _lock_seconds),
      attempts = o.attempts + 1
  WHERE o.id IN (
    SELECT id FROM public.event_outbox
    WHERE status IN ('pending','failed')
      AND available_at <= now()
      AND (locked_until IS NULL OR locked_until < now())
    ORDER BY available_at ASC
    LIMIT _batch_size FOR UPDATE SKIP LOCKED
  )
  RETURNING o.*;
END $$;

CREATE OR REPLACE FUNCTION public.mark_outbox_published(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.event_outbox
  SET status = 'published', published_at = now(), locked_by = NULL, locked_until = NULL
  WHERE id = _id;
$$;

CREATE OR REPLACE FUNCTION public.mark_outbox_failed(_id uuid, _error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_attempts int; v_max int; v_backoff int;
BEGIN
  SELECT attempts, max_attempts INTO v_attempts, v_max FROM public.event_outbox WHERE id = _id;
  IF v_attempts >= v_max THEN
    INSERT INTO public.event_outbox_dead_letter (original_outbox_id, store_id, aggregate_type, aggregate_id, event_type, payload, metadata, attempts, last_error)
    SELECT id, store_id, aggregate_type, aggregate_id, event_type, payload, metadata, attempts, _error
    FROM public.event_outbox WHERE id = _id;
    UPDATE public.event_outbox SET status = 'dead', last_error = _error, locked_by = NULL, locked_until = NULL WHERE id = _id;
  ELSE
    v_backoff := LEAST(3600, 5 * (2 ^ LEAST(v_attempts, 10))::int);
    UPDATE public.event_outbox
    SET status = 'failed', last_error = _error,
        available_at = now() + make_interval(secs => v_backoff),
        locked_by = NULL, locked_until = NULL
    WHERE id = _id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.release_stale_outbox_locks()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  WITH released AS (
    UPDATE public.event_outbox
    SET status = 'pending', locked_by = NULL, locked_until = NULL
    WHERE status = 'processing' AND locked_until < now()
    RETURNING 1
  ) SELECT count(*) INTO v_count FROM released;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.idempotency_begin(
  _scope text, _key text, _store_id uuid, _actor_user_id uuid,
  _request_hash text, _ttl_seconds int DEFAULT 86400
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.idempotency_keys%ROWTYPE; v_inserted boolean := false;
BEGIN
  INSERT INTO public.idempotency_keys (scope, key, store_id, actor_user_id, request_hash, expires_at)
  VALUES (_scope, _key, _store_id, _actor_user_id, _request_hash, now() + make_interval(secs => _ttl_seconds))
  ON CONFLICT (scope, key, store_id) DO NOTHING
  RETURNING * INTO v;

  IF v.id IS NOT NULL THEN
    RETURN jsonb_build_object('action','proceed','id',v.id);
  END IF;

  SELECT * INTO v FROM public.idempotency_keys
  WHERE scope = _scope AND key = _key AND store_id IS NOT DISTINCT FROM _store_id;

  IF v.status = 'succeeded' THEN
    IF v.request_hash = _request_hash THEN
      RETURN jsonb_build_object('action','replay','status',v.response_status,'body',v.response_body,'resource_id',v.resource_id);
    ELSE
      RETURN jsonb_build_object('action','conflict','reason','request_hash_mismatch');
    END IF;
  ELSIF v.status = 'in_flight' THEN
    RETURN jsonb_build_object('action','in_progress','id',v.id);
  ELSIF v.status = 'failed' AND v.request_hash = _request_hash THEN
    UPDATE public.idempotency_keys SET attempts = attempts + 1, status = 'in_flight' WHERE id = v.id;
    RETURN jsonb_build_object('action','retry','id',v.id);
  END IF;

  RETURN jsonb_build_object('action','conflict','reason','unknown_state');
END $$;

CREATE OR REPLACE FUNCTION public.idempotency_complete(
  _id uuid, _status public.idempotency_status,
  _response_status int, _response_body jsonb, _response_hash text,
  _resource_type text DEFAULT NULL, _resource_id uuid DEFAULT NULL,
  _error_code text DEFAULT NULL
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.idempotency_keys
  SET status = _status, response_status = _response_status,
      response_body = _response_body, response_hash = _response_hash,
      resource_type = COALESCE(_resource_type, resource_type),
      resource_id = COALESCE(_resource_id, resource_id),
      error_code = _error_code,
      completed_at = now()
  WHERE id = _id;
$$;

CREATE OR REPLACE FUNCTION public.purge_expired_idempotency_keys()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  WITH deleted AS (
    DELETE FROM public.idempotency_keys
    WHERE expires_at < now() AND status <> 'in_flight'
    RETURNING 1
  ) SELECT count(*) INTO v_count FROM deleted;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.record_metric(
  _scope text, _name text, _value numeric, _unit text DEFAULT NULL,
  _tags jsonb DEFAULT '{}'::jsonb, _store_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.metrics (store_id, scope, name, value, unit, tags)
  VALUES (_store_id, _scope, _name, _value, _unit, _tags)
  RETURNING id;
$$;

CREATE OR REPLACE FUNCTION public.record_health_check(
  _component text, _status public.health_status, _latency_ms int DEFAULT NULL, _details jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.health_checks (component, status, latency_ms, details)
  VALUES (_component, _status, _latency_ms, _details)
  RETURNING id;
$$;

CREATE OR REPLACE FUNCTION public.evaluate_feature_flag(
  _key text, _user_id uuid DEFAULT NULL, _store_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_flag public.feature_flags%ROWTYPE; v_override jsonb;
BEGIN
  SELECT * INTO v_flag FROM public.feature_flags WHERE key = _key;
  IF NOT FOUND OR NOT v_flag.enabled THEN
    RETURN COALESCE((SELECT default_value FROM public.feature_flags WHERE key = _key), 'false'::jsonb);
  END IF;
  SELECT value INTO v_override FROM public.feature_flag_overrides
  WHERE flag_id = v_flag.id
    AND ((scope_type = 'user' AND scope_id = _user_id)
      OR (scope_type = 'store' AND scope_id = _store_id))
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY (scope_type = 'user') DESC LIMIT 1;
  RETURN COALESCE(v_override, v_flag.default_value);
END $$;

-- ============================================================
-- 7. RBAC PERMISSIONS (schema correto: code, module, description)
-- ============================================================
INSERT INTO public.permissions (code, module, description) VALUES
  ('workflow.read','workflow','Visualizar definições e instâncias de workflow'),
  ('workflow.manage','workflow','Criar e editar definições de workflow'),
  ('workflow.transition','workflow','Executar transições de estado'),
  ('outbox.read','outbox','Visualizar fila de outbox'),
  ('outbox.retry','outbox','Reprocessar eventos com falha'),
  ('outbox.deadletter.manage','outbox','Gerenciar eventos descartados'),
  ('idempotency.read','idempotency','Visualizar chaves de idempotência'),
  ('idempotency.replay','idempotency','Forçar replay de operações'),
  ('observability.metrics.read','observability','Visualizar métricas'),
  ('observability.traces.read','observability','Visualizar traces'),
  ('observability.health.read','observability','Visualizar health checks'),
  ('observability.flags.manage','observability','Gerenciar feature flags'),
  ('observability.settings.manage','observability','Gerenciar configurações do sistema')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.code = 'super_admin'
  AND p.code IN (
    'workflow.read','workflow.manage','workflow.transition',
    'outbox.read','outbox.retry','outbox.deadletter.manage',
    'idempotency.read','idempotency.replay',
    'observability.metrics.read','observability.traces.read','observability.health.read',
    'observability.flags.manage','observability.settings.manage'
  )
ON CONFLICT DO NOTHING;
