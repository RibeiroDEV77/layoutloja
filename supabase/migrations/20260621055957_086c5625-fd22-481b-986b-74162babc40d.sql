
-- Read Model: lista administrativa
CREATE OR REPLACE VIEW public.order_admin_list_v AS
SELECT
  o.id, o.store_id, o.order_number, o.status, o.channel, o.currency,
  o.total, o.subtotal, o.discount_total, o.shipping_total, o.tax_total,
  o.items_count, o.tags, o.placed_at, o.created_at, o.updated_at, o.cancelled_at,
  o.customer_id,
  COALESCE(c.name, o.customer_email) AS customer_name,
  o.customer_email, o.customer_phone,
  (SELECT COUNT(*) FROM public.order_payments p WHERE p.order_id = o.id) AS payments_count,
  (SELECT COALESCE(SUM(p.amount),0) FROM public.order_payments p WHERE p.order_id = o.id AND p.status = 'captured') AS paid_amount,
  (SELECT COALESCE(SUM(p.refunded_amount),0) FROM public.order_payments p WHERE p.order_id = o.id) AS refunded_amount,
  (SELECT COUNT(*) FROM public.order_fulfillments f WHERE f.order_id = o.id) AS fulfillments_count,
  (SELECT COUNT(*) FROM public.order_shipments s WHERE s.order_id = o.id) AS shipments_count,
  (SELECT COUNT(*) FROM public.order_holds h WHERE h.order_id = o.id AND h.status = 'active') AS active_holds_count,
  (SELECT au.user_id FROM public.order_assignments au WHERE au.order_id = o.id AND au.unassigned_at IS NULL ORDER BY au.created_at DESC LIMIT 1) AS assigned_user_id
FROM public.orders o
LEFT JOIN public.customers c ON c.id = o.customer_id;

GRANT SELECT ON public.order_admin_list_v TO authenticated;
GRANT SELECT ON public.order_admin_list_v TO service_role;

-- Read Model: timeline unificada
CREATE OR REPLACE VIEW public.order_timeline_unified_v AS
  SELECT ot.id, ot.order_id, ot.store_id, 'order'::text AS source,
         ot.event_type::text AS event_type,
         COALESCE(ot.actor_label, ot.event_type::text) AS title,
         ot.payload, ot.actor_user_id, ot.created_at
  FROM public.order_timeline ot
UNION ALL
  SELECT pt.id, p.order_id, p.store_id, 'payment'::text AS source,
         pt.event_type::text AS event_type,
         COALESCE(pt.summary, pt.event_type::text) AS title,
         pt.payload, pt.actor_user_id, pt.created_at
  FROM public.payment_timeline pt
  JOIN public.order_payments p ON p.id = pt.payment_id
UNION ALL
  SELECT fe.id, f.order_id, f.store_id, 'fulfillment'::text AS source,
         fe.kind::text AS event_type,
         COALESCE(fe.summary, fe.kind::text) AS title,
         fe.payload, fe.actor_user_id, fe.created_at
  FROM public.fulfillment_events fe
  JOIN public.order_fulfillments f ON f.id = fe.fulfillment_id
UNION ALL
  SELECT te.id, os.order_id, os.store_id, 'tracking'::text AS source,
         te.kind::text AS event_type,
         COALESCE(te.description, te.kind::text) AS title,
         te.raw_payload AS payload,
         NULL::uuid AS actor_user_id,
         te.created_at
  FROM public.tracking_events te
  JOIN public.order_shipments os ON os.id = te.shipment_id
UNION ALL
  SELECT fie.id, fi.order_id, fi.store_id, 'fiscal'::text AS source,
         fie.event_type::text AS event_type,
         COALESCE(fie.message, fie.event_type::text) AS title,
         fie.payload, fie.created_by AS actor_user_id, fie.created_at
  FROM public.fiscal_invoice_events fie
  JOIN public.fiscal_invoices fi ON fi.id = fie.invoice_id;

GRANT SELECT ON public.order_timeline_unified_v TO authenticated;
GRANT SELECT ON public.order_timeline_unified_v TO service_role;

-- Helper: timeline + auditoria
CREATE OR REPLACE FUNCTION public._order_admin_log(
  _order_id uuid, _store_id uuid, _event public.order_timeline_event,
  _label text, _payload jsonb, _actor uuid,
  _audit_action text, _old jsonb, _new jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.order_timeline (order_id, store_id, event_type, actor_user_id, actor_label, payload)
  VALUES (_order_id, _store_id, _event, _actor, _label, COALESCE(_payload, '{}'::jsonb));
  INSERT INTO public.order_audit (order_id, store_id, entity, entity_id, action, actor_user_id, old_data, new_data)
  VALUES (_order_id, _store_id, 'order', _order_id, _audit_action, _actor, _old, _new);
END;
$$;

-- order_add_note
CREATE OR REPLACE FUNCTION public.order_add_note(
  _order_id uuid, _body text, _visibility text DEFAULT 'internal', _pinned boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store uuid; v_user uuid := auth.uid(); v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  SELECT store_id INTO v_store FROM public.orders WHERE id = _order_id;
  IF v_store IS NULL THEN RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.has_permission(v_user, 'orders.write', v_store) THEN
    RAISE EXCEPTION 'forbidden: orders.write' USING ERRCODE = '42501';
  END IF;
  IF _body IS NULL OR length(trim(_body)) = 0 THEN RAISE EXCEPTION 'body required' USING ERRCODE = '22000'; END IF;
  INSERT INTO public.order_notes (order_id, store_id, visibility, body, author_user_id, pinned)
  VALUES (_order_id, v_store, _visibility::order_note_visibility, _body, v_user, _pinned)
  RETURNING id INTO v_id;
  PERFORM public._order_admin_log(_order_id, v_store, 'note_added', 'Nota adicionada',
    jsonb_build_object('note_id', v_id, 'visibility', _visibility, 'pinned', _pinned),
    v_user, 'note.add', NULL, jsonb_build_object('note_id', v_id));
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.order_add_note(uuid, text, text, boolean) TO authenticated;

-- order_add_tag
CREATE OR REPLACE FUNCTION public.order_add_tag(_order_id uuid, _tag text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store uuid; v_user uuid := auth.uid(); v_old text[]; v_new text[];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  SELECT store_id, tags INTO v_store, v_old FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF v_store IS NULL THEN RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.has_permission(v_user, 'orders.write', v_store) THEN
    RAISE EXCEPTION 'forbidden: orders.write' USING ERRCODE = '42501';
  END IF;
  IF _tag IS NULL OR length(trim(_tag)) = 0 OR _tag = ANY(v_old) THEN RETURN; END IF;
  v_new := v_old || ARRAY[_tag];
  UPDATE public.orders SET tags = v_new, updated_at = now() WHERE id = _order_id;
  PERFORM public._order_admin_log(_order_id, v_store, 'tag_added', 'Tag: '||_tag,
    jsonb_build_object('tag', _tag), v_user, 'tag.add',
    jsonb_build_object('tags', v_old), jsonb_build_object('tags', v_new));
END; $$;

-- order_remove_tag
CREATE OR REPLACE FUNCTION public.order_remove_tag(_order_id uuid, _tag text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store uuid; v_user uuid := auth.uid(); v_old text[]; v_new text[];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  SELECT store_id, tags INTO v_store, v_old FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF v_store IS NULL THEN RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.has_permission(v_user, 'orders.write', v_store) THEN
    RAISE EXCEPTION 'forbidden: orders.write' USING ERRCODE = '42501';
  END IF;
  v_new := array_remove(v_old, _tag);
  IF v_new = v_old THEN RETURN; END IF;
  UPDATE public.orders SET tags = v_new, updated_at = now() WHERE id = _order_id;
  PERFORM public._order_admin_log(_order_id, v_store, 'tag_removed', 'Tag removida: '||_tag,
    jsonb_build_object('tag', _tag), v_user, 'tag.remove',
    jsonb_build_object('tags', v_old), jsonb_build_object('tags', v_new));
END; $$;

GRANT EXECUTE ON FUNCTION public.order_add_tag(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.order_remove_tag(uuid, text) TO authenticated;

-- order_assign_user
CREATE OR REPLACE FUNCTION public.order_assign_user(_order_id uuid, _user uuid, _role text DEFAULT 'owner') RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store uuid; v_actor uuid := auth.uid(); v_id uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  SELECT store_id INTO v_store FROM public.orders WHERE id = _order_id;
  IF v_store IS NULL THEN RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.has_permission(v_actor, 'orders.write', v_store) THEN
    RAISE EXCEPTION 'forbidden: orders.write' USING ERRCODE = '42501';
  END IF;
  UPDATE public.order_assignments SET unassigned_at = now()
   WHERE order_id = _order_id AND unassigned_at IS NULL AND role = _role::order_assignment_role;
  INSERT INTO public.order_assignments (order_id, store_id, user_id, role, assigned_by)
  VALUES (_order_id, v_store, _user, _role::order_assignment_role, v_actor)
  RETURNING id INTO v_id;
  PERFORM public._order_admin_log(_order_id, v_store, 'assigned', 'Pedido atribuído',
    jsonb_build_object('user_id', _user, 'role', _role), v_actor,
    'order.assign', NULL, jsonb_build_object('user_id', _user, 'role', _role));
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.order_assign_user(uuid, uuid, text) TO authenticated;

-- order_cancel
CREATE OR REPLACE FUNCTION public.order_cancel(_order_id uuid, _reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store uuid; v_actor uuid := auth.uid(); v_old public.order_status;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501'; END IF;
  SELECT store_id, status INTO v_store, v_old FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF v_store IS NULL THEN RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.has_permission(v_actor, 'orders.cancel', v_store)
     AND NOT public.has_permission(v_actor, 'orders.write', v_store) THEN
    RAISE EXCEPTION 'forbidden: orders.cancel' USING ERRCODE = '42501';
  END IF;
  IF v_old IN ('shipped','delivered','completed','cancelled','refunded','returned') THEN
    RAISE EXCEPTION 'cannot cancel order in status %', v_old USING ERRCODE = '22000';
  END IF;
  UPDATE public.orders
     SET status = 'cancelled', cancelled_at = now(), cancellation_reason = _reason, updated_at = now()
   WHERE id = _order_id;
  PERFORM public._order_admin_log(_order_id, v_store, 'status_changed', 'Pedido cancelado',
    jsonb_build_object('from', v_old, 'to', 'cancelled', 'reason', _reason),
    v_actor, 'order.cancel',
    jsonb_build_object('status', v_old),
    jsonb_build_object('status', 'cancelled', 'reason', _reason));
END; $$;
GRANT EXECUTE ON FUNCTION public.order_cancel(uuid, text) TO authenticated;
