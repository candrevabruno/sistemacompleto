-- Ciclos de jornada do paciente: rastreia o retorno esperado por ciclo de tratamento.
-- "Ciclo ativo" = row mais recente com retorno_esperado_em não-nulo.

CREATE TABLE IF NOT EXISTS public.ciclos_jornada_paciente (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id         UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  lead_id             UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  retorno_esperado_em DATE,
  criado_por          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ciclos_jornada_paciente
  ON public.ciclos_jornada_paciente (paciente_id, created_at DESC);

ALTER TABLE public.ciclos_jornada_paciente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ciclos_jornada_auth"
  ON public.ciclos_jornada_paciente
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
