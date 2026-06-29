-- Migration: adiciona tipo_contato na tabela conversas
-- Usado pelo webhook-evolution para distinguir contatos novos de pacientes retornando.
-- Valores: 'novo' (primeiro contato) | 'retorno' (lead com status='converteu')

ALTER TABLE public.conversas
  ADD COLUMN IF NOT EXISTS tipo_contato TEXT DEFAULT 'novo';

COMMENT ON COLUMN public.conversas.tipo_contato IS
  'Tipo do contato ao abrir a conversa: novo | retorno. Preenchido pelo webhook-evolution.';
