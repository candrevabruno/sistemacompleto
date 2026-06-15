-- Fix: exclusão de paciente robusta + RLS do audit_log.

-- ── 1. audit_log: permite insert/select para authenticated (estava bloqueando 403) ──
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_log' AND policyname='audit_log_insert_auth') THEN
    CREATE POLICY "audit_log_insert_auth" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_log' AND policyname='audit_log_select_auth') THEN
    CREATE POLICY "audit_log_select_auth" ON public.audit_log FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ── 2. apagar_paciente_completo: versão dinâmica e atômica ──────────────────────
-- Em vez de listar tabelas fixas, descobre via catálogo TODAS as tabelas que têm
-- FK para leads(id) e pacientes(id) com delete_rule que bloqueia (NO ACTION/RESTRICT)
-- e apaga os filhos antes do pai. FKs CASCADE/SET NULL o próprio banco resolve.
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

  -- mensagens dependem de conversas (chain) — apaga primeiro.
  BEGIN
    DELETE FROM mensagens WHERE conversa_id IN (SELECT id FROM conversas WHERE lead_id = p_lead_id);
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Filhos de pacientes(id) que bloqueiam (CASCADE se resolve sozinho ao apagar pacientes).
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
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND ccu.table_name = 'pacientes' AND ccu.column_name = 'id'
        AND rc.delete_rule IN ('NO ACTION', 'RESTRICT')
        AND tc.table_name <> 'pacientes'
    LOOP
      EXECUTE format('DELETE FROM public.%I WHERE %I = $1', r.tbl, r.col) USING v_pac;
    END LOOP;
    DELETE FROM pacientes WHERE id = v_pac;
  END IF;

  -- Filhos de leads(id) que bloqueiam (ignora auto-referência e pacientes já tratada).
  FOR r IN
    SELECT tc.table_name AS tbl, kcu.column_name AS col
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'leads' AND ccu.column_name = 'id'
      AND rc.delete_rule IN ('NO ACTION', 'RESTRICT')
      AND tc.table_name NOT IN ('leads', 'pacientes')
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE %I = $1', r.tbl, r.col) USING p_lead_id;
  END LOOP;

  DELETE FROM leads WHERE id = p_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apagar_paciente_completo(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
