-- ETAPA 6B Fase 2 — disponibilidade, bloqueios e fila de eventos do agente.

-- ── Bloqueios de agenda (horário, dia inteiro ou período/férias) ─────────────
CREATE TABLE IF NOT EXISTS public.bloqueios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id   UUID NOT NULL REFERENCES public.agendas(id) ON DELETE CASCADE,
  inicio      TIMESTAMPTZ NOT NULL,
  fim         TIMESTAMPTZ NOT NULL,
  dia_inteiro BOOLEAN NOT NULL DEFAULT false,
  motivo      TEXT,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bloqueios_agenda_periodo ON public.bloqueios (agenda_id, inicio, fim);

-- ── Fila de eventos para o agente (n8n) ──────────────────────────────────────
-- ClinicOS grava aqui; o agente consome (status='pendente') e conduz o WhatsApp.
-- O agente usa service_role (bypassa RLS).
CREATE TABLE IF NOT EXISTS public.agente_eventos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo           TEXT NOT NULL,                 -- ex.: 'reagendar_por_bloqueio', 'slot_liberado'
  agendamento_id UUID,
  lead_id        UUID,
  agenda_id      UUID,
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  status         TEXT NOT NULL DEFAULT 'pendente',  -- pendente | processado | erro
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_agente_eventos_status ON public.agente_eventos (status, created_at);

-- URL opcional para o ClinicOS notificar o agente em tempo real (best-effort).
ALTER TABLE public.clinic_config
  ADD COLUMN IF NOT EXISTS agente_webhook_url TEXT;

-- ── RLS permissiva p/ authenticated (agente usa service_role e ignora RLS) ────
ALTER TABLE public.bloqueios      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agente_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_hours   ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bloqueios' AND policyname='bloqueios_auth') THEN
    CREATE POLICY "bloqueios_auth" ON public.bloqueios FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='agente_eventos' AND policyname='agente_eventos_auth') THEN
    CREATE POLICY "agente_eventos_auth" ON public.agente_eventos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='agenda_hours' AND policyname='agenda_hours_auth') THEN
    CREATE POLICY "agenda_hours_auth" ON public.agenda_hours FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
