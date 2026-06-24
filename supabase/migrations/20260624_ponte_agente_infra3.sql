-- ════════════════════════════════════════════════════════════════════════════
-- MIGRATION-PONTE 3 — campos de config/integração + estado de workflow
-- Completa a Fase 1: expõe na VIEW profissionais e em clinic_config todos os
-- campos que os WFs leem (descobertos varrendo pr.* / scratch state).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. conversas.estado_wf — scratch state dos workflows (JSONB) ──────────────
-- Substitui as colunas wfXX_* do estado_conversa v3.4 (slots apresentados, slot
-- escolhido, resume URLs do n8n, agendamento_autonomo_bloqueado, etc.).
ALTER TABLE public.conversas
  ADD COLUMN IF NOT EXISTS estado_wf JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── 2. clinic_config — integrações e parâmetros que os WFs consultam ──────────
-- (evolution_instance_name, tally_formulario_id, whatsapp_provider já existem.)
ALTER TABLE public.clinic_config
  ADD COLUMN IF NOT EXISTS calcom_event_type_id        TEXT,
  ADD COLUMN IF NOT EXISTS calcom_api_key              TEXT,   -- idealmente env; aqui p/ o agente (service_role)
  ADD COLUMN IF NOT EXISTS horario_inicio              TIME    DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS horario_fim                 TIME    DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS dias_atendimento            TEXT    DEFAULT '1,2,3,4,5',  -- ISO dow (1=seg)
  ADD COLUMN IF NOT EXISTS offset_confirmacao_minutos  INTEGER DEFAULT 2880,         -- 48h
  ADD COLUMN IF NOT EXISTS tally_form_id_retorno       TEXT,
  ADD COLUMN IF NOT EXISTS anamnese_validade_meses     INTEGER DEFAULT 6;

-- ── 3. profissionais: VIEW expandida com todos os campos lidos pelos WFs ──────
-- Single-tenant: dados de profissional/clínica vêm de users + clinic_config(id=1).
-- DROP antes de recriar: a VIEW já existe (ponte-1) com outra ordem de colunas e
-- CREATE OR REPLACE não permite reordenar/renomear colunas existentes.
DROP VIEW IF EXISTS public.profissionais;
CREATE VIEW public.profissionais
WITH (security_invoker = true) AS
SELECT
  u.id,
  COALESCE(cc.nome, 'Profissional')                       AS nome_exibicao,
  COALESCE(cc.whatsapp_alertas, cc.heroic_leap_whatsapp)  AS whatsapp_pessoal,
  COALESCE(cc.fuso_horario, 'America/Sao_Paulo')          AS fuso_horario,
  cc.evolution_instance_name                              AS evolution_instance,
  cc.calcom_event_type_id,
  cc.calcom_api_key,
  cc.horario_inicio,
  cc.horario_fim,
  cc.dias_atendimento,
  cc.offset_confirmacao_minutos,
  cc.tally_formulario_id                                  AS tally_form_id_anamnese,
  cc.tally_form_id_retorno,
  cc.anamnese_validade_meses,
  true                                                    AS ativo
FROM public.users u
LEFT JOIN LATERAL (
  SELECT nome, whatsapp_alertas, heroic_leap_whatsapp, fuso_horario,
         evolution_instance_name, calcom_event_type_id, calcom_api_key,
         horario_inicio, horario_fim, dias_atendimento, offset_confirmacao_minutos,
         tally_formulario_id, tally_form_id_retorno, anamnese_validade_meses
  FROM public.clinic_config WHERE id = 1
) cc ON true;
