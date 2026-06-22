-- RPC para apagar lead com todas as dependências
-- Mantém histórico de agendamentos (desvincula), remove ações e audit_log do lead.

CREATE OR REPLACE FUNCTION public.apagar_lead_completo(p_lead_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.agendamentos        SET lead_id = NULL WHERE lead_id = p_lead_id;
  UPDATE public.episodio_atendimento SET lead_id = NULL WHERE lead_id = p_lead_id;
  DELETE FROM public.acoes_lead      WHERE lead_id = p_lead_id;
  DELETE FROM public.audit_log       WHERE record_id = p_lead_id::text;
  DELETE FROM public.leads           WHERE id = p_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apagar_lead_completo(UUID) TO authenticated;
