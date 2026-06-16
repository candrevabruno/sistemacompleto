-- Fix 2: exclusão de paciente também remove FKs SET NULL com coluna NOT NULL.
-- (Ex.: tabela 'clientes' tem lead_id NOT NULL + ON DELETE SET NULL → SET NULL falha;
--  precisamos APAGAR a linha filha em vez de tentar anular.)
CREATE OR REPLACE FUNCTION public.apagar_paciente_completo(p_lead_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pac UUID;
  r RECORD;
BEGIN
  SELECT id INTO v_pac FROM pacientes WHERE lead_id = p_lead_id;

  -- Chains conhecidas, na ordem certa (filho antes do pai).
  BEGIN DELETE FROM mensagens WHERE conversa_id IN (SELECT id FROM conversas WHERE lead_id = p_lead_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM agendamentos WHERE lead_id = p_lead_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM clientes     WHERE lead_id = p_lead_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Filhos de pacientes(id): apaga quando bloqueia (NO ACTION/RESTRICT) OU
  -- quando é SET NULL mas a coluna é NOT NULL (anular falharia).
  IF v_pac IS NOT NULL THEN
    FOR r IN
      SELECT tc.table_name AS tbl, kcu.column_name AS col
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
      JOIN information_schema.columns colinfo
        ON colinfo.table_schema = tc.table_schema AND colinfo.table_name = tc.table_name AND colinfo.column_name = kcu.column_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND ccu.table_name = 'pacientes' AND ccu.column_name = 'id'
        AND tc.table_name <> 'pacientes'
        AND ( rc.delete_rule IN ('NO ACTION','RESTRICT')
              OR (rc.delete_rule = 'SET NULL' AND colinfo.is_nullable = 'NO') )
    LOOP
      EXECUTE format('DELETE FROM public.%I WHERE %I = $1', r.tbl, r.col) USING v_pac;
    END LOOP;
    DELETE FROM pacientes WHERE id = v_pac;
  END IF;

  -- Filhos de leads(id): mesma regra (ignora auto-referência e pacientes já tratada).
  FOR r IN
    SELECT tc.table_name AS tbl, kcu.column_name AS col
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
    JOIN information_schema.columns colinfo
      ON colinfo.table_schema = tc.table_schema AND colinfo.table_name = tc.table_name AND colinfo.column_name = kcu.column_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'leads' AND ccu.column_name = 'id'
      AND tc.table_name NOT IN ('leads', 'pacientes')
      AND ( rc.delete_rule IN ('NO ACTION','RESTRICT')
            OR (rc.delete_rule = 'SET NULL' AND colinfo.is_nullable = 'NO') )
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE %I = $1', r.tbl, r.col) USING p_lead_id;
  END LOOP;

  DELETE FROM leads WHERE id = p_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apagar_paciente_completo(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
