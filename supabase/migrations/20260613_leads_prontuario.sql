-- ETAPA 4 PARTE 1 — Prontuário comercial do lead
-- Execute no Supabase SQL Editor

-- ── 1. Campos de score + anotações em leads ───────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS score_temperatura    TEXT,
  ADD COLUMN IF NOT EXISTS score_sonho          TEXT,
  ADD COLUMN IF NOT EXISTS score_contexto       TEXT,
  ADD COLUMN IF NOT EXISTS score_obstaculo      TEXT,
  ADD COLUMN IF NOT EXISTS score_rota           TEXT,
  ADD COLUMN IF NOT EXISTS score_gatilho        TEXT,
  ADD COLUMN IF NOT EXISTS anotacoes_secretaria TEXT;

-- ── 2. Tabela de ações manuais ────────────────────────────────────────────────
-- Registro manual de ações da secretaria: liga, mensagem, reagendar, etc.
CREATE TABLE IF NOT EXISTS public.acoes_lead (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tipo             TEXT NOT NULL CHECK (tipo IN ('ligar','mensagem','reagendar','conteudo','aguardar')),
  observacao       TEXT,
  proximo_passo_em TIMESTAMPTZ,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.acoes_lead ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acoes_lead_auth" ON public.acoes_lead
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 4. Índice para queries por lead ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_acoes_lead_lead_id ON public.acoes_lead(lead_id);
