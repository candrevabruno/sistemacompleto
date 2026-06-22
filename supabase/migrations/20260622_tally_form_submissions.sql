-- Adiciona campos de integração Tally em clinic_config.
ALTER TABLE public.clinic_config
  ADD COLUMN IF NOT EXISTS tally_formulario_id  TEXT,
  ADD COLUMN IF NOT EXISTS tally_webhook_url     TEXT;

-- Expande form_submissions para suportar integração Tally completa.
-- Campos existentes: id, lead_id, whatsapp_number, form_type, form_name, dados, tally_submission_id, created_at
ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS paciente_id    UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agendamento_id UUID,
  ADD COLUMN IF NOT EXISTS formulario_id  TEXT,
  ADD COLUMN IF NOT EXISTS resumo_ia      TEXT,
  ADD COLUMN IF NOT EXISTS visualizado    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS arquivado      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_form_submissions_paciente
  ON public.form_submissions (paciente_id);

CREATE INDEX IF NOT EXISTS idx_form_submissions_formulario
  ON public.form_submissions (formulario_id, criado_em DESC);
