-- Materiais utilizados por procedimento (rastreabilidade ANVISA/clínica)
CREATE TABLE IF NOT EXISTS public.materiais_procedimento (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  procedimento_id UUID NOT NULL REFERENCES public.procedimentos_paciente(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  descricao     TEXT,
  lote          TEXT,
  validade      DATE,
  quantidade    TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por    UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_materiais_procedimento_proc
  ON public.materiais_procedimento (procedimento_id, criado_em);

ALTER TABLE public.materiais_procedimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON public.materiais_procedimento
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
