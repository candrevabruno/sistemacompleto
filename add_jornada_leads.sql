-- 1. Adicionar coluna jornada do tipo JSONB
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS jornada jsonb DEFAULT '[]'::jsonb;

-- 2. Criar ou atualizar a função do trigger para registrar transições de status
CREATE OR REPLACE FUNCTION public.log_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Se for inserção de lead novo
  IF (TG_OP = 'INSERT') THEN
    NEW.jornada = jsonb_build_array(
      jsonb_build_object(
        'status', NEW.status,
        'timestamp', timezone('utc', now())::text
      )
    );
  -- Se for atualização e o status mudou
  ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Garante que o campo não seja nulo
    IF NEW.jornada IS NULL THEN
      NEW.jornada = '[]'::jsonb;
    END IF;
    
    -- Anexa o novo status à lista
    NEW.jornada = NEW.jornada || jsonb_build_array(
      jsonb_build_object(
        'status', NEW.status,
        'timestamp', timezone('utc', now())::text
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar o trigger de inserção/atualização na tabela leads
DROP TRIGGER IF EXISTS trigger_log_lead_status_change ON public.leads;
CREATE TRIGGER trigger_log_lead_status_change
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.log_lead_status_change();

-- 4. Migração de dados para leads antigos que não têm jornada preenchida
UPDATE public.leads 
SET jornada = jsonb_build_array(
  jsonb_build_object(
    'status', status,
    'timestamp', COALESCE(inicio_atendimento, created_at, now())::text
  )
) 
WHERE jornada IS NULL OR jsonb_array_length(jornada) = 0;
