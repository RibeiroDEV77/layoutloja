
-- 1. SUPPORT -> OUTBOX TRIGGER
CREATE OR REPLACE FUNCTION public._support_event_to_outbox()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store_id uuid; v_customer_id uuid; v_event_name text; v_payload jsonb; v_meta jsonb; v_corr uuid; v_caus uuid;
BEGIN
  SELECT store_id, customer_id INTO v_store_id, v_customer_id FROM public.support_tickets WHERE id = NEW.ticket_id;
  IF v_store_id IS NULL THEN RETURN NEW; END IF;

  v_event_name := CASE NEW.event_type
    WHEN 'ticket.created'      THEN 'support.ticket.created'
    WHEN 'message.added'       THEN 'support.ticket.replied'
    WHEN 'status.changed'      THEN
      CASE
        WHEN COALESCE(NEW.payload->>'new_status','') = 'resolved' THEN 'support.ticket.resolved'
        WHEN COALESCE(NEW.payload->>'new_status','') = 'closed'   THEN 'support.ticket.closed'
        WHEN COALESCE(NEW.payload->>'new_status','') = 'open' AND COALESCE(NEW.payload->>'previous_status','') IN ('resolved','closed') THEN 'support.ticket.reopened'
        ELSE 'support.ticket.status_changed'
      END
    WHEN 'assignment.changed'  THEN 'support.ticket.assigned'
    WHEN 'ticket.escalated'    THEN 'support.ticket.escalated'
    WHEN 'sla.at_risk'         THEN 'support.sla.warning'
    WHEN 'sla.breached'        THEN 'support.sla.breached'
    WHEN 'first_response'      THEN 'support.ticket.first_response'
    ELSE 'support.' || NEW.event_type
  END;

  v_corr := COALESCE((NEW.payload->>'correlation_id')::uuid, NEW.ticket_id);
  v_caus := COALESCE((NEW.payload->>'causation_id')::uuid, NEW.id);

  v_payload := NEW.payload || jsonb_build_object(
    'ticket_id', NEW.ticket_id, 'event_id', NEW.id,
    'customer_id', v_customer_id, 'occurred_at', NEW.occurred_at
  );

  v_meta := jsonb_build_object(
    'schema_version', 1,
    'trace_id', COALESCE(NEW.payload->>'trace_id', gen_random_uuid()::text),
    'correlation_id', v_corr, 'causation_id', v_caus,
    'source', 'support_ticket_events',
    'actor_user_id', NEW.actor_user_id, 'actor_customer_id', NEW.actor_customer_id
  );

  PERFORM public.enqueue_outbox_event(v_store_id, 'support_ticket', NEW.ticket_id, v_event_name, v_payload, v_meta, v_corr, v_caus, true);
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_support_event_to_outbox ON public.support_ticket_events;
CREATE TRIGGER trg_support_event_to_outbox AFTER INSERT ON public.support_ticket_events
  FOR EACH ROW EXECUTE FUNCTION public._support_event_to_outbox();

-- 2. NOTIFICATION TEMPLATES + SUBSCRIPTIONS (idempotent seed)
INSERT INTO public.notification_templates
  (store_id, code, channel, locale, version, subject, body_text, body_html, variables, status, is_active, description)
SELECT NULL, t.code, t.channel::notification_channel, 'pt-BR', 1, t.subject, t.body, t.body_html, t.vars, 'active', true, t.descr
FROM (VALUES
  ('support.ticket.created',  'email',  'Ticket #{{ticket_number}} criado', 'Olá {{customer_name}}, recebemos seu ticket: {{subject}}.', '<p>Olá {{customer_name}}, recebemos seu ticket: <b>{{subject}}</b>.</p>', '{"ticket_number":"string"}'::jsonb, 'Confirmação de abertura'),
  ('support.ticket.assigned', 'in_app', 'Ticket atribuído', 'Ticket #{{ticket_number}} atribuído a {{assignee}}', NULL, '{}'::jsonb, 'Atribuição'),
  ('support.ticket.reply',    'email',  'Nova resposta no ticket #{{ticket_number}}', 'Nova resposta disponível.', NULL, '{}'::jsonb, 'Resposta'),
  ('support.ticket.closed',   'email',  'Ticket #{{ticket_number}} encerrado', 'Seu ticket foi encerrado.', NULL, '{}'::jsonb, 'Encerramento'),
  ('support.ticket.resolved', 'email',  'Ticket #{{ticket_number}} resolvido', 'Seu ticket foi resolvido.', NULL, '{}'::jsonb, 'Resolução'),
  ('support.sla.warning',     'in_app', 'SLA em risco #{{ticket_number}}', 'SLA próximo do vencimento.', NULL, '{}'::jsonb, 'SLA risco'),
  ('support.sla.breached',    'in_app', 'SLA violado #{{ticket_number}}', 'SLA violado.', NULL, '{}'::jsonb, 'SLA breach'),
  ('review.approved',         'email',  'Avaliação aprovada', 'Obrigado!', NULL, '{}'::jsonb, 'Review aprovado'),
  ('review.rejected',         'email',  'Avaliação não aprovada', 'Sua avaliação não atende às diretrizes.', NULL, '{}'::jsonb, 'Review rejeitado'),
  ('wishlist.shared',         'email',  'Lista de desejos compartilhada', 'Compartilharam uma wishlist.', NULL, '{}'::jsonb, 'Wishlist')
) AS t(code, channel, subject, body, body_html, vars, descr)
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_templates nt
  WHERE nt.code=t.code AND nt.channel=t.channel::notification_channel AND nt.locale='pt-BR' AND nt.version=1 AND nt.store_id IS NULL
);

INSERT INTO public.notification_event_subscriptions
  (store_id, event_type, template_code, channels, priority, recipient_resolver, is_active)
SELECT NULL, s.event_type, s.template_code, s.channels::notification_channel[], s.priority::notification_priority, s.resolver, true
FROM (VALUES
  ('support.ticket.created',  'support.ticket.created',  ARRAY['email','in_app'], 'normal',   'ticket.customer'),
  ('support.ticket.assigned', 'support.ticket.assigned', ARRAY['in_app'],         'normal',   'ticket.assignee'),
  ('support.ticket.replied',  'support.ticket.reply',    ARRAY['email','in_app'], 'normal',   'ticket.customer'),
  ('support.ticket.resolved', 'support.ticket.resolved', ARRAY['email','in_app'], 'normal',   'ticket.customer'),
  ('support.ticket.closed',   'support.ticket.closed',   ARRAY['email','in_app'], 'low',      'ticket.customer'),
  ('support.sla.warning',     'support.sla.warning',     ARRAY['in_app'],         'high',     'ticket.assignee'),
  ('support.sla.breached',    'support.sla.breached',    ARRAY['in_app'],         'critical', 'ticket.assignee')
) AS s(event_type, template_code, channels, priority, resolver)
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_event_subscriptions ns
  WHERE ns.event_type=s.event_type AND ns.template_code=s.template_code AND ns.store_id IS NULL
);

-- 3. SLA WORKERS
CREATE OR REPLACE FUNCTION public.support_sla_warning_worker()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int := 0; r record;
BEGIN
  PERFORM public.support_recompute_sla_states();
  FOR r IN
    SELECT t.id, t.assigned_to_user_id, t.first_response_due_at, t.resolution_due_at
    FROM public.support_tickets t
    WHERE t.status NOT IN ('resolved','closed') AND t.sla_state = 'at_risk'
      AND NOT EXISTS (SELECT 1 FROM public.support_ticket_events e WHERE e.ticket_id=t.id AND e.event_type='sla.at_risk' AND e.occurred_at > now() - interval '1 hour')
  LOOP
    INSERT INTO public.support_ticket_events (ticket_id, event_type, payload)
    VALUES (r.id, 'sla.at_risk', jsonb_build_object('first_response_due_at', r.first_response_due_at, 'resolution_due_at', r.resolution_due_at, 'assignee_user_id', r.assigned_to_user_id));
    v_count := v_count + 1;
  END LOOP;
  PERFORM public.record_metric('support','support.ticket.sla_warning',v_count,'count',NULL::jsonb,NULL::uuid);
  RETURN v_count;
END;$$;

CREATE OR REPLACE FUNCTION public.support_sla_breach_worker()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int := 0; r record;
BEGIN
  PERFORM public.support_recompute_sla_states();
  FOR r IN
    SELECT t.id, t.assigned_to_user_id, t.first_response_due_at, t.resolution_due_at
    FROM public.support_tickets t
    WHERE t.status NOT IN ('resolved','closed') AND t.sla_state = 'breached'
      AND NOT EXISTS (SELECT 1 FROM public.support_ticket_events e WHERE e.ticket_id=t.id AND e.event_type='sla.breached' AND e.occurred_at > now() - interval '6 hour')
  LOOP
    INSERT INTO public.support_ticket_events (ticket_id, event_type, payload)
    VALUES (r.id, 'sla.breached', jsonb_build_object('first_response_due_at', r.first_response_due_at, 'resolution_due_at', r.resolution_due_at, 'assignee_user_id', r.assigned_to_user_id));
    v_count := v_count + 1;
  END LOOP;
  PERFORM public.record_metric('support','support.ticket.sla_breach',v_count,'count',NULL::jsonb,NULL::uuid);
  RETURN v_count;
END;$$;

REVOKE ALL ON FUNCTION public.support_sla_warning_worker() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.support_sla_breach_worker()  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_sla_warning_worker() TO service_role;
GRANT EXECUTE ON FUNCTION public.support_sla_breach_worker()  TO service_role;

-- 4. PORTAL READ MODELS (Views, SECURITY INVOKER)
CREATE OR REPLACE VIEW public.customer_portal_orders_v WITH (security_invoker=true) AS
SELECT o.id, o.store_id, o.customer_id, o.order_number, o.status, o.total, o.currency, o.placed_at, o.created_at, o.updated_at
FROM public.orders o;

CREATE OR REPLACE VIEW public.customer_portal_support_v WITH (security_invoker=true) AS
SELECT t.id, t.store_id, t.customer_id, t.ticket_number, t.subject, t.status, t.priority, t.sla_state, t.created_at, t.updated_at
FROM public.support_tickets t;

CREATE OR REPLACE VIEW public.customer_portal_notifications_v WITH (security_invoker=true) AS
SELECT n.id, n.store_id, n.customer_id, n.template_code, n.payload, n.channels, n.status, n.read_at, n.created_at
FROM public.notifications n;

CREATE OR REPLACE VIEW public.customer_portal_tracking_v WITH (security_invoker=true) AS
SELECT s.id AS shipment_id, s.store_id, s.tracking_number, s.tracking_url, s.status, s.created_at, s.updated_at
FROM public.shipments s;

CREATE OR REPLACE VIEW public.customer_portal_dashboard_v WITH (security_invoker=true) AS
SELECT c.id AS customer_id, c.store_id,
  (SELECT count(*) FROM public.orders o WHERE o.customer_id=c.id) AS total_orders,
  (SELECT count(*) FROM public.support_tickets t WHERE t.customer_id=c.id AND t.status NOT IN ('resolved','closed')) AS open_tickets,
  (SELECT count(*) FROM public.notifications n WHERE n.customer_id=c.id AND n.read_at IS NULL) AS unread_notifications
FROM public.customers c;

GRANT SELECT ON public.customer_portal_orders_v, public.customer_portal_support_v, public.customer_portal_notifications_v, public.customer_portal_tracking_v, public.customer_portal_dashboard_v TO authenticated;

-- 5. PUBLIC TRACKING
CREATE TABLE IF NOT EXISTS public.public_tracking_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  max_hits integer NOT NULL DEFAULT 1000,
  hits integer NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.public_tracking_tokens TO authenticated;
GRANT ALL ON public.public_tracking_tokens TO service_role;
ALTER TABLE public.public_tracking_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store admins manage tokens" ON public.public_tracking_tokens FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'support.manage_tickets', store_id))
  WITH CHECK (public.has_permission(auth.uid(), 'support.manage_tickets', store_id));
CREATE INDEX IF NOT EXISTS idx_pt_tokens_shipment ON public.public_tracking_tokens(shipment_id);
CREATE INDEX IF NOT EXISTS idx_pt_tokens_expires  ON public.public_tracking_tokens(expires_at);

CREATE TABLE IF NOT EXISTS public.public_tracking_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES public.public_tracking_tokens(id) ON DELETE SET NULL,
  store_id uuid, shipment_id uuid,
  ip_hash text, user_agent text,
  result text NOT NULL,
  accessed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.public_tracking_access_log TO authenticated;
GRANT ALL ON public.public_tracking_access_log TO service_role;
ALTER TABLE public.public_tracking_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store admins read access log" ON public.public_tracking_access_log FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'support.manage_tickets', store_id));
CREATE INDEX IF NOT EXISTS idx_pt_log_token   ON public.public_tracking_access_log(token_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pt_log_ip_time ON public.public_tracking_access_log(ip_hash, accessed_at DESC);

CREATE OR REPLACE FUNCTION public.public_tracking_resolve(
  p_token text, p_ip_hash text DEFAULT NULL, p_user_agent text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hash text; v_tok public.public_tracking_tokens%ROWTYPE; v_rate int; v_result jsonb;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    INSERT INTO public.public_tracking_access_log(result, ip_hash, user_agent) VALUES('invalid_token', p_ip_hash, p_user_agent);
    RAISE EXCEPTION 'invalid token';
  END IF;
  v_hash := encode(digest(p_token, 'sha256'), 'hex');
  SELECT * INTO v_tok FROM public.public_tracking_tokens WHERE token_hash = v_hash;
  IF NOT FOUND THEN
    INSERT INTO public.public_tracking_access_log(result, ip_hash, user_agent) VALUES('not_found', p_ip_hash, p_user_agent);
    RAISE EXCEPTION 'token not found';
  END IF;
  IF v_tok.revoked_at IS NOT NULL OR v_tok.expires_at < now() THEN
    INSERT INTO public.public_tracking_access_log(token_id, store_id, shipment_id, result, ip_hash, user_agent)
    VALUES(v_tok.id, v_tok.store_id, v_tok.shipment_id, 'expired', p_ip_hash, p_user_agent);
    RAISE EXCEPTION 'token expired';
  END IF;
  IF v_tok.hits >= v_tok.max_hits THEN
    INSERT INTO public.public_tracking_access_log(token_id, store_id, shipment_id, result, ip_hash, user_agent)
    VALUES(v_tok.id, v_tok.store_id, v_tok.shipment_id, 'quota_exceeded', p_ip_hash, p_user_agent);
    RAISE EXCEPTION 'quota exceeded';
  END IF;
  IF p_ip_hash IS NOT NULL THEN
    SELECT count(*) INTO v_rate FROM public.public_tracking_access_log
      WHERE ip_hash = p_ip_hash AND accessed_at > now() - interval '1 minute';
    IF v_rate > 30 THEN
      INSERT INTO public.public_tracking_access_log(token_id, store_id, shipment_id, result, ip_hash, user_agent)
      VALUES(v_tok.id, v_tok.store_id, v_tok.shipment_id, 'rate_limited', p_ip_hash, p_user_agent);
      RAISE EXCEPTION 'rate limited';
    END IF;
  END IF;
  UPDATE public.public_tracking_tokens SET hits = hits + 1 WHERE id = v_tok.id;
  SELECT jsonb_build_object(
    'shipment_id', shipment_id, 'store_id', store_id,
    'tracking_number', tracking_number, 'tracking_url', tracking_url,
    'status', status, 'updated_at', updated_at
  ) INTO v_result FROM public.customer_portal_tracking_v WHERE shipment_id = v_tok.shipment_id;
  INSERT INTO public.public_tracking_access_log(token_id, store_id, shipment_id, result, ip_hash, user_agent)
  VALUES(v_tok.id, v_tok.store_id, v_tok.shipment_id, 'ok', p_ip_hash, p_user_agent);
  PERFORM public.record_metric('portal','portal.public_tracking_hits',1,'count', jsonb_build_object('store_id', v_tok.store_id), v_tok.store_id);
  RETURN v_result;
END;$$;

REVOKE ALL ON FUNCTION public.public_tracking_resolve(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_tracking_resolve(text,text,text) TO anon, authenticated, service_role;

-- 6. DASHBOARD RPCs
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_customer_dashboard_daily AS
SELECT c.store_id, date_trunc('day', now())::date AS day,
  count(DISTINCT c.id) AS active_customers,
  (SELECT count(*) FROM public.orders o WHERE o.store_id=c.store_id AND o.created_at >= now() - interval '1 day') AS orders_24h,
  (SELECT count(*) FROM public.support_tickets t WHERE t.store_id=c.store_id AND t.status NOT IN ('resolved','closed')) AS open_tickets
FROM public.customers c GROUP BY c.store_id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_customer_dashboard_daily ON public.mv_customer_dashboard_daily(store_id, day);

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_support_metrics_daily AS
SELECT t.store_id, date_trunc('day', t.created_at)::date AS day,
  count(*) AS tickets_created,
  count(*) FILTER (WHERE t.status='resolved') AS tickets_resolved,
  count(*) FILTER (WHERE t.sla_state='breached') AS sla_breached,
  count(*) FILTER (WHERE t.sla_state='at_risk')  AS sla_at_risk
FROM public.support_tickets t GROUP BY t.store_id, date_trunc('day', t.created_at)::date;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_support_metrics_daily ON public.mv_support_metrics_daily(store_id, day);

CREATE OR REPLACE VIEW public.customer_dashboard_daily_v WITH (security_invoker=true) AS SELECT * FROM public.mv_customer_dashboard_daily;
CREATE OR REPLACE VIEW public.support_metrics_daily_v    WITH (security_invoker=true) AS SELECT * FROM public.mv_support_metrics_daily;
GRANT SELECT ON public.customer_dashboard_daily_v, public.support_metrics_daily_v TO authenticated;

CREATE OR REPLACE FUNCTION public.customer_dashboard_refresh() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_customer_dashboard_daily;
  EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW public.mv_customer_dashboard_daily; END;
END;$$;
CREATE OR REPLACE FUNCTION public.customer_timeline_refresh() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM public.record_metric('portal','portal.timeline_refresh',1,'count',NULL::jsonb,NULL::uuid); END;$$;
CREATE OR REPLACE FUNCTION public.portal_cache_invalidate(p_store_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM public.record_metric('portal','portal.cache_invalidate',1,'count', jsonb_build_object('store_id',p_store_id), p_store_id); END;$$;
CREATE OR REPLACE FUNCTION public.portal_refresh_metrics() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_customer_dashboard_daily;
  EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW public.mv_customer_dashboard_daily; END;
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_support_metrics_daily;
  EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW public.mv_support_metrics_daily; END;
END;$$;

REVOKE ALL ON FUNCTION public.customer_dashboard_refresh(), public.customer_timeline_refresh(), public.portal_cache_invalidate(uuid), public.portal_refresh_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_dashboard_refresh(), public.portal_refresh_metrics() TO service_role;
GRANT EXECUTE ON FUNCTION public.customer_timeline_refresh(), public.portal_cache_invalidate(uuid) TO service_role, authenticated;

-- 7. FEATURE FLAGS
INSERT INTO public.feature_flags (key, name, description, type, default_value, enabled, store_scope)
SELECT k.key, k.name, k.descr, 'boolean', 'true'::jsonb, true, true FROM (VALUES
  ('portal.enable_reviews',       'Portal: Reviews',       'Habilita reviews no portal'),
  ('portal.enable_wishlist',      'Portal: Wishlist',      'Habilita wishlist'),
  ('portal.enable_support',       'Portal: Support',       'Habilita SAC'),
  ('portal.enable_tracking',      'Portal: Tracking',      'Habilita rastreio público'),
  ('portal.enable_notifications', 'Portal: Notifications', 'Habilita notificações'),
  ('portal.enable_dashboard',     'Portal: Dashboard',     'Habilita dashboard')
) AS k(key, name, descr)
WHERE NOT EXISTS (SELECT 1 FROM public.feature_flags ff WHERE ff.key = k.key);

-- 8. NOTIFICATION DISPATCH WORKER
CREATE OR REPLACE FUNCTION public.notification_dispatch_worker(p_batch integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count int := 0; r record;
BEGIN
  FOR r IN
    SELECT id FROM public.event_outbox
    WHERE status='pending' AND available_at <= now()
    ORDER BY created_at ASC LIMIT p_batch FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      PERFORM public.notification_consume_outbox_event(r.id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.record_metric('notifications','notification.dispatch_error',1,'count',NULL::jsonb,NULL::uuid);
    END;
  END LOOP;
  PERFORM public.record_metric('notifications','notification.dispatch_batch',v_count,'count',NULL::jsonb,NULL::uuid);
  RETURN v_count;
END;$$;

REVOKE ALL ON FUNCTION public.notification_dispatch_worker(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_dispatch_worker(integer) TO service_role;

-- 9. CRON JOBS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='support-sla-warning')    THEN PERFORM cron.unschedule('support-sla-warning');    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='support-sla-breach')     THEN PERFORM cron.unschedule('support-sla-breach');     END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='portal-refresh-metrics') THEN PERFORM cron.unschedule('portal-refresh-metrics'); END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='notification-dispatch')  THEN PERFORM cron.unschedule('notification-dispatch');  END IF;

    PERFORM cron.schedule('support-sla-warning',    '*/5 * * * *',  $cron$ SELECT public.support_sla_warning_worker(); $cron$);
    PERFORM cron.schedule('support-sla-breach',     '*/5 * * * *',  $cron$ SELECT public.support_sla_breach_worker();  $cron$);
    PERFORM cron.schedule('portal-refresh-metrics', '*/15 * * * *', $cron$ SELECT public.portal_refresh_metrics();     $cron$);
    PERFORM cron.schedule('notification-dispatch',  '* * * * *',    $cron$ SELECT public.notification_dispatch_worker(100); $cron$);
  END IF;
END;$$;
