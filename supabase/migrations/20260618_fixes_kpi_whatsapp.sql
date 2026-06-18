-- Move "Tempo de Resposta" para o pilar Operacional
UPDATE public.kpi_catalog
  SET pilar = 'operacional', ordem = 6
  WHERE codigo = 'exp_resp_tempo';

-- WhatsApp da Heroic Leap configurável pelo super_admin (botões de upgrade)
ALTER TABLE public.clinic_config
  ADD COLUMN IF NOT EXISTS heroic_leap_whatsapp TEXT;

NOTIFY pgrst, 'reload schema';
