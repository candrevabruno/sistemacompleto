-- Migration: RAG — Base de Conhecimento (pgvector)
-- Usada pelo WF01 para busca semântica antes de gerar respostas com GPT

-- Habilita extensão pgvector (necessária para colunas VECTOR)
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela de documentos indexados
CREATE TABLE IF NOT EXISTS public.base_conhecimento (
  id        BIGSERIAL PRIMARY KEY,
  content   TEXT NOT NULL,
  metadata  JSONB DEFAULT '{}',
  embedding VECTOR(1536)
);

-- Índice para acelerar buscas por similaridade (IVFFlat)
CREATE INDEX IF NOT EXISTS base_conhecimento_embedding_idx
  ON public.base_conhecimento
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Função de busca semântica chamada pelo WF01
CREATE OR REPLACE FUNCTION public.match_base_conhecimento(
  query_embedding VECTOR(1536),
  match_count     INT     DEFAULT 5,
  filter          JSONB   DEFAULT '{}'
)
RETURNS TABLE (
  id         BIGINT,
  content    TEXT,
  metadata   JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.content,
    b.metadata,
    1 - (b.embedding <=> query_embedding) AS similarity
  FROM public.base_conhecimento b
  WHERE b.embedding IS NOT NULL
    AND (filter = '{}' OR b.metadata @> filter)
  ORDER BY b.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
