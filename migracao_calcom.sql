-- =======================================================================
-- MIGRAÇÃO PARA CAL.COM
-- Este script limpa a lógica antiga de agenda do Supabase.
-- =======================================================================

-- 1. Remoção de Triggers antigos
DROP TRIGGER IF EXISTS on_agenda_created ON public.agendas;
DROP FUNCTION IF EXISTS public.criar_agenda_hours();

-- 2. Remoção das Tabelas de Horários Antigas
DROP TABLE IF EXISTS public.agenda_hours;
DROP TABLE IF EXISTS public.clinic_hours;

-- 3. Adaptação da Tabela Principais (Agendas)
-- Onde a secretária/profissional é cadastrada
ALTER TABLE public.agendas ADD COLUMN IF NOT EXISTS cal_event_id TEXT;
ALTER TABLE public.agendas ADD COLUMN IF NOT EXISTS cal_username TEXT;

-- Opcional: Update inicial (substitua pelos IDs reais depois)
-- UPDATE public.agendas SET cal_event_id = 'id_padrao_aqui' WHERE nome = 'Angela';
