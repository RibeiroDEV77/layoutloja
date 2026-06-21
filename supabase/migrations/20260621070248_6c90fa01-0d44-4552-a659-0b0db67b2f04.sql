
-- Políticas para o bucket 'dam' (DAM binary storage).
-- O server enforce dam.upload / dam.read via requirePermission antes de gerar URLs assinadas.
-- Estas policies habilitam o caminho assinado para usuários autenticados.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='dam_select_authenticated') THEN
    CREATE POLICY "dam_select_authenticated" ON storage.objects
      FOR SELECT TO authenticated USING (bucket_id = 'dam');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='dam_insert_authenticated') THEN
    CREATE POLICY "dam_insert_authenticated" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'dam');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='dam_update_authenticated') THEN
    CREATE POLICY "dam_update_authenticated" ON storage.objects
      FOR UPDATE TO authenticated USING (bucket_id = 'dam') WITH CHECK (bucket_id = 'dam');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='dam_delete_authenticated') THEN
    CREATE POLICY "dam_delete_authenticated" ON storage.objects
      FOR DELETE TO authenticated USING (bucket_id = 'dam');
  END IF;
END $$;
