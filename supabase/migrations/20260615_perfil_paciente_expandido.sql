-- Perfil do paciente expandido (aba Dados) + cadastro manual de paciente.
-- Idempotente: roda com segurança nesta instância (que tem migrações parciais).

-- ── 1. Colunas novas em pacientes ────────────────────────────────────────────
-- 'complemento' fica dentro do JSONB endereco (consistente com rua/numero/etc).
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS nome_social                    TEXT,
  ADD COLUMN IF NOT EXISTS cpf                            TEXT,  -- LGPD: virar hash na Etapa 7 <<MARCADOR-LGPD-ETAPA7>>
  ADD COLUMN IF NOT EXISTS sexo                           TEXT,
  ADD COLUMN IF NOT EXISTS estado_civil                   TEXT,
  ADD COLUMN IF NOT EXISTS profissao                      TEXT,
  ADD COLUMN IF NOT EXISTS nacionalidade                  TEXT,
  ADD COLUMN IF NOT EXISTS celular_whatsapp               BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telefone_secundario            TEXT,
  ADD COLUMN IF NOT EXISTS origem_detalhe                 TEXT,
  ADD COLUMN IF NOT EXISTS indicado_por                   TEXT,
  ADD COLUMN IF NOT EXISTS contato_emergencia_nome        TEXT,
  ADD COLUMN IF NOT EXISTS contato_emergencia_parentesco  TEXT,
  ADD COLUMN IF NOT EXISTS contato_emergencia_telefone    TEXT,
  ADD COLUMN IF NOT EXISTS possui_convenio                BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS convenio_validade              DATE,
  ADD COLUMN IF NOT EXISTS convenio_plano                 TEXT,
  ADD COLUMN IF NOT EXISTS preferencia_canais             JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS melhor_horario_contato         TEXT;

-- ── 2. Marca de cadastro manual no lead (não conta como conversão de funil) ──
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS cadastro_manual BOOLEAN NOT NULL DEFAULT false;

-- ── 3. RLS — pacientes mantém policy permissiva p/ authenticated (agente usa service_role).
--    leads NÃO tem RLS endurecida aqui de propósito: o hardening é da Parte B (Etapa 5),
--    adiada até o agente estar pronto. Mexer agora poderia quebrar o fluxo do funil/agente.
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pacientes' AND policyname='pacientes_auth') THEN
    CREATE POLICY "pacientes_auth" ON public.pacientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
