
-- ENUMS
DO $$ BEGIN CREATE TYPE public.asset_context AS ENUM ('product','category','brand','collection','banner','institutional','marketing','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.asset_kind AS ENUM ('image','video','youtube','vimeo','pdf','svg','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.asset_status AS ENUM ('active','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.asset_driver AS ENUM ('supabase','external','youtube','vimeo'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.asset_job_status AS ENUM ('pending','uploading','processing','done','failed','canceled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- assets
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  context public.asset_context NOT NULL DEFAULT 'other',
  kind public.asset_kind NOT NULL,
  status public.asset_status NOT NULL DEFAULT 'active',
  storage_driver public.asset_driver NOT NULL,
  bucket text, storage_path text, external_url text, external_id text,
  mime text, size_bytes bigint, width int, height int, duration_seconds numeric,
  sha256 text, original_filename text, title text, alt_text text, description text, caption text,
  webp_path text, thumb_path text, medium_path text,
  folder_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE UNIQUE INDEX assets_store_sha256_uq ON public.assets(store_id, sha256) WHERE sha256 IS NOT NULL;
CREATE INDEX assets_store_ctx_idx ON public.assets(store_id, context, status);
CREATE INDEX assets_store_kind_idx ON public.assets(store_id, kind, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.asset_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.asset_folders(id) ON DELETE CASCADE,
  context public.asset_context NOT NULL DEFAULT 'other',
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX asset_folders_store_idx ON public.asset_folders(store_id, context);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_folders TO authenticated;
GRANT ALL ON public.asset_folders TO service_role;
ALTER TABLE public.asset_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ADD CONSTRAINT assets_folder_fk FOREIGN KEY (folder_id) REFERENCES public.asset_folders(id) ON DELETE SET NULL;

CREATE TABLE public.asset_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_tags TO authenticated;
GRANT ALL ON public.asset_tags TO service_role;
ALTER TABLE public.asset_tags ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.asset_tag_map (
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.asset_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (asset_id, tag_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_tag_map TO authenticated;
GRANT ALL ON public.asset_tag_map TO service_role;
ALTER TABLE public.asset_tag_map ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.asset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  version_no int NOT NULL,
  storage_driver public.asset_driver NOT NULL,
  storage_path text, external_url text, sha256 text, size_bytes bigint, mime text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, version_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_versions TO authenticated;
GRANT ALL ON public.asset_versions TO service_role;
ALTER TABLE public.asset_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.asset_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
  owner_type text NOT NULL,
  owner_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'gallery',
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX asset_links_owner_idx ON public.asset_links(owner_type, owner_id);
CREATE INDEX asset_links_asset_idx ON public.asset_links(asset_id);
CREATE UNIQUE INDEX asset_links_unique ON public.asset_links(asset_id, owner_type, owner_id, role, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_links TO authenticated;
GRANT ALL ON public.asset_links TO service_role;
ALTER TABLE public.asset_links ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.asset_upload_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context public.asset_context NOT NULL DEFAULT 'other',
  filename text NOT NULL,
  size_bytes bigint, mime text,
  bytes_uploaded bigint NOT NULL DEFAULT 0,
  status public.asset_job_status NOT NULL DEFAULT 'pending',
  error text, attempts int NOT NULL DEFAULT 0,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX asset_upload_jobs_user_idx ON public.asset_upload_jobs(user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_upload_jobs TO authenticated;
GRANT ALL ON public.asset_upload_jobs TO service_role;
ALTER TABLE public.asset_upload_jobs ENABLE ROW LEVEL SECURITY;

-- FUNCTIONS / TRIGGERS
CREATE OR REPLACE FUNCTION public.asset_store_id(_asset_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM public.assets WHERE id = _asset_id
$$;

CREATE OR REPLACE FUNCTION public.assets_usage_count(_asset_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.asset_links WHERE asset_id = _asset_id
$$;

CREATE OR REPLACE FUNCTION public.prevent_delete_if_linked()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.asset_links WHERE asset_id = OLD.id) THEN
    RAISE EXCEPTION 'Asset % está vinculado e não pode ser excluído. Remova os vínculos ou arquive-o.', OLD.id;
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER assets_prevent_delete BEFORE DELETE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_if_linked();

CREATE OR REPLACE FUNCTION public.enforce_asset_storage_consistency()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.storage_driver = 'supabase' AND (NEW.storage_path IS NULL OR length(NEW.storage_path) = 0) THEN
    RAISE EXCEPTION 'storage_path é obrigatório para driver supabase';
  END IF;
  IF NEW.storage_driver = 'external' AND (NEW.external_url IS NULL OR length(NEW.external_url) = 0) THEN
    RAISE EXCEPTION 'external_url é obrigatório para driver external';
  END IF;
  IF NEW.storage_driver IN ('youtube','vimeo') AND (NEW.external_id IS NULL OR length(NEW.external_id) = 0) THEN
    RAISE EXCEPTION 'external_id é obrigatório para driver %', NEW.storage_driver;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER assets_storage_consistency BEFORE INSERT OR UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.enforce_asset_storage_consistency();

CREATE TRIGGER assets_set_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER asset_folders_set_updated_at BEFORE UPDATE ON public.asset_folders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER asset_upload_jobs_set_updated_at BEFORE UPDATE ON public.asset_upload_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER assets_audit AFTER INSERT OR UPDATE OR DELETE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER asset_links_audit AFTER INSERT OR UPDATE OR DELETE ON public.asset_links FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER asset_versions_audit AFTER INSERT OR UPDATE OR DELETE ON public.asset_versions FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- PERMISSIONS (table uses: code, module, description)
INSERT INTO public.permissions (code, module, description) VALUES
  ('dam.read','dam','Visualizar a biblioteca de mídias'),
  ('dam.upload','dam','Enviar/registrar novos ativos'),
  ('dam.update','dam','Editar metadados de ativos'),
  ('dam.archive','dam','Arquivar/restaurar ativos'),
  ('dam.delete','dam','Excluir ativos sem vínculos'),
  ('dam.link','dam','Vincular ativos a entidades')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.code IN ('super_admin','admin')
  AND p.code IN ('dam.read','dam.upload','dam.update','dam.archive','dam.delete','dam.link')
ON CONFLICT DO NOTHING;

-- POLICIES
CREATE POLICY assets_select ON public.assets FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR (store_id IN (SELECT public.user_store_ids(auth.uid())) AND public.has_permission(auth.uid(),'dam.read',store_id)));
CREATE POLICY assets_insert ON public.assets FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'dam.upload',store_id));
CREATE POLICY assets_update ON public.assets FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'dam.update',store_id))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'dam.update',store_id));
CREATE POLICY assets_delete ON public.assets FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'dam.delete',store_id));

CREATE POLICY asset_folders_all ON public.asset_folders FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'dam.read',store_id))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'dam.update',store_id));

CREATE POLICY asset_tags_all ON public.asset_tags FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'dam.read',store_id))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'dam.update',store_id));

CREATE POLICY asset_tag_map_all ON public.asset_tag_map FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'dam.read',public.asset_store_id(asset_id)))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'dam.update',public.asset_store_id(asset_id)));

CREATE POLICY asset_versions_select ON public.asset_versions FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'dam.read',public.asset_store_id(asset_id)));
CREATE POLICY asset_versions_insert ON public.asset_versions FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'dam.upload',public.asset_store_id(asset_id)));

CREATE POLICY asset_links_select ON public.asset_links FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'dam.read',public.asset_store_id(asset_id)));
CREATE POLICY asset_links_insert ON public.asset_links FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'dam.link',public.asset_store_id(asset_id)));
CREATE POLICY asset_links_update ON public.asset_links FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'dam.link',public.asset_store_id(asset_id)))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'dam.link',public.asset_store_id(asset_id)));
CREATE POLICY asset_links_delete ON public.asset_links FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'dam.link',public.asset_store_id(asset_id)));

CREATE POLICY asset_upload_jobs_own ON public.asset_upload_jobs FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
