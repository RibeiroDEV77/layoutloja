
-- =========================================================
-- FASE 5.6 — Migration 2/4 — Notification Engine
-- =========================================================

DO $$ BEGIN
  CREATE TYPE public.notification_status AS ENUM (
    'pending','processing','sent','partially_delivered','failed','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_delivery_status AS ENUM (
    'queued','sending','sent','delivered','failed','bounced','retrying','abandoned'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_priority AS ENUM ('low','normal','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_template_status AS ENUM ('draft','active','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ========== notification_templates ==========
CREATE TABLE public.notification_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  code            text NOT NULL,
  channel         public.notification_channel NOT NULL,
  locale          text NOT NULL DEFAULT 'pt-BR',
  version         integer NOT NULL DEFAULT 1,
  subject         text,
  body_text       text,
  body_html       text,
  variables       jsonb NOT NULL DEFAULT '[]'::jsonb,
  status          public.notification_template_status NOT NULL DEFAULT 'draft',
  is_active       boolean NOT NULL DEFAULT false,
  description     text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_templates_unique UNIQUE (store_id, code, channel, locale, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notif_templates_code_channel
  ON public.notification_templates(code, channel, locale)
  WHERE is_active = true AND status = 'active';

-- ========== notification_channel_configs ==========
CREATE TABLE public.notification_channel_configs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  channel               public.notification_channel NOT NULL,
  provider              text NOT NULL,
  config                jsonb NOT NULL DEFAULT '{}'::jsonb,
  credentials_secret_ref text,
  is_active             boolean NOT NULL DEFAULT true,
  priority              integer NOT NULL DEFAULT 100,
  rate_limit_per_minute integer,
  created_by            uuid REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ncc_unique_store_channel_provider UNIQUE (store_id, channel, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_channel_configs TO authenticated;
GRANT ALL ON public.notification_channel_configs TO service_role;
ALTER TABLE public.notification_channel_configs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ncc_store_channel_active
  ON public.notification_channel_configs(store_id, channel, priority)
  WHERE is_active = true;

-- ========== notification_event_subscriptions ==========
CREATE TABLE public.notification_event_subscriptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  event_type          text NOT NULL,
  template_code       text NOT NULL,
  channels            public.notification_channel[] NOT NULL,
  priority            public.notification_priority NOT NULL DEFAULT 'normal',
  recipient_resolver  text NOT NULL DEFAULT 'customer_from_payload',
  filter_expression   jsonb,
  is_active           boolean NOT NULL DEFAULT true,
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nes_unique UNIQUE (store_id, event_type, template_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_event_subscriptions TO authenticated;
GRANT ALL ON public.notification_event_subscriptions TO service_role;
ALTER TABLE public.notification_event_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_nes_event_active
  ON public.notification_event_subscriptions(event_type)
  WHERE is_active = true;

-- ========== notifications (AGGREGATE ROOT) ==========
CREATE TABLE public.notifications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  customer_id           uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  recipient_user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email       text,
  recipient_phone       text,
  template_code         text NOT NULL,
  template_version      integer,
  locale                text NOT NULL DEFAULT 'pt-BR',
  channels              public.notification_channel[] NOT NULL,
  payload               jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority              public.notification_priority NOT NULL DEFAULT 'normal',
  status                public.notification_status NOT NULL DEFAULT 'pending',
  idempotency_key       text,
  dedupe_key            text,
  scheduled_for         timestamptz,
  read_at               timestamptz,
  source_event_id       uuid REFERENCES public.event_outbox(id) ON DELETE SET NULL,
  source_aggregate      text,
  source_aggregate_id   uuid,
  version               integer NOT NULL DEFAULT 1,
  error_message         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_idempotency_unique UNIQUE (store_id, idempotency_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_customer
  ON public.notifications(customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;
CREATE INDEX idx_notifications_pending_sched
  ON public.notifications(scheduled_for)
  WHERE status = 'pending';
CREATE INDEX idx_notifications_source_event
  ON public.notifications(source_event_id)
  WHERE source_event_id IS NOT NULL;
CREATE INDEX idx_notifications_dedupe
  ON public.notifications(store_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- ========== notification_deliveries ==========
CREATE TABLE public.notification_deliveries (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id       uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  channel               public.notification_channel NOT NULL,
  provider              text,
  status                public.notification_delivery_status NOT NULL DEFAULT 'queued',
  attempt_number        integer NOT NULL DEFAULT 0,
  max_attempts          integer NOT NULL DEFAULT 5,
  next_attempt_at       timestamptz NOT NULL DEFAULT now(),
  last_attempt_at       timestamptz,
  sent_at               timestamptz,
  delivered_at          timestamptz,
  failed_at             timestamptz,
  recipient_address     text,
  provider_message_id   text,
  provider_response     jsonb,
  error_code            text,
  error_message         text,
  retryable             boolean NOT NULL DEFAULT true,
  idempotency_key       text NOT NULL DEFAULT gen_random_uuid()::text,
  version               integer NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nd_idempotency_unique UNIQUE (idempotency_key),
  CONSTRAINT nd_one_per_channel UNIQUE (notification_id, channel)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_nd_ready
  ON public.notification_deliveries(next_attempt_at)
  WHERE status IN ('queued','retrying');
CREATE INDEX idx_nd_notification
  ON public.notification_deliveries(notification_id);
CREATE INDEX idx_nd_provider_message
  ON public.notification_deliveries(provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- ========== notification_delivery_events (append-only) ==========
CREATE TABLE public.notification_delivery_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id   uuid NOT NULL REFERENCES public.notification_deliveries(id) ON DELETE CASCADE,
  event_type    text NOT NULL,
  payload       jsonb,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.notification_delivery_events TO authenticated;
GRANT ALL ON public.notification_delivery_events TO service_role;
ALTER TABLE public.notification_delivery_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_nde_delivery
  ON public.notification_delivery_events(delivery_id, occurred_at DESC);

-- ========== TRIGGERS updated_at ==========
CREATE TRIGGER trg_notif_templates_updated
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_ncc_updated
  BEFORE UPDATE ON public.notification_channel_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_nes_updated
  BEFORE UPDATE ON public.notification_event_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_notifications_updated
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_nd_updated
  BEFORE UPDATE ON public.notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== _recompute_notification_status ==========
CREATE OR REPLACE FUNCTION public._recompute_notification_status(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total int; v_sent int; v_fail int; v_open int;
  v_new public.notification_status;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE status IN ('delivered','sent')),
         count(*) FILTER (WHERE status IN ('failed','abandoned','bounced')),
         count(*) FILTER (WHERE status IN ('queued','sending','retrying'))
    INTO v_total, v_sent, v_fail, v_open
    FROM public.notification_deliveries
   WHERE notification_id = p_notification_id;

  IF v_total = 0 THEN RETURN; END IF;

  IF v_open > 0 THEN v_new := 'processing';
  ELSIF v_sent = v_total THEN v_new := 'sent';
  ELSIF v_fail = v_total THEN v_new := 'failed';
  ELSE v_new := 'partially_delivered';
  END IF;

  UPDATE public.notifications
     SET status = v_new, version = version + 1, updated_at = now()
   WHERE id = p_notification_id AND status <> v_new;
END;
$$;

-- ========== notification_enqueue ==========
CREATE OR REPLACE FUNCTION public.notification_enqueue(
  p_store_id          uuid,
  p_template_code     text,
  p_channels          public.notification_channel[],
  p_payload           jsonb DEFAULT '{}'::jsonb,
  p_customer_id       uuid DEFAULT NULL,
  p_recipient_email   text DEFAULT NULL,
  p_recipient_phone   text DEFAULT NULL,
  p_recipient_user_id uuid DEFAULT NULL,
  p_priority          public.notification_priority DEFAULT 'normal',
  p_idempotency_key   text DEFAULT NULL,
  p_dedupe_key        text DEFAULT NULL,
  p_scheduled_for     timestamptz DEFAULT NULL,
  p_source_event_id   uuid DEFAULT NULL,
  p_source_aggregate  text DEFAULT NULL,
  p_source_aggregate_id uuid DEFAULT NULL,
  p_locale            text DEFAULT 'pt-BR',
  p_max_attempts      integer DEFAULT 5
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid; v_existing uuid; v_chan public.notification_channel;
BEGIN
  IF p_channels IS NULL OR array_length(p_channels,1) IS NULL THEN
    RAISE EXCEPTION 'notification_enqueue: at least one channel required';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.notifications
     WHERE store_id IS NOT DISTINCT FROM p_store_id
       AND idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  END IF;

  IF p_dedupe_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.notifications
     WHERE store_id IS NOT DISTINCT FROM p_store_id
       AND dedupe_key = p_dedupe_key
       AND created_at > now() - interval '24 hours'
     ORDER BY created_at DESC LIMIT 1;
    IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  END IF;

  INSERT INTO public.notifications (
    store_id, customer_id, recipient_user_id, recipient_email, recipient_phone,
    template_code, locale, channels, payload, priority,
    status, idempotency_key, dedupe_key, scheduled_for,
    source_event_id, source_aggregate, source_aggregate_id
  ) VALUES (
    p_store_id, p_customer_id, p_recipient_user_id, p_recipient_email, p_recipient_phone,
    p_template_code, p_locale, p_channels, COALESCE(p_payload,'{}'::jsonb), p_priority,
    'pending', p_idempotency_key, p_dedupe_key, p_scheduled_for,
    p_source_event_id, p_source_aggregate, p_source_aggregate_id
  ) RETURNING id INTO v_id;

  FOREACH v_chan IN ARRAY p_channels LOOP
    INSERT INTO public.notification_deliveries (
      notification_id, channel, status, max_attempts,
      next_attempt_at, recipient_address
    ) VALUES (
      v_id, v_chan, 'queued', p_max_attempts,
      COALESCE(p_scheduled_for, now()),
      CASE v_chan
        WHEN 'email'    THEN p_recipient_email
        WHEN 'sms'      THEN p_recipient_phone
        WHEN 'whatsapp' THEN p_recipient_phone
        ELSE NULL
      END
    );
  END LOOP;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.notification_enqueue(
  uuid,text,public.notification_channel[],jsonb,uuid,text,text,uuid,
  public.notification_priority,text,text,timestamptz,uuid,text,uuid,text,integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_enqueue(
  uuid,text,public.notification_channel[],jsonb,uuid,text,text,uuid,
  public.notification_priority,text,text,timestamptz,uuid,text,uuid,text,integer
) TO authenticated, service_role;

-- ========== notification_mark_delivery_sending ==========
CREATE OR REPLACE FUNCTION public.notification_mark_delivery_sending(
  p_delivery_id uuid, p_provider text, p_version integer
)
RETURNS public.notification_deliveries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row public.notification_deliveries;
BEGIN
  UPDATE public.notification_deliveries
     SET status='sending',
         provider=COALESCE(p_provider, provider),
         attempt_number=attempt_number+1,
         last_attempt_at=now(),
         version=version+1
   WHERE id=p_delivery_id AND version=p_version
     AND status IN ('queued','retrying')
   RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'optimistic_lock_or_invalid_state' USING ERRCODE='40001';
  END IF;
  INSERT INTO public.notification_delivery_events(delivery_id, event_type, payload)
  VALUES (p_delivery_id, 'sending', jsonb_build_object('attempt', v_row.attempt_number));
  RETURN v_row;
END;$$;
GRANT EXECUTE ON FUNCTION public.notification_mark_delivery_sending(uuid,text,integer) TO authenticated, service_role;

-- ========== notification_mark_delivery_sent ==========
CREATE OR REPLACE FUNCTION public.notification_mark_delivery_sent(
  p_delivery_id uuid, p_provider_message_id text, p_provider_response jsonb, p_version integer
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_notif uuid;
BEGIN
  UPDATE public.notification_deliveries
     SET status='sent',
         provider_message_id=p_provider_message_id,
         provider_response=p_provider_response,
         sent_at=now(),
         version=version+1
   WHERE id=p_delivery_id AND version=p_version AND status='sending'
   RETURNING notification_id INTO v_notif;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'optimistic_lock_or_invalid_state' USING ERRCODE='40001';
  END IF;
  INSERT INTO public.notification_delivery_events(delivery_id, event_type, payload)
  VALUES (p_delivery_id, 'sent', jsonb_build_object('provider_message_id', p_provider_message_id));
  PERFORM public._recompute_notification_status(v_notif);
END;$$;
GRANT EXECUTE ON FUNCTION public.notification_mark_delivery_sent(uuid,text,jsonb,integer) TO authenticated, service_role;

-- ========== notification_mark_delivery_delivered ==========
CREATE OR REPLACE FUNCTION public.notification_mark_delivery_delivered(
  p_delivery_id uuid, p_provider_response jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_notif uuid;
BEGIN
  UPDATE public.notification_deliveries
     SET status='delivered',
         delivered_at=now(),
         provider_response=COALESCE(p_provider_response, provider_response),
         version=version+1
   WHERE id=p_delivery_id AND status IN ('sent','sending')
   RETURNING notification_id INTO v_notif;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO public.notification_delivery_events(delivery_id, event_type, payload)
  VALUES (p_delivery_id, 'delivered', p_provider_response);
  PERFORM public._recompute_notification_status(v_notif);
END;$$;
GRANT EXECUTE ON FUNCTION public.notification_mark_delivery_delivered(uuid,jsonb) TO authenticated, service_role;

-- ========== notification_mark_delivery_failed (backoff exponencial) ==========
CREATE OR REPLACE FUNCTION public.notification_mark_delivery_failed(
  p_delivery_id uuid, p_error_code text, p_error_message text,
  p_retryable boolean, p_version integer
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.notification_deliveries;
  v_backoff interval;
  v_new_status public.notification_delivery_status;
BEGIN
  SELECT * INTO v_row FROM public.notification_deliveries WHERE id=p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery_not_found'; END IF;
  IF v_row.version <> p_version THEN
    RAISE EXCEPTION 'optimistic_lock' USING ERRCODE='40001';
  END IF;

  IF NOT p_retryable OR v_row.attempt_number >= v_row.max_attempts THEN
    v_new_status := CASE WHEN p_retryable THEN 'abandoned' ELSE 'failed' END;
    UPDATE public.notification_deliveries
       SET status=v_new_status, failed_at=now(),
           error_code=p_error_code, error_message=p_error_message,
           retryable=p_retryable, version=version+1
     WHERE id=p_delivery_id;
  ELSE
    v_backoff := make_interval(secs =>
      LEAST(3600, 60 * power(2, GREATEST(v_row.attempt_number - 1, 0))::int)
    );
    UPDATE public.notification_deliveries
       SET status='retrying', next_attempt_at=now()+v_backoff,
           error_code=p_error_code, error_message=p_error_message,
           retryable=true, version=version+1
     WHERE id=p_delivery_id;
  END IF;

  INSERT INTO public.notification_delivery_events(delivery_id, event_type, payload)
  VALUES (p_delivery_id, 'failed', jsonb_build_object(
    'error_code', p_error_code, 'error_message', p_error_message,
    'attempt', v_row.attempt_number, 'retryable', p_retryable
  ));
  PERFORM public._recompute_notification_status(v_row.notification_id);
END;$$;
GRANT EXECUTE ON FUNCTION public.notification_mark_delivery_failed(uuid,text,text,boolean,integer) TO authenticated, service_role;

-- ========== notification_mark_delivery_bounced ==========
CREATE OR REPLACE FUNCTION public.notification_mark_delivery_bounced(
  p_delivery_id uuid, p_provider_response jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_notif uuid;
BEGIN
  UPDATE public.notification_deliveries
     SET status='bounced', failed_at=now(),
         provider_response=COALESCE(p_provider_response, provider_response),
         retryable=false, version=version+1
   WHERE id=p_delivery_id AND status IN ('sent','sending','delivered')
   RETURNING notification_id INTO v_notif;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO public.notification_delivery_events(delivery_id, event_type, payload)
  VALUES (p_delivery_id, 'bounced', p_provider_response);
  PERFORM public._recompute_notification_status(v_notif);
END;$$;
GRANT EXECUTE ON FUNCTION public.notification_mark_delivery_bounced(uuid,jsonb) TO authenticated, service_role;

-- ========== notification_mark_read ==========
CREATE OR REPLACE FUNCTION public.notification_mark_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_customer_id uuid;
BEGIN
  SELECT customer_id INTO v_customer_id
    FROM public.notifications WHERE id=p_notification_id;
  IF v_customer_id IS NULL OR NOT public._is_customer_owner(v_customer_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.notifications
     SET read_at=COALESCE(read_at, now()), version=version+1
   WHERE id=p_notification_id;
END;$$;
GRANT EXECUTE ON FUNCTION public.notification_mark_read(uuid) TO authenticated;

-- ========== notification_consume_outbox_event ==========
CREATE OR REPLACE FUNCTION public.notification_consume_outbox_event(p_event_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event public.event_outbox;
  v_sub   public.notification_event_subscriptions;
  v_count int := 0;
  v_customer_id uuid;
  v_email text; v_phone text; v_user uuid;
BEGIN
  SELECT * INTO v_event FROM public.event_outbox WHERE id=p_event_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  FOR v_sub IN
    SELECT * FROM public.notification_event_subscriptions
     WHERE is_active=true
       AND event_type=v_event.event_type
       AND (store_id IS NULL OR store_id = NULLIF(v_event.payload->>'store_id','')::uuid)
  LOOP
    v_customer_id := NULLIF(v_event.payload->>'customer_id','')::uuid;
    v_email := NULLIF(v_event.payload->>'recipient_email','');
    v_phone := NULLIF(v_event.payload->>'recipient_phone','');
    v_user  := NULL;

    IF v_customer_id IS NOT NULL THEN
      SELECT email, phone, auth_user_id
        INTO v_email, v_phone, v_user
        FROM public.customers WHERE id=v_customer_id;
    END IF;

    PERFORM public.notification_enqueue(
      p_store_id          := NULLIF(v_event.payload->>'store_id','')::uuid,
      p_template_code     := v_sub.template_code,
      p_channels          := v_sub.channels,
      p_payload           := v_event.payload,
      p_customer_id       := v_customer_id,
      p_recipient_email   := v_email,
      p_recipient_phone   := v_phone,
      p_recipient_user_id := v_user,
      p_priority          := v_sub.priority,
      p_idempotency_key   := 'evt:' || v_event.id::text || ':' || v_sub.template_code,
      p_source_event_id   := v_event.id,
      p_source_aggregate  := v_event.aggregate_type,
      p_source_aggregate_id := v_event.aggregate_id
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;$$;
REVOKE ALL ON FUNCTION public.notification_consume_outbox_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_consume_outbox_event(uuid) TO service_role;

-- ========== RLS POLICIES ==========

CREATE POLICY notifications_owner_select ON public.notifications
  FOR SELECT TO authenticated
  USING (customer_id IS NOT NULL AND public._is_customer_owner(customer_id));

CREATE POLICY notifications_staff_select ON public.notifications
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'notifications.view_all', NULL));

CREATE POLICY notifications_staff_manage ON public.notifications
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'notifications.send', NULL))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'notifications.send', NULL));

CREATE POLICY nd_staff_select ON public.notification_deliveries
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'notifications.view_all', NULL));

CREATE POLICY nd_staff_manage ON public.notification_deliveries
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'notifications.send', NULL))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'notifications.send', NULL));

CREATE POLICY nde_staff_select ON public.notification_delivery_events
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'notifications.view_all', NULL));

CREATE POLICY nde_staff_insert ON public.notification_delivery_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'notifications.send', NULL));

CREATE POLICY ntpl_staff_select ON public.notification_templates
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid())
      OR public.has_permission(auth.uid(), 'notifications.manage_templates', NULL)
      OR public.has_permission(auth.uid(), 'notifications.view_all', NULL));

CREATE POLICY ntpl_staff_manage ON public.notification_templates
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'notifications.manage_templates', NULL))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'notifications.manage_templates', NULL));

CREATE POLICY ncc_admin_select ON public.notification_channel_configs
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'notifications.manage_channels', NULL));

CREATE POLICY ncc_admin_manage ON public.notification_channel_configs
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'notifications.manage_channels', NULL))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'notifications.manage_channels', NULL));

CREATE POLICY nes_admin_select ON public.notification_event_subscriptions
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'notifications.manage_templates', NULL));

CREATE POLICY nes_admin_manage ON public.notification_event_subscriptions
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'notifications.manage_templates', NULL))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'notifications.manage_templates', NULL));

-- ========== SEED RBAC ==========
INSERT INTO public.permissions (code, module, description) VALUES
  ('notifications.send',             'notifications', 'Enfileirar e enviar notificações'),
  ('notifications.view_all',         'notifications', 'Visualizar todas as notificações e entregas'),
  ('notifications.manage_templates', 'notifications', 'Gerenciar templates e subscriptions de eventos'),
  ('notifications.manage_channels',  'notifications', 'Gerenciar provedores e configurações de canal')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r
  JOIN public.permissions p ON p.code IN (
    'notifications.send','notifications.view_all',
    'notifications.manage_templates','notifications.manage_channels'
  )
 WHERE r.code IN ('super_admin','store_admin')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r
  JOIN public.permissions p ON p.code IN (
    'notifications.send','notifications.view_all','notifications.manage_templates'
  )
 WHERE r.code = 'cx_manager'
ON CONFLICT DO NOTHING;
