
-- =========================================================
-- FASE 5.6 — Migration 3/4 — Customer Support & SLA
-- =========================================================

DO $$ BEGIN
  CREATE TYPE public.support_ticket_status AS ENUM (
    'open','pending_customer','pending_internal','on_hold','resolved','closed','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_ticket_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_ticket_source AS ENUM (
    'portal','email','whatsapp','phone','chat','api','internal'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_message_visibility AS ENUM ('public','internal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_message_author_type AS ENUM ('customer','agent','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_sla_state AS ENUM ('on_track','at_risk','breached','paused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ========== support_ticket_categories ==========
CREATE TABLE public.support_ticket_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  code        text NOT NULL,
  name        text NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_categories_unique UNIQUE (store_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_ticket_categories TO authenticated;
GRANT ALL ON public.support_ticket_categories TO service_role;
ALTER TABLE public.support_ticket_categories ENABLE ROW LEVEL SECURITY;

-- ========== support_sla_policies ==========
CREATE TABLE public.support_sla_policies (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                 uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  name                     text NOT NULL,
  description              text,
  match_priority           public.support_ticket_priority,
  match_source             public.support_ticket_source,
  match_category_id        uuid REFERENCES public.support_ticket_categories(id) ON DELETE SET NULL,
  first_response_minutes   integer NOT NULL,
  resolution_minutes       integer NOT NULL,
  at_risk_threshold_pct    integer NOT NULL DEFAULT 80,
  pause_on_pending_customer boolean NOT NULL DEFAULT true,
  business_hours_only      boolean NOT NULL DEFAULT false,
  priority                 integer NOT NULL DEFAULT 100,
  is_active                boolean NOT NULL DEFAULT true,
  created_by               uuid REFERENCES auth.users(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_sla_policies TO authenticated;
GRANT ALL ON public.support_sla_policies TO service_role;
ALTER TABLE public.support_sla_policies ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sla_lookup
  ON public.support_sla_policies(store_id, priority)
  WHERE is_active = true;

-- ========== support_tickets (AGGREGATE ROOT) ==========
CREATE TABLE public.support_tickets (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  ticket_number           bigserial NOT NULL,
  customer_id             uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id                uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  category_id             uuid REFERENCES public.support_ticket_categories(id) ON DELETE SET NULL,
  subject                 text NOT NULL,
  description             text,
  priority                public.support_ticket_priority NOT NULL DEFAULT 'normal',
  source                  public.support_ticket_source NOT NULL DEFAULT 'portal',
  status                  public.support_ticket_status NOT NULL DEFAULT 'open',
  assigned_to_user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at             timestamptz,
  team                    text,
  sla_policy_id           uuid REFERENCES public.support_sla_policies(id) ON DELETE SET NULL,
  sla_state               public.support_sla_state NOT NULL DEFAULT 'on_track',
  first_response_due_at   timestamptz,
  resolution_due_at       timestamptz,
  first_responded_at      timestamptz,
  resolved_at             timestamptz,
  closed_at               timestamptz,
  reopened_at             timestamptz,
  escalation_level        integer NOT NULL DEFAULT 0,
  escalated_at            timestamptz,
  satisfaction_score      integer CHECK (satisfaction_score BETWEEN 1 AND 5),
  satisfaction_feedback   text,
  idempotency_key         text,
  version                 integer NOT NULL DEFAULT 1,
  created_by_user_id      uuid REFERENCES auth.users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_tickets_idempotency_unique UNIQUE (store_id, idempotency_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_support_tickets_customer ON public.support_tickets(customer_id, created_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_support_tickets_order    ON public.support_tickets(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_support_tickets_assignee ON public.support_tickets(assigned_to_user_id) WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX idx_support_tickets_open     ON public.support_tickets(status, first_response_due_at)
  WHERE status IN ('open','pending_internal','on_hold','pending_customer');
CREATE INDEX idx_support_tickets_sla_state ON public.support_tickets(sla_state)
  WHERE status IN ('open','pending_internal','on_hold','pending_customer');

-- ========== support_ticket_messages (APPEND-ONLY) ==========
CREATE TABLE public.support_ticket_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id           uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_type         public.support_message_author_type NOT NULL,
  author_user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_customer_id  uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  visibility          public.support_message_visibility NOT NULL DEFAULT 'public',
  body                text NOT NULL,
  body_format         text NOT NULL DEFAULT 'text',
  attachments_count   integer NOT NULL DEFAULT 0,
  source              public.support_ticket_source,
  idempotency_key     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_messages_idempotency_unique UNIQUE (ticket_id, idempotency_key)
);
GRANT SELECT, INSERT ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_support_messages_ticket ON public.support_ticket_messages(ticket_id, created_at);
CREATE INDEX idx_support_messages_public ON public.support_ticket_messages(ticket_id, created_at)
  WHERE visibility = 'public';

-- ========== support_ticket_message_attachments ==========
CREATE TABLE public.support_ticket_message_attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      uuid NOT NULL REFERENCES public.support_ticket_messages(id) ON DELETE CASCADE,
  asset_id        uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  filename        text NOT NULL,
  mime_type       text,
  size_bytes      bigint,
  storage_url     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.support_ticket_message_attachments TO authenticated;
GRANT ALL ON public.support_ticket_message_attachments TO service_role;
ALTER TABLE public.support_ticket_message_attachments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_support_attachments_message ON public.support_ticket_message_attachments(message_id);

-- ========== support_ticket_events (APPEND-ONLY) ==========
CREATE TABLE public.support_ticket_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  actor_user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  payload     jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_ticket_events TO authenticated;
GRANT ALL ON public.support_ticket_events TO service_role;
ALTER TABLE public.support_ticket_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_support_events_ticket ON public.support_ticket_events(ticket_id, occurred_at);

-- ========== support_ticket_assignments (HISTORY) ==========
CREATE TABLE public.support_ticket_assignments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id           uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  team                text,
  assigned_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at         timestamptz NOT NULL DEFAULT now(),
  unassigned_at       timestamptz,
  reason              text
);
GRANT SELECT, INSERT, UPDATE ON public.support_ticket_assignments TO authenticated;
GRANT ALL ON public.support_ticket_assignments TO service_role;
ALTER TABLE public.support_ticket_assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_support_assignments_ticket ON public.support_ticket_assignments(ticket_id, assigned_at DESC);
CREATE UNIQUE INDEX idx_support_assignments_current
  ON public.support_ticket_assignments(ticket_id)
  WHERE unassigned_at IS NULL;

-- ========== support_ticket_watchers ==========
CREATE TABLE public.support_ticket_watchers (
  ticket_id  uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.support_ticket_watchers TO authenticated;
GRANT ALL ON public.support_ticket_watchers TO service_role;
ALTER TABLE public.support_ticket_watchers ENABLE ROW LEVEL SECURITY;

-- ========== TRIGGERS updated_at ==========
CREATE TRIGGER trg_support_cat_updated BEFORE UPDATE ON public.support_ticket_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_support_sla_updated BEFORE UPDATE ON public.support_sla_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_support_tickets_updated BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== APPEND-ONLY GUARDS ==========
CREATE OR REPLACE FUNCTION public._prevent_support_message_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'support_ticket_messages is append-only';
END;$$;

CREATE TRIGGER trg_support_messages_no_update
  BEFORE UPDATE ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public._prevent_support_message_mutation();

CREATE OR REPLACE FUNCTION public._prevent_support_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'support_ticket_events is append-only';
END;$$;

CREATE TRIGGER trg_support_events_no_update
  BEFORE UPDATE ON public.support_ticket_events
  FOR EACH ROW EXECUTE FUNCTION public._prevent_support_event_mutation();

-- ========== SLA HELPERS ==========
CREATE OR REPLACE FUNCTION public._resolve_support_sla_policy(
  p_store_id uuid,
  p_priority public.support_ticket_priority,
  p_source   public.support_ticket_source,
  p_category_id uuid
)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.support_sla_policies
   WHERE is_active = true
     AND (store_id IS NULL OR store_id = p_store_id)
     AND (match_priority IS NULL OR match_priority = p_priority)
     AND (match_source IS NULL OR match_source = p_source)
     AND (match_category_id IS NULL OR match_category_id = p_category_id)
   ORDER BY
     (match_priority IS NOT NULL)::int +
     (match_source IS NOT NULL)::int +
     (match_category_id IS NOT NULL)::int DESC,
     priority ASC
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public._apply_support_sla_dates(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_t public.support_tickets;
  v_p public.support_sla_policies;
BEGIN
  SELECT * INTO v_t FROM public.support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND OR v_t.sla_policy_id IS NULL THEN RETURN; END IF;
  SELECT * INTO v_p FROM public.support_sla_policies WHERE id = v_t.sla_policy_id;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.support_tickets
     SET first_response_due_at = COALESCE(first_response_due_at, created_at + make_interval(mins => v_p.first_response_minutes)),
         resolution_due_at     = COALESCE(resolution_due_at,     created_at + make_interval(mins => v_p.resolution_minutes))
   WHERE id = p_ticket_id;
END;$$;

CREATE OR REPLACE FUNCTION public.support_recompute_sla_states()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count int := 0;
BEGIN
  WITH upd AS (
    UPDATE public.support_tickets t
       SET sla_state = CASE
             WHEN t.status = 'pending_customer'
                  AND COALESCE((SELECT pause_on_pending_customer FROM public.support_sla_policies WHERE id = t.sla_policy_id), true)
                  THEN 'paused'::public.support_sla_state
             WHEN t.resolution_due_at IS NOT NULL AND now() > t.resolution_due_at THEN 'breached'
             WHEN t.first_response_due_at IS NOT NULL AND t.first_responded_at IS NULL AND now() > t.first_response_due_at THEN 'breached'
             WHEN t.resolution_due_at IS NOT NULL
                  AND now() > t.created_at + (t.resolution_due_at - t.created_at) *
                              (COALESCE((SELECT at_risk_threshold_pct FROM public.support_sla_policies WHERE id = t.sla_policy_id), 80)::numeric / 100)
                  THEN 'at_risk'
             ELSE 'on_track'
           END,
           version = version + 1,
           updated_at = now()
     WHERE t.status IN ('open','pending_internal','on_hold','pending_customer')
     RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;$$;
GRANT EXECUTE ON FUNCTION public.support_recompute_sla_states() TO service_role;

-- ========== RPC: support_ticket_create ==========
CREATE OR REPLACE FUNCTION public.support_ticket_create(
  p_store_id    uuid,
  p_subject     text,
  p_description text,
  p_customer_id uuid DEFAULT NULL,
  p_order_id    uuid DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_priority    public.support_ticket_priority DEFAULT 'normal',
  p_source      public.support_ticket_source DEFAULT 'portal',
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_id uuid;
  v_policy uuid;
  v_caller uuid := auth.uid();
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.support_tickets
     WHERE store_id IS NOT DISTINCT FROM p_store_id AND idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  END IF;

  -- Customer self-service path: ensure ownership when caller is a customer
  IF p_customer_id IS NOT NULL
     AND NOT public._is_customer_owner(p_customer_id)
     AND NOT public.is_super_admin(v_caller)
     AND NOT public.has_permission(v_caller, 'support.manage_tickets', NULL) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_policy := public._resolve_support_sla_policy(p_store_id, p_priority, p_source, p_category_id);

  INSERT INTO public.support_tickets (
    store_id, customer_id, order_id, category_id, subject, description,
    priority, source, status, sla_policy_id, idempotency_key, created_by_user_id
  ) VALUES (
    p_store_id, p_customer_id, p_order_id, p_category_id, p_subject, p_description,
    p_priority, p_source, 'open', v_policy, p_idempotency_key, v_caller
  ) RETURNING id INTO v_id;

  PERFORM public._apply_support_sla_dates(v_id);

  INSERT INTO public.support_ticket_events(ticket_id, event_type, actor_user_id, actor_customer_id, payload)
  VALUES (v_id, 'ticket.created', v_caller, p_customer_id,
          jsonb_build_object('priority', p_priority, 'source', p_source));

  RETURN v_id;
END;$$;
GRANT EXECUTE ON FUNCTION public.support_ticket_create(uuid,text,text,uuid,uuid,uuid,public.support_ticket_priority,public.support_ticket_source,text) TO authenticated, service_role;

-- ========== RPC: support_ticket_add_message ==========
CREATE OR REPLACE FUNCTION public.support_ticket_add_message(
  p_ticket_id uuid,
  p_body      text,
  p_visibility public.support_message_visibility DEFAULT 'public',
  p_author_type public.support_message_author_type DEFAULT 'agent',
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_t public.support_tickets;
  v_caller uuid := auth.uid();
  v_msg_id uuid;
  v_customer_id uuid;
  v_existing uuid;
  v_is_staff boolean;
BEGIN
  SELECT * INTO v_t FROM public.support_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.support_ticket_messages
     WHERE ticket_id = p_ticket_id AND idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  END IF;

  v_is_staff := public.is_super_admin(v_caller)
             OR public.has_permission(v_caller, 'support.manage_tickets', NULL)
             OR public.has_permission(v_caller, 'support.view_all', NULL);

  -- Customer can only post public messages on own tickets
  IF p_author_type = 'customer' THEN
    IF v_t.customer_id IS NULL OR NOT public._is_customer_owner(v_t.customer_id) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    IF p_visibility <> 'public' THEN
      RAISE EXCEPTION 'customer_cannot_post_internal_notes';
    END IF;
    IF v_t.status IN ('closed','cancelled') THEN
      RAISE EXCEPTION 'ticket_not_open_for_replies';
    END IF;
    v_customer_id := v_t.customer_id;
  ELSIF p_author_type = 'agent' THEN
    IF NOT v_is_staff THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF p_visibility = 'internal'
       AND NOT public.has_permission(v_caller, 'support.add_internal_notes', NULL)
       AND NOT public.is_super_admin(v_caller) THEN
      RAISE EXCEPTION 'forbidden_internal_note';
    END IF;
  END IF;

  INSERT INTO public.support_ticket_messages (
    ticket_id, author_type, author_user_id, author_customer_id,
    visibility, body, idempotency_key, source
  ) VALUES (
    p_ticket_id, p_author_type,
    CASE WHEN p_author_type IN ('agent','system') THEN v_caller END,
    v_customer_id,
    p_visibility, p_body, p_idempotency_key, v_t.source
  ) RETURNING id INTO v_msg_id;

  -- First agent public reply sets first_responded_at
  IF p_author_type = 'agent' AND p_visibility = 'public' AND v_t.first_responded_at IS NULL THEN
    UPDATE public.support_tickets
       SET first_responded_at = now(),
           status = CASE WHEN status = 'open' THEN 'pending_customer' ELSE status END,
           version = version + 1
     WHERE id = p_ticket_id;
  ELSIF p_author_type = 'customer' THEN
    UPDATE public.support_tickets
       SET status = CASE WHEN status IN ('pending_customer','resolved') THEN 'open' ELSE status END,
           reopened_at = CASE WHEN status = 'resolved' THEN now() ELSE reopened_at END,
           version = version + 1
     WHERE id = p_ticket_id;
  END IF;

  INSERT INTO public.support_ticket_events(ticket_id, event_type, actor_user_id, actor_customer_id, payload)
  VALUES (p_ticket_id, 'message.added', CASE WHEN p_author_type IN ('agent','system') THEN v_caller END,
          v_customer_id,
          jsonb_build_object('message_id', v_msg_id, 'visibility', p_visibility, 'author_type', p_author_type));

  RETURN v_msg_id;
END;$$;
GRANT EXECUTE ON FUNCTION public.support_ticket_add_message(uuid,text,public.support_message_visibility,public.support_message_author_type,text) TO authenticated, service_role;

-- ========== RPC: support_ticket_change_status ==========
CREATE OR REPLACE FUNCTION public.support_ticket_change_status(
  p_ticket_id uuid,
  p_new_status public.support_ticket_status,
  p_reason text DEFAULT NULL,
  p_version integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_old public.support_ticket_status;
  v_cur_version integer;
BEGIN
  IF NOT (public.is_super_admin(v_caller)
       OR public.has_permission(v_caller, 'support.manage_tickets', NULL)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT status, version INTO v_old, v_cur_version
    FROM public.support_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found'; END IF;
  IF p_version IS NOT NULL AND p_version <> v_cur_version THEN
    RAISE EXCEPTION 'optimistic_lock' USING ERRCODE = '40001';
  END IF;

  UPDATE public.support_tickets
     SET status = p_new_status,
         resolved_at = CASE WHEN p_new_status = 'resolved' THEN now() ELSE resolved_at END,
         closed_at   = CASE WHEN p_new_status = 'closed'   THEN now() ELSE closed_at   END,
         version = version + 1
   WHERE id = p_ticket_id;

  INSERT INTO public.support_ticket_events(ticket_id, event_type, actor_user_id, payload)
  VALUES (p_ticket_id, 'status.changed', v_caller,
          jsonb_build_object('from', v_old, 'to', p_new_status, 'reason', p_reason));
END;$$;
GRANT EXECUTE ON FUNCTION public.support_ticket_change_status(uuid,public.support_ticket_status,text,integer) TO authenticated, service_role;

-- ========== RPC: support_ticket_assign ==========
CREATE OR REPLACE FUNCTION public.support_ticket_assign(
  p_ticket_id uuid,
  p_assignee  uuid,
  p_team      text DEFAULT NULL,
  p_reason    text DEFAULT NULL,
  p_version   integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_cur_version int;
  v_prev_assignee uuid;
BEGIN
  IF NOT (public.is_super_admin(v_caller)
       OR public.has_permission(v_caller, 'support.assign_tickets', NULL)
       OR public.has_permission(v_caller, 'support.manage_tickets', NULL)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT version, assigned_to_user_id INTO v_cur_version, v_prev_assignee
    FROM public.support_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found'; END IF;
  IF p_version IS NOT NULL AND p_version <> v_cur_version THEN
    RAISE EXCEPTION 'optimistic_lock' USING ERRCODE = '40001';
  END IF;

  -- Close previous assignment row (uniqueness on unassigned_at IS NULL)
  UPDATE public.support_ticket_assignments
     SET unassigned_at = now()
   WHERE ticket_id = p_ticket_id AND unassigned_at IS NULL;

  IF p_assignee IS NOT NULL THEN
    INSERT INTO public.support_ticket_assignments(ticket_id, assigned_to_user_id, team, assigned_by_user_id, reason)
    VALUES (p_ticket_id, p_assignee, p_team, v_caller, p_reason);
  END IF;

  UPDATE public.support_tickets
     SET assigned_to_user_id = p_assignee,
         assigned_at = CASE WHEN p_assignee IS NULL THEN NULL ELSE now() END,
         team = COALESCE(p_team, team),
         version = version + 1
   WHERE id = p_ticket_id;

  INSERT INTO public.support_ticket_events(ticket_id, event_type, actor_user_id, payload)
  VALUES (p_ticket_id, 'assignment.changed', v_caller,
          jsonb_build_object('from', v_prev_assignee, 'to', p_assignee, 'team', p_team, 'reason', p_reason));
END;$$;
GRANT EXECUTE ON FUNCTION public.support_ticket_assign(uuid,uuid,text,text,integer) TO authenticated, service_role;

-- ========== RPC: support_ticket_escalate ==========
CREATE OR REPLACE FUNCTION public.support_ticket_escalate(
  p_ticket_id uuid,
  p_reason    text,
  p_raise_priority boolean DEFAULT true,
  p_version   integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_cur_version int;
  v_cur_priority public.support_ticket_priority;
  v_new_priority public.support_ticket_priority;
BEGIN
  IF NOT (public.is_super_admin(v_caller)
       OR public.has_permission(v_caller, 'support.manage_tickets', NULL)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT version, priority INTO v_cur_version, v_cur_priority
    FROM public.support_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found'; END IF;
  IF p_version IS NOT NULL AND p_version <> v_cur_version THEN
    RAISE EXCEPTION 'optimistic_lock' USING ERRCODE = '40001';
  END IF;

  v_new_priority := CASE
    WHEN NOT p_raise_priority THEN v_cur_priority
    WHEN v_cur_priority = 'low'    THEN 'normal'::public.support_ticket_priority
    WHEN v_cur_priority = 'normal' THEN 'high'::public.support_ticket_priority
    WHEN v_cur_priority = 'high'   THEN 'urgent'::public.support_ticket_priority
    ELSE 'urgent'::public.support_ticket_priority
  END;

  UPDATE public.support_tickets
     SET escalation_level = escalation_level + 1,
         escalated_at = now(),
         priority = v_new_priority,
         version = version + 1
   WHERE id = p_ticket_id;

  INSERT INTO public.support_ticket_events(ticket_id, event_type, actor_user_id, payload)
  VALUES (p_ticket_id, 'ticket.escalated', v_caller,
          jsonb_build_object('reason', p_reason,
                             'priority_from', v_cur_priority, 'priority_to', v_new_priority));
END;$$;
GRANT EXECUTE ON FUNCTION public.support_ticket_escalate(uuid,text,boolean,integer) TO authenticated, service_role;

-- ========== RLS POLICIES ==========

-- Categories: staff manage; tickets policies handle customer reads via join
CREATE POLICY support_cat_select ON public.support_ticket_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY support_cat_manage ON public.support_ticket_categories
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'support.manage_sla',NULL))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'support.manage_sla',NULL));

-- SLA policies: admin only
CREATE POLICY support_sla_select ON public.support_sla_policies
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'support.manage_sla',NULL) OR public.has_permission(auth.uid(),'support.view_all',NULL));
CREATE POLICY support_sla_manage ON public.support_sla_policies
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'support.manage_sla',NULL))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'support.manage_sla',NULL));

-- Tickets
CREATE POLICY support_tickets_owner_select ON public.support_tickets
  FOR SELECT TO authenticated
  USING (customer_id IS NOT NULL AND public._is_customer_owner(customer_id));

CREATE POLICY support_tickets_staff_select ON public.support_tickets
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid())
      OR public.has_permission(auth.uid(),'support.view_all',NULL)
      OR assigned_to_user_id = auth.uid());

CREATE POLICY support_tickets_owner_insert ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (customer_id IS NOT NULL AND public._is_customer_owner(customer_id));

CREATE POLICY support_tickets_staff_manage ON public.support_tickets
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'support.manage_tickets',NULL))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'support.manage_tickets',NULL));

-- Messages
CREATE POLICY support_msg_owner_select ON public.support_ticket_messages
  FOR SELECT TO authenticated
  USING (visibility = 'public' AND EXISTS (
    SELECT 1 FROM public.support_tickets t
     WHERE t.id = support_ticket_messages.ticket_id
       AND t.customer_id IS NOT NULL
       AND public._is_customer_owner(t.customer_id)
  ));

CREATE POLICY support_msg_staff_select ON public.support_ticket_messages
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid())
      OR public.has_permission(auth.uid(),'support.view_all',NULL)
      OR EXISTS (SELECT 1 FROM public.support_tickets t
                  WHERE t.id = support_ticket_messages.ticket_id
                    AND t.assigned_to_user_id = auth.uid()));

CREATE POLICY support_msg_owner_insert ON public.support_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_type = 'customer'
    AND visibility = 'public'
    AND author_customer_id IS NOT NULL
    AND public._is_customer_owner(author_customer_id)
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
       WHERE t.id = support_ticket_messages.ticket_id
         AND t.customer_id = support_ticket_messages.author_customer_id
         AND t.status NOT IN ('closed','cancelled')
    )
  );

CREATE POLICY support_msg_staff_insert ON public.support_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_type IN ('agent','system')
    AND (public.is_super_admin(auth.uid())
         OR public.has_permission(auth.uid(),'support.manage_tickets',NULL))
    AND (visibility = 'public'
         OR public.is_super_admin(auth.uid())
         OR public.has_permission(auth.uid(),'support.add_internal_notes',NULL))
  );

-- Attachments
CREATE POLICY support_att_select ON public.support_ticket_message_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_ticket_messages m
     WHERE m.id = support_ticket_message_attachments.message_id
       AND (
         (m.visibility = 'public' AND EXISTS (
            SELECT 1 FROM public.support_tickets t
             WHERE t.id = m.ticket_id
               AND t.customer_id IS NOT NULL
               AND public._is_customer_owner(t.customer_id)))
         OR public.is_super_admin(auth.uid())
         OR public.has_permission(auth.uid(),'support.view_all',NULL)
       )
  ));

CREATE POLICY support_att_manage ON public.support_ticket_message_attachments
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'support.manage_tickets',NULL))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'support.manage_tickets',NULL));

-- Events: staff only
CREATE POLICY support_events_staff_select ON public.support_ticket_events
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'support.view_all',NULL));

CREATE POLICY support_events_staff_insert ON public.support_ticket_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'support.manage_tickets',NULL));

-- Assignments: staff only
CREATE POLICY support_assign_staff_select ON public.support_ticket_assignments
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'support.view_all',NULL));

CREATE POLICY support_assign_staff_manage ON public.support_ticket_assignments
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'support.assign_tickets',NULL) OR public.has_permission(auth.uid(),'support.manage_tickets',NULL))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'support.assign_tickets',NULL) OR public.has_permission(auth.uid(),'support.manage_tickets',NULL));

-- Watchers: staff only
CREATE POLICY support_watchers_staff ON public.support_ticket_watchers
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'support.view_all',NULL))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'support.manage_tickets',NULL));

-- ========== SEED RBAC ==========
INSERT INTO public.permissions(code, module, description) VALUES
  ('support.view_all',         'support', 'Visualizar todos os tickets e mensagens'),
  ('support.manage_tickets',   'support', 'Criar/editar tickets, mensagens e mudar status'),
  ('support.assign_tickets',   'support', 'Atribuir tickets a agentes'),
  ('support.add_internal_notes','support','Adicionar notas internas em tickets'),
  ('support.manage_sla',       'support', 'Gerenciar políticas de SLA e categorias')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.roles(code, name, description) VALUES
  ('support_agent','Support Agent','Agente de atendimento ao cliente')
ON CONFLICT (code) DO NOTHING;

-- super_admin & store_admin: tudo
INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM public.roles r
 JOIN public.permissions p ON p.code IN (
   'support.view_all','support.manage_tickets','support.assign_tickets',
   'support.add_internal_notes','support.manage_sla')
 WHERE r.code IN ('super_admin','store_admin')
ON CONFLICT DO NOTHING;

-- cx_manager: tudo exceto manage_sla (compartilha gestão tática)
INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM public.roles r
 JOIN public.permissions p ON p.code IN (
   'support.view_all','support.manage_tickets','support.assign_tickets',
   'support.add_internal_notes','support.manage_sla')
 WHERE r.code = 'cx_manager'
ON CONFLICT DO NOTHING;

-- support_agent: operação diária, sem SLA admin
INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM public.roles r
 JOIN public.permissions p ON p.code IN (
   'support.view_all','support.manage_tickets','support.add_internal_notes')
 WHERE r.code = 'support_agent'
ON CONFLICT DO NOTHING;
