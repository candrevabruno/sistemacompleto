-- ════════════════════════════════════════════════════════════════════════════
-- MIGRATION-PONTE 4 — colunas de tracking p/ WF04 (lista_espera) e WF05 (anamnese)
-- Última ponte da Fase 1. csat_respostas/nps_respostas já bastam p/ WF08/WF08d.
-- ════════════════════════════════════════════════════════════════════════════

-- ── lista_espera (WF04): estado da oferta de vaga + contador de recusas ───────
-- A tabela do sistema é lead-cêntrica (lead_id, nome, whatsapp, procedimento,
-- status aguardando|oferecido|agendado|removido). Faltam os campos da oferta.
ALTER TABLE public.lista_espera
  ADD COLUMN IF NOT EXISTS recusas_count        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS oferta_enviada_em     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS oferta_expira_em      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS oferta_slot_time      TEXT,
  ADD COLUMN IF NOT EXISTS oferta_slot_exibicao  TEXT,
  ADD COLUMN IF NOT EXISTS aceita_em             TIMESTAMPTZ;

-- ── form_submissions (WF05 anamnese): status do pedido + queixa + lembrete ────
-- form_submissions guarda respostas Tally (lead_id, formulario_id, resumo_ia...).
-- O agente também controla o pedido de anamnese (pendente/concluida) e o lembrete.
ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS status              TEXT DEFAULT 'pendente',  -- pendente | concluida
  ADD COLUMN IF NOT EXISTS queixa_principal    TEXT,
  ADD COLUMN IF NOT EXISTS lembrete_enviado    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lembrete_enviado_em TIMESTAMPTZ;
