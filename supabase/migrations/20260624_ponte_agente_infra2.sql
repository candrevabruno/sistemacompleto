-- ════════════════════════════════════════════════════════════════════════════
-- MIGRATION-PONTE 2 — tabelas de infra do agente descobertas na varredura dos WFs
-- Completa a Fase 1 (1b): garante que toda tabela referenciada pelos workflows
-- existe no schema do sistema. Colunas = as que os nodes já consultam.
-- (relatorios_semanais NÃO é criada: pertence ao WF09/Kommo, que será eliminado.)
-- ════════════════════════════════════════════════════════════════════════════

-- ── prompt_versions — system prompts versionados do agente (WF01, WF06, ...) ──
-- O agente lê: WHERE tipo_prompt=... AND ativo=true (por profissional ou global).
-- Conteúdo carregado manualmente a partir de /workflows/prompts (passo de config).
CREATE TABLE IF NOT EXISTS public.prompt_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_prompt     TEXT NOT NULL,          -- ex.: 'wf06_resumo', 'assistente_base'
  conteudo        TEXT NOT NULL,
  versao          INTEGER NOT NULL DEFAULT 1,
  ativo           BOOLEAN NOT NULL DEFAULT false,
  profissional_id UUID,                   -- NULL = global (single-tenant)
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_lookup
  ON public.prompt_versions (tipo_prompt, ativo, profissional_id);

-- ── feriados — dias sem expediente (cálculo de horário comercial / dia útil) ──
CREATE TABLE IF NOT EXISTS public.feriados (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data            DATE NOT NULL,
  descricao       TEXT,
  profissional_id UUID,                   -- NULL = vale para toda a clínica
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feriados_data ON public.feriados (data, profissional_id);

-- ── memoria_fria — memória de longo prazo do paciente (resumo p/ contexto) ────
-- WF01 lê para dar contexto ao agente (última queixa/orientação, pontos-chave).
CREATE TABLE IF NOT EXISTS public.memoria_fria (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id       UUID,
  lead_id           UUID,
  pontos_chave      TEXT,
  ultima_queixa     TEXT,
  ultima_orientacao TEXT,
  gerado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_memoria_fria_paciente
  ON public.memoria_fria (paciente_id, gerado_em DESC);

-- ── RLS (regra do projeto: enable sempre com policy) ─────────────────────────
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feriados        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memoria_fria    ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['prompt_versions','feriados','memoria_fria'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=t||'_auth') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t||'_auth', t);
    END IF;
  END LOOP;
END $$;
