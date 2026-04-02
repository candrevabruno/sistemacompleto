# Heroic Leap | Sistema de CRM & Gestão White-Label 🚀

Plataforma completa para gestão de clientes, leads e agendamentos, focada em alta conversão, segurança e experiência do usuário premium. Desenvolvida para agências que buscam escalar a entrega de valor para seus clientes com uma infraestrutura robusta e personalizada.

## 🌟 Funcionalidades Principais

- **Dashboard Inteligente**: Visão geral de atendimentos, conversão de leads e novos clientes em tempo real.
- **Agenda Dinâmica**: Calendário interativo para gestão de horários e serviços.
- **CRM Completo**: Funil de vendas (Kanban) para acompanhamento e automação de leads.
- **Gestão de Clientes**: Cadastro detalhado, histórico de interações e acompanhamento de funil.
- **Documentação de API**: Portal interativo para integração com automações (N8N, Make, Agentes IA).
- **Segurança Robusta**: Proteção via Row Level Security (RLS) no Supabase e isolamento multi-tenant.

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 19 + TypeScript + Vite
- **Estilização**: CSS Moderno + Tailwind CSS v4
- **Banco de Dados & Auth**: Supabase (PostgreSQL)
- **Ícones**: Lucide React
- **Gráficos**: Recharts
- **Calendário**: FullCalendar
- **Gerenciamento de Estado**: React Context API

## ⚙️ Configuração Local

1.  **Clonar o repositório:**
    ```bash
    git clone https://github.com/candrevabruno/sistemacompleto.git
    cd sistemacompleto
    ```

2.  **Instalar dependências:**
    ```bash
    npm install
    ```

3.  **Configurar Variáveis de Ambiente:**
    - Renomeie o arquivo `.env.example` para `.env`.
    - Insira suas credenciais do Supabase (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`).

4.  **Iniciar o servidor de desenvolvimento:**
    ```bash
    npm run dev
    ```

## 🔒 Segurança e Privacidade

O projeto foi auditado para conformidade com as melhores práticas de mercado:
- **Modelo Multi-Tenant**: Isolamento completo de dados por projeto e ambiente.
- **Proteção de Dados**: O acesso aos dados é restrito via RLS, garantindo que apenas usuários autenticados acessem as informações.
- **Sanitização**: Uso de bibliotecas modernas para prevenção de injeção e ataques XSS.

---
Desenvolvido com foco em escalabilidade e performance pela **Heroic Leap**.
