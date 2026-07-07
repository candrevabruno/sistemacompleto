-- ============================================================
-- Fix: colunas score_* de leads devem ser TEXT (Método SCORE)
-- ============================================================
-- Sintoma: WF01 "Grava SCORE no Lead" falhava com
--   "COALESCE types text and integer cannot be matched".
-- Causa: alguma score_* foi criada como integer numa migration antiga;
--   o ADD COLUMN IF NOT EXISTS (20260614_perfil_paciente_fix) não troca tipo.
-- Design: TODAS as score_* guardam texto livre / rótulos (frio, qualificacao...).
-- Idempotente: se já for text, o ::text é no-op.
-- ============================================================

ALTER TABLE public.leads
  ALTER COLUMN score_sonho       TYPE text USING score_sonho::text,
  ALTER COLUMN score_contexto    TYPE text USING score_contexto::text,
  ALTER COLUMN score_obstaculo   TYPE text USING score_obstaculo::text,
  ALTER COLUMN score_rota        TYPE text USING score_rota::text,
  ALTER COLUMN score_gatilho     TYPE text USING score_gatilho::text,
  ALTER COLUMN score_perfil      TYPE text USING score_perfil::text,
  ALTER COLUMN score_trilha      TYPE text USING score_trilha::text,
  ALTER COLUMN score_temperatura TYPE text USING score_temperatura::text;
