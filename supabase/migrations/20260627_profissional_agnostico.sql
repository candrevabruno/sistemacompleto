-- ════════════════════════════════════════════════════════════════════════════
-- Profissão-agnóstico: título, tipo de profissional e WhatsApp de emergência
-- ════════════════════════════════════════════════════════════════════════════
-- Usado pelos prompts do agente: {{TITULO_PROFISSIONAL}}, {{TIPO_PROFISSIONAL}}
-- e {{CONTATO_URGENCIA}}. Permite que o agente atenda qualquer profissional de
-- saúde (médica, nutricionista, dentista, fisio...), não só "médica".
--
-- Single-tenant: os dados ficam em clinic_config(id=1) e são expostos pela
-- VIEW public.profissionais, que os workflows leem via JOIN.
--
-- Preenchimento: uma vez, no onboarding do cliente (cadastro da clínica).
-- Idempotente: seguro re-rodar.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Colunas de configuração da clínica ──────────────────────────────────────
ALTER TABLE public.clinic_config
  ADD COLUMN IF NOT EXISTS titulo              TEXT,   -- ex.: 'Dra.', 'Dr.', 'Nutri', 'Dr(a).'
  ADD COLUMN IF NOT EXISTS tipo_profissional   TEXT,   -- ex.: 'médica', 'nutricionista', 'dentista'
  ADD COLUMN IF NOT EXISTS whatsapp_emergencia TEXT,   -- contato de urgência (opcional)
  ADD COLUMN IF NOT EXISTS nome_assistente     TEXT;   -- nome do agente de IA ({{NOME_ASSISTENTE}})

COMMENT ON COLUMN public.clinic_config.titulo              IS 'Título exibido antes do nome ({{TITULO_PROFISSIONAL}}). Ex.: Dra., Dr., Nutri.';
COMMENT ON COLUMN public.clinic_config.tipo_profissional   IS 'Tipo de profissional ({{TIPO_PROFISSIONAL}}). Ex.: médica, nutricionista, dentista.';
COMMENT ON COLUMN public.clinic_config.whatsapp_emergencia IS 'Contato de urgência opcional ({{CONTATO_URGENCIA}}). Só usado se preenchido.';
COMMENT ON COLUMN public.clinic_config.nome_assistente     IS 'Nome do agente de IA ({{NOME_ASSISTENTE}}). Ex.: Lu, Sofia, Bia.';

-- 2. VIEW profissionais — recriada expondo os novos campos ────────────────────
-- Mantém todas as colunas da ponte-3 e acrescenta nome, titulo, tipo_profissional
-- e whatsapp_emergencia. DROP+CREATE porque CREATE OR REPLACE não reordena colunas.
DROP VIEW IF EXISTS public.profissionais;
CREATE VIEW public.profissionais
WITH (security_invoker = true) AS
SELECT
  u.id,
  COALESCE(cc.nome, 'Profissional')                       AS nome_exibicao,
  COALESCE(cc.nome, 'Profissional')                       AS nome,
  cc.titulo,
  cc.tipo_profissional,
  cc.nome_assistente,
  COALESCE(cc.whatsapp_alertas, cc.heroic_leap_whatsapp)  AS whatsapp_pessoal,
  cc.whatsapp_emergencia,
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
  SELECT nome, titulo, tipo_profissional, whatsapp_emergencia, nome_assistente,
         whatsapp_alertas, heroic_leap_whatsapp, fuso_horario,
         evolution_instance_name, calcom_event_type_id, calcom_api_key,
         horario_inicio, horario_fim, dias_atendimento, offset_confirmacao_minutos,
         tally_formulario_id, tally_form_id_retorno, anamnese_validade_meses
  FROM public.clinic_config WHERE id = 1
) cc ON true;

-- 3. (opcional) valores iniciais para a clínica atual ────────────────────────
-- Descomente e ajuste no onboarding:
-- UPDATE public.clinic_config
--   SET titulo = 'Dra.', tipo_profissional = 'médica'
--   WHERE id = 1;
