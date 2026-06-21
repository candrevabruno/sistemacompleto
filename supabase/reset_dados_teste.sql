-- ============================================================
-- RESET GERAL — apaga todos os dados de teste
-- Execute no Supabase SQL Editor (com service_role)
-- ATENÇÃO: IRREVERSÍVEL. Use somente em ambiente de desenvolvimento.
-- ============================================================

-- ── ETAPA 1: Desativar triggers de auditoria durante o reset ───────────────
-- Evita que o reset em si gere milhares de linhas de audit_log
SET session_replication_role = replica;

-- ── ETAPA 2: Dados operacionais (ordem respeita hierarquia de FKs) ─────────

-- Respostas de pesquisa pós-consulta
TRUNCATE TABLE public.csat_respostas    CASCADE;
TRUNCATE TABLE public.nps_respostas     CASCADE;

-- Episódios / KPIs clínicos
TRUNCATE TABLE public.episodio_atendimento CASCADE;

-- Prontuário e histórico do paciente
TRUNCATE TABLE public.acoes_lead           CASCADE;
TRUNCATE TABLE public.anotacoes_paciente   CASCADE;
TRUNCATE TABLE public.procedimentos_paciente CASCADE;

-- Agenda
TRUNCATE TABLE public.agendamentos  CASCADE;
TRUNCATE TABLE public.lista_espera  CASCADE;
TRUNCATE TABLE public.bloqueios     CASCADE;
TRUNCATE TABLE public.agenda_hours  CASCADE;
TRUNCATE TABLE public.agendas       CASCADE;
TRUNCATE TABLE public.servicos      CASCADE;

-- WhatsApp / inbox
TRUNCATE TABLE public.mensagens   CASCADE;
TRUNCATE TABLE public.conversas   CASCADE;

-- Leads e pacientes (núcleo)
TRUNCATE TABLE public.pacientes CASCADE;
TRUNCATE TABLE public.leads     CASCADE;

-- Marketing e eventos
TRUNCATE TABLE public.marketing_investimento CASCADE;
TRUNCATE TABLE public.clinic_campaigns       CASCADE;

-- Logs e observabilidade
TRUNCATE TABLE public.agente_eventos   CASCADE;
TRUNCATE TABLE public.integration_log  CASCADE;
TRUNCATE TABLE public.audit_log        CASCADE;

-- Gestão de equipe (convites e permissões — mantém o super_admin)
TRUNCATE TABLE public.team_invites      CASCADE;
TRUNCATE TABLE public.user_permissions  CASCADE;

-- ── ETAPA 3: Reativar triggers ─────────────────────────────────────────────
SET session_replication_role = DEFAULT;

-- ── ETAPA 4: Resetar clinic_config para valores padrão ────────────────────
-- Mantém a linha id=1, mas limpa todas as configurações de integração e clínica
UPDATE public.clinic_config SET
  nome                      = 'Minha Clínica',
  subtitulo                 = NULL,
  logo_url                  = NULL,
  evolution_server_url      = NULL,
  evolution_api_key         = NULL,
  evolution_instance_name   = NULL,
  calcom_api_key            = NULL,
  aniversario_webhook_url   = NULL,
  aniversario_last_dispatch = NULL,
  upgrade_webhook_url       = NULL,
  heroic_leap_whatsapp      = NULL,
  lista_espera_enabled      = false,
  admin_config_tabs         = NULL
WHERE id = 1;

-- ── ETAPA 5: Arquivos de mídia no Storage ──────────────────────────────────
-- O Supabase não permite DELETE direto em storage.objects via SQL.
-- Para limpar os arquivos do bucket "media", acesse:
-- Supabase Dashboard → Storage → media → selecionar tudo → Delete

-- ── ETAPA 6: Resetar seleção de KPIs (OPCIONAL) ───────────────────────────
-- Descomente se quiser também zerar quais KPIs a clínica selecionou.
-- O kpi_catalog (definições) NÃO é apagado — é configuração do sistema.
-- TRUNCATE TABLE public.clinic_kpi_selection CASCADE;

-- ── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
-- Rode após o reset para confirmar que as tabelas estão vazias:
SELECT
  'leads'                   AS tabela, COUNT(*) FROM public.leads UNION ALL
  SELECT 'pacientes',                  COUNT(*) FROM public.pacientes UNION ALL
  SELECT 'conversas',                  COUNT(*) FROM public.conversas UNION ALL
  SELECT 'mensagens',                  COUNT(*) FROM public.mensagens UNION ALL
  SELECT 'agendamentos',               COUNT(*) FROM public.agendamentos UNION ALL
  SELECT 'agendas',                    COUNT(*) FROM public.agendas UNION ALL
  SELECT 'servicos',                   COUNT(*) FROM public.servicos UNION ALL
  SELECT 'episodio_atendimento',       COUNT(*) FROM public.episodio_atendimento UNION ALL
  SELECT 'audit_log',                  COUNT(*) FROM public.audit_log UNION ALL
  SELECT 'clinic_config (deve ser 1)', COUNT(*) FROM public.clinic_config;
