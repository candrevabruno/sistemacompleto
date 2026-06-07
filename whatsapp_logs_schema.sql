-- ============================================================
-- WhatsApp Logs — tabela de auditoria de mensagens enviadas/recebidas
-- Execute este script no Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider      TEXT NOT NULL CHECK (provider IN ('evolution', 'meta')),
  direction     TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  phone         TEXT,
  message_type  TEXT DEFAULT 'text',
  payload       JSONB,
  status        TEXT DEFAULT 'success' CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at  ON whatsapp_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_phone       ON whatsapp_logs(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_direction   ON whatsapp_logs(direction);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status      ON whatsapp_logs(status);

ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ler os logs
CREATE POLICY "auth_read_whatsapp_logs"
  ON whatsapp_logs FOR SELECT TO authenticated USING (true);

-- Edge Functions (service_role) bypassam RLS automaticamente — sem política extra necessária
