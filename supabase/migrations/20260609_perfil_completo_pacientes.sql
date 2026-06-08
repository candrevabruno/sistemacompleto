-- ============================================================
-- Migração: Perfil Completo de Pacientes
-- ============================================================

-- 1. Novas colunas na tabela pacientes
ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS endereco             JSONB,
  ADD COLUMN IF NOT EXISTS como_conheceu        TEXT,
  ADD COLUMN IF NOT EXISTS indicado_por_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo                 TEXT NOT NULL DEFAULT 'particular',
  ADD COLUMN IF NOT EXISTS convenio_nome        TEXT,
  ADD COLUMN IF NOT EXISTS convenio_numero      TEXT,
  ADD COLUMN IF NOT EXISTS preferencia_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS nf_documento         TEXT,
  ADD COLUMN IF NOT EXISTS nf_nome              TEXT,
  ADD COLUMN IF NOT EXISTS nf_endereco          JSONB,
  ADD COLUMN IF NOT EXISTS ultimo_resumo_conversa TEXT,
  ADD COLUMN IF NOT EXISTS ultimo_resumo_at     TIMESTAMPTZ;

-- 2. Valor na tabela de serviços
ALTER TABLE servicos
  ADD COLUMN IF NOT EXISTS valor NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 3. Tabela de anotações de pacientes (geral e profissional)
CREATE TABLE IF NOT EXISTS anotacoes_paciente (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id  UUID        NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  autor_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  autor_nome   TEXT        NOT NULL DEFAULT '',
  tipo         TEXT        NOT NULL DEFAULT 'geral',
  conteudo     TEXT        NOT NULL,
  editado_em   TIMESTAMPTZ,
  editado_por  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT anotacoes_tipo_check CHECK (tipo IN ('geral', 'profissional'))
);
CREATE INDEX IF NOT EXISTS idx_anotacoes_paciente_id ON anotacoes_paciente(paciente_id);
CREATE INDEX IF NOT EXISTS idx_anotacoes_tipo        ON anotacoes_paciente(tipo);
ALTER TABLE anotacoes_paciente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso compartilhado anotacoes" ON anotacoes_paciente
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Tabela de procedimentos do paciente
CREATE TABLE IF NOT EXISTS procedimentos_paciente (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id  UUID         NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  servico_id   UUID         REFERENCES servicos(id) ON DELETE SET NULL,
  nome_servico TEXT         NOT NULL,
  valor        NUMERIC(10,2) NOT NULL DEFAULT 0,
  adicionado_por UUID       REFERENCES users(id) ON DELETE SET NULL,
  adicionado_por_nome TEXT  NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_procedimentos_paciente_id ON procedimentos_paciente(paciente_id);
ALTER TABLE procedimentos_paciente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso compartilhado procedimentos" ON procedimentos_paciente
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Tipo de contato nas conversas (retorno vs novo)
ALTER TABLE conversas
  ADD COLUMN IF NOT EXISTS tipo_contato TEXT NOT NULL DEFAULT 'novo';

COMMENT ON COLUMN conversas.tipo_contato IS 'novo | retorno — retorno quando paciente convertido entra em contato novamente';
