
-- =========================================================
-- 1) PROFILE EXTENSIONS
-- =========================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS default_store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_uq ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(lower(email));
CREATE INDEX IF NOT EXISTS profiles_is_active_idx ON public.profiles(is_active) WHERE is_active = true;

-- Auto-create profile + sync email on signup / update
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  )
  ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Backfill emails for existing users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id AND p.email IS NULL;

-- =========================================================
-- 2) RBAC HELPER FUNCTIONS  (SECURITY DEFINER)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.code = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role_code text, _store_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND r.code = _role_code
      AND (_store_id IS NULL OR ur.store_id = _store_id OR r.code = 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_code text, _store_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user_id)
      OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id
      AND p.code = _permission_code
      AND (_store_id IS NULL OR ur.store_id = _store_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.user_store_ids(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.is_super_admin(_user_id) THEN (SELECT id FROM public.stores)
    ELSE ur.store_id
  END
  FROM public.user_roles ur
  WHERE ur.user_id = _user_id AND ur.store_id IS NOT NULL
  GROUP BY ur.store_id;
$$;

CREATE OR REPLACE FUNCTION public.current_user_context()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (SELECT auth.uid() AS uid)
  SELECT jsonb_build_object(
    'user_id', u.uid,
    'is_super_admin', public.is_super_admin(u.uid),
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.user_id = u.uid),
    'roles', COALESCE((
      SELECT jsonb_agg(DISTINCT jsonb_build_object('code', r.code, 'name', r.name, 'store_id', ur.store_id))
      FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = u.uid
    ), '[]'::jsonb),
    'permissions', COALESCE((
      SELECT jsonb_agg(DISTINCT p.code)
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = u.uid
    ), '[]'::jsonb),
    'stores', COALESCE((
      SELECT jsonb_agg(DISTINCT s) FROM public.user_store_ids(u.uid) s
    ), '[]'::jsonb)
  ) FROM u;
$$;

-- Claim first super admin: only works if NO super admin exists yet.
CREATE OR REPLACE FUNCTION public.claim_first_super_admin()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role uuid;
  v_store uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE r.code='super_admin') THEN
    RAISE EXCEPTION 'super admin already exists';
  END IF;
  SELECT id INTO v_role FROM public.roles WHERE code='super_admin';
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'super_admin role not seeded';
  END IF;
  -- Pick any store (super admin spans all stores anyway)
  SELECT id INTO v_store FROM public.stores LIMIT 1;
  INSERT INTO public.user_roles (user_id, role_id, store_id, granted_by)
  VALUES (v_uid, v_role, v_store, v_uid)
  ON CONFLICT DO NOTHING;
  INSERT INTO public.audit_log (actor_user_id, entity_type, entity_id, action, diff)
  VALUES (v_uid, 'user', v_uid, 'user.super_admin_claimed', '{}'::jsonb);
  RETURN jsonb_build_object('ok', true, 'user_id', v_uid);
END $$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_store_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_super_admin() TO authenticated;

-- =========================================================
-- 3) SEED ROLES + PERMISSIONS
-- =========================================================
INSERT INTO public.roles (code, name, description, is_system) VALUES
  ('super_admin','Super Administrador','Acesso irrestrito ao sistema',true),
  ('admin','Administrador','Gerencia uma loja e seus usuários',true),
  ('manager','Gerente','Operação completa sem gestão de usuários',true),
  ('operator','Operador','Operação do dia a dia (vendas, estoque)',true),
  ('viewer','Visualizador','Somente leitura',true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.permissions (code, module, description) VALUES
  ('users.read','users','Visualizar usuários'),
  ('users.manage','users','Gerenciar usuários, papéis e convites'),
  ('catalog.read','catalog','Visualizar catálogo'),
  ('catalog.manage','catalog','Gerenciar catálogo (produtos, categorias, marcas)'),
  ('orders.read','orders','Visualizar pedidos'),
  ('orders.manage','orders','Gerenciar pedidos'),
  ('customers.read','customers','Visualizar clientes'),
  ('customers.manage','customers','Gerenciar clientes'),
  ('inventory.read','inventory','Visualizar estoque'),
  ('inventory.manage','inventory','Movimentar estoque'),
  ('purchases.read','purchases','Visualizar compras'),
  ('purchases.manage','purchases','Gerenciar pedidos de compra'),
  ('fiscal.read','fiscal','Visualizar notas fiscais'),
  ('fiscal.manage','fiscal','Emitir/cancelar notas fiscais'),
  ('fiscal.cancel','fiscal','Cancelar notas fiscais'),
  ('reports.read','reports','Visualizar relatórios'),
  ('settings.manage','settings','Gerenciar configurações da loja')
ON CONFLICT (code) DO NOTHING;

-- Role × permission defaults
WITH r AS (SELECT id, code FROM public.roles),
     p AS (SELECT id, code FROM public.permissions),
     pairs AS (
       SELECT 'admin'::text AS rc, unnest(ARRAY[
         'users.read','users.manage','catalog.read','catalog.manage','orders.read','orders.manage',
         'customers.read','customers.manage','inventory.read','inventory.manage','purchases.read',
         'purchases.manage','fiscal.read','fiscal.manage','fiscal.cancel','reports.read','settings.manage'
       ]) AS pc
       UNION ALL SELECT 'manager', unnest(ARRAY[
         'catalog.read','catalog.manage','orders.read','orders.manage','customers.read','customers.manage',
         'inventory.read','inventory.manage','purchases.read','purchases.manage','fiscal.read','fiscal.manage',
         'reports.read'
       ])
       UNION ALL SELECT 'operator', unnest(ARRAY[
         'catalog.read','orders.read','orders.manage','customers.read','inventory.read','inventory.manage',
         'fiscal.read'
       ])
       UNION ALL SELECT 'viewer', unnest(ARRAY[
         'catalog.read','orders.read','customers.read','inventory.read','purchases.read','fiscal.read','reports.read'
       ])
     )
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM pairs pa JOIN r ON r.code = pa.rc JOIN p ON p.code = pa.pc
ON CONFLICT DO NOTHING;

-- =========================================================
-- 4) INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS user_roles_store_id_idx ON public.user_roles(store_id);
CREATE INDEX IF NOT EXISTS user_roles_role_id_idx ON public.user_roles(role_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_unique_idx ON public.user_roles(user_id, role_id, COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON public.audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON public.audit_log(actor_user_id, created_at DESC);

-- =========================================================
-- 5) RLS — admin & self access
-- =========================================================
DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
CREATE POLICY profiles_self_read ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS profiles_super_admin_insert ON public.profiles;
CREATE POLICY profiles_super_admin_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS user_roles_self_read ON public.user_roles;
CREATE POLICY user_roles_self_read ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS user_roles_super_admin_write ON public.user_roles;
CREATE POLICY user_roles_super_admin_write ON public.user_roles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- audit_log: super admin reads all, user reads own actor entries
DROP POLICY IF EXISTS audit_log_super_admin_read ON public.audit_log;
CREATE POLICY audit_log_super_admin_read ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR actor_user_id = auth.uid());

-- user_sessions: own + super admin
DROP POLICY IF EXISTS user_sessions_self_read ON public.user_sessions;
CREATE POLICY user_sessions_self_read ON public.user_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS user_sessions_super_admin_delete ON public.user_sessions;
CREATE POLICY user_sessions_super_admin_delete ON public.user_sessions FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR user_id = auth.uid());

-- =========================================================
-- 6) OUTBOX TRIGGERS — user lifecycle events
-- =========================================================
CREATE OR REPLACE FUNCTION public.tg_user_roles_outbox()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event text;
  v_user uuid;
  v_payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'user.role_assigned';
    v_user := NEW.user_id;
    v_payload := jsonb_build_object('user_id', NEW.user_id, 'role_id', NEW.role_id, 'store_id', NEW.store_id, 'granted_by', NEW.granted_by);
  ELSIF TG_OP = 'DELETE' THEN
    v_event := 'user.role_revoked';
    v_user := OLD.user_id;
    v_payload := jsonb_build_object('user_id', OLD.user_id, 'role_id', OLD.role_id, 'store_id', OLD.store_id);
  END IF;
  INSERT INTO public.event_outbox (store_id, aggregate_type, aggregate_id, event_type, payload)
  VALUES (COALESCE(NEW.store_id, OLD.store_id), 'user', v_user, v_event, v_payload);
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS user_roles_outbox ON public.user_roles;
CREATE TRIGGER user_roles_outbox
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.tg_user_roles_outbox();

CREATE OR REPLACE FUNCTION public.tg_profiles_outbox()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event text;
BEGIN
  IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    v_event := CASE WHEN NEW.is_active THEN 'user.activated' ELSE 'user.deactivated' END;
    INSERT INTO public.event_outbox (aggregate_type, aggregate_id, event_type, payload)
    VALUES ('user', NEW.user_id, v_event, jsonb_build_object('user_id', NEW.user_id));
  END IF;
  IF OLD.is_blocked IS DISTINCT FROM NEW.is_blocked THEN
    v_event := CASE WHEN NEW.is_blocked THEN 'user.blocked' ELSE 'user.unblocked' END;
    INSERT INTO public.event_outbox (aggregate_type, aggregate_id, event_type, payload)
    VALUES ('user', NEW.user_id, v_event, jsonb_build_object('user_id', NEW.user_id, 'reason', NEW.blocked_reason));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_outbox ON public.profiles;
CREATE TRIGGER profiles_outbox
  AFTER UPDATE OF is_active, is_blocked ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_outbox();

-- updated_at maintainer for profiles
DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
