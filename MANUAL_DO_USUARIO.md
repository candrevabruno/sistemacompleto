# 💎 Manual de Uso — Heroic Leap (CRM Boutique + IA)

Bem-vindo ao **Heroic Leap**, o seu ecossistema de gestão comercial, agendamento inteligente e automação com Inteligência Artificial. Este manual foi estruturado para treinar você, sua equipe e seus clientes a utilizarem 100% dos recursos do sistema com eficiência máxima.

---

## 🧭 1. O que é o Heroic Leap?

O **Heroic Leap** é uma plataforma "High-End" de atração, qualificação, agendamento e conversão de clientes. Ele foi desenhado especialmente para prestadores de serviços de alto padrão (consultórios médicos, clínicas de estética, escritórios de advocacia, agências e consultorias) que buscam:
1. **Atendimento Imediato:** Qualificação e agendamento automático via WhatsApp usando IA.
2. **Organização Visual:** Gestão clara do funil de vendas (CRM Kanban).
3. **Visibilidade de Métricas:** Decisões baseadas em faturamento real, LTV (Lifetime Value) e conversão de consultas.

---

## 🛠️ 2. Arquitetura e Segurança (Visão Geral)

Para sua tranquilidade e de seus clientes, o Heroic Leap utiliza infraestrutura moderna de ponta:
*   **Dados Isolados e Protegidos:** Cada cliente possui um banco de dados independente e isolado no **Supabase**. Seus dados de leads, faturamento e agendas nunca se misturam com os de outros clientes.
*   **Comunicação Criptografada:** Toda transferência de dados é feita sob criptografia SSL de ponta a ponta.
*   **Sincronização em Tempo Real:** O painel reflete alterações imediatamente (tecnologia de WebSocket/Realtime). Se o robô de IA fizer um agendamento ou se você arrastar um card no Kanban, a tela atualiza sozinha sem precisar dar F5.

---

## 🖥️ 3. Explicação Detalhada das Abas do Sistema

### 📊 A. Dashboard (Painel de Indicadores)
O Dashboard é a sua central de inteligência. Ele resume a saúde financeira e comercial da empresa com base no período selecionado (Hoje, Ontem, 7 Dias, 14 Dias, Mês, Ano ou Personalizado).

*   **Métricas Principais (Cards):**
    *   **Leads Qualificados:** Total de novas pessoas que iniciaram contato e foram qualificadas pelo sistema.
    *   **Agendamentos Realizados:** Quantidade de agendamentos agendados para o período.
    *   **Conversão de Consultas (%):** Percentual de pessoas que agendaram e efetivamente compareceram/compraram.
    *   **LTV Acumulado (R$):** Valor total faturado no período (soma de todas as conversões e vendas).
*   **Gráfico de Movimento Diário:** Mostra a quantidade de agendamentos criados e quantas consultas foram realizadas dia a dia, facilitando a visualização dos seus dias mais produtivos.
*   **Gráfico de Horários de Pico:** Distribuição das consultas por hora do dia, ideal para dimensionar sua equipe ou disponibilidade.
*   **Funil de Vendas Visual:** Representação gráfica das etapas (Iniciou Atendimento -> Agendado -> Converteu), exibindo a taxa de eficiência de uma etapa para outra.
*   **Exportação em PDF:** Um botão dedicado para gerar relatórios profissionais do painel prontos para impressão ou envio.

---

### 📋 B. CRM (Painel Kanban)
A aba CRM organiza seus leads visualmente em colunas de acordo com o estágio de negociação:
1. **Lead (Novo):** Pessoas que acabaram de entrar no sistema.
2. **Conversando:** Leads em fase de qualificação ou bate-papo.
3. **Agendado:** Leads com data e hora marcadas para consulta.
4. **Compareceu:** Clientes que compareceram ao agendamento.
5. **Converteu (Venda):** Negócios fechados com faturamento registrado.
6. **Não Converteu:** Leads descartados ou que recusaram a oferta.

*   **Ações nos Cards:**
    *   **Arrastar e Soltar (Drag & Drop):** Mova os cards entre as colunas para atualizar o status do lead no banco em tempo real.
    *   **Ação de Agendamento Automático:** Ao arrastar um card para a coluna **Agendado**, o sistema abre automaticamente um pop-up para você definir: *Profissional/Agenda, Data/Hora, Procedimento e Modalidade (Presencial/Online)*.
    *   **Ação de Conversão Automática:** Ao arrastar um card para **Converteu**, o sistema exibe um formulário de fechamento exigindo: *Serviço contratado, Valor Total Faturado e Observações*.
    *   **Links Rápidos:** Cada card possui um botão de WhatsApp para abrir a conversa diretamente no celular/Web, e um botão de detalhes.
    *   **Filtros de Busca:** Digite no campo de busca na parte superior para encontrar leads instantaneamente por nome ou número.

---

### 👥 C. Leads e Base de Clientes
Uma aba híbrida que divide os contatos em duas visões estratégicas:

*   **Aba Leads:** Lista completa de contatos que ainda estão no funil (não converteram). Exibe o nome, WhatsApp, resumo da conversa gerado por IA, status atual, data de agendamento e início de atendimento.
*   **Aba Base de Clientes:** Exibe os leads que já foram convertidos em faturamento.
    *   **Serviços Realizados (Qtd):** Mostra quantas consultas marcadas como "Compareceu" o cliente já realizou.
    *   **Próximo Agendamento:** Data e hora da próxima consulta agendada. Se não houver, exibe "Sem agendamentos futuros".
    *   **Cliente Desde:** Data do primeiro fechamento comercial.
*   **Modal de Detalhes do Lead (Ao clicar em qualquer linha):**
    *   **Dados Pessoais:** Exibe Telefone, E-mail, Data de Nascimento, Gênero, Idade (calculada de forma automática) e CPF.
    *   **LTV Acumulado:** O sistema soma em tempo real todas as conversões e consultas pagas desse cliente, exibindo o valor total investido por ele no seu negócio.
    *   **Histórico de Consultas:** Lista detalhada de todas as consultas passadas, exibindo o status, procedimento e o valor faturado em cada uma.
    *   **Jornada do Cliente (Timeline Scrollable):** Um registro cronológico de todas as ações ocorridas (ex: "Lead Criado", "Status alterado para Agendado", "Status alterado para Converteu com R$ 800,00").

---

### 📅 D. Central de Agendamentos (Agenda)
A visualização clássica de calendário para controle operacional de atendimentos.

*   **Múltiplas Agendas (Multiprofissional):** Filtre a visualização para ver a agenda de profissionais específicos (ex: Dr. Bruno, Dra. Elen) ou de todos ao mesmo tempo. Cada profissional possui uma **cor de identificação única** nos blocos do calendário.
*   **Visualizações Flexíveis:** Alterne entre os modos Semana, Dia ou Lista.
*   **Gestão de Status das Consultas:** Clique em qualquer consulta no calendário para abrir ações rápidas de:
    *   **Compareceu:** Marca que o cliente esteve presente e registra o pagamento.
    *   **Reagendar:** Altera a data, hora ou modalidade.
    *   **Cancelar:** Cancela o horário liberando a agenda.
*   **Criação Rápida:** Clique em qualquer espaço vazio do calendário para agendar um novo horário associado a um lead existente.

---

### ⚙️ E. Configurações
Área administrativa para parametrização do sistema.

*   **Configurações de Horário:** Defina os horários de início e fim do funcionamento da empresa. Isso ajuda o Dashboard a calcular com precisão as métricas de atendimento no horário comercial.
*   **Agendas (Profissionais):** Cadastre novos profissionais, edite suas cores de exibição e gerencie seus dados.
*   **API Tokens (Desenvolvedores):** Crie chaves de acesso seguras para integrar o Heroic Leap com ferramentas externas de automação (como n8n, Make ou Chatwoot).

---

## 🤖 4. O Agente de IA (Como funciona a automação de WhatsApp)

O sistema possui um assistente virtual inteligente integrado que roda em segundo plano:
1. **Triagem e Qualificação:** Quando um contato novo envia mensagem no WhatsApp da empresa, a IA lê, consulta as regras do seu negócio e responde qualificando o cliente.
2. **Consulta de Disponibilidade:** Se o lead quiser agendar, a IA consulta a tabela `agendamentos` e `agendas` no banco em tempo real, descobrindo as brechas de horários livres.
3. **Reserva Automática:** A IA sugere os horários livres. Assim que o lead confirma, a IA cria o agendamento no calendário e atualiza o status do lead no Kanban para **Agendado**.
4. **Lembrete de Consultas (Robô de Lembretes):** De hora em hora, o robô verifica quem tem consulta marcada para o dia atual e dispara um lembrete personalizado no WhatsApp do cliente solicitando confirmação. Ao enviar, marca o campo `lembrete_enviado = true` para garantir que o cliente nunca receba mensagens duplicadas.

---

## ❓ 5. Perguntas Frequentes (FAQ)

#### Um cliente realizou mais de uma consulta paga, como o LTV dele é calculated?
O LTV é atualizado dinamicamente. Ele soma o valor da conversão inicial registrado no CRM mais os valores pagos informados em cada um dos agendamentos marcados como "Compareceu". Você pode visualizar esses valores detalhadamente abrindo o Modal de Detalhes do Cliente.

#### O cliente desmarcou ou faltou. O que devo fazer no CRM?
Basta arrastar o card dele no Kanban para a coluna **Não Converteu** (se ele desistiu da compra) ou clicar na consulta correspondente na Agenda e selecionar **Reagendar** ou **Cancelar**. Se reagendar, o card dele no Kanban voltará automaticamente ao status "Agendado".

#### Como a IA sabe quais procedimentos nós oferecemos?
As diretrizes de procedimentos e regras de preços são configuradas no prompt do Agente de IA (geralmente conectado via n8n). O sistema puxa os horários disponíveis das agendas cadastradas na aba **Configurações**.

---

*Manual atualizado em: Maio de 2026. Todos os direitos reservados à Heroic Leap.*
