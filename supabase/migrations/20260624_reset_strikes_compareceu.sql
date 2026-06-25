-- ════════════════════════════════════════════════════════════════════════════
-- Fase 1 (1j) — Reset de strikes ao comparecer (Decisão v3).
-- "Paciente comparece após falta → zera contador."
--
-- O status 'compareceu' é gravado pelo SISTEMA (src/pages/Pacientes.tsx
-- marcarPresenca e src/pages/CRM.tsx fluxo "converteu"), NÃO pelo cal-webhook
-- (o Cal.com não conhece comparecimento). Por isso o reset é um TRIGGER no banco:
-- dispara seja qual for o autor da escrita (UI, cal-webhook ou workflow).
-- Espelha o padrão do trigger de RFM (trg_agendamentos_rfm).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trg_reset_strikes_compareceu()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL
     AND NEW.status = 'compareceu'
     AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
    UPDATE public.leads
       SET faltas_consecutivas = 0,
           no_show_risco       = false
     WHERE id = NEW.lead_id
       AND (COALESCE(faltas_consecutivas, 0) <> 0 OR COALESCE(no_show_risco, false) <> false);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agendamentos_reset_strikes ON public.agendamentos;
CREATE TRIGGER trg_agendamentos_reset_strikes
  AFTER INSERT OR UPDATE OF status ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_reset_strikes_compareceu();
