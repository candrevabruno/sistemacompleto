-- ======================================================================================
-- SCRIPT DE INICIALIZAÇÃO DE NOVO CLIENTE (HEROIC LEAP HEALTH)
-- Copie e cole este código no "SQL Editor" do Supabase do novo cliente e clique em RUN.
-- Ele criará todas as tabelas, permissões de segurança e dados padrão.
-- ======================================================================================

-- 1. EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA: USERS (Controle de Acesso)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. TABELA: CLINIC CONFIG (Configurações da Empresa)
CREATE TABLE IF NOT EXISTS public.clinic_config (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome text DEFAULT 'Nova Clínica',
  logo_url text,
  token_chatwoot text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.clinic_config ENABLE ROW LEVEL SECURITY;
-- Insere a configuração padrão vazia
INSERT INTO public.clinic_config (nome) VALUES ('Minha Clínica') ON CONFLICT DO NOTHING;

-- 4. TABELA: CLINIC HOURS (Horários de Funcionamento Global)
CREATE TABLE IF NOT EXISTS public.clinic_hours (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  dia text NOT NULL,
  aberto boolean DEFAULT true,
  hora_inicio time without time zone DEFAULT '08:00:00',
  hora_fim time without time zone DEFAULT '18:00:00',
  UNIQUE(dia)
);
ALTER TABLE public.clinic_hours ENABLE ROW LEVEL SECURITY;
-- Insere os horários padrão
INSERT INTO public.clinic_hours (dia, aberto) VALUES 
  ('segunda', true), ('terca', true), ('quarta', true), ('quinta', true), ('sexta', true), ('sabado', false), ('domingo', false)
  ON CONFLICT DO NOTHING;

-- 5. TABELA: AGENDAS (Agendas múltiplas / Médicos)
CREATE TABLE IF NOT EXISTS public.agendas (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome text NOT NULL,
  cor text DEFAULT '#c47e7e',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.agendas ENABLE ROW LEVEL SECURITY;

-- 6. TABELA: LEADS (Triagem e Funil do WhatsApp AI)
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome_lead text NOT NULL,
  whatsapp_lead text,
  motivo_contato text,
  procedimento_interesse text,
  status text DEFAULT 'conversando',
  resumo_conversa text,
  id_conta_chatwoot text,
  inicio_atendimento timestamp with time zone DEFAULT timezone('utc'::text, now()),
  ultima_mensagem timestamp with time zone DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- 7. TABELA: PACIENTES (Convertidos)
CREATE TABLE IF NOT EXISTS public.pacientes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  data_primeira_visita date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

-- 8. TABELA: AGENDAMENTOS (Calendário)
CREATE TABLE IF NOT EXISTS public.agendamentos (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE CASCADE,
  agenda_id uuid REFERENCES public.agendas(id) ON DELETE CASCADE,
  procedimento_nome text,
  nome_lead text,
  whatsapp_lead text,
  status text DEFAULT 'agendado',
  data_hora_inicio timestamp with time zone NOT NULL,
  data_hora_fim timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

-- 9. CRIAÇÃO DO STORAGE (Para Logos)
INSERT INTO storage.buckets (id, name, public) VALUES ('clinic-assets', 'clinic-assets', true) ON CONFLICT DO NOTHING;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'clinic-assets');
CREATE POLICY "Auth Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'clinic-assets' AND auth.role() = 'authenticated');

-- 10. POLÍTICAS RLS (Segurança Liberada para Usuários Logados neste Tenant)
-- Permite que qualquer usuário logado no painel DESTE cliente veja e edite OS DADOS DESTE DASHBOARD
DO $$
DECLARE
    t_name text;
BEGIN
    FOR t_name IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Shared Access" ON %I;', t_name);
        EXECUTE format('CREATE POLICY "Shared Access" ON %I FOR ALL USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'');', t_name);
    END LOOP;
END
$$;
