# Pendências ClinicOS

---

## CÓDIGO

### Alta prioridade

- [ ] **Webhook de nota médica (WF06): configurar URL**
  - O campo "Resumo da Consulta" já dispara o webhook, mas a URL precisa ser configurada em Configurações → aba WhatsApp → campo "Webhook — Resumo da Consulta (n8n)"
  - Sem a URL configurada, o resumo salva localmente mas não chega ao n8n

### Média prioridade

- [ ] **n8n: auditar tabelas usadas nos workflows vs schema atual**
  - Alguns nós Postgres dos workflows podem referenciar colunas ou tabelas que foram renomeadas
  - Especialmente: `wf02` cria `agendamentos` — verificar se os campos batem com o schema atual

### Baixa prioridade

- [ ] **Variáveis VITE_* expostas no bundle JS**
  - `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` ficam no bundle público (comportamento padrão do Vite)
  - A anon key é projetada para ser pública, mas vale verificar se há outras vars `VITE_` com dados sensíveis

- [ ] **Botão "Atualizar" na Agenda: testar em telas pequenas**
  - Foi corrigido com `flexShrink: 0`, mas validar visualmente em viewport menor que 1024px

---

## SUPABASE (requer acesso ao painel)

- [ ] **RLS em `clinic_config`: bloquear colunas sensíveis para roles não-admin**
  - Colunas: `meta_access_token`, `evolution_api_key`, `meta_webhook_verify_token`
  - Usuários com role `atendente` não devem conseguir ler essas colunas mesmo via anon key

- [ ] **RLS em `anotacoes_paciente`: bloquear `tipo='profissional'` para role `atendente`**
  - Anotações profissionais devem ser visíveis apenas para `admin` e `medico`
  - Atualmente a restrição existe apenas na UI, não no banco

- [ ] **Verificar constraint em `anotacoes_paciente.tipo`**
  - Se houver `CHECK constraint` nos valores aceitos pelo campo `tipo`, adicionar `'resumo_consulta'` como valor válido
  - Sem isso, a feature "Resumo da Consulta" pode falhar silenciosamente no insert

---

## N8N / INTEGRAÇÕES

- [ ] **Configurar variáveis de ambiente no n8n**
  - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`
  - `EVOLUTION_BASE_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`
  - `OPENAI_API_KEY`
  - `CALCOM_API_KEY`
  - `TALLY_FORM_ANAMNESE_ID`, `TALLY_FORM_RETORNO_ID`
  - `KOMMO_BASE_URL`, `KOMMO_ACCESS_TOKEN`
  - `GRUPO_CLINICA_ID`

- [ ] **WF06: configurar URL do webhook no Configurações**
  - Copiar a URL do webhook do WF06 no n8n e colar em Configurações → "Webhook — Resumo da Consulta"

- [ ] **WF09 (Kommo CRM): verificar se integração está ativa**
  - O workflow envia relatório semanal e atualiza o Kommo
  - Confirmar se `KOMMO_BASE_URL` e `KOMMO_ACCESS_TOKEN` estão configurados

---

## DESIGN / UX (pequenos ajustes)

- [ ] **Testados mas não validados visualmente no browser:**
  - Redesign das tabs Consultas, Procedimentos, Comportamento, Anotações (publicado mas não verificado em prod)
  - Campo "Resumo da Consulta" na aba Anotações do Profissional
  - Sidebar: subtítulo abaixo do nome da clínica

---

## CONCLUÍDO (referência)

- [x] Aba Usuários em Configurações: `loadUsers()` implementada via RPC `get_team_members`, lista membros com badge de role e link para Equipe
- [x] Dashboard faturamento: filtro de período já aplicado corretamente na query `procedimentos_paciente`
- [x] Edge Function `agendamentos` restaurada (arquivo estava acidentalmente na raiz do projeto)
- [x] Redesign luxury: CentralAgendamentos, CRM Kanban
- [x] Redesign luxury: LeadsClientes (tabela + modais)
- [x] Redesign luxury: Pacientes (sidebar + perfil + DadosTab)
- [x] Redesign luxury: tabs Consultas, Procedimentos, Comportamento, Anotações
- [x] LeadDetailsModal: botões alinhados, campos sempre editáveis, textarea sempre visível
- [x] webhook-meta: colunas `nome_lead` / `whatsapp_lead` corrigidas
- [x] Edge Function `evolution-proxy` criada (Evolution API não mais exposta no browser)
- [x] Credenciais sensíveis removidas do ClinicContext global
- [x] Inputs de credenciais com `type="password"`
- [x] Loading de horários corrigido em Configurações
- [x] Sidebar: subtítulo da clínica exibido
- [x] Modal: `overflow-hidden` adicionado
- [x] Agenda: deduplicação de agendamentos (Agendado + Reagendado)
- [x] Dashboard: faturamento unificado em `procedimentos_paciente`
- [x] Pacientes: fetch duplicado de próxima consulta removido
- [x] DadosTab: spinner enquanto `pacienteId` é null
- [x] Feature "Resumo da Consulta" com disparo de webhook n8n (WF06)
