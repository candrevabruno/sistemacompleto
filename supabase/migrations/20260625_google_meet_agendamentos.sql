-- Migration: suporte a Google Meet via Cal.com
-- Adiciona tipo_consulta, link_reuniao e notificacao_grupo_enviada em agendamentos

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS tipo_consulta           TEXT,
  ADD COLUMN IF NOT EXISTS link_reuniao            TEXT,
  ADD COLUMN IF NOT EXISTS notificacao_grupo_enviada BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.agendamentos.tipo_consulta            IS 'presencial | online (alias de modalidade, escrito pelo cal-webhook)';
COMMENT ON COLUMN public.agendamentos.link_reuniao             IS 'Link do Google Meet ou outro serviço de videoconferência';
COMMENT ON COLUMN public.agendamentos.notificacao_grupo_enviada IS 'Flag que evita reenvio de notificação de criação ao grupo do WhatsApp';
