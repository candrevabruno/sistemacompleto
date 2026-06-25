-- ════════════════════════════════════════════════════════════════════════════
-- Fase 4 (4c) — RFM unificado F+R+M (Decisão v3). Substitui a fórmula anterior.
--   Diamante : F>=3  E  R<90d   E  M alto
--   Fiel     : F>=3  E  R<90d
--   Potencial: F>=2  E  R<90d   (e também F==1 recente — catch-all de recentes)
--   Em Risco : F>=1  E  R 90–180d
--   Perdida  : R>180d
-- F = nº de comparecimentos; R = dias desde o último; M = SUM(valor_pago).
-- "M alto" = M >= feature_flags.rfm_monetario_minimo (default 2000).
-- Dashboard lê leads.segmento_rfm (não recalcula). Trigger trg_agendamentos_rfm
-- (já existente) continua recalculando ao mudar status de agendamento.
-- ════════════════════════════════════════════════════════════════════════════

-- Limiar monetário configurável (R$). Ajuste por clínica conforme ticket médio.
INSERT INTO public.feature_flags (chave, valor_texto, ativo)
SELECT 'rfm_monetario_minimo', '2000', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.feature_flags WHERE chave = 'rfm_monetario_minimo'
);

CREATE OR REPLACE FUNCTION public.calcular_segmento_rfm(p_lead_id UUID)
RETURNS TEXT
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  v_freq  INTEGER;   -- Frequência: nº de comparecimentos
  v_recd  INTEGER;   -- Recência: dias desde o último comparecimento
  v_monet NUMERIC;   -- Monetário: total pago em consultas realizadas
  v_m_min NUMERIC;   -- Limiar "M alto"
BEGIN
  SELECT COUNT(*),
         MIN(EXTRACT(DAY FROM (NOW() - data_hora_inicio)))::INT,
         COALESCE(SUM(valor_pago), 0)
    INTO v_freq, v_recd, v_monet
  FROM public.agendamentos
  WHERE lead_id = p_lead_id AND status = 'compareceu';

  IF v_freq IS NULL OR v_freq = 0 THEN
    RETURN NULL;                          -- sem histórico clínico: sem RFM
  END IF;

  v_m_min := COALESCE(
    (SELECT NULLIF(valor_texto,'')::numeric FROM public.feature_flags
       WHERE chave = 'rfm_monetario_minimo' AND profissional_id IS NULL LIMIT 1),
    2000);

  IF v_recd > 180 THEN
    RETURN 'Perdida';
  ELSIF v_recd >= 90 THEN
    RETURN 'Em Risco';                    -- R 90–180d (F>=1 garantido aqui)
  ELSE                                     -- R < 90d (recente)
    IF    v_freq >= 3 AND v_monet >= v_m_min THEN RETURN 'Diamante';
    ELSIF v_freq >= 3                        THEN RETURN 'Fiel';
    ELSIF v_freq >= 2                        THEN RETURN 'Potencial';
    ELSE                                          RETURN 'Potencial';  -- F==1 recente
    END IF;
  END IF;
END;
$$;

-- Re-backfill com a nova fórmula.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT lead_id FROM public.agendamentos
            WHERE lead_id IS NOT NULL AND status = 'compareceu' LOOP
    PERFORM public.recalcular_rfm_lead(r.lead_id);
  END LOOP;
END $$;
