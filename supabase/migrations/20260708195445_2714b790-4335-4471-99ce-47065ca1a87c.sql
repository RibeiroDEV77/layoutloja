-- Fase 4.1: Restringir hash_doc_number a service_role apenas.
-- authenticated não deve poder usar a função como oracle de CPF/CNPJ.
-- A busca admin por documento completo passa a rodar via server function
-- usando supabaseAdmin (service_role).
REVOKE EXECUTE ON FUNCTION public.hash_doc_number(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.hash_doc_number(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.hash_doc_number(text) FROM anon;