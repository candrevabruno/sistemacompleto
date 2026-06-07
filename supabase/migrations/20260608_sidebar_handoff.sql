-- Handoff IA ↔ Humano e origem do lead
ALTER TABLE public.conversas
  ADD COLUMN IF NOT EXISTS handoff_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handoff_by UUID,
  ADD COLUMN IF NOT EXISTS handoff_by_name TEXT,
  ADD COLUMN IF NOT EXISTS ia_ultima_acao TEXT,
  ADD COLUMN IF NOT EXISTS ia_ultima_interacao_at TIMESTAMPTZ;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS origem TEXT;
