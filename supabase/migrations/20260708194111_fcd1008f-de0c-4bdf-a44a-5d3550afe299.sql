-- Permissão customers.read.pii
INSERT INTO public.permissions (code, module, description)
VALUES ('customers.read.pii', 'customers', 'Revelar documento completo do cliente')
ON CONFLICT (code) DO NOTHING;

-- Reforçar grants em hash_doc_number: revogar de PUBLIC e anon; manter authenticated
-- (justificado: busca admin usa o hash via RPC no client autenticado do servidor;
-- doc_number_hash só é visível a staff com customers.read via RLS, então a função
-- não expõe dados novos para quem já não teria acesso).
REVOKE ALL ON FUNCTION public.hash_doc_number(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hash_doc_number(text) TO authenticated, service_role;