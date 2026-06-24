-- Alinhamento sistema ↔ agente — colunas/tabelas exigidas pelas Decisões v2 ─────
-- Pré-requisito para a reescrita dos workflows (n8n). Cria o que o agente vai
-- gravar/ler mas que ainda não existe no schema do sistema.

-- ── 1. Protocolo anti no-show (Decisão #9 + Método SCORE) ─────────────────────
-- Contador de faltas e flag de risco vivem no lead (mesmo registro do SCORE).
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS faltas_consecutivas INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_show_risco       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reativacao_suspensa BOOLEAN NOT NULL DEFAULT false;

-- ── 2. RFM (Decisão #6) ──────────────────────────────────────────────────────
-- Segmento calculado pelo agente/sistema: Diamante | Fiel | Potencial | Em Risco | Perdida.
-- Diamante e Fiel têm gate manual (nunca disparam automático).
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS segmento_rfm TEXT;

-- ── 3. Gating de testes no WF00 (Decisão 1h) ─────────────────────────────────
-- feature_flags no shape que os workflows JÁ esperam: chave/valor/ativo por
-- profissional (o WF00 consulta `WHERE chave=... AND profissional_id=...`).
-- modo_teste é UMA LINHA (chave='modo_teste'): ativo=true ⇒ agente só responde
-- números presentes em numeros_teste. Para ir a produção: UPDATE ... ativo=false.
-- profissional_id NULL = flag global (vale para toda a clínica).
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave          TEXT NOT NULL,
  valor_texto    TEXT,
  ativo          BOOLEAN NOT NULL DEFAULT false,
  profissional_id UUID,
  descricao      TEXT,
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_flags_chave_prof
  ON public.feature_flags (chave, COALESCE(profissional_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Flag global de modo de teste (ativo=true por segurança até liberar produção).
INSERT INTO public.feature_flags (chave, ativo, descricao)
  SELECT 'modo_teste', true, 'Modo de teste: agente só responde números em numeros_teste'
  WHERE NOT EXISTS (SELECT 1 FROM public.feature_flags WHERE chave='modo_teste' AND profissional_id IS NULL);

CREATE TABLE IF NOT EXISTS public.numeros_teste (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero    TEXT NOT NULL,
  ativo     BOOLEAN NOT NULL DEFAULT true,
  descricao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_numeros_teste_ativo
  ON public.numeros_teste (numero, ativo);

-- ── 4. RLS (regra do projeto: enable sempre acompanhado de policy) ────────────
-- Agente usa service_role (ignora RLS); frontend usa anon/authenticated.
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numeros_teste ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feature_flags' AND policyname='feature_flags_auth') THEN
    CREATE POLICY "feature_flags_auth" ON public.feature_flags FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='numeros_teste' AND policyname='numeros_teste_auth') THEN
    CREATE POLICY "numeros_teste_auth" ON public.numeros_teste FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
