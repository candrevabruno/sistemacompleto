-- =======================================================================
-- MIGRAÇÃO PARA GOOGLE CALENDAR
-- Este script limpa a lógica antiga de horários e prepara o CRM
-- para uma arquitetura agnóstica de Single ou Multi-Agendas do Google.
-- =======================================================================

-- 1. Remoção de Triggers antigos focados na construção local de hora
DROP TRIGGER IF EXISTS on_agenda_created ON public.agendas;
DROP FUNCTION IF EXISTS public.criar_agenda_hours();

-- 2. Remoção das Tabelas de Horários Antigas
DROP TABLE IF EXISTS public.agenda_hours;
DROP TABLE IF EXISTS public.clinic_hours;

-- 3. Adaptação da Tabela de Agendamentos
-- Esta tabela passa a servir de histórico e espelho de eventos da API
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- 4. Adaptação da Tabela Principais (Agendas)
-- Cada registro nesta tabela indica 1 conta/calendário do google distinto
ALTER TABLE public.agendas ADD COLUMN IF NOT EXISTS google_calendar_id TEXT;

-- O sistema agora pode ligar a "google_calendar_id" (Agendas) com o "google_event_id" (Agendamentos)
