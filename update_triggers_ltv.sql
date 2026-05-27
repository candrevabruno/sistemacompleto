-- 1. Atualizar função do trigger de jornada do lead para salvar valor_pago e serviços contratados
CREATE OR REPLACE FUNCTION public.log_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    NEW.jornada = jsonb_build_array(
      jsonb_build_object(
        'status', NEW.status,
        'timestamp', timezone('utc', now())::text,
        'valor_pago', CASE WHEN NEW.status = 'converteu' THEN COALESCE(NEW.valor_pago, 0) ELSE null END,
        'servicos_contratados', CASE WHEN NEW.status = 'converteu' THEN NEW.servicos_contratados ELSE null END
      )
    );
  ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.jornada IS NULL THEN
      NEW.jornada = '[]'::jsonb;
    END IF;
    
    NEW.jornada = NEW.jornada || jsonb_build_array(
      jsonb_build_object(
        'status', NEW.status,
        'timestamp', timezone('utc', now())::text,
        'valor_pago', CASE WHEN NEW.status = 'converteu' THEN COALESCE(NEW.valor_pago, 0) ELSE null END,
        'servicos_contratados', CASE WHEN NEW.status = 'converteu' THEN NEW.servicos_contratados ELSE null END
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atualizar função do trigger de cliente para não excluir o cliente da tabela clientes se o status do lead mudar
CREATE OR REPLACE FUNCTION public.converter_lead_em_cliente()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'converteu' THEN
    INSERT INTO public.clientes (lead_id, data_primeira_visita) 
    VALUES (NEW.id, CURRENT_DATE) 
    ON CONFLICT (lead_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
