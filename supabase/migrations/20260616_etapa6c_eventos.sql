-- ETAPA 6C — Módulo Eventos
--  - clinic_campaigns: "Ações do mês" (campanhas sazonais) que alimentam o contexto do agente.
--    Status ativo/arquivado (NUNCA exclui — histórico e reuso).
--  - clinic_config: webhooks n8n de aniversário e de solicitação de upgrade (Heroic Leap).

-- ── Campanhas (Ações do mês) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_campaigns (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo       text NOT NULL,
  descricao    text,
  oferta       text,                -- ex.: "20% em faciais"
  data_inicio  date,
  data_fim     date,
  status       text NOT NULL DEFAULT 'ativa',   -- 'ativa' | 'arquivada'
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clinic_campaigns ADD COLUMN IF NOT EXISTS oferta text;
ALTER TABLE clinic_campaigns ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_clinic_campaigns_status ON clinic_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_clinic_campaigns_periodo ON clinic_campaigns(data_inicio, data_fim);

ALTER TABLE clinic_campaigns ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clinic_campaigns' AND policyname='clinic_campaigns_auth') THEN
    CREATE POLICY clinic_campaigns_auth ON clinic_campaigns
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Webhooks n8n para Eventos ───────────────────────────────────────────────
ALTER TABLE clinic_config ADD COLUMN IF NOT EXISTS aniversario_webhook_url text;
ALTER TABLE clinic_config ADD COLUMN IF NOT EXISTS upgrade_webhook_url text;

NOTIFY pgrst, 'reload schema';
