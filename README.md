# Sistema de Gestão para Profissionais de Saúde ⚕️

Sistema completo para gestão de clínicas, consultórios e profissionais de saúde, focado em alta conversão, segurança (LGPD) e experiência do usuário premium.

## 🚀 Funcionalidades Principais

- **Dashboard Inteligente**: Visão geral de atendimentos, conversão de leads e novos clientes.
- **Agenda Dinâmica**: Calendário interativo para gestão de horários e procedimentos.
- **CRM Completo**: Funil de vendas (Kanban) para acompanhamento de leads.
- **Gestão de Pacientes**: Cadastro detalhado e histórico de atendimentos.
- **Documentação de API**: Portal interativo para desenvolvedores com exemplos em tempo real.
- **Segurança Robusta**: Proteção via Row Level Security (RLS) no Supabase e sanitização contra XSS.

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 19 + TypeScript + Vite
- **Estilização**: Tailwind CSS v4 + Vanilla CSS
- **Banco de Dados & Auth**: Supabase (PostgreSQL)
- **Ícones**: Lucide React
- **Gráficos**: Recharts
- **Calendário**: FullCalendar
- **Gerenciamento de Estado**: React Context API

## ⚙️ Configuração Local

1.  **Clonar o repositório:**
    ```bash
    git clone https://github.com/heroicleaphealth/heroicleaphealth.git
    cd heroicleaphealth
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

## 🔒 Segurança e Privacidade (LGPD)

O projeto foi auditado para conformidade com as melhores práticas de segurança:
- **Zero Secrets**: Nenhuma chave privada ou secreta está exposta no código-fonte.
- **Proteção de Dados**: O acesso aos dados é restrito via RLS, garantindo que apenas usuários autenticados acessem as informações.
- **Sanitização**: Uso de `DOMPurify` em áreas sensíveis para prever ataques de injeção.

---
Desenvolvido com foco em excelência técnica e médica.

