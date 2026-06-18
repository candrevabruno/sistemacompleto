-- ETAPA 7 — Parte 3: Logs / Saúde das Integrações
-- Cria tabela integration_log para monitoramento das integrações externas.
-- Execute no Supabase SQL Editor.

-- ── 1. Tabela integration_log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.integration_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  servico        TEXT        NOT NULL,  -- calcom | evolution | meta | n8n_eventos | n8n_intake
  nivel          TEXT        NOT NULL CHECK (nivel IN ('info', 'warn', 'error')),
  origem         TEXT        NOT NULL,  -- nome da edge function ou módulo
  mensagem       TEXT,
  payload_resumo JSONB,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Índices ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_integration_log_servico   ON public.integration_log (servico, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_integration_log_nivel     ON public.integration_log (nivel, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_integration_log_criado_em ON public.integration_log (criado_em DESC);

-- ── 3. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.integration_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "integration_log_select_admin" ON public.integration_log FOR SELECT TO authenticated
    USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "integration_log_insert_auth" ON public.integration_log FOR INSERT TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
