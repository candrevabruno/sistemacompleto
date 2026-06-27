-- Migration: RAG — Base de Conhecimento (pgvector)
-- Usada pelo WF01 para busca semântica antes de gerar respostas com GPT

-- 1. Habilitar pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Tabela de embeddings da base de conhecimento
CREATE TABLE IF NOT EXISTS public.base_conhecimento (
  id        BIGSERIAL PRIMARY KEY,
  content   TEXT,
  metadata  JSONB,
  embedding extensions.vector(1536)
);

-- 3. Função de busca vetorial (chamada pelo WF01 via RPC)
CREATE OR REPLACE FUNCTION public.match_base_conhecimento(
  query_embedding extensions.vector(1536),
  match_count     INT   DEFAULT 5,
  filter          JSONB DEFAULT '{}'
)
RETURNS TABLE (
  id         BIGINT,
  content    TEXT,
  metadata   JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    id,
    content,
    metadata,
    1 - (base_conhecimento.embedding <=> query_embedding) AS similarity
  FROM public.base_conhecimento
  WHERE metadata @> filter
  ORDER BY base_conhecimento.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4. Tabela auxiliar para rastrear documentos carregados (usada pelo workflow de ingestão RAG)
CREATE TABLE IF NOT EXISTS public.documentos_base (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id        TEXT NOT NULL UNIQUE,
  nome_arquivo   TEXT,
  processado_em  TIMESTAMPTZ DEFAULT now(),
  status         TEXT DEFAULT 'concluido'
);

-- 5. RLS — somente service_role pode ler/escrever
ALTER TABLE public.base_conhecimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_base   ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "service_role_base_conhecimento"
  ON public.base_conhecimento FOR ALL TO service_role USING (true);

CREATE POLICY IF NOT EXISTS "service_role_documentos_base"
  ON public.documentos_base FOR ALL TO service_role USING (true);
