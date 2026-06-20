REVOKE EXECUTE ON FUNCTION public.supplier_store_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.warehouse_store_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.po_store_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gr_store_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ic_store_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.st_store_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.emit_domain_event(text, text, uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emit_domain_event(text, text, uuid, uuid, jsonb, jsonb) TO authenticated, service_role;
