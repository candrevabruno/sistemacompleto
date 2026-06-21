-- ============================================================
-- RESET PARCIAL — Leads + Agendamentos + Inbox (mantém Tally e integrações)
-- ------------------------------------------------------------
-- Limpa SOMENTE dados operacionais de lead/agendamento e o inbox do WhatsApp.
-- PRESERVA:
--   • clinic_config (credenciais Evolution/Cal.com, webhooks)
--   • agendas, agenda_hours, clinic_hours, bloqueios, servicos (config de agenda)
--   • form_submissions (Tally) — as linhas ficam, só perdem o vínculo com o lead
--   • kpi_catalog, clinic_kpi_selection, marketing_investimento, tags
--   • users, user_permissions, team_invites, api_tokens
--   • integration_log, audit_log, whatsapp_logs (logs)
--
-- Execute no Supabase SQL Editor com service_role.
-- ATENÇÃO: IRREVERSÍVEL. Use somente em ambiente de teste/desenvolvimento.
-- ============================================================

BEGIN;

-- ── Desliga triggers (auditoria + FK actions) durante o reset ───────────────
-- Em modo 'replica' o ON DELETE CASCADE/SET NULL NÃO dispara automaticamente,
-- por isso cada tabela-filha é apagada explicitamente abaixo, na ordem correta.
SET session_replication_role = replica;

-- ── PASSO 1: preservar Tally — desvincular submissões dos leads que serão apagados
-- (form_submissions é mantido; só zeramos a FK para não ficar apontando p/ lead inexistente)
UPDATE public.form_submissions SET lead_id = NULL WHERE lead_id IS NOT NULL;

-- ── PASSO 2: Inbox do WhatsApp (apagar) ─────────────────────────────────────
DELETE FROM public.mensagens;
DELETE FROM public.conversa_tags;
DELETE FROM public.conversas;

-- Memória de conversa do agente n8n (criada pelo n8n, não pelas migrations).
-- Guard: só apaga se a tabela existir, para o script não quebrar em outros ambientes.
DO $$ BEGIN
  IF to_regclass('public.n8n_chat_histories') IS NOT NULL THEN
    DELETE FROM public.n8n_chat_histories;
  END IF;
END $$;

-- ── PASSO 3: Feedback pós-consulta ──────────────────────────────────────────
DELETE FROM public.csat_respostas;
DELETE FROM public.nps_respostas;

-- ── PASSO 4: Prontuário / histórico do paciente ─────────────────────────────
DELETE FROM public.anotacoes_paciente;
DELETE FROM public.procedimentos_paciente;

-- ── PASSO 5: Pipeline comercial do lead ─────────────────────────────────────
DELETE FROM public.acoes_lead;
DELETE FROM public.tarefas;

-- ── PASSO 6: Agenda operacional (NÃO é config) ──────────────────────────────
DELETE FROM public.episodio_atendimento;   -- KPIs/episódios (derivam de agendamentos)
DELETE FROM public.lista_espera;
DELETE FROM public.agente_eventos;          -- event bus de leads/agendamentos
DELETE FROM public.agendamentos;

-- ── PASSO 7: Núcleo lead/paciente ───────────────────────────────────────────
DELETE FROM public.clientes;
DELETE FROM public.pacientes;
DELETE FROM public.leads;

-- ── Religa triggers ─────────────────────────────────────────────────────────
SET session_replication_role = DEFAULT;

COMMIT;

-- ── VERIFICAÇÃO (deve dar 0 nas apagadas; Tally e config preservados) ───────
SELECT 'leads'                AS tabela, COUNT(*) AS linhas FROM public.leads
UNION ALL SELECT 'pacientes',            COUNT(*) FROM public.pacientes
UNION ALL SELECT 'clientes',             COUNT(*) FROM public.clientes
UNION ALL SELECT 'agendamentos',         COUNT(*) FROM public.agendamentos
UNION ALL SELECT 'episodio_atendimento', COUNT(*) FROM public.episodio_atendimento
UNION ALL SELECT 'lista_espera',         COUNT(*) FROM public.lista_espera
UNION ALL SELECT 'acoes_lead',           COUNT(*) FROM public.acoes_lead
UNION ALL SELECT 'tarefas',              COUNT(*) FROM public.tarefas
UNION ALL SELECT 'csat_respostas',       COUNT(*) FROM public.csat_respostas
UNION ALL SELECT 'nps_respostas',        COUNT(*) FROM public.nps_respostas
UNION ALL SELECT 'anotacoes_paciente',   COUNT(*) FROM public.anotacoes_paciente
UNION ALL SELECT 'procedimentos_paciente', COUNT(*) FROM public.procedimentos_paciente
UNION ALL SELECT 'agente_eventos',       COUNT(*) FROM public.agente_eventos
UNION ALL SELECT 'conversas (inbox)',    COUNT(*) FROM public.conversas
UNION ALL SELECT 'mensagens (inbox)',    COUNT(*) FROM public.mensagens
UNION ALL SELECT 'n8n_chat_histories',   COUNT(*) FROM public.n8n_chat_histories
UNION ALL SELECT '--- PRESERVADOS ---',  NULL
UNION ALL SELECT 'form_submissions (Tally, mantido)', COUNT(*) FROM public.form_submissions
UNION ALL SELECT 'agendas (config, mantido)',         COUNT(*) FROM public.agendas
UNION ALL SELECT 'servicos (config, mantido)',        COUNT(*) FROM public.servicos
UNION ALL SELECT 'clinic_config (mantido, = 1)',      COUNT(*) FROM public.clinic_config;
