
-- Revoke default PUBLIC execute on new SECURITY DEFINER functions; grant only to safe roles.

REVOKE EXECUTE ON FUNCTION public.enqueue_outbox_event(uuid,text,uuid,text,jsonb,jsonb,uuid,uuid,boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_outbox_batch(text,int,int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_outbox_published(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_outbox_failed(uuid,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_stale_outbox_locks() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.idempotency_begin(text,text,uuid,uuid,text,int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.idempotency_complete(uuid,public.idempotency_status,int,jsonb,text,text,uuid,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_expired_idempotency_keys() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_metric(text,text,numeric,text,jsonb,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_health_check(text,public.health_status,int,jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.evaluate_feature_flag(text,uuid,uuid) FROM PUBLIC;

-- Backend-only (workers, server functions using service role)
GRANT EXECUTE ON FUNCTION public.enqueue_outbox_event(uuid,text,uuid,text,jsonb,jsonb,uuid,uuid,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_outbox_batch(text,int,int) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_outbox_published(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_outbox_failed(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_stale_outbox_locks() TO service_role;
GRANT EXECUTE ON FUNCTION public.idempotency_begin(text,text,uuid,uuid,text,int) TO service_role;
GRANT EXECUTE ON FUNCTION public.idempotency_complete(uuid,public.idempotency_status,int,jsonb,text,text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_idempotency_keys() TO service_role;
GRANT EXECUTE ON FUNCTION public.record_metric(text,text,numeric,text,jsonb,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_health_check(text,public.health_status,int,jsonb) TO service_role;

-- Authenticated users may evaluate flags and record metrics from server fns acting as user
GRANT EXECUTE ON FUNCTION public.evaluate_feature_flag(text,uuid,uuid) TO authenticated, service_role;
