# 💎 Blueprint Mestre — Heroic Leap (CRM + Agente de IA)

Este documento contém os requisitos técnicos e as instruções estruturais para replicar ou expandir o sistema "Heroic Leap". Pode ser usado como um prompt de alta fidelidade para IAs de codificação.

---

## 1. Visão Geral do Produto
O **Heroic Leap** é um CRM Boutique de alta conversão, focado em prestadores de serviços premium (Advogados, Clínicas, Agências). O diferencial é a integração nativa entre um **Painel de Gestão Visual (Kanban)** e um **Agente de IA via WhatsApp** que qualifica e agenda reuniões sozinho.

---

## 2. Pilares do Frontend (UI/UX)
*   **Design System:** Estética "High-End", fontes profissionais (Outfit/Inter), modo escuro por padrão (`#0a0a0a`), uso de Glassmorphism e sombras suaves (`shadow-card`).
*   **Páginas Chave:**
    *   **Dashboard:** Métricas em tempo real, Gráficos de barra (movimento por dia), Pizza (horário de pico) e Funil de Vendas dinâmico.
    *   **CRM (Kanban):** Colunas de status customizáveis. Cards de Leads com ações rápidas (WhatsApp, Detalhes, Reagendar).
    *   **Agenda:** Visão semanal/diária integrada ao banco de dados, com diferenciação por cores para cada profissional.

---

## 3. Estrutura do Banco de Dados (Supabase/PostgreSQL)
### Tabelas Essenciais:
*   **`leads`**: Centraliza o contato. Possui colunas para IA (`lembrete_enviado`, `id_conversa_chatwoot`) e status de funil.
*   **`agendamentos`**: Vincula leads a horários e agendas. Possui gatilho (Trigger) para calcular `data_hora_fim` automaticamente (+60min).
*   **`agendas`**: Lista de calendários ativos (ex: Dr. Bruno, Dra. Elen).
*   **`clinic_hours`**: Tabela de configuração para o Dashboard saber se o contato foi "Dentro ou Fora do Horário".

### Lógica de Segurança (RLS):
*   Acesso protegido por autenticação (Supabase Auth).
*   Políticas que garantem proteção de dados entre instâncias.

---

## 4. O Coração da IA (Automações n8n)
*   **Qualificação:** IA recebe a mensagem, consulta as regras do negócio e decide se o lead está pronto para agendar.
*   **Agendamento:** A IA consulta a disponibilidade real no banco de dados e propõe horários.
*   **Lembrete de Reunião:** Robô que roda de hora em hora. Ele filtra leads com `data_agendamento` para hoje onde `lembrete_enviado` é falso. Após enviar, marca como verdadeiro para evitar spam.

---

## 5. Modelo de Escala (SaaS)
*   **Deploy Isolado:** Um repositório central no GitHub servindo múltiplos projetos na Vercel.
*   **Vercel CLI:** Uso de instâncias separadas para garantir isolamento de dados e custo zero de infraestrutura inicial (Hobby/Pro).

---

**Nota de Uso:** Para reconstruir o sistema, use este blueprint em conjunto com o arquivo `setup_banco_novo_cliente.sql`.
