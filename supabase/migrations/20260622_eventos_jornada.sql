-- Expande ciclos_jornada_paciente com campos de ciclo completo.
-- Tabela já existe (20260622_ciclos_jornada_paciente.sql) — só adiciona colunas.

ALTER TABLE public.ciclos_jornada_paciente
  ADD COLUMN IF NOT EXISTS numero_ciclo  INTEGER,
  ADD COLUMN IF NOT EXISTS iniciado_em   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fechado_em    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'concluido', 'perdido'));

-- Tabela de eventos da jornada premium.
-- Populada pelo n8n ao concluir cada etapa. A timeline lê daqui em tempo real.
-- UNIQUE (ciclo_id, etapa) permite upserts idempotentes do n8n.

CREATE TABLE IF NOT EXISTS public.eventos_jornada (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id     UUID        NOT NULL REFERENCES public.ciclos_jornada_paciente(id) ON DELETE CASCADE,
  etapa        TEXT        NOT NULL CHECK (etapa IN (
                             'pre_consulta','consulta','resumo_pos',
                             'csat','checkin','evolucao','nps','reativacao')),
  status       TEXT        NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente','concluido','pulado')),
  concluido_em TIMESTAMPTZ,
  dados        JSONB,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ciclo_id, etapa)
);

CREATE INDEX IF NOT EXISTS idx_eventos_jornada_ciclo
  ON public.eventos_jornada (ciclo_id);

ALTER TABLE public.eventos_jornada ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eventos_jornada_auth"
  ON public.eventos_jornada FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
