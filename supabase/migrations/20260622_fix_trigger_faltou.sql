-- Fix: fechar_episodio_atendimento usava 'nao_compareceu' mas o enum é 'faltou'
-- Resultado: episódios de no-show nunca fechavam → KPI op_no_show sempre zerado.

CREATE OR REPLACE FUNCTION public.fechar_episodio_atendimento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.episodio_id IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'compareceu' THEN
      UPDATE public.episodio_atendimento
        SET final_status = 'realizado', final_status_at = NOW()
        WHERE id = NEW.episodio_id AND final_status IS NULL;
    ELSIF NEW.status = 'faltou' THEN
      UPDATE public.episodio_atendimento
        SET final_status = 'no_show', final_status_at = NOW()
        WHERE id = NEW.episodio_id AND final_status IS NULL;
    ELSIF NEW.status = 'cancelado' THEN
      UPDATE public.episodio_atendimento
        SET final_status = 'cancelado', final_status_at = NOW()
        WHERE id = NEW.episodio_id AND final_status IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
