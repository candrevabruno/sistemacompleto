-- Retorno planejado (Pós-Consulta) ────────────────────────────────────────────
-- Fluxo:
--   1. Ao salvar resumo + retorno_esperado_em, o ClinicOS grava em agente_eventos:
--      • 'oferta_retorno_imediato'  → WF06 oferece o retorno logo após o resumo.
--      • 'lembrete_retorno'         → FALLBACK D-10 (retorno_esperado_em - 10 dias).
--   2. Se a paciente agendar (WF02 ou pela própria UI da Agenda), o lembrete D-10
--      vira desnecessário. Este trigger cancela automaticamente qualquer
--      'lembrete_retorno' pendente daquele lead assim que um agendamento é criado.
--
-- Status usados em agente_eventos (coluna TEXT, sem CHECK):
--   pendente | processado | cancelado | recusado | erro

-- Índice p/ a busca de eventos pendentes por lead (cancelamento e dedup).
CREATE INDEX IF NOT EXISTS idx_agente_eventos_lead_tipo_status
  ON public.agente_eventos (lead_id, tipo, status);

-- Cancela lembrete D-10 pendente quando a paciente já agendou.
CREATE OR REPLACE FUNCTION public.cancelar_lembrete_retorno_on_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL AND COALESCE(NEW.status, '') <> 'cancelado' THEN
    UPDATE public.agente_eventos
       SET status = 'cancelado',
           processed_at = now()
     WHERE tipo = 'lembrete_retorno'
       AND status = 'pendente'
       AND lead_id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancelar_lembrete_retorno ON public.agendamentos;
CREATE TRIGGER trg_cancelar_lembrete_retorno
  AFTER INSERT ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.cancelar_lembrete_retorno_on_agendamento();
