-- Garante que as tabelas usadas em realtime estão na publicação supabase_realtime.
-- Sem isso, as assinaturas do front (postgres_changes) não disparam → a tela
-- só atualiza com F5. Idempotente: só adiciona o que ainda não está publicado e
-- só tabelas que existem. Seguro rodar várias vezes.
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'leads','pacientes','clientes','agendamentos','episodio_atendimento',
    'conversas','mensagens','lista_espera','agente_eventos',
    'csat_respostas','nps_respostas','procedimentos_paciente','anotacoes_paciente',
    'acoes_lead','tarefas','clinic_campaigns','audit_log','integration_log',
    'team_invites','user_permissions','users'
  ];
BEGIN
  -- Cria a publicação se (por algum motivo) não existir.
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH t IN ARRAY tabelas LOOP
    IF to_regclass('public.' || t) IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime'
           AND schemaname = 'public'
           AND tablename = t
       ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
