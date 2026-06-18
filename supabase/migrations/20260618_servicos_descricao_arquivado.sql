-- Adiciona descrição e soft-delete nos serviços prestados.
-- Execute no Supabase SQL Editor.

ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS descricao  TEXT,
  ADD COLUMN IF NOT EXISTS arquivado  BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_servicos_arquivado ON public.servicos (arquivado);

NOTIFY pgrst, 'reload schema';
