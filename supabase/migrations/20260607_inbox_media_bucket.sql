-- Bucket para arquivos enviados pelo inbox (fotos, documentos, vídeos)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'inbox-media',
    'inbox-media',
    true,
    52428800,
    ARRAY[
      'image/jpeg','image/png','image/gif','image/webp',
      'video/mp4','video/webm','video/quicktime',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ]
  );
EXCEPTION WHEN unique_violation THEN NULL;
END $$;

-- Leitura pública (Evolution API precisa acessar a URL)
DO $$
BEGIN
  CREATE POLICY "inbox_media_read" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'inbox-media');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Upload apenas para usuários autenticados
DO $$
BEGIN
  CREATE POLICY "inbox_media_insert" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'inbox-media');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Deleção permitida ao próprio usuário autenticado
DO $$
BEGIN
  CREATE POLICY "inbox_media_delete" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'inbox-media');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
