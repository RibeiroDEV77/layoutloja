
-- Enums
DO $$ BEGIN CREATE TYPE public.customer_type AS ENUM ('pf','pj'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.customer_status AS ENUM ('active','inactive','blocked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.customer_segment AS ENUM ('retail','wholesale','rep','distributor','reseller','vip'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.address_type AS ENUM ('main','shipping','billing','commercial'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tax_regime AS ENUM ('mei','simples','presumido','real','isento'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.credit_ledger_kind AS ENUM ('credit','debit','refund','adjustment','expiration'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  type public.customer_type NOT NULL DEFAULT 'pf',
  code text,
  status public.customer_status NOT NULL DEFAULT 'active',
  email text,
  phone text,
  doc_number text,
  name text NOT NULL,
  legal_name text,
  trade_name text,
  state_registration text,
  municipal_registration text,
  birth_date date,
  gender text,
  default_price_list_id uuid REFERENCES public.price_lists(id) ON DELETE SET NULL,
  default_payment_terms text,
  credit_limit numeric(14,2) NOT NULL DEFAULT 0,
  segment public.customer_segment NOT NULL DEFAULT 'retail',
  origin text,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  notes text,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX customers_store_doc_uq ON public.customers(store_id, doc_number) WHERE doc_number IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX customers_store_code_uq ON public.customers(store_id, code) WHERE code IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX customers_store_idx ON public.customers(store_id);
CREATE INDEX customers_auth_user_idx ON public.customers(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX customers_status_idx ON public.customers(store_id, status);
CREATE INDEX customers_segment_idx ON public.customers(store_id, segment);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.customer_store_id(_customer_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT store_id FROM public.customers WHERE id = _customer_id
$$;

CREATE OR REPLACE FUNCTION public.validate_customer()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_doc text;
BEGIN
  IF NEW.doc_number IS NOT NULL THEN
    v_doc := regexp_replace(NEW.doc_number, '\D', '', 'g');
    NEW.doc_number := v_doc;
    IF NEW.type = 'pf' AND length(v_doc) NOT IN (0, 11) THEN
      RAISE EXCEPTION 'CPF deve ter 11 dígitos';
    END IF;
    IF NEW.type = 'pj' AND length(v_doc) NOT IN (0, 14) THEN
      RAISE EXCEPTION 'CNPJ deve ter 14 dígitos';
    END IF;
  END IF;
  IF NEW.email IS NOT NULL THEN NEW.email := lower(trim(NEW.email)); END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER customers_validate BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.validate_customer();
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER customers_audit AFTER INSERT OR UPDATE OR DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TABLE public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label text,
  type public.address_type NOT NULL DEFAULT 'main',
  is_default_shipping boolean NOT NULL DEFAULT false,
  is_default_billing boolean NOT NULL DEFAULT false,
  recipient text,
  doc_number text,
  zipcode text,
  street text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  country text NOT NULL DEFAULT 'BR',
  latitude numeric(10,7),
  longitude numeric(10,7),
  reference text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_addresses_customer_idx ON public.customer_addresses(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enforce_single_default_address()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.is_default_shipping THEN
    UPDATE public.customer_addresses SET is_default_shipping = false
    WHERE customer_id = NEW.customer_id AND id <> NEW.id AND is_default_shipping = true;
  END IF;
  IF NEW.is_default_billing THEN
    UPDATE public.customer_addresses SET is_default_billing = false
    WHERE customer_id = NEW.customer_id AND id <> NEW.id AND is_default_billing = true;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER customer_addresses_default BEFORE INSERT OR UPDATE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_default_address();
CREATE TRIGGER customer_addresses_updated_at BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  email text,
  phone text,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_contacts_customer_idx ON public.customer_contacts(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_contacts TO authenticated;
GRANT ALL ON public.customer_contacts TO service_role;
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER customer_contacts_updated_at BEFORE UPDATE ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customer_tax_profiles (
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  regime public.tax_regime,
  icms_taxpayer boolean NOT NULL DEFAULT false,
  suframa text,
  ie_isento boolean NOT NULL DEFAULT false,
  cnae text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_tax_profiles TO authenticated;
GRANT ALL ON public.customer_tax_profiles TO service_role;
ALTER TABLE public.customer_tax_profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER customer_tax_profiles_updated_at BEFORE UPDATE ON public.customer_tax_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customer_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  kind public.credit_ledger_kind NOT NULL,
  amount numeric(14,2) NOT NULL,
  balance_after numeric(14,2) NOT NULL,
  reference_type text,
  reference_id uuid,
  reason text,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_credit_ledger_customer_idx ON public.customer_credit_ledger(customer_id, created_at DESC);
GRANT SELECT, INSERT ON public.customer_credit_ledger TO authenticated;
GRANT ALL ON public.customer_credit_ledger TO service_role;
ALTER TABLE public.customer_credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.customer_groups_map (
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_group_id uuid NOT NULL REFERENCES public.customer_groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, customer_group_id)
);
CREATE INDEX customer_groups_map_group_idx ON public.customer_groups_map(customer_group_id);
GRANT SELECT, INSERT, DELETE ON public.customer_groups_map TO authenticated;
GRANT ALL ON public.customer_groups_map TO service_role;
ALTER TABLE public.customer_groups_map ENABLE ROW LEVEL SECURITY;

-- RLS
CREATE POLICY customers_select ON public.customers FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR (auth_user_id = auth.uid()) OR (store_id IN (SELECT public.user_store_ids(auth.uid())) AND public.has_permission(auth.uid(),'customers.read',store_id)));
CREATE POLICY customers_insert ON public.customers FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'customers.create',store_id));
CREATE POLICY customers_update ON public.customers FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR (auth_user_id = auth.uid()) OR public.has_permission(auth.uid(),'customers.update',store_id))
WITH CHECK (public.is_super_admin(auth.uid()) OR (auth_user_id = auth.uid()) OR public.has_permission(auth.uid(),'customers.update',store_id));
CREATE POLICY customers_delete ON public.customers FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'customers.delete',store_id));

CREATE POLICY customer_addresses_select ON public.customer_addresses FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND (c.auth_user_id = auth.uid() OR (c.store_id IN (SELECT public.user_store_ids(auth.uid())) AND public.has_permission(auth.uid(),'customers.read',c.store_id)))));
CREATE POLICY customer_addresses_write ON public.customer_addresses FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND (c.auth_user_id = auth.uid() OR public.has_permission(auth.uid(),'customers.update',c.store_id))))
WITH CHECK (public.is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND (c.auth_user_id = auth.uid() OR public.has_permission(auth.uid(),'customers.update',c.store_id))));

CREATE POLICY customer_contacts_select ON public.customer_contacts FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND (c.auth_user_id = auth.uid() OR public.has_permission(auth.uid(),'customers.read',c.store_id))));
CREATE POLICY customer_contacts_write ON public.customer_contacts FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND public.has_permission(auth.uid(),'customers.update',c.store_id)))
WITH CHECK (public.is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND public.has_permission(auth.uid(),'customers.update',c.store_id)));

CREATE POLICY customer_tax_profiles_select ON public.customer_tax_profiles FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND (c.auth_user_id = auth.uid() OR public.has_permission(auth.uid(),'customers.read',c.store_id))));
CREATE POLICY customer_tax_profiles_write ON public.customer_tax_profiles FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND public.has_permission(auth.uid(),'customers.update',c.store_id)))
WITH CHECK (public.is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND public.has_permission(auth.uid(),'customers.update',c.store_id)));

CREATE POLICY customer_credit_ledger_select ON public.customer_credit_ledger FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND (c.auth_user_id = auth.uid() OR public.has_permission(auth.uid(),'customers.read',c.store_id))));
CREATE POLICY customer_credit_ledger_insert ON public.customer_credit_ledger FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND public.has_permission(auth.uid(),'customers.credit.manage',c.store_id)));

CREATE POLICY customer_groups_map_select ON public.customer_groups_map FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND (c.auth_user_id = auth.uid() OR public.has_permission(auth.uid(),'customers.read',c.store_id))));
CREATE POLICY customer_groups_map_write ON public.customer_groups_map FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND public.has_permission(auth.uid(),'customers.update',c.store_id)))
WITH CHECK (public.is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND public.has_permission(auth.uid(),'customers.update',c.store_id)));

-- Permissions / Roles seed
INSERT INTO public.permissions (code, module, description) VALUES
  ('customers.read','customers','Visualizar clientes'),
  ('customers.create','customers','Cadastrar clientes'),
  ('customers.update','customers','Editar clientes'),
  ('customers.delete','customers','Excluir clientes'),
  ('customers.credit.manage','customers','Gerenciar crédito de clientes')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.roles (code, name, description, is_system)
VALUES ('sales','Vendas','Equipe comercial: clientes, carrinhos e pedidos', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.code IN ('super_admin','admin')
  AND p.code IN ('customers.read','customers.create','customers.update','customers.delete','customers.credit.manage')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.code = 'sales'
  AND p.code IN ('customers.read','customers.create','customers.update')
ON CONFLICT DO NOTHING;

-- Workflow seed
DO $$
DECLARE v_def_id uuid;
BEGIN
  SELECT id INTO v_def_id FROM public.workflow_definitions WHERE code='customer_onboarding' AND version=1;
  IF v_def_id IS NULL THEN
    INSERT INTO public.workflow_definitions (code, name, aggregate_type, version, is_active, metadata)
    VALUES ('customer_onboarding','Onboarding de Cliente','customer',1,true,'{}'::jsonb)
    RETURNING id INTO v_def_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.workflow_states WHERE definition_id = v_def_id) THEN
    INSERT INTO public.workflow_states (definition_id, code, label, is_initial, is_final, sort_order, color) VALUES
      (v_def_id,'lead','Lead',true,false,10,'#94a3b8'),
      (v_def_id,'active','Ativo',false,false,20,'#22c55e'),
      (v_def_id,'vip','VIP',false,false,30,'#a855f7'),
      (v_def_id,'blocked','Bloqueado',false,true,40,'#ef4444');

    INSERT INTO public.workflow_transitions (definition_id, code, label, from_state_id, to_state_id)
    SELECT v_def_id, t.action, t.action_label, a.id, b.id FROM (VALUES
      ('lead','active','activate','Ativar'),
      ('active','vip','promote_vip','Promover a VIP'),
      ('vip','active','demote','Rebaixar'),
      ('active','blocked','block','Bloquear'),
      ('vip','blocked','block_vip','Bloquear VIP'),
      ('blocked','active','unblock','Desbloquear')
    ) AS t(fromc, toc, action, action_label)
    JOIN public.workflow_states a ON a.definition_id = v_def_id AND a.code = t.fromc
    JOIN public.workflow_states b ON b.definition_id = v_def_id AND b.code = t.toc;
  END IF;
END $$;

-- Feature flag
INSERT INTO public.feature_flags (key, name, description, enabled, default_value)
VALUES ('customers.enable_credit_ledger','Habilitar Ledger de Crédito','Exibe e permite lançamentos no ledger de crédito do cliente',true,'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
