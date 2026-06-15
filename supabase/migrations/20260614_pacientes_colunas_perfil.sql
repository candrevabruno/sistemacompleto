-- Corrige PGRST204 — colunas do perfil completo ausentes em public.pacientes.
-- (A migração 20260609 não aplicou estas colunas nesta instância.)
-- Sem elas, salvar a aba Dados do paciente retorna 400 (Bad Request).

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS endereco               JSONB,
  ADD COLUMN IF NOT EXISTS como_conheceu          TEXT,
  ADD COLUMN IF NOT EXISTS indicado_por_lead_id   UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo                   TEXT NOT NULL DEFAULT 'particular',
  ADD COLUMN IF NOT EXISTS convenio_nome          TEXT,
  ADD COLUMN IF NOT EXISTS convenio_numero        TEXT,
  ADD COLUMN IF NOT EXISTS preferencia_pagamento  TEXT,
  ADD COLUMN IF NOT EXISTS nf_documento           TEXT,
  ADD COLUMN IF NOT EXISTS nf_nome                TEXT,
  ADD COLUMN IF NOT EXISTS nf_endereco            JSONB,
  ADD COLUMN IF NOT EXISTS ultimo_resumo_conversa TEXT,
  ADD COLUMN IF NOT EXISTS ultimo_resumo_at       TIMESTAMPTZ;

-- Pós-consulta salva anotações com tipo 'resumo_consulta' — libera no CHECK.
ALTER TABLE public.anotacoes_paciente DROP CONSTRAINT IF EXISTS anotacoes_tipo_check;
ALTER TABLE public.anotacoes_paciente
  ADD CONSTRAINT anotacoes_tipo_check CHECK (tipo IN ('geral', 'profissional', 'resumo_consulta'));

-- Recarrega o cache de schema do PostgREST para reconhecer as colunas na hora.
NOTIFY pgrst, 'reload schema';
