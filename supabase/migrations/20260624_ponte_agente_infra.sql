-- ════════════════════════════════════════════════════════════════════════════
-- MIGRATION-PONTE — infra dos workflows (n8n) sobre o schema do sistema
-- Pré-requisito da Fase 1 da reescrita (Decisões v2, item 1b).
-- Cria/ajusta SÓ o plumbing interno do agente que não tem equivalente no sistema.
-- NÃO recria tabelas que já existem no sistema (estas são remapeadas nos WFs):
--   estado_conversa -> conversas      consultas   -> agendamentos
--   fila_envios     -> agente_eventos  checkins    -> csat_respostas/nps_respostas/eventos_jornada
--   anamnese_resp.  -> form_submissions
-- Colunas das tabelas de infra = exatamente as que os nodes do WF00 já usam.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. conversas: estado da conversa do agente (folding de estado_conversa) ───
-- conversas já tem is_human (handoff), whatsapp_number, lead_id, ia_ultima_acao.
-- Faltam os campos de estado/fluxo que o agente mantém por conversa.
ALTER TABLE public.conversas
  ADD COLUMN IF NOT EXISTS estado_atual       TEXT DEFAULT 'novo',
  ADD COLUMN IF NOT EXISTS workflow_ativo      TEXT DEFAULT 'WF01',
  ADD COLUMN IF NOT EXISTS janela_24h_aberta   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS profissional_id     UUID;  -- single-tenant: opcional

-- ── 2. clinic_config: dados de clínica usados pelos workflows ─────────────────
ALTER TABLE public.clinic_config
  ADD COLUMN IF NOT EXISTS fuso_horario     TEXT DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS whatsapp_alertas TEXT;  -- número p/ alertas (médica/grupo)

-- ── 3. profissionais: VIEW de compatibilidade sobre users (single-tenant) ─────
-- Os workflows fazem JOIN profissionais pr ON pr.id = <profissional_id>.
-- No sistema, profissional = registro em users; dados de clínica vêm do singleton.
-- security_invoker: a view respeita o RLS das tabelas-base para o frontend.
-- public.users tem só id/role (nome e email vivem em auth.users). Em single-tenant,
-- o nome de exibição do profissional é o nome da clínica (clinic_config.nome).
CREATE OR REPLACE VIEW public.profissionais
WITH (security_invoker = true) AS
SELECT
  u.id,
  COALESCE(cc.nome, 'Profissional')                       AS nome_exibicao,
  COALESCE(cc.whatsapp_alertas, cc.heroic_leap_whatsapp)  AS whatsapp_pessoal,
  COALESCE(cc.fuso_horario, 'America/Sao_Paulo')          AS fuso_horario,
  true                                                    AS ativo
FROM public.users u
LEFT JOIN LATERAL (
  SELECT nome, whatsapp_alertas, heroic_leap_whatsapp, fuso_horario
  FROM public.clinic_config WHERE id = 1
) cc ON true;

-- ── 4. eventos_processados — dedup do WF00 ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.eventos_processados (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        TEXT NOT NULL,
  profissional_id UUID,
  workflow        TEXT,
  status          TEXT NOT NULL DEFAULT 'processing',
  ttl_expires_at  TIMESTAMPTZ NOT NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT eventos_processados_uniq UNIQUE (event_id, profissional_id)
);
CREATE INDEX IF NOT EXISTS idx_eventos_processados_ttl
  ON public.eventos_processados (ttl_expires_at);

-- ── 5. processing_locks — lock de concorrência do WF00 ───────────────────────
CREATE TABLE IF NOT EXISTS public.processing_locks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_key TEXT NOT NULL UNIQUE,
  workflow_id  TEXT,
  locked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_processing_locks_expires
  ON public.processing_locks (expires_at);

-- ── 6. log_decisoes — trilha de decisões do agente ───────────────────────────
CREATE TABLE IF NOT EXISTS public.log_decisoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID,
  paciente_id     UUID,
  lead_id         UUID,
  workflow        TEXT,
  acao            TEXT,
  detalhes        JSONB DEFAULT '{}'::jsonb,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_log_decisoes_wf ON public.log_decisoes (workflow, criado_em);

-- ── 7. erros_log — erros dos workflows ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.erros_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID,
  workflow        TEXT,
  severity        TEXT,
  mensagem        TEXT,
  detalhes        JSONB DEFAULT '{}'::jsonb,
  stack_trace     TEXT,
  resolvido       BOOLEAN NOT NULL DEFAULT false,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_erros_log_naoresolvido
  ON public.erros_log (resolvido, criado_em);

-- ── 8. RLS (regra do projeto: enable sempre com policy) ──────────────────────
-- Agente usa service_role (ignora RLS); frontend usa authenticated.
ALTER TABLE public.eventos_processados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_locks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_decisoes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erros_log           ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['eventos_processados','processing_locks','log_decisoes','erros_log'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=t||'_auth') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t||'_auth', t);
    END IF;
  END LOOP;
END $$;
