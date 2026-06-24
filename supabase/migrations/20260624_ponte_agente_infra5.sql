-- ════════════════════════════════════════════════════════════════════════════
-- MIGRATION-PONTE 5 — checkins (rastreador de jornada do agente: CSAT/checkin/
-- evolução/NPS por ciclo). Usado por WF06/WF08/WF08b/WF08c/WF08d/WF11.
-- Sem equivalente direto no sistema (csat_respostas/nps_respostas guardam só o
-- score). Os WF08/WF08d também gravam o score em csat_respostas/nps_respostas
-- para o dashboard do sistema (dual-write). A decomposição completa via Edge
-- Function intake é Fase 3.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.checkins (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_id              UUID UNIQUE,          -- agendamentos.id (ON CONFLICT no WF06)
  lead_id                  UUID,
  paciente_id              UUID,
  profissional_id          UUID,
  etapa_atual              TEXT,
  orientacoes_resumo       TEXT,
  -- CSAT (D+2)
  csat_enviado_em          TIMESTAMPTZ,
  csat_resume_url          TEXT,
  csat_nota                SMALLINT,
  csat_positivo            BOOLEAN,
  csat_respondeu           BOOLEAN,
  csat_respondido_em       TIMESTAMPTZ,
  -- Check-in (D+15)
  checkin_enviado_em       TIMESTAMPTZ,
  checkin_respondeu        BOOLEAN,
  checkin_respondido_em    TIMESTAMPTZ,
  checkin_timeout          BOOLEAN,
  checkin_resumo           TEXT,
  checkin_resumo_abertura  TEXT,
  checkin_resumo_adesao    TEXT,
  checkin_resumo_experiencia TEXT,
  checkin_resposta         TEXT,
  -- Evolução (D+30)
  evolucao_enviada_em      TIMESTAMPTZ,
  evolucao_respondeu       BOOLEAN,
  evolucao_respondida      BOOLEAN,
  evolucao_resposta        TEXT,
  evolucao_timeout         BOOLEAN,
  -- NPS (D+45)
  nps_enviado              BOOLEAN,
  nps_enviado_em           TIMESTAMPTZ,
  nps_respondeu            BOOLEAN,
  nps_comentario           TEXT,
  nps_timeout              BOOLEAN,
  -- Encerramento do ciclo
  encerrado_em             TIMESTAMPTZ,
  motivo_encerramento      TEXT,
  criado_em                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_checkins_lead ON public.checkins (lead_id);

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='checkins' AND policyname='checkins_auth') THEN
    CREATE POLICY "checkins_auth" ON public.checkins FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
