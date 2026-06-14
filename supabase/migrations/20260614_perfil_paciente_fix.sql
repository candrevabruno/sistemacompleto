-- ETAPA 6 — corrige abas do perfil do paciente (colunas faltantes + RLS).
-- Sintoma: abas Procedimentos/Comportamento/Anotações em branco porque o
-- selecionarLead falhava ao buscar/criar a linha em public.pacientes
-- (coluna `tipo` inexistente + RLS sem policy) → pacienteId ficava null.
-- service_role (agente/n8n) bypassa RLS; estas policies são só para o painel.

-- 1. pacientes: coluna tipo + RLS permissiva p/ authenticated
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'particular';
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pacientes' AND policyname='pacientes_auth') THEN
    CREATE POLICY "pacientes_auth" ON public.pacientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 2. leads: colunas consultadas pela aba Comportamento
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS score_perfil    TEXT,
  ADD COLUMN IF NOT EXISTS score_trilha    TEXT,
  ADD COLUMN IF NOT EXISTS canal_preferido TEXT;

-- 3. policies permissivas (idempotentes) nas demais tabelas das abas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='procedimentos_paciente' AND policyname='procedimentos_paciente_auth') THEN
    CREATE POLICY "procedimentos_paciente_auth" ON public.procedimentos_paciente FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='anotacoes_paciente' AND policyname='anotacoes_paciente_auth') THEN
    CREATE POLICY "anotacoes_paciente_auth" ON public.anotacoes_paciente FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nps_respostas' AND policyname='nps_respostas_auth') THEN
    CREATE POLICY "nps_respostas_auth" ON public.nps_respostas FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='csat_respostas' AND policyname='csat_respostas_auth') THEN
    CREATE POLICY "csat_respostas_auth" ON public.csat_respostas FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
