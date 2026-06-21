
-- =====================================================================
-- PAYMENT ENGINE — MIGRATION 3/3 (corrigida)
-- =====================================================================

CREATE TYPE public.payment_adapter_status AS ENUM (
  'experimental','active','deprecated','retired'
);
CREATE TYPE public.payment_webhook_status AS ENUM (
  'received','processing','processed','failed','ignored','duplicate'
);
CREATE TYPE public.payment_timeline_event AS ENUM (
  'created','authorized','captured','partially_captured','failed',
  'cancelled','refund_requested','refund_succeeded','refund_failed',
  'chargeback_opened','chargeback_resolved','reconciled',
  'webhook_received','adapter_attempt','note_added','document_added'
);

-- payment_adapters --------------------------------------------------
CREATE TABLE public.payment_adapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  version text NOT NULL,
  display_name text NOT NULL,
  status public.payment_adapter_status NOT NULL DEFAULT 'active',
  supported_methods public.payment_method[] NOT NULL DEFAULT '{}',
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  config_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  webhook_signature_scheme text,
  release_notes text,
  released_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, version)
);
CREATE INDEX idx_payment_adapters_provider_status ON public.payment_adapters(provider, status);
GRANT SELECT ON public.payment_adapters TO anon, authenticated;
GRANT ALL ON public.payment_adapters TO service_role;
ALTER TABLE public.payment_adapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_adapters_public_select" ON public.payment_adapters FOR SELECT
  USING (status IN ('active','deprecated'));
CREATE TRIGGER trg_payment_adapters_updated BEFORE UPDATE ON public.payment_adapters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- payment_gateway_adapter_bindings ----------------------------------
CREATE TABLE public.payment_gateway_adapter_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_id uuid NOT NULL REFERENCES public.payment_gateways(id) ON DELETE CASCADE,
  adapter_id uuid NOT NULL REFERENCES public.payment_adapters(id) ON DELETE RESTRICT,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  pinned_at timestamptz NOT NULL DEFAULT now(),
  pinned_by uuid REFERENCES auth.users(id),
  config_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gateway_id, adapter_id)
);
CREATE INDEX idx_pg_adapter_bindings_gateway ON public.payment_gateway_adapter_bindings(gateway_id, is_active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_gateway_adapter_bindings TO authenticated;
GRANT ALL ON public.payment_gateway_adapter_bindings TO service_role;
ALTER TABLE public.payment_gateway_adapter_bindings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pg_adapter_bindings_select" ON public.payment_gateway_adapter_bindings FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'payments.read',store_id));
CREATE POLICY "pg_adapter_bindings_write" ON public.payment_gateway_adapter_bindings FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'payments.audit',store_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'payments.audit',store_id));
CREATE TRIGGER trg_pg_adapter_bindings_updated BEFORE UPDATE ON public.payment_gateway_adapter_bindings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- payment_webhook_inbox ---------------------------------------------
CREATE TABLE public.payment_webhook_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  gateway_id uuid REFERENCES public.payment_gateways(id) ON DELETE SET NULL,
  provider text NOT NULL,
  external_event_id text NOT NULL,
  event_type text NOT NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  status public.payment_webhook_status NOT NULL DEFAULT 'received',
  signature text,
  signature_valid boolean,
  raw_payload jsonb NOT NULL,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_ip text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  trace_id uuid,
  correlation_id uuid,
  causation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, external_event_id)
);
CREATE INDEX idx_payment_webhook_inbox_status ON public.payment_webhook_inbox(status, received_at);
CREATE INDEX idx_payment_webhook_inbox_payment ON public.payment_webhook_inbox(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX idx_payment_webhook_inbox_store ON public.payment_webhook_inbox(store_id, received_at DESC);
GRANT SELECT ON public.payment_webhook_inbox TO authenticated;
GRANT ALL ON public.payment_webhook_inbox TO service_role;
ALTER TABLE public.payment_webhook_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_webhook_inbox_select" ON public.payment_webhook_inbox FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid())
         OR (store_id IS NOT NULL AND public.has_permission(auth.uid(),'payments.audit',store_id)));
CREATE TRIGGER trg_payment_webhook_inbox_updated BEFORE UPDATE ON public.payment_webhook_inbox
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- payment_webhook_processing_log ------------------------------------
CREATE TABLE public.payment_webhook_processing_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.payment_webhook_inbox(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  status public.payment_webhook_status NOT NULL,
  error_message text,
  duration_ms integer,
  processed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_webhook_log_webhook ON public.payment_webhook_processing_log(webhook_id);
GRANT SELECT ON public.payment_webhook_processing_log TO authenticated;
GRANT ALL ON public.payment_webhook_processing_log TO service_role;
ALTER TABLE public.payment_webhook_processing_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_webhook_log_select" ON public.payment_webhook_processing_log FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid())
         OR EXISTS (
           SELECT 1 FROM public.payment_webhook_inbox w
           WHERE w.id = payment_webhook_processing_log.webhook_id
             AND w.store_id IS NOT NULL
             AND public.has_permission(auth.uid(),'payments.audit',w.store_id)
         ));

CREATE OR REPLACE FUNCTION public.payment_webhook_log_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'payment_webhook_processing_log is append-only'; END $$;

CREATE TRIGGER trg_payment_webhook_log_append_only
  BEFORE UPDATE OR DELETE ON public.payment_webhook_processing_log
  FOR EACH ROW EXECUTE FUNCTION public.payment_webhook_log_append_only();

-- payment_timeline --------------------------------------------------
CREATE TABLE public.payment_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  event_type public.payment_timeline_event NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id),
  actor_kind text NOT NULL DEFAULT 'system',
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  trace_id uuid,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_timeline_payment ON public.payment_timeline(payment_id, created_at DESC);
CREATE INDEX idx_payment_timeline_store ON public.payment_timeline(store_id, created_at DESC);
GRANT SELECT ON public.payment_timeline TO authenticated;
GRANT ALL ON public.payment_timeline TO service_role;
ALTER TABLE public.payment_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_timeline_select" ON public.payment_timeline FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'payments.read',store_id));

CREATE OR REPLACE FUNCTION public.payment_timeline_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'payment_timeline is append-only'; END $$;

CREATE TRIGGER trg_payment_timeline_append_only
  BEFORE UPDATE OR DELETE ON public.payment_timeline
  FOR EACH ROW EXECUTE FUNCTION public.payment_timeline_append_only();

-- Workflow seed -----------------------------------------------------
CREATE OR REPLACE FUNCTION public._seed_payment_transition(
  _def_id uuid, _state_map jsonb, _code text, _from_code text, _to_code text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.workflow_transitions (definition_id, code, label, from_state_id, to_state_id, required_permission)
  VALUES (_def_id, _code, initcap(replace(_code,'_',' ')),
          (_state_map->>_from_code)::uuid, (_state_map->>_to_code)::uuid,
          'payments.create')
  ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.seed_payment_workflow(_store_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_def_id uuid;
  v_state_ids jsonb := '{}'::jsonb;
  v_codes text[] := ARRAY['pending','authorizing','authorized','capturing','captured',
    'partially_captured','failed','cancelled','refunding','refunded','closed'];
  v_finals text[] := ARRAY['captured','partially_captured','failed','cancelled','refunded','closed'];
  c text; v_state_id uuid; v_idx int := 0;
BEGIN
  SELECT id INTO v_def_id FROM public.workflow_definitions
    WHERE store_id = _store_id AND code = 'payment' AND version = 1;
  IF v_def_id IS NULL THEN
    INSERT INTO public.workflow_definitions (store_id, code, name, aggregate_type, version, description, is_active)
    VALUES (_store_id, 'payment', 'Payment Workflow', 'payment', 1, 'Workflow oficial do Payment Engine v1', true)
    RETURNING id INTO v_def_id;
  END IF;
  FOREACH c IN ARRAY v_codes LOOP
    v_idx := v_idx + 1;
    INSERT INTO public.workflow_states (definition_id, code, label, is_initial, is_final, sort_order)
    VALUES (v_def_id, c, initcap(replace(c,'_',' ')), c = 'pending', c = ANY(v_finals), v_idx)
    ON CONFLICT DO NOTHING;
    SELECT id INTO v_state_id FROM public.workflow_states WHERE definition_id = v_def_id AND code = c;
    v_state_ids := v_state_ids || jsonb_build_object(c, v_state_id);
  END LOOP;
  PERFORM public._seed_payment_transition(v_def_id, v_state_ids, 'authorize_start',     'pending',            'authorizing');
  PERFORM public._seed_payment_transition(v_def_id, v_state_ids, 'authorize',           'authorizing',        'authorized');
  PERFORM public._seed_payment_transition(v_def_id, v_state_ids, 'capture_start',       'authorized',         'capturing');
  PERFORM public._seed_payment_transition(v_def_id, v_state_ids, 'capture',             'capturing',          'captured');
  PERFORM public._seed_payment_transition(v_def_id, v_state_ids, 'partial_capture',     'capturing',          'partially_captured');
  PERFORM public._seed_payment_transition(v_def_id, v_state_ids, 'complete_partial',    'partially_captured', 'captured');
  PERFORM public._seed_payment_transition(v_def_id, v_state_ids, 'fail_pending',        'pending',            'failed');
  PERFORM public._seed_payment_transition(v_def_id, v_state_ids, 'fail_authorizing',    'authorizing',        'failed');
  PERFORM public._seed_payment_transition(v_def_id, v_state_ids, 'fail_capturing',      'capturing',          'failed');
  PERFORM public._seed_payment_transition(v_def_id, v_state_ids, 'cancel_pending',      'pending',            'cancelled');
  PERFORM public._seed_payment_transition(v_def_id, v_state_ids, 'cancel_authorized',   'authorized',         'cancelled');
  PERFORM public._seed_payment_transition(v_def_id, v_state_ids, 'refund_start',        'captured',           'refunding');
  PERFORM public._seed_payment_transition(v_def_id, v_state_ids, 'refund_start_partial','partially_captured', 'refunding');
  PERFORM public._seed_payment_transition(v_def_id, v_state_ids, 'refund',              'refunding',          'refunded');
  PERFORM public._seed_payment_transition(v_def_id, v_state_ids, 'close',               'captured',           'closed');
  PERFORM public._seed_payment_transition(v_def_id, v_state_ids, 'close_refunded',      'refunded',           'closed');
  RETURN v_def_id;
END $$;

-- Timeline helper ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.payment_record_timeline(
  _payment_id uuid, _event_type public.payment_timeline_event,
  _summary text DEFAULT NULL, _payload jsonb DEFAULT '{}'::jsonb,
  _actor_kind text DEFAULT 'system'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store_id uuid; v_id uuid;
BEGIN
  SELECT store_id INTO v_store_id FROM public.payments WHERE id = _payment_id;
  IF v_store_id IS NULL THEN RAISE EXCEPTION 'Payment % not found', _payment_id; END IF;
  INSERT INTO public.payment_timeline(payment_id, store_id, event_type, actor_user_id, actor_kind, summary, payload)
  VALUES (_payment_id, v_store_id, _event_type, auth.uid(), _actor_kind, _summary, _payload)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- payment_record_attempt --------------------------------------------
CREATE OR REPLACE FUNCTION public.payment_record_attempt(
  _payment_id uuid, _operation public.payment_attempt_operation, _gateway_id uuid,
  _success boolean, _request_payload jsonb, _response_payload jsonb,
  _http_status integer DEFAULT NULL, _gateway_code text DEFAULT NULL,
  _gateway_message text DEFAULT NULL, _latency_ms integer DEFAULT NULL,
  _external_id text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store_id uuid; v_id uuid;
BEGIN
  SELECT store_id INTO v_store_id FROM public.payments WHERE id = _payment_id;
  IF v_store_id IS NULL THEN RAISE EXCEPTION 'Payment % not found', _payment_id; END IF;
  INSERT INTO public.payment_attempts(
    payment_id, store_id, gateway_id, operation, success,
    request_payload, response_payload, http_status,
    gateway_code, gateway_message, latency_ms, external_id, actor_user_id
  ) VALUES (
    _payment_id, v_store_id, _gateway_id, _operation, _success,
    _request_payload, _response_payload, _http_status,
    _gateway_code, _gateway_message, _latency_ms, _external_id, auth.uid()
  ) RETURNING id INTO v_id;
  PERFORM public.payment_record_timeline(_payment_id, 'adapter_attempt',
    format('%s %s', _operation, CASE WHEN _success THEN 'OK' ELSE 'FAIL' END),
    jsonb_build_object('attempt_id', v_id, 'operation', _operation, 'success', _success));
  RETURN v_id;
END $$;

-- payment_authorize --------------------------------------------------
CREATE OR REPLACE FUNCTION public.payment_authorize(
  _payment_id uuid, _gateway_id uuid, _authorization_id text,
  _authorized_amount numeric, _expires_at timestamptz DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p public.payments%ROWTYPE;
BEGIN
  SELECT * INTO v_p FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment % not found', _payment_id; END IF;
  IF v_p.status NOT IN ('pending','authorizing') THEN
    RAISE EXCEPTION 'Cannot authorize payment in status %', v_p.status;
  END IF;
  UPDATE public.payments SET
    status = 'authorized',
    gateway_id = COALESCE(_gateway_id, gateway_id),
    authorization_id = _authorization_id,
    amount_authorized = _authorized_amount,
    authorization_expires_at = _expires_at,
    metadata = metadata || _metadata
  WHERE id = _payment_id RETURNING * INTO v_p;
  INSERT INTO public.payment_transactions(payment_id, store_id, kind, direction, amount, currency, occurred_at)
  VALUES (_payment_id, v_p.store_id, 'authorization', 'credit', _authorized_amount, v_p.currency, now());
  PERFORM public.payment_record_timeline(_payment_id, 'authorized',
    format('Autorizado %s %s', _authorized_amount, v_p.currency),
    jsonb_build_object('authorization_id', _authorization_id, 'amount', _authorized_amount));
  RETURN v_p;
END $$;

-- payment_capture ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.payment_capture(
  _payment_id uuid, _amount numeric, _capture_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p public.payments%ROWTYPE; v_new_status public.payment_status; v_total_captured numeric;
BEGIN
  SELECT * INTO v_p FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment % not found', _payment_id; END IF;
  IF v_p.status NOT IN ('authorized','capturing','partially_captured') THEN
    RAISE EXCEPTION 'Cannot capture payment in status %', v_p.status;
  END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Capture amount must be > 0'; END IF;
  v_total_captured := COALESCE(v_p.amount_captured,0) + _amount;
  IF v_total_captured > COALESCE(v_p.amount_authorized, v_p.amount_gross) THEN
    RAISE EXCEPTION 'Capture exceeds authorized amount';
  END IF;
  v_new_status := CASE
    WHEN v_total_captured >= COALESCE(v_p.amount_authorized, v_p.amount_gross) THEN 'captured'
    ELSE 'partially_captured'
  END;
  UPDATE public.payments SET
    status = v_new_status,
    amount_captured = v_total_captured,
    captured_at = COALESCE(captured_at, now()),
    metadata = metadata || _metadata
  WHERE id = _payment_id RETURNING * INTO v_p;
  INSERT INTO public.payment_transactions(payment_id, store_id, kind, direction, amount, currency, external_id, occurred_at)
  VALUES (_payment_id, v_p.store_id, 'capture', 'credit', _amount, v_p.currency, _capture_id, now());
  PERFORM public.payment_record_timeline(_payment_id,
    CASE WHEN v_new_status='captured' THEN 'captured'::public.payment_timeline_event
         ELSE 'partially_captured'::public.payment_timeline_event END,
    format('Capturado %s %s', _amount, v_p.currency),
    jsonb_build_object('amount', _amount, 'total_captured', v_total_captured, 'capture_id', _capture_id));
  RETURN v_p;
END $$;

-- payment_cancel -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.payment_cancel(
  _payment_id uuid, _reason text DEFAULT NULL
) RETURNS public.payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p public.payments%ROWTYPE;
BEGIN
  SELECT * INTO v_p FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment % not found', _payment_id; END IF;
  IF v_p.status NOT IN ('pending','authorizing','authorized') THEN
    RAISE EXCEPTION 'Cannot cancel payment in status %', v_p.status;
  END IF;
  UPDATE public.payments SET
    status = 'cancelled', cancelled_at = now(),
    failure_message = COALESCE(_reason, failure_message)
  WHERE id = _payment_id RETURNING * INTO v_p;
  IF v_p.amount_authorized > 0 THEN
    INSERT INTO public.payment_transactions(payment_id, store_id, kind, direction, amount, currency, occurred_at)
    VALUES (_payment_id, v_p.store_id, 'void', 'debit', v_p.amount_authorized, v_p.currency, now());
  END IF;
  PERFORM public.payment_record_timeline(_payment_id, 'cancelled', _reason,
    jsonb_build_object('reason', _reason));
  RETURN v_p;
END $$;

-- payment_fail -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payment_fail(
  _payment_id uuid, _failure_code text, _failure_message text
) RETURNS public.payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p public.payments%ROWTYPE;
BEGIN
  SELECT * INTO v_p FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment % not found', _payment_id; END IF;
  IF v_p.status NOT IN ('pending','authorizing','capturing') THEN
    RAISE EXCEPTION 'Cannot fail payment in status %', v_p.status;
  END IF;
  UPDATE public.payments SET
    status='failed', failure_code=_failure_code, failure_message=_failure_message
  WHERE id = _payment_id RETURNING * INTO v_p;
  PERFORM public.payment_record_timeline(_payment_id, 'failed', _failure_message,
    jsonb_build_object('code', _failure_code));
  RETURN v_p;
END $$;

-- payment_refund_request --------------------------------------------
CREATE OR REPLACE FUNCTION public.payment_refund_request(
  _payment_id uuid, _amount numeric, _reason public.payment_refund_reason DEFAULT 'customer_request',
  _reason_note text DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.payment_refunds LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p public.payments%ROWTYPE; v_r public.payment_refunds%ROWTYPE; v_available numeric;
BEGIN
  SELECT * INTO v_p FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment % not found', _payment_id; END IF;
  IF v_p.status NOT IN ('captured','partially_captured','refunding') THEN
    RAISE EXCEPTION 'Cannot refund payment in status %', v_p.status;
  END IF;
  v_available := COALESCE(v_p.amount_captured,0) - COALESCE(v_p.amount_refunded,0);
  IF _amount > v_available THEN
    RAISE EXCEPTION 'Refund amount % exceeds refundable balance %', _amount, v_available;
  END IF;
  INSERT INTO public.payment_refunds(
    store_id, payment_id, gateway_id, status, reason, reason_note,
    amount, currency, requested_by, trace_id, correlation_id, metadata
  ) VALUES (
    v_p.store_id, _payment_id, v_p.gateway_id, 'pending', _reason, _reason_note,
    _amount, v_p.currency, auth.uid(), v_p.trace_id, v_p.correlation_id, _metadata
  ) RETURNING * INTO v_r;
  UPDATE public.payments SET status='refunding' WHERE id=_payment_id AND status<>'refunding';
  PERFORM public.payment_record_timeline(_payment_id, 'refund_requested',
    format('Refund solicitado %s %s', _amount, v_p.currency),
    jsonb_build_object('refund_id', v_r.id, 'amount', _amount, 'reason', _reason));
  RETURN v_r;
END $$;

-- payment_refund_mark_succeeded / _failed ---------------------------
CREATE OR REPLACE FUNCTION public.payment_refund_mark_succeeded(
  _refund_id uuid, _gateway_refund_id text DEFAULT NULL
) RETURNS public.payment_refunds LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_r public.payment_refunds%ROWTYPE; v_p public.payments%ROWTYPE;
BEGIN
  SELECT * INTO v_r FROM public.payment_refunds WHERE id = _refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund % not found', _refund_id; END IF;
  UPDATE public.payment_refunds SET
    status='succeeded', processed_at=now(),
    gateway_refund_id=COALESCE(_gateway_refund_id, gateway_refund_id)
  WHERE id=_refund_id RETURNING * INTO v_r;
  INSERT INTO public.payment_transactions(payment_id, store_id, kind, direction, amount, currency, external_id, occurred_at)
  VALUES (v_r.payment_id, v_r.store_id, 'refund', 'debit', v_r.amount, v_r.currency, v_r.gateway_refund_id, now());
  SELECT * INTO v_p FROM public.payments WHERE id = v_r.payment_id FOR UPDATE;
  IF COALESCE(v_p.amount_refunded,0) >= COALESCE(v_p.amount_captured,0) THEN
    UPDATE public.payments SET status='refunded' WHERE id=v_p.id AND status<>'refunded';
  ELSIF v_p.status='refunding' THEN
    UPDATE public.payments SET status=
      CASE WHEN COALESCE(v_p.amount_captured,0) > 0 THEN 'partially_captured'::public.payment_status
           ELSE 'captured'::public.payment_status END
    WHERE id=v_p.id;
  END IF;
  PERFORM public.payment_record_timeline(v_r.payment_id, 'refund_succeeded',
    format('Refund concluído %s', v_r.amount),
    jsonb_build_object('refund_id', v_r.id, 'amount', v_r.amount));
  RETURN v_r;
END $$;

CREATE OR REPLACE FUNCTION public.payment_refund_mark_failed(
  _refund_id uuid, _failure_code text, _failure_message text
) RETURNS public.payment_refunds LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_r public.payment_refunds%ROWTYPE;
BEGIN
  UPDATE public.payment_refunds SET
    status='failed', failure_code=_failure_code, failure_message=_failure_message, processed_at=now()
  WHERE id=_refund_id RETURNING * INTO v_r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund % not found', _refund_id; END IF;
  PERFORM public.payment_record_timeline(v_r.payment_id, 'refund_failed', _failure_message,
    jsonb_build_object('refund_id', v_r.id, 'code', _failure_code));
  RETURN v_r;
END $$;

-- payment_chargeback_open / _resolve --------------------------------
CREATE OR REPLACE FUNCTION public.payment_chargeback_open(
  _payment_id uuid, _amount numeric,
  _reason public.payment_chargeback_reason DEFAULT 'general',
  _gateway_dispute_id text DEFAULT NULL,
  _evidence_due_at timestamptz DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.payment_chargebacks LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p public.payments%ROWTYPE; v_cb public.payment_chargebacks%ROWTYPE;
BEGIN
  SELECT * INTO v_p FROM public.payments WHERE id = _payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment % not found', _payment_id; END IF;
  INSERT INTO public.payment_chargebacks(
    store_id, payment_id, gateway_id, status, reason,
    amount, currency, gateway_dispute_id, evidence_due_at,
    trace_id, correlation_id, metadata
  ) VALUES (
    v_p.store_id, _payment_id, v_p.gateway_id, 'opened', _reason,
    _amount, v_p.currency, _gateway_dispute_id, _evidence_due_at,
    v_p.trace_id, v_p.correlation_id, _metadata
  ) RETURNING * INTO v_cb;
  PERFORM public.payment_record_timeline(_payment_id, 'chargeback_opened',
    format('Chargeback aberto %s %s', _amount, v_p.currency),
    jsonb_build_object('chargeback_id', v_cb.id, 'reason', _reason));
  RETURN v_cb;
END $$;

CREATE OR REPLACE FUNCTION public.payment_chargeback_resolve(
  _chargeback_id uuid, _outcome public.payment_chargeback_status,
  _outcome_note text DEFAULT NULL, _fee_amount numeric DEFAULT 0
) RETURNS public.payment_chargebacks LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cb public.payment_chargebacks%ROWTYPE;
BEGIN
  IF _outcome NOT IN ('won','lost','accepted','cancelled') THEN
    RAISE EXCEPTION 'Invalid chargeback resolution %', _outcome;
  END IF;
  UPDATE public.payment_chargebacks SET
    status=_outcome, resolved_at=now(),
    outcome_note=_outcome_note, fee_amount=COALESCE(_fee_amount,0)
  WHERE id=_chargeback_id RETURNING * INTO v_cb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chargeback % not found', _chargeback_id; END IF;
  PERFORM public.payment_record_timeline(v_cb.payment_id, 'chargeback_resolved',
    format('Chargeback %s', _outcome),
    jsonb_build_object('chargeback_id', v_cb.id, 'outcome', _outcome, 'fee', _fee_amount));
  RETURN v_cb;
END $$;

-- payment_webhook_ingest --------------------------------------------
CREATE OR REPLACE FUNCTION public.payment_webhook_ingest(
  _provider text, _external_event_id text, _event_type text,
  _payload jsonb, _signature text DEFAULT NULL,
  _signature_valid boolean DEFAULT NULL,
  _headers jsonb DEFAULT '{}'::jsonb, _source_ip text DEFAULT NULL,
  _gateway_id uuid DEFAULT NULL, _store_id uuid DEFAULT NULL,
  _payment_id uuid DEFAULT NULL,
  _trace_id uuid DEFAULT NULL, _correlation_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM public.payment_webhook_inbox
    WHERE provider=_provider AND external_event_id=_external_event_id;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('action','duplicate','id',v_existing);
  END IF;
  INSERT INTO public.payment_webhook_inbox(
    store_id, gateway_id, provider, external_event_id, event_type,
    payment_id, status, signature, signature_valid, raw_payload,
    headers, source_ip, trace_id, correlation_id
  ) VALUES (
    _store_id, _gateway_id, _provider, _external_event_id, _event_type,
    _payment_id, 'received', _signature, _signature_valid, _payload,
    _headers, _source_ip, _trace_id, _correlation_id
  ) RETURNING id INTO v_id;
  IF _payment_id IS NOT NULL THEN
    PERFORM public.payment_record_timeline(_payment_id, 'webhook_received',
      format('Webhook %s', _event_type),
      jsonb_build_object('webhook_id', v_id, 'provider', _provider, 'event_type', _event_type));
  END IF;
  RETURN jsonb_build_object('action','new','id',v_id);
END $$;

CREATE OR REPLACE FUNCTION public.payment_webhook_mark_processed(
  _webhook_id uuid, _duration_ms integer DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_attempts int;
BEGIN
  UPDATE public.payment_webhook_inbox SET
    status='processed', processed_at=now(), attempts=attempts+1
  WHERE id=_webhook_id RETURNING attempts INTO v_attempts;
  INSERT INTO public.payment_webhook_processing_log(webhook_id, attempt_number, status, duration_ms)
  VALUES (_webhook_id, v_attempts, 'processed', _duration_ms);
END $$;

CREATE OR REPLACE FUNCTION public.payment_webhook_mark_failed(
  _webhook_id uuid, _error text, _duration_ms integer DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_attempts int;
BEGIN
  UPDATE public.payment_webhook_inbox SET
    status='failed', attempts=attempts+1, last_error=_error
  WHERE id=_webhook_id RETURNING attempts INTO v_attempts;
  INSERT INTO public.payment_webhook_processing_log(webhook_id, attempt_number, status, error_message, duration_ms)
  VALUES (_webhook_id, v_attempts, 'failed', _error, _duration_ms);
END $$;

-- payment_reconciliation_match_item ---------------------------------
CREATE OR REPLACE FUNCTION public.payment_reconciliation_match_item(
  _item_id uuid, _payment_id uuid
) RETURNS public.payment_reconciliation_items LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item public.payment_reconciliation_items%ROWTYPE; v_p public.payments%ROWTYPE;
BEGIN
  SELECT * INTO v_item FROM public.payment_reconciliation_items WHERE id = _item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reconciliation item % not found', _item_id; END IF;
  SELECT * INTO v_p FROM public.payments WHERE id = _payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment % not found', _payment_id; END IF;
  IF v_item.amount <> COALESCE(v_p.amount_captured, v_p.amount_gross) THEN
    INSERT INTO public.payment_reconciliation_discrepancies(
      reconciliation_id, reconciliation_item_id, store_id, payment_id,
      kind, expected_amount, actual_amount
    ) VALUES (
      v_item.reconciliation_id, v_item.id, v_item.store_id, _payment_id,
      'amount_mismatch', COALESCE(v_p.amount_captured, v_p.amount_gross), v_item.amount
    );
    UPDATE public.payment_reconciliations SET discrepant_items = discrepant_items + 1
      WHERE id = v_item.reconciliation_id;
  ELSE
    UPDATE public.payment_reconciliations SET matched_items = matched_items + 1
      WHERE id = v_item.reconciliation_id;
  END IF;
  PERFORM public.payment_record_timeline(_payment_id, 'reconciled',
    format('Conciliado item %s', v_item.external_transaction_id),
    jsonb_build_object('item_id', v_item.id, 'amount', v_item.amount));
  RETURN v_item;
END $$;

-- GRANT EXECUTE -----------------------------------------------------
GRANT EXECUTE ON FUNCTION public.payment_record_timeline(uuid, public.payment_timeline_event, text, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payment_record_attempt(uuid, public.payment_attempt_operation, uuid, boolean, jsonb, jsonb, integer, text, text, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payment_authorize(uuid, uuid, text, numeric, timestamptz, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payment_capture(uuid, numeric, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payment_cancel(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payment_fail(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payment_refund_request(uuid, numeric, public.payment_refund_reason, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payment_refund_mark_succeeded(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payment_refund_mark_failed(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payment_chargeback_open(uuid, numeric, public.payment_chargeback_reason, text, timestamptz, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payment_chargeback_resolve(uuid, public.payment_chargeback_status, text, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payment_webhook_ingest(text, text, text, jsonb, text, boolean, jsonb, text, uuid, uuid, uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payment_webhook_mark_processed(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payment_webhook_mark_failed(uuid, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payment_reconciliation_match_item(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.seed_payment_workflow(uuid) TO authenticated, service_role;
