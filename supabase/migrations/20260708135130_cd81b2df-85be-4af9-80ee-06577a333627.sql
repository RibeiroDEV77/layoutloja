
-- Fix asset_folders: split ALL policy so DELETE requires dam.update (or super admin)
DROP POLICY IF EXISTS asset_folders_all ON public.asset_folders;

CREATE POLICY asset_folders_select ON public.asset_folders
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'dam.read', store_id));

CREATE POLICY asset_folders_insert ON public.asset_folders
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'dam.update', store_id));

CREATE POLICY asset_folders_update ON public.asset_folders
  FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'dam.update', store_id))
  WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'dam.update', store_id));

CREATE POLICY asset_folders_delete ON public.asset_folders
  FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'dam.update', store_id));

-- Fix asset_tags: same pattern
DROP POLICY IF EXISTS asset_tags_all ON public.asset_tags;

CREATE POLICY asset_tags_select ON public.asset_tags
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'dam.read', store_id));

CREATE POLICY asset_tags_insert ON public.asset_tags
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'dam.update', store_id));

CREATE POLICY asset_tags_update ON public.asset_tags
  FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'dam.update', store_id))
  WITH CHECK (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'dam.update', store_id));

CREATE POLICY asset_tags_delete ON public.asset_tags
  FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()) OR has_permission(auth.uid(), 'dam.update', store_id));

-- Fix payment_gateways: restrict access to encrypted credential columns
-- Encrypted blobs and fingerprints must not be readable by broad payments.read holders.
-- Revoke column privileges from authenticated so that only service_role (via SECURITY DEFINER
-- decryption functions) can read the raw ciphertext. Application code does not select these
-- columns directly; encryption/decryption is performed exclusively through server functions.
REVOKE SELECT (credentials_encrypted, webhook_secret_encrypted, credentials_fingerprint)
  ON public.payment_gateways FROM authenticated;
REVOKE UPDATE (credentials_encrypted, webhook_secret_encrypted, credentials_fingerprint)
  ON public.payment_gateways FROM authenticated;
REVOKE INSERT (credentials_encrypted, webhook_secret_encrypted, credentials_fingerprint)
  ON public.payment_gateways FROM authenticated;
