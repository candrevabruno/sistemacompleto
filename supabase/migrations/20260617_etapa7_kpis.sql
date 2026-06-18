-- ETAPA 7 — Parte 4: KPIs do Pilar Experiência
-- Cria tabelas csat_respostas e nps_respostas; ativa cálculo dos KPIs.
-- Execute no Supabase SQL Editor.

-- ── 1. Tabela csat_respostas ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.csat_respostas (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      UUID        REFERENCES public.leads(id) ON DELETE SET NULL,
  paciente_id  UUID        REFERENCES public.pacientes(id) ON DELETE SET NULL,
  score        SMALLINT    NOT NULL CHECK (score BETWEEN 1 AND 5),
  comentario   TEXT,
  canal        TEXT,       -- 'whatsapp' | 'email' | 'tally'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_csat_lead_id    ON public.csat_respostas (lead_id);
CREATE INDEX IF NOT EXISTS idx_csat_created_at ON public.csat_respostas (created_at DESC);

ALTER TABLE public.csat_respostas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='csat_respostas' AND policyname='csat_respostas_auth') THEN
    CREATE POLICY "csat_respostas_auth" ON public.csat_respostas FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
CREATE POLICY "csat_respostas_insert" ON public.csat_respostas FOR INSERT TO authenticated WITH CHECK (true);

-- ── 2. Tabela nps_respostas ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nps_respostas (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      UUID        REFERENCES public.leads(id) ON DELETE SET NULL,
  paciente_id  UUID        REFERENCES public.pacientes(id) ON DELETE SET NULL,
  score        SMALLINT    NOT NULL CHECK (score BETWEEN 0 AND 10),
  comentario   TEXT,
  canal        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nps_lead_id    ON public.nps_respostas (lead_id);
CREATE INDEX IF NOT EXISTS idx_nps_created_at ON public.nps_respostas (created_at DESC);

ALTER TABLE public.nps_respostas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nps_respostas' AND policyname='nps_respostas_auth') THEN
    CREATE POLICY "nps_respostas_auth" ON public.nps_respostas FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
CREATE POLICY "nps_respostas_insert" ON public.nps_respostas FOR INSERT TO authenticated WITH CHECK (true);

-- ── 3. Garantir que apagar_paciente_completo deleta csat/nps ─────────────────
-- (A RPC já tem BEGIN/EXCEPTION WHEN undefined_table — seguro mesmo se existir)

-- ── 4. Ativar cálculo dos KPIs de Experiência ─────────────────────────────────
UPDATE public.kpi_catalog SET fonte = 'calculado'
WHERE codigo IN ('exp_nps', 'exp_csat', 'exp_reativacao');

NOTIFY pgrst, 'reload schema';
