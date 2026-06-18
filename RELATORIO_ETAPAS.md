# ClinicOS — Relatório de Etapas

**Projeto:** Heroic Leap / LeapCare  
**Stack:** React + Vite + TypeScript + Supabase (Postgres + Edge Functions)  
**Concluído em:** Junho 2026  

---

## Resumo Executivo

O sistema foi construído em 7 etapas, cobrindo os pilares: operação clínica, experiência do paciente,
comunicação automatizada, agenda + Cal.com, módulo de eventos, compliance e observabilidade.

---

## ETAPA 1 — Base Operacional

**Módulos entregues:**
- Dashboard com KPIs operacionais (atendimentos, leads, conversão, receita).
- Módulo **Leads** (funil de captação, kanban, filtros por status, histórico de mensagens).
- Módulo **Pacientes** (prontuário, abas por domínio, anamnese, comportamento, pré/pós consulta).
- Módulo **CRM Kanban** (colunas de pipeline, drag-and-drop, cards de oportunidade).
- Módulo **Inbox** (mensagens WhatsApp em tempo real via Evolution API, envio manual).
- Módulo **Equipe** (listagem de membros, convite por e-mail via Resend, edição de perfil).
- Módulo **Configurações** (dados da clínica, WhatsApp, webhooks externos).

**Banco de dados chave:**
- `leads`, `pacientes`, `agendamentos`, `clinic_config`, `users` (roles: super_admin / admin / membro).

---

## ETAPA 2 — Prontuário e Perfil Completo do Paciente

**Melhorias:**
- Abas do paciente: Dados, Consultas, Procedimentos, Comportamento, Anotações do Profissional, Pré-Consulta, Pós-Consulta.
- Campos expandidos: CPF (com hash SHA-256 para dedup), endereço, contato de emergência, dados de NF.
- Fluxo de cadastro manual de paciente a partir de um lead (separado da conversão automática).
- RPC `apagar_paciente_completo` — deleta com cascata dinâmica de FKs (inclui CSAT/NPS quando existentes).
- Soft-delete (arquivar/desarquivar) reversível via `leads.arquivado`.

---

## ETAPA 3 — CRM e Automações de Comunicação

**Melhorias:**
- **Serviços**: CRUD completo com soft-delete (arquivado), valor, duração, tipo de atendimento; datalist no agendamento.
- **KPI Catalog**: estrutura `kpi_catalog` + `clinic_kpi_selection` para ativar/desativar KPIs por clínica.
- **KPIs Episódio**: `episodio_atendimento` — registra cada atendimento para cálculo de métricas de produção.
- Inbox: exclusão de mensagens (suporte a `MESSAGES_DELETE` / `messages.update` do Evolution), mídia em bucket privado.
- Sidebar reorganizada com handoff de notificações.

---

## ETAPA 4 — Agenda + Lista de Espera (Fase 1)

**Entregues:**
- **Central de Agendamentos**: calendário mensal/semanal, slots por agenda, status (confirmado/pendente/compareceu/faltou/cancelado).
- **Lista de Espera**: fila de pacientes aguardando vaga, flag `lista_espera_enabled` na `clinic_config`.
- **Agendados Hoje**: aba em Leads filtrando agendamentos do dia vigente (excl. cancelados/reagendados).
- Fluxo compareceu/faltou disponível só após o horário do agendamento.
- Aviso ao paciente opcional em caso de falta.

---

## ETAPA 5 — Hierarquia de Permissões (3 Níveis)

**Decisões de arquitetura:**
- 3 roles: `super_admin` (Heroic Leap), `admin` (dono/médico da clínica), `membro` (secretária/aux.).
- Tenancy: **1 clínica por instância** — sem `clinic_id` nas tabelas de dados; RLS por `auth.uid()`.
- `super_admin` e `admin` têm bypass automático de todas as políticas granulares.
- `membro`: acesso definido item-a-item em `user_permissions` (JSONB: `{ "modulo:leads": "view_edit" }`).

**Catálogo de permissões** (`src/lib/permissions.ts`):
- Grupos: `modulo`, `paciente_tab`, `config_tab`, `feature`.
- Abas do paciente controladas aba por aba para membros.
- **Abas de Configurações** controladas por membro: Geral, Agendas, Serviços, Kanban, WhatsApp, Webhooks, KPIs.
- Features com flag: `premium_enabled`, `eventos_enabled`, `lista_espera_enabled`.

**Banco:** tabela `user_permissions`, trigger de convite (`invited_by` / `invite_token`), convite-only (signups desativados).

---

## ETAPA 6 — Agenda Integrada ao Cal.com (Sentidos 1 e 2) + ETAPA 6C Eventos

### 6A — Serviços com Valor
- Tabela `servicos` com `valor_em_centavos`, `duracao_minutos`, `tipo_atendimento`, `arquivado`.

### 6B — Cal.com Sentido 1 + 2
- **Sentido 1** (Cal.com → ClinicOS): webhook `cal-webhook` captura `booking.created/cancelled/rescheduled`; sincroniza `agendamentos`.
- **Sentido 2** (ClinicOS → Cal.com): criação de reservas via `/v2/bookings`, cancelamento, reagendamento, bloqueios OOO, apagar agenda remove event-type.
- Criação de event-type no Cal.com ao criar a agenda (com duração e local).
- `cal-sync` edge function para sincronização periódica.

### 6C — Módulo Eventos
- Gatilho por flag `eventos_enabled` na `clinic_config`.
- **Aniversariantes**: integração com n8n; status do disparo via `registrar_disparo`.
- **Ações do Mês** (`clinic_campaigns`): campanhas recorrentes que alimentam contexto do agente de IA.
- Edge function `eventos-dispatch`: processa disparos agendados com autenticação `X-Dispatch-Secret`.
- Permissão granular por membro: `feature:eventos:disparos`.

---

## ETAPA 7 — Compliance, Observabilidade e Fechamento

### 7.1 LGPD (`20260617_etapa7_lgpd.sql`)
- `cpf_hash` (SHA-256 do CPF sem pontuação) para dedup/busca sem expor PII.
- Colunas de consentimento: `consentimento_dado_em`, `consentimento_origem`, `consentimento_texto`, `consentimento_revogado_em`.
- RPC `anonimizar_paciente_completo`: zera PII (nome → "Paciente anonimizado", CPF/whatsapp/email/endereço → NULL), mantém episódios e métricas. Coluna `leads.anonimizado_em`.
- Frontend: CPF mascarado (`123.***.***-09`) com botão "revelar" que gera registro de auditoria.
- Seção "Consentimento LGPD" no prontuário: timestamp, origem (chip), revogar, registrar manual.
- Exportar dados do paciente (JSON download client-side).
- Opção "Anonimizar" ao lado de "Apagar definitivo" — só admins, dupla confirmação.

### 7.2 Auditoria (`20260617_etapa7_auditoria.sql`)
- Tabela `audit_log`: actor_id, actor_email, acao, tabela, registro_id, valor_anterior/novo JSONB, modulo.
- Triggers genéricos `AFTER INSERT/UPDATE/DELETE` nas tabelas sensíveis.
- Página `/auditoria` com filtros (usuário, módulo, período, tipo) e paginação.
- Restrito a `super_admin` via `PERM_ITEMS` (`superAdminOnly: true`).

### 7.3 Logs / Saúde das Integrações (`20260617_etapa7_logs.sql`)
- Tabela `integration_log`: servico, nivel (info/warn/error), origem, mensagem, payload_resumo JSONB.
- Página `/logs` com **semáforo** verde/amarelo/vermelho por integração (derivado de último sucesso + erros recentes + config presente).
- Integrações monitoradas: Cal.com, Evolution, Meta, n8n Eventos, n8n Intake.
- Restrito a `super_admin`.

### 7.4 KPIs do Pilar Experiência (`20260617_etapa7_kpis.sql`)
- Tabelas `csat_respostas` e `nps_respostas` (score, comentario, canal, lead_id, paciente_id).
- Edge function `intake`: endpoint server-side para n8n gravar consentimento, CSAT, NPS, reativação.
  - Auth: aceita JWT ou `X-Dispatch-Secret` == `DISPATCH_SECRET`.
  - Ações: `consentimento`, `csat`, `nps`, `reativacao`.
- KPIs `exp_nps`, `exp_csat`, `exp_reativacao` viram `calculado` no `kpi_catalog`.
- Fluxos pós-consulta n8n: CSAT (2d), Check-in (15d), Evolução (30d), NPS (45d), Reativação (60/180d).

### 7.5 API Tokens + Configurações por Membro
- Tabela `api_tokens`: label, token_hash (SHA-256), ativo, created_by.
- UI em Configurações → Webhooks: gerar token (exibido **uma vez**), listar, revogar.
- Permissões de **abas de Configurações** para membros: controladas item-a-item no editor de permissões.
- Fixes: `20260618_fixes_kpi_whatsapp.sql`, `20260618_lista_espera_flag.sql`, `20260618_servicos_descricao_arquivado.sql`.

---

## Edge Functions Deployadas

| Função | Propósito |
|--------|-----------|
| `cal-sync` | Sincroniza agendamentos Cal.com → ClinicOS |
| `cal-webhook` | Recebe eventos do Cal.com (booking.*) |
| `eventos-dispatch` | Dispara campanhas e aniversariantes via n8n |
| `evolution-proxy` | Proxy para Evolution API (isolamento de credenciais) |
| `intake` | Recebe dados pós-consulta do n8n (CSAT/NPS/consentimento) |
| `webhook-evolution` | Recebe eventos do Evolution (mensagens WhatsApp) |
| `webhook-meta` | Recebe eventos da Meta (WhatsApp Business API) |
| `whatsapp-delete` | Deleta mensagem no WhatsApp via Evolution |
| `whatsapp-send` | Envia mensagem WhatsApp via Evolution |
| `agendamentos` | (util) consulta agendamentos para o agente |

---

## Pendências e Recomendações

### RLS — Fase B (não implementada)
A RLS atual é faseada: tabelas sensíveis têm RLS habilitado, mas a maioria das políticas confiam no role
do usuário via `auth.uid()` ou deixam service_role passar livremente. A Fase B consistiria em:
- Adicionar políticas `FOR UPDATE` e `FOR DELETE` restritivas por `clinic_id` (quando multi-tenancy for necessário).
- Validar que membros não conseguem ler dados de outras clínicas mesmo com tokens vazados.
- Até lá: o isolamento é garantido pelo produto (1 instância = 1 clínica) e pela camada de aplicação.

### Agente de IA — Service Role
O agente deve usar a chave `service_role` do Supabase para bypassar RLS e ter acesso completo ao banco.
Contexto relevante para o agente (disponível via `clinic_campaigns`):
- Ações do mês vigente (campanhas ativas).
- Horários de atendimento (agendas + disponibilidade Cal.com).
- Preferências da clínica (`clinic_config`).
- Status de leads recentes.

### Avaliação Google
O campo de link de avaliação Google pode ser armazenado em `clinic_config` (coluna `google_review_url`).
O KPI de avaliação ficou como input manual no Dashboard (não há API pública do Google Business Profile
que permita consultar a nota diretamente sem OAuth complexo).

### Multi-tenancy futura
A arquitetura atual (1 instância Supabase = 1 clínica) é intencional e simplifica RLS drasticamente.
Se no futuro for necessário servir múltiplas clínicas em uma única instância, será preciso:
1. Adicionar `clinic_id UUID` às tabelas principais.
2. Reescrever todas as políticas RLS para filtrar por `clinic_id`.
3. Migrar o sistema de invites para associar usuários a clínicas específicas.

---

## Checklist de Regressão (Pré-Produção)

- [ ] Login (email/senha + Google OAuth) — fluxo completo
- [ ] Invite de membro → aceitar → permissões funcionando
- [ ] Criar lead → converter em paciente → abrir prontuário
- [ ] Agendar consulta → Cal.com recebe → compareceu/faltou registra
- [ ] Cancelar no Cal.com → status atualiza no ClinicOS
- [ ] Enviar mensagem WhatsApp pelo Inbox
- [ ] Criar campanha em Eventos → disparo via n8n
- [ ] Revelar CPF → registro em `audit_log`
- [ ] Anonimizar paciente (admin) → PII zerada, episódios mantidos
- [ ] Rotas gated: `/auditoria` e `/logs` visíveis só para `super_admin`
- [ ] Membro sem permissão não vê abas bloqueadas em Configurações
- [ ] Token de API: gerar → copiar (aparece 1x) → revogar
- [ ] `npm run build` sem erros TypeScript
