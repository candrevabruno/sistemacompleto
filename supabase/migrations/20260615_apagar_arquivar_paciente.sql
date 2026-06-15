-- Apagar (definitivo) e arquivar (reversível) paciente.

-- ── Arquivamento (esconde da lista, mantém os dados) ─────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS arquivado     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em  TIMESTAMPTZ;

-- ── Exclusão definitiva (atômica) ────────────────────────────────────────────
-- Remove o lead/paciente e todos os dependentes numa transação.
-- SECURITY DEFINER: ignora RLS (permissão é validada no frontend — editar Pacientes).
-- Cada DELETE em tabela opcional é protegido contra "tabela inexistente".
CREATE OR REPLACE FUNCTION public.apagar_paciente_completo(p_lead_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pac UUID;
BEGIN
  SELECT id INTO v_pac FROM pacientes WHERE lead_id = p_lead_id;

  BEGIN DELETE FROM mensagens WHERE conversa_id IN (SELECT id FROM conversas WHERE lead_id = p_lead_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM conversas   WHERE lead_id = p_lead_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM agendamentos WHERE lead_id = p_lead_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM acoes_lead   WHERE lead_id = p_lead_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM tarefas      WHERE lead_id = p_lead_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  IF v_pac IS NOT NULL THEN
    BEGIN DELETE FROM procedimentos_paciente WHERE paciente_id = v_pac; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM anotacoes_paciente     WHERE paciente_id = v_pac; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM nps_respostas          WHERE paciente_id = v_pac; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM csat_respostas         WHERE paciente_id = v_pac; EXCEPTION WHEN undefined_table THEN NULL; END;
    DELETE FROM pacientes WHERE id = v_pac;
  END IF;

  DELETE FROM leads WHERE id = p_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apagar_paciente_completo(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
