-- ════════════════════════════════════════════════════════════════════════════
-- Fase 4 — RFM (Decisão #6): segmentação Diamante | Fiel | Potencial | Em Risco | Perdida
-- Calculada do histórico (Frequência = nº de 'compareceu'; Recência = dias desde o
-- último). Diamante e Fiel têm GATE MANUAL no agente (nunca disparam automático).
-- Fonte da verdade no lead (agente é lead-cêntrico). Recalculada por trigger quando
-- um agendamento vira 'compareceu'.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS segmento_rfm TEXT;

-- Função pura: dado o lead, retorna o segmento RFM a partir dos agendamentos.
CREATE OR REPLACE FUNCTION public.calcular_segmento_rfm(p_lead_id UUID)
RETURNS TEXT
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  v_freq   INTEGER;   -- frequência: nº de comparecimentos
  v_recd   INTEGER;   -- recência: dias desde o último comparecimento
BEGIN
  SELECT COUNT(*),
         MIN(EXTRACT(DAY FROM (NOW() - data_hora_inicio)))::INT
    INTO v_freq, v_recd
  FROM public.agendamentos
  WHERE lead_id = p_lead_id AND status = 'compareceu';

  IF v_freq IS NULL OR v_freq = 0 THEN
    RETURN NULL;                         -- sem histórico clínico: sem RFM
  ELSIF v_recd <= 90 THEN
    RETURN CASE WHEN v_freq >= 3 THEN 'Diamante' ELSE 'Potencial' END;
  ELSIF v_recd <= 180 THEN
    RETURN CASE WHEN v_freq >= 3 THEN 'Fiel'     ELSE 'Em Risco'  END;
  ELSE
    RETURN CASE WHEN v_freq >= 3 THEN 'Em Risco' ELSE 'Perdida'   END;
  END IF;
END;
$$;

-- Recalcula e grava o segmento no lead (e espelha em pacientes, se existir).
CREATE OR REPLACE FUNCTION public.recalcular_rfm_lead(p_lead_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_seg TEXT;
BEGIN
  IF p_lead_id IS NULL THEN RETURN; END IF;
  v_seg := public.calcular_segmento_rfm(p_lead_id);
  UPDATE public.leads     SET segmento_rfm = v_seg WHERE id = p_lead_id;
  UPDATE public.pacientes SET segmento_rfm = v_seg WHERE lead_id = p_lead_id;
END;
$$;

-- Trigger: recalcula RFM quando um agendamento passa a 'compareceu' (ou muda status).
CREATE OR REPLACE FUNCTION public.trg_recalcular_rfm()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
    PERFORM public.recalcular_rfm_lead(NEW.lead_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agendamentos_rfm ON public.agendamentos;
CREATE TRIGGER trg_agendamentos_rfm
  AFTER INSERT OR UPDATE OF status ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_rfm();

-- Backfill inicial (todos os leads com histórico).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT lead_id FROM public.agendamentos WHERE lead_id IS NOT NULL AND status='compareceu' LOOP
    PERFORM public.recalcular_rfm_lead(r.lead_id);
  END LOOP;
END $$;
