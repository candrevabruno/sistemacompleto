-- Migration: número do grupo de WhatsApp para notificações de agendamento (Cal.com)

ALTER TABLE public.clinic_config
  ADD COLUMN IF NOT EXISTS grupo_whatsapp_numero TEXT;

COMMENT ON COLUMN public.clinic_config.grupo_whatsapp_numero IS 'Número do grupo do WhatsApp para notificações de agendamento (apenas dígitos, sem @g.us). Ex: 120363425735191359';
