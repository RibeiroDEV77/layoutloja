
CREATE POLICY "Authenticated can read dam" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'dam');
CREATE POLICY "Authenticated can insert dam" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'dam');
CREATE POLICY "Authenticated can update dam" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'dam');
CREATE POLICY "Authenticated can delete dam" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'dam');
