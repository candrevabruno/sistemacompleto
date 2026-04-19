-- =======================================================================
-- ATUALIZAÇÃO PARA O CAL.COM
-- Este script realiza a troca da arquitetura de colunas do Supabase,
-- abandonando os IDs do Google Calendar em favor dos Links Públicos 
-- do Cal.com (Event Types).
-- =======================================================================

-- 1. Na tabela de agendas, tentar renomear a coluna do Google para o Cal.com
-- (O bloco DO atua com segurança para não quebrar caso a coluna já tenha o nome certo)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='agendas' AND column_name='google_calendar_id'
    ) THEN
        ALTER TABLE public.agendas RENAME COLUMN google_calendar_id TO calcom_link;
    ELSE
        ALTER TABLE public.agendas ADD COLUMN IF NOT EXISTS calcom_link TEXT;
    END IF;
END
$$;

-- 2. Na tabela de agendamentos, repassamos o campo de ID do evento.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='agendamentos' AND column_name='google_event_id'
    ) THEN
        ALTER TABLE public.agendamentos RENAME COLUMN google_event_id TO calcom_uid;
    ELSE
        ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS calcom_uid TEXT;
    END IF;
END
$$;
