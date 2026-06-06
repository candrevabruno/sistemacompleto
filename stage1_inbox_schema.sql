-- ============================================================
-- ETAPA 1: Inbox WhatsApp — Banco de Dados
-- Execute este script no Supabase SQL Editor
-- ============================================================

-- 1. Adicionar colunas de configuração WhatsApp ao clinic_config
ALTER TABLE clinic_config
  ADD COLUMN IF NOT EXISTS whatsapp_provider       TEXT DEFAULT 'meta',
  ADD COLUMN IF NOT EXISTS meta_phone_number_id    TEXT,
  ADD COLUMN IF NOT EXISTS meta_access_token       TEXT,
  ADD COLUMN IF NOT EXISTS meta_webhook_verify_token TEXT,
  ADD COLUMN IF NOT EXISTS meta_business_account_id TEXT,
  ADD COLUMN IF NOT EXISTS evolution_server_url    TEXT,
  ADD COLUMN IF NOT EXISTS evolution_api_key       TEXT,
  ADD COLUMN IF NOT EXISTS evolution_instance_name TEXT,
  ADD COLUMN IF NOT EXISTS nota_webhook_url        TEXT;

-- 2. Conversas (cada chat do WhatsApp)
CREATE TABLE IF NOT EXISTS conversas (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id             UUID REFERENCES leads(id) ON DELETE SET NULL,
  whatsapp_number     TEXT NOT NULL,
  nome_contato        TEXT,
  provider            TEXT NOT NULL DEFAULT 'meta',
  status              TEXT NOT NULL DEFAULT 'aberta',
  assigned_to         UUID REFERENCES users(id) ON DELETE SET NULL,
  is_human            BOOLEAN NOT NULL DEFAULT false,
  ultima_mensagem     TEXT,
  ultima_mensagem_at  TIMESTAMPTZ,
  nao_lidas           INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Mensagens dentro de cada conversa
CREATE TABLE IF NOT EXISTS mensagens (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversa_id           UUID NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  conteudo              TEXT NOT NULL,
  tipo                  TEXT NOT NULL DEFAULT 'text',
  direcao               TEXT NOT NULL,
  status                TEXT DEFAULT 'enviado',
  whatsapp_message_id   TEXT,
  media_url             TEXT,
  lida                  BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tags livres para conversas
CREATE TABLE IF NOT EXISTS tags (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome        TEXT NOT NULL UNIQUE,
  cor         TEXT DEFAULT '#7A9E87',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tags aplicadas a conversas (N:N)
CREATE TABLE IF NOT EXISTS conversa_tags (
  conversa_id UUID NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (conversa_id, tag_id)
);

-- 6. Tarefas vinculadas a leads
CREATE TABLE IF NOT EXISTS tarefas (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id          UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  titulo           TEXT NOT NULL,
  descricao        TEXT,
  concluida        BOOLEAN NOT NULL DEFAULT false,
  data_vencimento  DATE,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Ficha de paciente (leads com consulta confirmada)
CREATE TABLE IF NOT EXISTS pacientes (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id          UUID NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
  nota             TEXT,
  resumo           TEXT,
  nota_updated_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Formulários recebidos via Tally
CREATE TABLE IF NOT EXISTS form_submissions (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id              UUID REFERENCES leads(id) ON DELETE SET NULL,
  whatsapp_number      TEXT NOT NULL,
  form_type            TEXT NOT NULL,
  form_name            TEXT,
  dados                JSONB NOT NULL DEFAULT '{}',
  tally_submission_id  TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conversas_lead_id          ON conversas(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversas_whatsapp_number  ON conversas(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_conversas_status           ON conversas(status);
CREATE INDEX IF NOT EXISTS idx_conversas_is_human         ON conversas(is_human);
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_id      ON mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_created_at       ON mensagens(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tarefas_lead_id            ON tarefas(lead_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_number    ON form_submissions(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_form_submissions_lead_id   ON form_submissions(lead_id);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE conversas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags            ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversa_tags   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarefas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- Políticas: usuários autenticados têm acesso total (mesmo padrão do restante do sistema)
CREATE POLICY "auth_all_conversas"        ON conversas        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_mensagens"        ON mensagens        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_tags"             ON tags             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_conversa_tags"    ON conversa_tags    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_tarefas"          ON tarefas          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_pacientes"        ON pacientes        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_form_submissions" ON form_submissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Trigger: atualizar updated_at automaticamente ─────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_conversas_updated_at  BEFORE UPDATE ON conversas  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_tarefas_updated_at    BEFORE UPDATE ON tarefas    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_pacientes_updated_at  BEFORE UPDATE ON pacientes  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
