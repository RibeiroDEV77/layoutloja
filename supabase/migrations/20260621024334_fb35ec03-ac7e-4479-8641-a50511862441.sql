
-- ============================================================================
-- Phase 5.4 — Payment Engine — Migration 1/3 (Core Aggregate)
-- ============================================================================

-- 1. ENUMS
CREATE TYPE public.payment_status AS ENUM (
  'pending','authorized','partially_captured','captured','paid',
  'partially_refunded','refunded','failed','cancelled','chargeback','closed'
);
CREATE TYPE public.payment_method AS ENUM (
  'pix','credit_card','debit_card','boleto','wallet',
  'bank_transfer','store_credit','gift_card'
);
CREATE TYPE public.payment_payable_type AS ENUM (
  'order','subscription','wallet_topup','marketplace_split'
);
CREATE TYPE public.payment_attempt_operation AS ENUM (
  'authorize','capture','cancel','refund','query','tokenize'
);
CREATE TYPE public.payment_transaction_kind AS ENUM (
  'authorization','capture','cancel','refund','partial_refund',
  'chargeback','adjustment','fee','settlement'
);
CREATE TYPE public.payment_transaction_direction AS ENUM ('credit','debit');
CREATE TYPE public.payment_event_actor AS ENUM (
  'system','user','gateway','webhook','workflow'
);
CREATE TYPE public.payment_allocation_target AS ENUM (
  'order_item','shipping','tax','discount','marketplace_seller','platform_fee'
);

-- 2. RBAC — permissions
INSERT INTO public.permissions (code, module, description) VALUES
  ('payments.read',       'payments', 'View payments and timeline'),
  ('payments.create',     'payments', 'Create payment intents and authorize'),
  ('payments.capture',    'payments', 'Capture authorized payments'),
  ('payments.cancel',     'payments', 'Cancel authorizations'),
  ('payments.refund',     'payments', 'Request and execute refunds'),
  ('payments.chargeback', 'payments', 'Manage chargebacks and evidence'),
  ('payments.reconcile',  'payments', 'Run reconciliation against PSP settlement'),
  ('payments.audit',      'payments', 'Full audit access (attempts, secrets, webhooks)')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.code = 'super_admin' AND p.code LIKE 'payments.%'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.code = 'store_admin' AND p.code LIKE 'payments.%'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.code = 'finance'
  AND p.code IN ('payments.read','payments.refund','payments.chargeback',
                 'payments.reconcile','payments.audit')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.code = 'support_agent' AND p.code = 'payments.read'
ON CONFLICT DO NOTHING;

-- 3. Shared trigger functions
CREATE OR REPLACE FUNCTION public.payments_append_only_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only', TG_TABLE_NAME USING ERRCODE = '42501';
END $$;

CREATE OR REPLACE FUNCTION public.payments_bump_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN NEW.version := COALESCE(OLD.version, 0) + 1; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.payments_status_transition_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_allowed boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('pending','authorized','failed') THEN
      RAISE EXCEPTION 'Invalid initial payment status: %', NEW.status;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  v_allowed := CASE OLD.status
    WHEN 'pending'             THEN NEW.status IN ('authorized','failed','cancelled','paid')
    WHEN 'authorized'          THEN NEW.status IN ('partially_captured','captured','paid','cancelled','failed')
    WHEN 'partially_captured'  THEN NEW.status IN ('captured','paid','cancelled','refunded','partially_refunded','chargeback')
    WHEN 'captured'            THEN NEW.status IN ('paid','partially_refunded','refunded','chargeback')
    WHEN 'paid'                THEN NEW.status IN ('partially_refunded','refunded','chargeback','closed')
    WHEN 'partially_refunded'  THEN NEW.status IN ('refunded','chargeback','closed')
    WHEN 'refunded'            THEN NEW.status IN ('chargeback','closed')
    WHEN 'failed'              THEN NEW.status IN ('closed')
    WHEN 'cancelled'           THEN NEW.status IN ('closed')
    WHEN 'chargeback'          THEN NEW.status IN ('closed')
    ELSE false
  END;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid payment status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_payments_enqueue_outbox()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event text; v_payload jsonb; v_meta jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'payment.created';
    v_payload := jsonb_build_object(
      'payment_id', NEW.id, 'payable_type', NEW.payable_type,
      'payable_id', NEW.payable_id, 'status', NEW.status,
      'amount_gross', NEW.amount_gross, 'currency', NEW.currency, 'method', NEW.method);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_event := 'payment.' || NEW.status::text;
      v_payload := jsonb_build_object(
        'payment_id', NEW.id, 'from', OLD.status, 'to', NEW.status,
        'amount_captured', NEW.amount_captured, 'amount_refunded', NEW.amount_refunded,
        'version', NEW.version);
    ELSE RETURN NEW; END IF;
  ELSE RETURN OLD; END IF;
  v_meta := jsonb_build_object('trace_id', NEW.trace_id,
    'correlation_id', NEW.correlation_id, 'schema_version', 1);
  PERFORM public.enqueue_outbox_event(
    NEW.store_id, 'payment', NEW.id, v_event, v_payload, v_meta,
    NEW.correlation_id, NULL, true);
  RETURN NEW;
END $$;

-- 4. payment_gateways
CREATE TABLE public.payment_gateways (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  adapter             text NOT NULL,
  display_name        text NOT NULL,
  is_active           boolean NOT NULL DEFAULT true,
  priority            int NOT NULL DEFAULT 100,
  supported_methods   public.payment_method[] NOT NULL DEFAULT '{}',
  supported_currencies char(3)[] NOT NULL DEFAULT ARRAY['BRL']::char(3)[],
  capabilities        jsonb NOT NULL DEFAULT '{}'::jsonb,
  config              jsonb NOT NULL DEFAULT '{}'::jsonb,
  webhook_secret_ref  text,
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_gateways_unique UNIQUE (store_id, adapter, display_name)
);
CREATE INDEX idx_payment_gateways_store_active ON public.payment_gateways(store_id, is_active, priority);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_gateways TO authenticated;
GRANT ALL ON public.payment_gateways TO service_role;

ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gateways_read" ON public.payment_gateways FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid())
  OR public.has_permission(auth.uid(), 'payments.audit', store_id)
  OR public.has_permission(auth.uid(), 'payments.read', store_id));

CREATE POLICY "gateways_write_audit" ON public.payment_gateways FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())
  OR public.has_permission(auth.uid(), 'payments.audit', store_id))
WITH CHECK (public.is_super_admin(auth.uid())
  OR public.has_permission(auth.uid(), 'payments.audit', store_id));

CREATE TRIGGER trg_payment_gateways_updated_at BEFORE UPDATE ON public.payment_gateways
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. payments (Aggregate Root)
CREATE TABLE public.payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  payable_type    public.payment_payable_type NOT NULL,
  payable_id      uuid NOT NULL,
  customer_id     uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  gateway_id      uuid REFERENCES public.payment_gateways(id) ON DELETE RESTRICT,
  method          public.payment_method,
  status          public.payment_status NOT NULL DEFAULT 'pending',
  currency        char(3) NOT NULL DEFAULT 'BRL',
  amount_gross    numeric(18,4) NOT NULL,
  amount_net      numeric(18,4) NOT NULL DEFAULT 0,
  amount_fee      numeric(18,4) NOT NULL DEFAULT 0,
  amount_captured numeric(18,4) NOT NULL DEFAULT 0,
  amount_refunded numeric(18,4) NOT NULL DEFAULT 0,
  external_id     text,
  idempotency_key text,
  expires_at      timestamptz,
  authorized_at   timestamptz,
  captured_at     timestamptz,
  paid_at         timestamptz,
  failed_at       timestamptz,
  cancelled_at    timestamptz,
  refunded_at     timestamptz,
  closed_at       timestamptz,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id  uuid,
  trace_id        text,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  version         int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_amount_gross_positive  CHECK (amount_gross > 0),
  CONSTRAINT payments_amount_captured_nonneg CHECK (amount_captured >= 0),
  CONSTRAINT payments_amount_refunded_nonneg CHECK (amount_refunded >= 0),
  CONSTRAINT payments_refund_lte_captured    CHECK (amount_refunded <= amount_captured),
  CONSTRAINT payments_captured_lte_gross     CHECK (amount_captured <= amount_gross),
  CONSTRAINT payments_version_nonneg         CHECK (version >= 0),
  CONSTRAINT payments_external_unique        UNIQUE (gateway_id, external_id),
  CONSTRAINT payments_idempotency_unique     UNIQUE (idempotency_key)
);

CREATE INDEX idx_payments_store_status    ON public.payments(store_id, status);
CREATE INDEX idx_payments_payable         ON public.payments(payable_type, payable_id);
CREATE INDEX idx_payments_customer        ON public.payments(customer_id, created_at DESC);
CREATE INDEX idx_payments_correlation     ON public.payments(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_payments_active_partial  ON public.payments(status)
  WHERE status IN ('pending','authorized','partially_captured');
CREATE INDEX idx_payments_created_at_brin ON public.payments USING brin(created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_read_staff_or_owner" ON public.payments FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_permission(auth.uid(), 'payments.read',  store_id)
  OR public.has_permission(auth.uid(), 'payments.audit', store_id)
  OR EXISTS (SELECT 1 FROM public.customers c
             WHERE c.id = payments.customer_id AND c.auth_user_id = auth.uid())
);

CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payments_version_bump BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.payments_bump_version();
CREATE TRIGGER trg_payments_status_guard BEFORE INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.payments_status_transition_guard();
CREATE TRIGGER trg_payments_outbox AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_payments_enqueue_outbox();

-- 5b. payment_store_id helper (now that payments exists)
CREATE OR REPLACE FUNCTION public.payment_store_id(_payment_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM public.payments WHERE id = _payment_id
$$;

-- 6. payment_attempts (append-only)
CREATE TABLE public.payment_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id      uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  store_id        uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  attempt_no      int NOT NULL,
  adapter         text NOT NULL,
  gateway_id      uuid REFERENCES public.payment_gateways(id) ON DELETE SET NULL,
  operation       public.payment_attempt_operation NOT NULL,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  http_status     int,
  gateway_status  text,
  error_code      text,
  error_message   text,
  latency_ms      int,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  retry_of        uuid REFERENCES public.payment_attempts(id) ON DELETE SET NULL,
  idempotency_key text,
  correlation_id  uuid,
  trace_id        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_attempts_no_positive    CHECK (attempt_no >= 1),
  CONSTRAINT payment_attempts_latency_nonneg CHECK (latency_ms IS NULL OR latency_ms >= 0),
  CONSTRAINT payment_attempts_unique_no      UNIQUE (payment_id, attempt_no),
  CONSTRAINT payment_attempts_idem_unique    UNIQUE (idempotency_key)
);

CREATE INDEX idx_payment_attempts_payment    ON public.payment_attempts(payment_id, attempt_no);
CREATE INDEX idx_payment_attempts_adapter    ON public.payment_attempts(adapter, gateway_status);
CREATE INDEX idx_payment_attempts_started    ON public.payment_attempts USING brin(started_at);
CREATE INDEX idx_payment_attempts_correlation ON public.payment_attempts(correlation_id) WHERE correlation_id IS NOT NULL;

GRANT SELECT, INSERT ON public.payment_attempts TO authenticated;
GRANT ALL ON public.payment_attempts TO service_role;

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attempts_read_audit" ON public.payment_attempts FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid())
  OR public.has_permission(auth.uid(), 'payments.audit', store_id));

CREATE TRIGGER trg_payment_attempts_no_update
  BEFORE UPDATE OR DELETE ON public.payment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.payments_append_only_guard();

-- 7. payment_transactions (append-only ledger)
CREATE TABLE public.payment_transactions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id            uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  store_id              uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  kind                  public.payment_transaction_kind NOT NULL,
  direction             public.payment_transaction_direction NOT NULL,
  amount                numeric(18,4) NOT NULL,
  currency              char(3) NOT NULL DEFAULT 'BRL',
  external_id           text,
  gateway_id            uuid REFERENCES public.payment_gateways(id) ON DELETE SET NULL,
  parent_transaction_id uuid REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  attempt_id            uuid REFERENCES public.payment_attempts(id) ON DELETE SET NULL,
  occurred_at           timestamptz NOT NULL DEFAULT now(),
  posted_at             timestamptz,
  settlement_date       date,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id        uuid,
  trace_id              text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_transactions_amount_positive CHECK (amount > 0),
  CONSTRAINT payment_transactions_external_unique UNIQUE (gateway_id, external_id, kind)
);

CREATE INDEX idx_payment_tx_payment       ON public.payment_transactions(payment_id, occurred_at);
CREATE INDEX idx_payment_tx_kind          ON public.payment_transactions(kind);
CREATE INDEX idx_payment_tx_settlement    ON public.payment_transactions(settlement_date) WHERE settlement_date IS NOT NULL;
CREATE INDEX idx_payment_tx_occurred_brin ON public.payment_transactions USING brin(occurred_at);

GRANT SELECT, INSERT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tx_read_staff" ON public.payment_transactions FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid())
  OR public.has_permission(auth.uid(), 'payments.read', store_id)
  OR public.has_permission(auth.uid(), 'payments.audit', store_id));

CREATE TRIGGER trg_payment_tx_no_update
  BEFORE UPDATE OR DELETE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.payments_append_only_guard();

-- 8. payment_events (append-only timeline mirror)
CREATE TABLE public.payment_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id     uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  store_id       uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  event_type     text NOT NULL,
  actor_type     public.payment_event_actor NOT NULL DEFAULT 'system',
  actor_id       uuid,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  correlation_id uuid,
  trace_id       text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_events_payment ON public.payment_events(payment_id, occurred_at DESC);
CREATE INDEX idx_payment_events_type    ON public.payment_events(event_type);

GRANT SELECT, INSERT ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_read_staff_or_owner" ON public.payment_events FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_permission(auth.uid(), 'payments.read',  store_id)
  OR public.has_permission(auth.uid(), 'payments.audit', store_id)
  OR EXISTS (SELECT 1 FROM public.payments p
             JOIN public.customers c ON c.id = p.customer_id
             WHERE p.id = payment_events.payment_id AND c.auth_user_id = auth.uid())
);

CREATE TRIGGER trg_payment_events_no_update
  BEFORE UPDATE OR DELETE ON public.payment_events
  FOR EACH ROW EXECUTE FUNCTION public.payments_append_only_guard();

-- 9. payment_allocations
CREATE TABLE public.payment_allocations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id   uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  store_id     uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  target_type  public.payment_allocation_target NOT NULL,
  target_id    uuid,
  amount       numeric(18,4) NOT NULL,
  currency     char(3) NOT NULL DEFAULT 'BRL',
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_allocations_amount_positive CHECK (amount > 0)
);

CREATE INDEX idx_payment_alloc_payment ON public.payment_allocations(payment_id);
CREATE INDEX idx_payment_alloc_target  ON public.payment_allocations(target_type, target_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_allocations TO authenticated;
GRANT ALL ON public.payment_allocations TO service_role;

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alloc_read_staff" ON public.payment_allocations FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid())
  OR public.has_permission(auth.uid(), 'payments.read', store_id)
  OR public.has_permission(auth.uid(), 'payments.audit', store_id));

CREATE TRIGGER trg_payment_alloc_updated_at BEFORE UPDATE ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 10. payment_metadata
CREATE TABLE public.payment_metadata (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id  uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  store_id    uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  namespace   text NOT NULL,
  key         text NOT NULL,
  value       jsonb NOT NULL,
  is_pii      boolean NOT NULL DEFAULT false,
  is_secret   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_metadata_unique UNIQUE (payment_id, namespace, key)
);

CREATE INDEX idx_payment_metadata_payment ON public.payment_metadata(payment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_metadata TO authenticated;
GRANT ALL ON public.payment_metadata TO service_role;

ALTER TABLE public.payment_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metadata_read_scoped" ON public.payment_metadata FOR SELECT TO authenticated
USING (
  (NOT is_pii AND NOT is_secret AND (
      public.is_super_admin(auth.uid())
      OR public.has_permission(auth.uid(), 'payments.read', store_id)
      OR public.has_permission(auth.uid(), 'payments.audit', store_id)))
  OR ((is_pii OR is_secret) AND (
      public.is_super_admin(auth.uid())
      OR public.has_permission(auth.uid(), 'payments.audit', store_id)))
);

CREATE TRIGGER trg_payment_metadata_updated_at BEFORE UPDATE ON public.payment_metadata
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
