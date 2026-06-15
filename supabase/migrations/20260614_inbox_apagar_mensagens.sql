-- COMPLEMENTO ETAPA 6A — tratamento de mensagens apagadas no Inbox.
-- Persistência preservada (registro nunca é deletado de fato) — LGPD.
--   • apagada_pelo_contato  → paciente apagou no WhatsApp; fica marcada/esmaecida (Regra 1)
--   • apagada_para_todos    → clínica apagou para todos via Evolution (Regra 2)
--   • oculta_local          → some do Inbox da clínica, permanece no banco (Regras 2 e 3)
--   • apagada_por / apagada_at → auditoria de quem ocultou/apagou no painel

ALTER TABLE public.mensagens
  ADD COLUMN IF NOT EXISTS apagada_pelo_contato BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS apagada_para_todos   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS oculta_local         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS apagada_por          UUID,
  ADD COLUMN IF NOT EXISTS apagada_at           TIMESTAMPTZ;

-- RLS permissiva para authenticated (o agente/n8n usa service_role e ignora RLS).
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mensagens' AND policyname='mensagens_auth') THEN
    CREATE POLICY "mensagens_auth" ON public.mensagens FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- LGPD (Etapa 7): a persistência de mensagens após apagamento no WhatsApp deve
-- ser coberta pelo termo de consentimento. <<MARCADOR-LGPD-ETAPA7>>

NOTIFY pgrst, 'reload schema';
