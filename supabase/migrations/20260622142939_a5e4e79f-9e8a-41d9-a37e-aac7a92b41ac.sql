
-- Tabela auxiliar para o fluxo OAuth 2.0 (state + PKCE) do Melhor Envio
-- e de qualquer outro provider de shipping que use OAuth no futuro.
CREATE TABLE IF NOT EXISTS public.shipping_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code text NOT NULL,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.shipping_carrier_accounts(id) ON DELETE CASCADE,
  state text NOT NULL UNIQUE,
  code_verifier text NOT NULL,
  redirect_uri text NOT NULL,
  return_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_shipping_oauth_states_expires
  ON public.shipping_oauth_states (expires_at);

GRANT ALL ON public.shipping_oauth_states TO service_role;

ALTER TABLE public.shipping_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shipping_oauth_states_service_only"
  ON public.shipping_oauth_states FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Consome um state (uso único, válido, não expirado) e devolve metadados.
CREATE OR REPLACE FUNCTION public.shipping_oauth_consume_state(_state text)
RETURNS TABLE (
  id uuid,
  provider_code text,
  store_id uuid,
  account_id uuid,
  code_verifier text,
  redirect_uri text,
  return_to text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.shipping_oauth_states s
     SET consumed_at = now()
   WHERE s.state = _state
     AND s.consumed_at IS NULL
     AND s.expires_at > now()
  RETURNING s.id, s.provider_code, s.store_id, s.account_id,
            s.code_verifier, s.redirect_uri, s.return_to;
END;
$$;

REVOKE ALL ON FUNCTION public.shipping_oauth_consume_state(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shipping_oauth_consume_state(text) TO service_role;
