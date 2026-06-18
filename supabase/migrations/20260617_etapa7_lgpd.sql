-- ETAPA 7 — Parte 1: LGPD
-- Consentimento por paciente, CPF com hash SHA-256 (exibição mascarada no app),
-- e exclusão com anonimização em cascata (mantém métricas, zera PII).
-- Execute no Supabase SQL Editor.

-- ── 0. pgcrypto (para digest sha256) ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. Consentimento + hash de CPF (pacientes) ───────────────────────────────
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS cpf_hash                 TEXT,
  ADD COLUMN IF NOT EXISTS consentimento_dado_em    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consentimento_origem     TEXT,   -- 'tally' | 'whatsapp' | 'manual'
  ADD COLUMN IF NOT EXISTS consentimento_texto      TEXT,   -- versão/termo aceito
  ADD COLUMN IF NOT EXISTS consentimento_revogado_em TIMESTAMPTZ;

-- ── 2. Marca de anonimização (leads) ─────────────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS anonimizado_em TIMESTAMPTZ;

-- ── 3. Backfill: cpf_hash dos CPFs já cadastrados ────────────────────────────
UPDATE public.pacientes
   SET cpf_hash = encode(digest(regexp_replace(cpf, '\D', '', 'g'), 'sha256'), 'hex')
 WHERE cpf IS NOT NULL AND cpf <> '' AND cpf_hash IS NULL;

-- ── 4. Trigger: manter cpf_hash em sincronia com cpf ─────────────────────────
CREATE OR REPLACE FUNCTION public.sync_cpf_hash()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.cpf IS NULL OR NEW.cpf = '' THEN
    NEW.cpf_hash := NULL;
  ELSE
    NEW.cpf_hash := encode(digest(regexp_replace(NEW.cpf, '\D', '', 'g'), 'sha256'), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cpf_hash ON public.pacientes;
CREATE TRIGGER trg_sync_cpf_hash
  BEFORE INSERT OR UPDATE OF cpf ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.sync_cpf_hash();

-- ── 5. RPC: anonimizar paciente (mantém métricas, apaga PII em cascata) ───────
-- Diferente de apagar_paciente_completo: NÃO remove leads/pacientes/agendamentos
-- (preserva episódios e estatísticas dos KPIs). Zera os campos com dado pessoal e
-- apaga conversas/mensagens (conteúdo é PII e não alimenta métrica agregada).
-- SECURITY DEFINER: ignora RLS. Restrição a admin é validada no frontend.
CREATE OR REPLACE FUNCTION public.anonimizar_paciente_completo(p_lead_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pac UUID;
BEGIN
  SELECT id INTO v_pac FROM pacientes WHERE lead_id = p_lead_id;

  -- Conteúdo de conversa é PII pesado e não alimenta métricas: remover.
  BEGIN DELETE FROM mensagens WHERE conversa_id IN (SELECT id FROM conversas WHERE lead_id = p_lead_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM conversas WHERE lead_id = p_lead_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM anotacoes_paciente WHERE paciente_id = v_pac; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Zera PII do lead, preserva status/jornada/valor (métricas).
  UPDATE public.leads SET
    nome_lead             = 'Paciente anonimizado',
    whatsapp_lead         = NULL,
    email                 = NULL,
    data_nascimento       = NULL,
    genero                = NULL,
    observacoes           = NULL,
    anotacoes_secretaria  = NULL,
    resumo_conversa       = NULL,
    arquivado             = true,
    arquivado_em          = COALESCE(arquivado_em, NOW()),
    anonimizado_em        = NOW()
  WHERE id = p_lead_id;

  -- Zera PII do paciente.
  IF v_pac IS NOT NULL THEN
    UPDATE public.pacientes SET
      cpf                         = NULL,
      cpf_hash                    = NULL,
      nome_social                 = NULL,
      endereco                    = NULL,
      telefone_secundario         = NULL,
      contato_emergencia_nome     = NULL,
      contato_emergencia_parentesco = NULL,
      contato_emergencia_telefone = NULL,
      profissao                   = NULL,
      convenio_nome               = NULL,
      convenio_numero             = NULL,
      convenio_validade           = NULL,
      convenio_plano              = NULL,
      nf_documento                = NULL,
      nf_nome                     = NULL,
      nf_endereco                 = NULL,
      ultimo_resumo_conversa      = NULL
    WHERE id = v_pac;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.anonimizar_paciente_completo(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
