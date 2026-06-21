-- Tracking sync infra: idempotent ingestion + outbox notifications

-- Idempotency for tracking_events ingestion
CREATE UNIQUE INDEX IF NOT EXISTS uq_tracking_events_dedup
  ON public.tracking_events (shipment_id, occurred_at, kind, md5(coalesce(description,'')));

-- ============================================================
-- fulfillment_apply_tracking
-- Aplica eventos de rastreamento ingeridos via adapter,
-- atualizando shipments + fulfillments + tracking_events e
-- enfileirando outbox events conforme transições relevantes.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fulfillment_apply_tracking(
  _shipment_id   uuid,
  _events        jsonb,         -- array de { occurred_at, kind, description, location, raw }
  _delivered     boolean DEFAULT false,
  _tracking_code text DEFAULT NULL,
  _source        text DEFAULT 'adapter'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shipment       public.shipments%ROWTYPE;
  v_fulfillment    public.fulfillments%ROWTYPE;
  v_order_id       uuid;
  v_customer_id    uuid;
  v_store_id       uuid;
  v_inserted       int := 0;
  v_skipped        int := 0;
  v_event          jsonb;
  v_kind           public.tracking_event_kind;
  v_kind_text      text;
  v_latest_kind    public.tracking_event_kind;
  v_latest_at      timestamptz;
  v_prev_status    public.shipment_status;
  v_new_status     public.shipment_status;
  v_now            timestamptz := now();
  v_outbox_events  jsonb := '[]'::jsonb;
  v_trace          uuid := gen_random_uuid();
BEGIN
  SELECT * INTO v_shipment FROM public.shipments WHERE id = _shipment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shipment % not found', _shipment_id;
  END IF;

  v_store_id    := v_shipment.store_id;
  v_prev_status := v_shipment.status;

  IF v_shipment.fulfillment_id IS NOT NULL THEN
    SELECT * INTO v_fulfillment FROM public.fulfillments WHERE id = v_shipment.fulfillment_id;
    IF FOUND AND v_fulfillment.fulfillable_type = 'order' THEN
      v_order_id := v_fulfillment.fulfillable_id;
      v_customer_id := v_fulfillment.customer_id;
    END IF;
  END IF;
  IF v_customer_id IS NULL AND v_order_id IS NOT NULL THEN
    SELECT customer_id INTO v_customer_id FROM public.orders WHERE id = v_order_id;
  END IF;

  -- Ingest events (idempotent via UNIQUE INDEX)
  IF _events IS NOT NULL THEN
    FOR v_event IN SELECT * FROM jsonb_array_elements(_events) LOOP
      v_kind_text := lower(coalesce(v_event->>'kind',''));
      IF v_kind_text = '' THEN CONTINUE; END IF;
      -- Map to enum, default to 'in_transit'
      BEGIN
        v_kind := v_kind_text::public.tracking_event_kind;
      EXCEPTION WHEN invalid_text_representation THEN
        v_kind := 'in_transit'::public.tracking_event_kind;
      END;

      BEGIN
        INSERT INTO public.tracking_events
          (shipment_id, store_id, kind, occurred_at, location, description, source, raw_payload, trace_id)
        VALUES
          (v_shipment.id, v_store_id, v_kind,
           coalesce((v_event->>'occurred_at')::timestamptz, v_now),
           NULLIF(v_event->>'location',''),
           NULLIF(v_event->>'description',''),
           _source,
           coalesce(v_event->'raw','{}'::jsonb),
           v_trace);
        v_inserted := v_inserted + 1;
      EXCEPTION WHEN unique_violation THEN
        v_skipped := v_skipped + 1;
      END;
    END LOOP;
  END IF;

  -- Resolve latest event for status derivation
  SELECT te.kind, te.occurred_at INTO v_latest_kind, v_latest_at
    FROM public.tracking_events te
   WHERE te.shipment_id = _shipment_id
   ORDER BY te.occurred_at DESC, te.created_at DESC
   LIMIT 1;

  -- Derive shipment_status from latest kind (+ explicit delivered hint)
  v_new_status := v_prev_status;
  IF _delivered THEN
    v_new_status := 'delivered'::public.shipment_status;
  ELSIF v_latest_kind IS NOT NULL THEN
    v_new_status := CASE v_latest_kind
      WHEN 'delivered'          THEN 'delivered'::public.shipment_status
      WHEN 'returned'           THEN 'returned'::public.shipment_status
      WHEN 'lost'               THEN 'lost'::public.shipment_status
      WHEN 'picked_up'          THEN 'dispatched'::public.shipment_status
      WHEN 'pickup_scheduled'   THEN 'ready'::public.shipment_status
      WHEN 'label_purchased'    THEN 'label_purchased'::public.shipment_status
      WHEN 'in_transit'         THEN 'in_transit'::public.shipment_status
      WHEN 'out_for_delivery'   THEN 'in_transit'::public.shipment_status
      WHEN 'delivery_attempted' THEN 'in_transit'::public.shipment_status
      WHEN 'exception'          THEN 'failed'::public.shipment_status
      ELSE v_prev_status
    END;
  END IF;

  -- Persist shipment changes
  UPDATE public.shipments
     SET status         = v_new_status,
         tracking_number= COALESCE(NULLIF(_tracking_code,''), tracking_number),
         dispatched_at  = CASE WHEN dispatched_at IS NULL
                                 AND v_new_status IN ('dispatched','in_transit','delivered','returned','lost','failed')
                               THEN coalesce(v_latest_at, v_now) ELSE dispatched_at END,
         delivered_at   = CASE WHEN v_new_status = 'delivered'
                               THEN coalesce(delivered_at, v_latest_at, v_now) ELSE delivered_at END,
         returned_at    = CASE WHEN v_new_status = 'returned'
                               THEN coalesce(returned_at, v_latest_at, v_now) ELSE returned_at END,
         version        = version + 1,
         updated_at     = v_now,
         trace_id       = v_trace
   WHERE id = _shipment_id;

  -- Mirror to fulfillment timestamps + status
  IF v_fulfillment.id IS NOT NULL THEN
    UPDATE public.fulfillments
       SET shipped_at = CASE WHEN shipped_at IS NULL
                              AND v_new_status IN ('dispatched','in_transit','delivered')
                             THEN coalesce(v_latest_at, v_now) ELSE shipped_at END,
           delivered_at = CASE WHEN v_new_status = 'delivered'
                              THEN coalesce(delivered_at, v_latest_at, v_now) ELSE delivered_at END,
           status = CASE
             WHEN v_new_status = 'delivered'          THEN 'delivered'::public.fulfillment_status
             WHEN v_new_status = 'in_transit'         THEN 'in_transit'::public.fulfillment_status
             WHEN v_new_status IN ('dispatched','ready') THEN 'shipped'::public.fulfillment_status
             WHEN v_new_status = 'failed'             THEN 'failed'::public.fulfillment_status
             WHEN v_new_status = 'cancelled'          THEN 'cancelled'::public.fulfillment_status
             ELSE status
           END,
           version = version + 1,
           updated_at = v_now,
           trace_id = v_trace
     WHERE id = v_fulfillment.id;
  END IF;

  -- Outbox: always emit tracking_updated; emit transition events when status changed
  IF v_inserted > 0 OR v_new_status IS DISTINCT FROM v_prev_status THEN
    PERFORM public.enqueue_outbox_event(
      v_store_id, 'shipment', _shipment_id, 'shipment.tracking_updated',
      jsonb_build_object(
        'store_id', v_store_id,
        'shipment_id', _shipment_id,
        'order_id', v_order_id,
        'customer_id', v_customer_id,
        'tracking_number', COALESCE(NULLIF(_tracking_code,''), v_shipment.tracking_number),
        'tracking_url', v_shipment.tracking_url,
        'status', v_new_status,
        'previous_status', v_prev_status,
        'inserted_events', v_inserted,
        'latest_kind', v_latest_kind,
        'latest_at', v_latest_at
      ),
      jsonb_build_object('source','tracking_sync','trace_id', v_trace),
      NULL, NULL, true
    );
  END IF;

  IF v_new_status IS DISTINCT FROM v_prev_status THEN
    PERFORM public.enqueue_outbox_event(
      v_store_id, 'shipment', _shipment_id,
      CASE v_new_status
        WHEN 'in_transit' THEN 'shipment.in_transit'
        WHEN 'delivered'  THEN 'shipment.delivered'
        WHEN 'returned'   THEN 'shipment.returned'
        WHEN 'lost'       THEN 'shipment.lost'
        WHEN 'failed'     THEN 'shipment.failed'
        WHEN 'dispatched' THEN 'shipment.dispatched'
        ELSE 'shipment.status_changed'
      END,
      jsonb_build_object(
        'store_id', v_store_id,
        'shipment_id', _shipment_id,
        'order_id', v_order_id,
        'customer_id', v_customer_id,
        'tracking_number', COALESCE(NULLIF(_tracking_code,''), v_shipment.tracking_number),
        'tracking_url', v_shipment.tracking_url,
        'status', v_new_status,
        'previous_status', v_prev_status
      ),
      jsonb_build_object('source','tracking_sync','trace_id', v_trace),
      NULL, NULL, true
    );
  END IF;

  -- Specific out_for_delivery / delivery_attempted notifications (per ingested event)
  IF _events IS NOT NULL THEN
    FOR v_event IN SELECT * FROM jsonb_array_elements(_events) LOOP
      v_kind_text := lower(coalesce(v_event->>'kind',''));
      IF v_kind_text IN ('out_for_delivery','delivery_attempted') THEN
        PERFORM public.enqueue_outbox_event(
          v_store_id, 'shipment', _shipment_id,
          'shipment.' || v_kind_text,
          jsonb_build_object(
            'store_id', v_store_id,
            'shipment_id', _shipment_id,
            'order_id', v_order_id,
            'customer_id', v_customer_id,
            'tracking_number', COALESCE(NULLIF(_tracking_code,''), v_shipment.tracking_number),
            'tracking_url', v_shipment.tracking_url,
            'occurred_at', v_event->>'occurred_at',
            'location', v_event->>'location',
            'description', v_event->>'description'
          ),
          jsonb_build_object('source','tracking_sync','trace_id', v_trace),
          NULL, NULL, true
        );
      END IF;
    END LOOP;
  END IF;

  PERFORM public.record_metric(
    'shipping','shipping.tracking.sync', 1, 'count',
    jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped,
                       'status', v_new_status, 'previous_status', v_prev_status),
    v_store_id
  );

  RETURN jsonb_build_object(
    'shipment_id', _shipment_id,
    'inserted', v_inserted,
    'skipped', v_skipped,
    'previous_status', v_prev_status,
    'status', v_new_status,
    'order_id', v_order_id,
    'customer_id', v_customer_id,
    'trace_id', v_trace
  );
END;$$;

REVOKE ALL ON FUNCTION public.fulfillment_apply_tracking(uuid, jsonb, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfillment_apply_tracking(uuid, jsonb, boolean, text, text) TO service_role;

-- ============================================================
-- Pending shipments helper (service_role only)
-- Retorna IDs de envios que ainda não estão em estado terminal
-- e possuem tracking_number, para polling pelo sync worker.
-- ============================================================
CREATE OR REPLACE FUNCTION public.shipping_list_pending_tracking(
  _store_id uuid DEFAULT NULL,
  _limit    integer DEFAULT 100,
  _stale_minutes integer DEFAULT 30
)
RETURNS TABLE (shipment_id uuid, store_id uuid, tracking_number text, carrier_code text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.store_id, s.tracking_number, s.carrier_code
    FROM public.shipments s
   WHERE s.tracking_number IS NOT NULL
     AND s.status NOT IN ('delivered','returned','lost','cancelled')
     AND (_store_id IS NULL OR s.store_id = _store_id)
     AND s.updated_at < now() - make_interval(mins => GREATEST(_stale_minutes, 0))
   ORDER BY s.updated_at ASC
   LIMIT GREATEST(_limit, 1);
$$;

REVOKE ALL ON FUNCTION public.shipping_list_pending_tracking(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shipping_list_pending_tracking(uuid, integer, integer) TO service_role;

-- ============================================================
-- Notification templates (pt-BR) + subscriptions for shipment events
-- ============================================================
INSERT INTO public.notification_templates
  (store_id, code, channel, locale, version, subject, body_text, body_html, variables, status, is_active, description)
SELECT NULL, t.code, t.channel::notification_channel, 'pt-BR', 1, t.subject, t.body, t.body_html, t.vars, 'active', true, t.descr
FROM (VALUES
  ('shipment.dispatched',         'email',  'Seu pedido foi despachado',           'Olá! Seu pedido foi despachado. Código de rastreio: {{tracking_number}}.', '<p>Olá! Seu pedido foi despachado.</p><p>Código de rastreio: <b>{{tracking_number}}</b></p>', '{"tracking_number":"string"}'::jsonb, 'Despacho'),
  ('shipment.in_transit',         'email',  'Seu pedido está a caminho',           'Sua encomenda está em trânsito. Acompanhe: {{tracking_url}}', '<p>Sua encomenda está em trânsito.</p><p><a href="{{tracking_url}}">Acompanhar entrega</a></p>', '{}'::jsonb, 'Em trânsito'),
  ('shipment.out_for_delivery',   'email',  'Saiu para entrega',                   'Sua encomenda saiu para entrega hoje.', '<p>Sua encomenda saiu para entrega hoje.</p>', '{}'::jsonb, 'Saiu para entrega'),
  ('shipment.delivery_attempted', 'email',  'Tentativa de entrega realizada',      'Houve uma tentativa de entrega. Detalhes: {{description}}.', '<p>Houve uma tentativa de entrega. Detalhes: {{description}}.</p>', '{}'::jsonb, 'Tentativa de entrega'),
  ('shipment.delivered',          'email',  'Pedido entregue',                     'Seu pedido foi entregue. Obrigado pela preferência!', '<p>Seu pedido foi entregue. Obrigado!</p>', '{}'::jsonb, 'Entregue'),
  ('shipment.returned',           'email',  'Pedido devolvido ao remetente',       'Sua encomenda foi devolvida ao remetente.', '<p>Sua encomenda foi devolvida ao remetente.</p>', '{}'::jsonb, 'Devolvido'),
  ('shipment.failed',             'email',  'Problema na entrega do seu pedido',   'Detectamos um problema na entrega da sua encomenda.', '<p>Detectamos um problema na entrega da sua encomenda.</p>', '{}'::jsonb, 'Falha de entrega'),
  ('shipment.in_transit',         'in_app', 'Pedido em trânsito',                  'Sua encomenda está em trânsito.', NULL, '{}'::jsonb, 'In-app trânsito'),
  ('shipment.delivered',          'in_app', 'Pedido entregue',                     'Seu pedido foi entregue.', NULL, '{}'::jsonb, 'In-app entregue'),
  ('shipment.out_for_delivery',   'in_app', 'Saiu para entrega',                   'Saiu para entrega.', NULL, '{}'::jsonb, 'In-app saiu para entrega')
) AS t(code, channel, subject, body, body_html, vars, descr)
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_templates nt
  WHERE nt.code=t.code AND nt.channel=t.channel::notification_channel
    AND nt.locale='pt-BR' AND nt.version=1 AND nt.store_id IS NULL
);

INSERT INTO public.notification_event_subscriptions
  (store_id, event_type, template_code, channels, priority, recipient_resolver, is_active)
SELECT NULL, s.event_type, s.template_code, s.channels::notification_channel[], s.priority::notification_priority, s.resolver, true
FROM (VALUES
  ('shipment.dispatched',         'shipment.dispatched',         ARRAY['email'],            'normal', 'shipment.customer'),
  ('shipment.in_transit',         'shipment.in_transit',         ARRAY['email','in_app'],   'normal', 'shipment.customer'),
  ('shipment.out_for_delivery',   'shipment.out_for_delivery',   ARRAY['email','in_app'],   'high',   'shipment.customer'),
  ('shipment.delivery_attempted', 'shipment.delivery_attempted', ARRAY['email'],            'high',   'shipment.customer'),
  ('shipment.delivered',          'shipment.delivered',          ARRAY['email','in_app'],   'normal', 'shipment.customer'),
  ('shipment.returned',           'shipment.returned',           ARRAY['email'],            'high',   'shipment.customer'),
  ('shipment.failed',             'shipment.failed',             ARRAY['email'],            'high',   'shipment.customer')
) AS s(event_type, template_code, channels, priority, resolver)
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_event_subscriptions ns
  WHERE ns.event_type=s.event_type AND ns.template_code=s.template_code AND ns.store_id IS NULL
);
