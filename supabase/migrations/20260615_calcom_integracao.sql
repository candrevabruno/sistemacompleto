-- ETAPA 6B — Integração Cal.com (Sentido 1: Cal.com → ClinicOS via webhook).

-- Mapeia cada profissional (agenda) a um event-type do Cal.com.
ALTER TABLE public.agendas
  ADD COLUMN IF NOT EXISTS calcom_event_type_id TEXT;

-- Agendamentos vindos/sincronizados do Cal.com.
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS calcom_uid   TEXT,
  ADD COLUMN IF NOT EXISTS link_reuniao TEXT,
  ADD COLUMN IF NOT EXISTS modalidade   TEXT DEFAULT 'presencial';
-- Idempotência: uma reserva do Cal.com = um agendamento.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agendamentos_calcom_uid
  ON public.agendamentos (calcom_uid) WHERE calcom_uid IS NOT NULL;

-- Credenciais do Cal.com (api key p/ Sentido 2; secret p/ validar o webhook).
ALTER TABLE public.clinic_config
  ADD COLUMN IF NOT EXISTS calcom_api_key        TEXT,
  ADD COLUMN IF NOT EXISTS calcom_webhook_secret TEXT;

NOTIFY pgrst, 'reload schema';
