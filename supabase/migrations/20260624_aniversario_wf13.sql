-- ════════════════════════════════════════════════════════════════════════════
-- WF13 — Aniversário (envio individual no dia exato, NÃO em massa).
-- O WF13 roda diariamente, busca quem faz aniversário HOJE (fuso da clínica) e
-- envia 1 a 1. Esta coluna evita reenvio no mesmo ano; a flag liga/desliga.
--   Desligar:  UPDATE feature_flags SET ativo=false WHERE chave='aniversario_ativo';
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS aniversario_enviado_em TIMESTAMPTZ;

INSERT INTO public.feature_flags (chave, ativo)
SELECT 'aniversario_ativo', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.feature_flags WHERE chave = 'aniversario_ativo'
);
