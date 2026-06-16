-- ETAPA 6B Fase 3 — Lista de espera.
-- Fila de pacientes aguardando vaga. Quando um slot é liberado (cancelou/faltou),
-- o ClinicOS grava em agente_eventos (tipo 'slot_liberado') e o agente oferece ao próximo.

CREATE TABLE IF NOT EXISTS public.lista_espera (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  nome          TEXT NOT NULL,
  whatsapp      TEXT,
  agenda_id     UUID REFERENCES public.agendas(id) ON DELETE SET NULL,  -- profissional preferido
  procedimento  TEXT,
  preferencias  TEXT,                 -- dias/horários preferidos (texto livre)
  prioridade    INT NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'aguardando',  -- aguardando | oferecido | agendado | removido
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lista_espera_status ON public.lista_espera (status, prioridade DESC, created_at);

ALTER TABLE public.lista_espera ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lista_espera' AND policyname='lista_espera_auth') THEN
    CREATE POLICY "lista_espera_auth" ON public.lista_espera FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
