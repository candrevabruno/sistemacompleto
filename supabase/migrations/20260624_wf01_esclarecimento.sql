-- ════════════════════════════════════════════════════════════════════════════
-- Fase 2 (2d) — Classificação baixa: esclarecer antes de transferir.
-- Flag por conversa: o WF01 pede esclarecimento gentil na 1a baixa confiança
-- (seta true) e só transfere para humano se PERSISTIR (já true). Em qualquer
-- turno que volte a ter confiança, o WF01 limpa a flag (volta a false).
-- Coluna dedicada (não estado_wf JSONB) porque o WF01 atualiza via PostgREST,
-- que não faz merge parcial de JSONB.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.conversas
  ADD COLUMN IF NOT EXISTS wf01_esclarecimento_pendente BOOLEAN NOT NULL DEFAULT false;
