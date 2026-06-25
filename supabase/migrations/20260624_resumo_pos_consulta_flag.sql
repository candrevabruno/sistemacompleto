-- ════════════════════════════════════════════════════════════════════════════
-- Fase 3 (3a) — Flag 'resumo_pos_consulta_ativo'.
-- O WF01 só faz a pergunta de opt-in (essencial/completo) quando o resumo
-- pós-consulta está ativo na clínica. Padrão = true (ativo). Para desligar:
--   UPDATE feature_flags SET ativo=false WHERE chave='resumo_pos_consulta_ativo';
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.feature_flags (chave, ativo)
SELECT 'resumo_pos_consulta_ativo', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.feature_flags WHERE chave = 'resumo_pos_consulta_ativo'
);
