-- Apaga uma agenda (profissional) com segurança: remove primeiro todos os
-- registros-filhos que apontam para ela (agendamentos, bloqueios, agenda_hours,
-- lista_espera, agente_eventos...) descobertos dinamicamente via FK, depois a agenda.
-- Evita o erro de violação de chave estrangeira ao apagar uma agenda com vínculos.

CREATE OR REPLACE FUNCTION apagar_agenda_completa(p_agenda_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'agendas'
      AND ccu.column_name = 'id'
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE %I = $1', r.table_name, r.column_name) USING p_agenda_id;
  END LOOP;

  DELETE FROM public.agendas WHERE id = p_agenda_id;
END;
$$;

GRANT EXECUTE ON FUNCTION apagar_agenda_completa(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
