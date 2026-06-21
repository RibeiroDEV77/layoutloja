
-- =====================================================================
-- PAYMENT ENGINE — MIGRATION 2/3
-- Refunds, Chargebacks, Reconciliation, Documents & Notes
-- =====================================================================

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
CREATE TYPE public.payment_refund_status AS ENUM (
  'pending','processing','succeeded','failed','cancelled'
);

CREATE TYPE public.payment_refund_reason AS ENUM (
  'customer_request','duplicate','fraudulent','order_cancelled',
  'product_unavailable','return','chargeback','other'
);

CREATE TYPE public.payment_chargeback_status AS ENUM (
  'opened','under_review','evidence_required','evidence_submitted',
  'won','lost','accepted','cancelled'
);

CREATE TYPE public.payment_chargeback_reason AS ENUM (
  'fraudulent','product_not_received','product_unacceptable',
  'duplicate','credit_not_processed','subscription_cancelled',
  'general','other'
);

CREATE TYPE public.payment_reconciliation_status AS ENUM (
  'pending','processing','completed','failed','partially_matched'
);

CREATE TYPE public.payment_reconciliation_item_status AS ENUM (
  'unmatched','matched','discrepant','ignored'
);

CREATE TYPE public.payment_reconciliation_discrepancy_kind AS ENUM (
  'amount_mismatch','status_mismatch','fee_mismatch',
  'missing_in_psp','missing_in_platform','duplicate','other'
);

CREATE TYPE public.payment_document_kind AS ENUM (
  'receipt','invoice','credit_note','authorization_proof',
  'chargeback_evidence','refund_proof','other'
);

CREATE TYPE public.payment_document_status AS ENUM (
  'draft','issued','sent','archived','void'
);

CREATE TYPE public.payment_note_visibility AS ENUM (
  'internal','staff','customer'
);

-- =====================================================================
-- TABLE: payment_refunds
-- =====================================================================
CREATE TABLE public.payment_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  gateway_id uuid REFERENCES public.payment_gateways(id),
  status public.payment_refund_status NOT NULL DEFAULT 'pending',
  reason public.payment_refund_reason NOT NULL DEFAULT 'customer_request',
  reason_note text,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  gateway_refund_id text,
  external_reference text,
  requested_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  processed_at timestamptz,
  failure_code text,
  failure_message text,
  trace_id uuid,
  correlation_id uuid,
  causation_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_refunds_payment ON public.payment_refunds(payment_id);
CREATE INDEX idx_payment_refunds_store_status ON public.payment_refunds(store_id, status);
CREATE INDEX idx_payment_refunds_gateway_ref ON public.payment_refunds(gateway_refund_id) WHERE gateway_refund_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_refunds TO authenticated;
GRANT ALL ON public.payment_refunds TO service_role;
ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_refunds_select" ON public.payment_refunds FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'payments.read',store_id));

-- =====================================================================
-- TABLE: payment_refund_items (append-only)
-- =====================================================================
CREATE TABLE public.payment_refund_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id uuid NOT NULL REFERENCES public.payment_refunds(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  allocation_id uuid REFERENCES public.payment_allocations(id),
  transaction_id uuid REFERENCES public.payment_transactions(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_refund_items_refund ON public.payment_refund_items(refund_id);

GRANT SELECT, INSERT ON public.payment_refund_items TO authenticated;
GRANT ALL ON public.payment_refund_items TO service_role;
ALTER TABLE public.payment_refund_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_refund_items_select" ON public.payment_refund_items FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'payments.read',store_id));

-- =====================================================================
-- TABLE: payment_chargebacks
-- =====================================================================
CREATE TABLE public.payment_chargebacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  gateway_id uuid REFERENCES public.payment_gateways(id),
  status public.payment_chargeback_status NOT NULL DEFAULT 'opened',
  reason public.payment_chargeback_reason NOT NULL DEFAULT 'general',
  reason_note text,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  gateway_dispute_id text,
  network_reference text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  evidence_due_at timestamptz,
  evidence_submitted_at timestamptz,
  resolved_at timestamptz,
  outcome_note text,
  liable_party text,
  fee_amount numeric(14,2) NOT NULL DEFAULT 0,
  trace_id uuid,
  correlation_id uuid,
  causation_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_chargebacks_payment ON public.payment_chargebacks(payment_id);
CREATE INDEX idx_payment_chargebacks_store_status ON public.payment_chargebacks(store_id, status);
CREATE INDEX idx_payment_chargebacks_due ON public.payment_chargebacks(evidence_due_at) WHERE evidence_due_at IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_chargebacks TO authenticated;
GRANT ALL ON public.payment_chargebacks TO service_role;
ALTER TABLE public.payment_chargebacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_chargebacks_select" ON public.payment_chargebacks FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'payments.read',store_id));

-- =====================================================================
-- TABLE: payment_chargeback_evidences (append-only)
-- =====================================================================
CREATE TABLE public.payment_chargeback_evidences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chargeback_id uuid NOT NULL REFERENCES public.payment_chargebacks(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  evidence_kind text NOT NULL,
  asset_id uuid REFERENCES public.assets(id),
  description text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  submitted_by uuid REFERENCES auth.users(id),
  gateway_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_cb_evidences_cb ON public.payment_chargeback_evidences(chargeback_id);

GRANT SELECT, INSERT ON public.payment_chargeback_evidences TO authenticated;
GRANT ALL ON public.payment_chargeback_evidences TO service_role;
ALTER TABLE public.payment_chargeback_evidences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_cb_evidences_select" ON public.payment_chargeback_evidences FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid())
         OR public.has_permission(auth.uid(),'payments.audit',store_id)
         OR public.has_permission(auth.uid(),'payments.chargeback',store_id));

-- =====================================================================
-- TABLE: payment_reconciliations
-- =====================================================================
CREATE TABLE public.payment_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  gateway_id uuid NOT NULL REFERENCES public.payment_gateways(id),
  status public.payment_reconciliation_status NOT NULL DEFAULT 'pending',
  reference text NOT NULL,
  period_start timestamptz,
  period_end timestamptz,
  source_file_asset_id uuid REFERENCES public.assets(id),
  external_batch_id text,
  total_items integer NOT NULL DEFAULT 0,
  matched_items integer NOT NULL DEFAULT 0,
  discrepant_items integer NOT NULL DEFAULT 0,
  unmatched_items integer NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_fees numeric(14,2) NOT NULL DEFAULT 0,
  net_amount numeric(14,2) NOT NULL DEFAULT 0,
  processed_at timestamptz,
  failure_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_recon_store_status ON public.payment_reconciliations(store_id, status);
CREATE INDEX idx_payment_recon_gateway ON public.payment_reconciliations(gateway_id);
CREATE UNIQUE INDEX uq_payment_recon_ref ON public.payment_reconciliations(store_id, gateway_id, reference);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_reconciliations TO authenticated;
GRANT ALL ON public.payment_reconciliations TO service_role;
ALTER TABLE public.payment_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_recon_select" ON public.payment_reconciliations FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid())
         OR public.has_permission(auth.uid(),'payments.reconcile',store_id)
         OR public.has_permission(auth.uid(),'payments.read',store_id));

-- =====================================================================
-- TABLE: payment_reconciliation_items (append-only)
-- =====================================================================
CREATE TABLE public.payment_reconciliation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id uuid NOT NULL REFERENCES public.payment_reconciliations(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.payments(id),
  external_transaction_id text,
  amount numeric(14,2) NOT NULL,
  fee_amount numeric(14,2) NOT NULL DEFAULT 0,
  net_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL,
  posted_at timestamptz,
  status public.payment_reconciliation_item_status NOT NULL DEFAULT 'unmatched',
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  matched_at timestamptz,
  matched_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_recon_items_recon ON public.payment_reconciliation_items(reconciliation_id);
CREATE INDEX idx_payment_recon_items_payment ON public.payment_reconciliation_items(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX idx_payment_recon_items_status ON public.payment_reconciliation_items(reconciliation_id, status);

GRANT SELECT, INSERT ON public.payment_reconciliation_items TO authenticated;
GRANT ALL ON public.payment_reconciliation_items TO service_role;
ALTER TABLE public.payment_reconciliation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_recon_items_select" ON public.payment_reconciliation_items FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid())
         OR public.has_permission(auth.uid(),'payments.reconcile',store_id)
         OR public.has_permission(auth.uid(),'payments.audit',store_id));

-- =====================================================================
-- TABLE: payment_reconciliation_discrepancies (append-only)
-- =====================================================================
CREATE TABLE public.payment_reconciliation_discrepancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id uuid NOT NULL REFERENCES public.payment_reconciliations(id) ON DELETE CASCADE,
  reconciliation_item_id uuid REFERENCES public.payment_reconciliation_items(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.payments(id),
  kind public.payment_reconciliation_discrepancy_kind NOT NULL,
  expected_amount numeric(14,2),
  actual_amount numeric(14,2),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_recon_disc_recon ON public.payment_reconciliation_discrepancies(reconciliation_id);
CREATE INDEX idx_payment_recon_disc_payment ON public.payment_reconciliation_discrepancies(payment_id) WHERE payment_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.payment_reconciliation_discrepancies TO authenticated;
GRANT ALL ON public.payment_reconciliation_discrepancies TO service_role;
ALTER TABLE public.payment_reconciliation_discrepancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_recon_disc_select" ON public.payment_reconciliation_discrepancies FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid())
         OR public.has_permission(auth.uid(),'payments.reconcile',store_id)
         OR public.has_permission(auth.uid(),'payments.audit',store_id));

-- =====================================================================
-- TABLE: payment_documents
-- =====================================================================
CREATE TABLE public.payment_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  kind public.payment_document_kind NOT NULL,
  status public.payment_document_status NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  description text,
  asset_id uuid REFERENCES public.assets(id),
  external_url text,
  issued_at timestamptz,
  issued_by uuid REFERENCES auth.users(id),
  sent_to text,
  sent_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_docs_payment ON public.payment_documents(payment_id);
CREATE INDEX idx_payment_docs_store_kind ON public.payment_documents(store_id, kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_documents TO authenticated;
GRANT ALL ON public.payment_documents TO service_role;
ALTER TABLE public.payment_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_docs_select" ON public.payment_documents FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'payments.read',store_id));
CREATE POLICY "payment_docs_insert" ON public.payment_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'payments.create',store_id));
CREATE POLICY "payment_docs_update" ON public.payment_documents FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'payments.create',store_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'payments.create',store_id));
CREATE POLICY "payment_docs_delete" ON public.payment_documents FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'payments.audit',store_id));

-- =====================================================================
-- TABLE: payment_notes
-- =====================================================================
CREATE TABLE public.payment_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users(id),
  visibility public.payment_note_visibility NOT NULL DEFAULT 'internal',
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_notes_payment ON public.payment_notes(payment_id);
CREATE INDEX idx_payment_notes_store_visibility ON public.payment_notes(store_id, visibility);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_notes TO authenticated;
GRANT ALL ON public.payment_notes TO service_role;
ALTER TABLE public.payment_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_notes_select" ON public.payment_notes FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (visibility = 'internal' AND public.has_permission(auth.uid(),'payments.audit',store_id))
    OR (visibility = 'staff' AND public.has_permission(auth.uid(),'payments.read',store_id))
    OR (visibility = 'customer' AND public.has_permission(auth.uid(),'payments.read',store_id))
  );
CREATE POLICY "payment_notes_insert" ON public.payment_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'payments.create',store_id));
CREATE POLICY "payment_notes_update" ON public.payment_notes FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR author_user_id = auth.uid() OR public.has_permission(auth.uid(),'payments.audit',store_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR author_user_id = auth.uid() OR public.has_permission(auth.uid(),'payments.audit',store_id));
CREATE POLICY "payment_notes_delete" ON public.payment_notes FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'payments.audit',store_id));

-- =====================================================================
-- TRIGGERS — updated_at
-- =====================================================================
CREATE TRIGGER trg_payment_refunds_updated BEFORE UPDATE ON public.payment_refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payment_chargebacks_updated BEFORE UPDATE ON public.payment_chargebacks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payment_reconciliations_updated BEFORE UPDATE ON public.payment_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payment_documents_updated BEFORE UPDATE ON public.payment_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payment_notes_updated BEFORE UPDATE ON public.payment_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- TRIGGERS — append-only guards
-- =====================================================================
CREATE OR REPLACE FUNCTION public.payments_phase2_append_only_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only', TG_TABLE_NAME;
END $$;

CREATE TRIGGER trg_payment_refund_items_append_only
  BEFORE UPDATE OR DELETE ON public.payment_refund_items
  FOR EACH ROW EXECUTE FUNCTION public.payments_phase2_append_only_guard();

CREATE TRIGGER trg_payment_cb_evidences_append_only
  BEFORE UPDATE OR DELETE ON public.payment_chargeback_evidences
  FOR EACH ROW EXECUTE FUNCTION public.payments_phase2_append_only_guard();

CREATE TRIGGER trg_payment_recon_items_append_only
  BEFORE UPDATE OR DELETE ON public.payment_reconciliation_items
  FOR EACH ROW EXECUTE FUNCTION public.payments_phase2_append_only_guard();

-- discrepancies: permite UPDATE só de campos de resolução
CREATE OR REPLACE FUNCTION public.payment_recon_disc_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'payment_reconciliation_discrepancies is delete-protected';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.reconciliation_id <> OLD.reconciliation_id
       OR NEW.store_id <> OLD.store_id
       OR NEW.kind <> OLD.kind
       OR COALESCE(NEW.expected_amount,-1) <> COALESCE(OLD.expected_amount,-1)
       OR COALESCE(NEW.actual_amount,-1) <> COALESCE(OLD.actual_amount,-1)
       OR NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'Only resolution fields can be updated in discrepancies';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_payment_recon_disc_guard
  BEFORE UPDATE OR DELETE ON public.payment_reconciliation_discrepancies
  FOR EACH ROW EXECUTE FUNCTION public.payment_recon_disc_guard();

-- =====================================================================
-- TRIGGERS — status transition guards
-- =====================================================================
CREATE OR REPLACE FUNCTION public.payment_refunds_transition_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_ok boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('pending','processing') THEN
      RAISE EXCEPTION 'Refund must start in pending or processing (got %)', NEW.status;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  v_ok := (OLD.status='pending'    AND NEW.status IN ('processing','failed','cancelled'))
       OR (OLD.status='processing' AND NEW.status IN ('succeeded','failed','cancelled'));
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Invalid refund transition % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_payment_refunds_transition
  BEFORE INSERT OR UPDATE ON public.payment_refunds
  FOR EACH ROW EXECUTE FUNCTION public.payment_refunds_transition_guard();

CREATE OR REPLACE FUNCTION public.payment_chargebacks_transition_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_ok boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('opened','under_review') THEN
      RAISE EXCEPTION 'Chargeback must start in opened or under_review (got %)', NEW.status;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  v_ok := (OLD.status='opened'             AND NEW.status IN ('under_review','evidence_required','accepted','cancelled'))
       OR (OLD.status='under_review'       AND NEW.status IN ('evidence_required','won','lost','accepted','cancelled'))
       OR (OLD.status='evidence_required'  AND NEW.status IN ('evidence_submitted','accepted','cancelled','lost'))
       OR (OLD.status='evidence_submitted' AND NEW.status IN ('under_review','won','lost'));
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Invalid chargeback transition % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_payment_chargebacks_transition
  BEFORE INSERT OR UPDATE ON public.payment_chargebacks
  FOR EACH ROW EXECUTE FUNCTION public.payment_chargebacks_transition_guard();

-- =====================================================================
-- TRIGGERS — version bump
-- =====================================================================
CREATE OR REPLACE FUNCTION public.payments_phase2_bump_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN NEW.version := OLD.version + 1; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_payment_refunds_version
  BEFORE UPDATE ON public.payment_refunds
  FOR EACH ROW EXECUTE FUNCTION public.payments_phase2_bump_version();

CREATE TRIGGER trg_payment_chargebacks_version
  BEFORE UPDATE ON public.payment_chargebacks
  FOR EACH ROW EXECUTE FUNCTION public.payments_phase2_bump_version();

-- =====================================================================
-- TRIGGER — atualiza payments.amount_refunded ao concluir refund
-- =====================================================================
CREATE OR REPLACE FUNCTION public.payments_apply_refund_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'succeeded' AND OLD.status <> 'succeeded' THEN
    UPDATE public.payments
      SET amount_refunded = COALESCE(amount_refunded,0) + NEW.amount
      WHERE id = NEW.payment_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_payments_apply_refund_total
  AFTER UPDATE ON public.payment_refunds
  FOR EACH ROW EXECUTE FUNCTION public.payments_apply_refund_total();

-- =====================================================================
-- TRIGGERS — outbox emission
-- =====================================================================
CREATE OR REPLACE FUNCTION public.tg_payment_refunds_enqueue_outbox()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event text; v_payload jsonb; v_meta jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'payment.refund.created';
    v_payload := jsonb_build_object(
      'refund_id', NEW.id, 'payment_id', NEW.payment_id,
      'amount', NEW.amount, 'currency', NEW.currency,
      'status', NEW.status, 'reason', NEW.reason
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_event := 'payment.refund.' || NEW.status::text;
    v_payload := jsonb_build_object(
      'refund_id', NEW.id, 'payment_id', NEW.payment_id,
      'from', OLD.status, 'to', NEW.status,
      'amount', NEW.amount, 'version', NEW.version
    );
  ELSE
    RETURN NEW;
  END IF;
  v_meta := jsonb_build_object(
    'trace_id', NEW.trace_id, 'correlation_id', NEW.correlation_id,
    'causation_id', NEW.causation_id, 'schema_version', 1
  );
  PERFORM public.enqueue_outbox_event(
    NEW.store_id, 'payment_refund', NEW.id, v_event, v_payload, v_meta,
    NEW.correlation_id, NEW.causation_id, true
  );
  RETURN NEW;
END $$;

CREATE TRIGGER trg_payment_refunds_outbox
  AFTER INSERT OR UPDATE ON public.payment_refunds
  FOR EACH ROW EXECUTE FUNCTION public.tg_payment_refunds_enqueue_outbox();

CREATE OR REPLACE FUNCTION public.tg_payment_chargebacks_enqueue_outbox()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event text; v_payload jsonb; v_meta jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'payment.chargeback.opened';
    v_payload := jsonb_build_object(
      'chargeback_id', NEW.id, 'payment_id', NEW.payment_id,
      'amount', NEW.amount, 'currency', NEW.currency,
      'status', NEW.status, 'reason', NEW.reason,
      'evidence_due_at', NEW.evidence_due_at
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_event := 'payment.chargeback.' || NEW.status::text;
    v_payload := jsonb_build_object(
      'chargeback_id', NEW.id, 'payment_id', NEW.payment_id,
      'from', OLD.status, 'to', NEW.status, 'version', NEW.version
    );
  ELSE
    RETURN NEW;
  END IF;
  v_meta := jsonb_build_object(
    'trace_id', NEW.trace_id, 'correlation_id', NEW.correlation_id,
    'causation_id', NEW.causation_id, 'schema_version', 1
  );
  PERFORM public.enqueue_outbox_event(
    NEW.store_id, 'payment_chargeback', NEW.id, v_event, v_payload, v_meta,
    NEW.correlation_id, NEW.causation_id, true
  );
  RETURN NEW;
END $$;

CREATE TRIGGER trg_payment_chargebacks_outbox
  AFTER INSERT OR UPDATE ON public.payment_chargebacks
  FOR EACH ROW EXECUTE FUNCTION public.tg_payment_chargebacks_enqueue_outbox();

CREATE OR REPLACE FUNCTION public.tg_payment_reconciliations_enqueue_outbox()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event text; v_payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'payment.reconciliation.created';
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_event := 'payment.reconciliation.' || NEW.status::text;
  ELSE
    RETURN NEW;
  END IF;
  v_payload := jsonb_build_object(
    'reconciliation_id', NEW.id, 'gateway_id', NEW.gateway_id,
    'status', NEW.status, 'reference', NEW.reference,
    'total_items', NEW.total_items, 'matched_items', NEW.matched_items,
    'discrepant_items', NEW.discrepant_items, 'unmatched_items', NEW.unmatched_items
  );
  PERFORM public.enqueue_outbox_event(
    NEW.store_id, 'payment_reconciliation', NEW.id, v_event, v_payload,
    jsonb_build_object('schema_version', 1), NULL, NULL, true
  );
  RETURN NEW;
END $$;

CREATE TRIGGER trg_payment_reconciliations_outbox
  AFTER INSERT OR UPDATE ON public.payment_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.tg_payment_reconciliations_enqueue_outbox();
