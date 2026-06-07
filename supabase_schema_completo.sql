-- ======================================================================================
-- SETUP COMPLETO DO BANCO DE DADOS SUPABASE — HEROIC LEAP (CRM + AGENTE DE IA)
-- Versão Integrada e Atualizada (Com Cal.com, LTV, Triggers de Jornada e RLS)
-- ======================================================================================

-- --------------------------------------------------------------------------------------
-- CONFIGURAÇÕES INICIAIS & EXTENSÕES
-- --------------------------------------------------------------------------------------
ALTER DATABASE postgres SET timezone TO 'America/Sao_Paulo';
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------------------------------------
-- CRIAÇÃO DE ENUMS
-- --------------------------------------------------------------------------------------
DO $$ 
BEGIN 
  CREATE TYPE public.lead_status AS ENUM (
    'iniciou_atendimento',
    'conversando',
    'agendado',
    'reagendado',
    'compareceu',
    'cancelou_agendamento',
    'follow_up',
    'abandonou_conversa',
    'converteu',
    'nao_converteu',
    'faltou'
  ); 
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ 
BEGIN 
  CREATE TYPE public.agendamento_status AS ENUM (
    'agendado',
    'confirmado',
    'compareceu',
    'faltou',
    'cancelado',
    'reagendado'
  ); 
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ 
BEGIN 
  CREATE TYPE public.dia_semana AS ENUM (
    'domingo',
    'segunda',
    'terca',
    'quarta',
    'quinta',
    'sexta',
    'sabado'
  ); 
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ 
BEGIN 
  CREATE TYPE public.user_role AS ENUM (
    'admin',
    'user'
  ); 
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --------------------------------------------------------------------------------------
-- CRIAÇÃO DE TABELAS
-- --------------------------------------------------------------------------------------

-- 1. Tabela: users (Vinculado a auth.users do Supabase)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'user'::public.user_role,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela: clinic_config
CREATE TABLE IF NOT EXISTS public.clinic_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nome TEXT NOT NULL DEFAULT 'Minha Empresa',
  logo_url TEXT,
  chatwoot_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela: clinic_hours
CREATE TABLE IF NOT EXISTS public.clinic_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dia public.dia_semana NOT NULL UNIQUE,
  aberto BOOLEAN NOT NULL DEFAULT false,
  hora_inicio TIME,
  hora_fim TIME
);

-- 4. Tabela: agendas (Com suporte a Cal.com e legado)
CREATE TABLE IF NOT EXISTS public.agendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  cor TEXT NOT NULL DEFAULT '#C47E7E',
  ativo BOOLEAN NOT NULL DEFAULT true,
  horarios JSONB,
  calcom_link TEXT,      -- Campo unificado para link do Cal.com (Event Type)
  cal_event_id TEXT,     -- ID do Evento no Cal.com
  cal_username TEXT,     -- Usuário do profissional no Cal.com
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Tabela: agenda_hours (Opcional/Legado para horários locais)
CREATE TABLE IF NOT EXISTS public.agenda_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id UUID NOT NULL REFERENCES public.agendas(id) ON DELETE CASCADE,
  dia public.dia_semana NOT NULL,
  aberto BOOLEAN NOT NULL DEFAULT false,
  hora_inicio TIME,
  hora_fim TIME,
  UNIQUE (agenda_id, dia)
);

-- 6. Tabela: leads (Contém todas as colunas de dados, N8N, Chatwoot e Objeções)
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_lead TEXT NOT NULL,
  inicio_atendimento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  nome_lead TEXT,
  motivo_contato TEXT,
  procedimento_interesse TEXT,
  resumo_conversa TEXT,
  status public.lead_status NOT NULL DEFAULT 'iniciou_atendimento'::public.lead_status,
  lembrete_enviado BOOLEAN DEFAULT false,
  ultima_mensagem TIMESTAMPTZ,
  id_conta_chatwoot TEXT,
  id_conversa_chatwoot TEXT,
  id_lead_chatwoot TEXT,
  inbox_id_chatwoot TEXT,
  follow_up_1 TIMESTAMPTZ,
  follow_up_2 TIMESTAMPTZ,
  follow_up_3 TIMESTAMPTZ,
  data_agendamento TIMESTAMPTZ,
  agendamento_criado_em TIMESTAMPTZ,
  id_agendamento UUID, -- Vinculado ao agendamento ativo (Sem constraint direta para evitar circularidade em cascade, mas controlado na aplicação)
  observacoes TEXT,
  data_nascimento DATE,
  genero TEXT,
  valor_pago NUMERIC(10,2),
  email TEXT,
  cpf TEXT,
  jornada JSONB DEFAULT '[]'::jsonb,  -- Histórico completo de transições de status
  objecao TEXT,                       -- Motivo principal da não-conversão
  motivo_perda TEXT,                  -- Detalhamento da perda da venda
  servicos_contratados TEXT[],        -- Serviços efetivamente contratados na conversão
  modalidade TEXT DEFAULT 'presencial', -- Presencial ou Online
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Tabela: clientes (Registra leads convertidos e acumula o LTV total do cliente)
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  data_primeira_visita DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_pago NUMERIC(10,2) DEFAULT 0.00, -- Valor total acumulado (LTV)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Tabela: agendamentos
CREATE TABLE IF NOT EXISTS public.agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id UUID REFERENCES public.agendas(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  procedimento_nome TEXT,
  nome_lead TEXT,
  whatsapp_lead TEXT,
  data_hora_inicio TIMESTAMPTZ NOT NULL,
  data_hora_fim TIMESTAMPTZ NOT NULL,
  status public.agendamento_status NOT NULL DEFAULT 'agendado'::public.agendamento_status,
  observacoes TEXT,
  valor_pago NUMERIC(10,2),
  modalidade TEXT DEFAULT 'presencial', -- Presencial ou Online
  calcom_uid TEXT,                     -- ID do UID do agendamento vindo do Cal.com
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Tabela: api_tokens (Utilizado para autenticação de integrações externas como n8n)
CREATE TABLE IF NOT EXISTS public.api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Tabela: servicos (Cadastro de procedimentos/serviços oferecidos pela empresa)
CREATE TABLE IF NOT EXISTS public.servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------------------
-- CONSTRAINTS EXTRA E VÍNCULOS
-- --------------------------------------------------------------------------------------
-- Adiciona a foreign key do id_agendamento de forma deferred para evitar loops de criação de tabelas
ALTER TABLE public.leads 
  ADD CONSTRAINT fk_leads_active_appointment 
  FOREIGN KEY (id_agendamento) 
  REFERENCES public.agendamentos (id) 
  ON DELETE SET NULL;

-- --------------------------------------------------------------------------------------
-- CRIAÇÃO DE VIEWS
-- --------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_leads AS
SELECT
  *,
  CASE
    WHEN ultima_mensagem IS NOT NULL
    THEN ROUND(EXTRACT(EPOCH FROM (NOW() - ultima_mensagem)) / 60, 1)
    ELSE NULL
  END AS minutos_ultima_mensagem
FROM public.leads;

-- --------------------------------------------------------------------------------------
-- CRIAÇÃO DE ÍNDICES PARA ALTA PERFORMANCE
-- --------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp ON public.leads(whatsapp_lead);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON public.agendamentos(data_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_clientes_lead ON public.clientes(lead_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_lead ON public.agendamentos(lead_id);

-- --------------------------------------------------------------------------------------
-- CRIAÇÃO DE FUNÇÕES E TRIGGERS DO POSTGRES
-- --------------------------------------------------------------------------------------

-- 1. Trigger: Calcular a hora fim do agendamento automaticamente (Padrão: 60 minutos)
CREATE OR REPLACE FUNCTION public.calcular_hora_fim_agendamento()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.data_hora_fim IS NULL OR NEW.data_hora_inicio != OLD.data_hora_inicio OR OLD.data_hora_inicio IS NULL THEN
    NEW.data_hora_fim := NEW.data_hora_inicio + INTERVAL '60 minutes';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_agendamento_before_insert ON public.agendamentos;
CREATE TRIGGER on_agendamento_before_insert 
  BEFORE INSERT OR UPDATE ON public.agendamentos 
  FOR EACH ROW 
  EXECUTE FUNCTION public.calcular_hora_fim_agendamento();


-- 2. Trigger: Sincronização Automática de Usuários do Auth do Supabase
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, role) 
  VALUES (NEW.id, 'user'::public.user_role) 
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();


-- 3. Trigger: Criar horários de agenda padrão ao cadastrar nova agenda
CREATE OR REPLACE FUNCTION public.criar_agenda_hours()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.agenda_hours (agenda_id, dia, aberto, hora_inicio, hora_fim) VALUES
    (NEW.id, 'domingo'::public.dia_semana, false, '08:00', '18:00'),
    (NEW.id, 'segunda'::public.dia_semana, true,  '08:00', '18:00'),
    (NEW.id, 'terca'::public.dia_semana,   true,  '08:00', '18:00'),
    (NEW.id, 'quarta'::public.dia_semana,  true,  '08:00', '18:00'),
    (NEW.id, 'quinta'::public.dia_semana,  true,  '08:00', '18:00'),
    (NEW.id, 'sexta'::public.dia_semana,   true,  '08:00', '18:00'),
    (NEW.id, 'sabado'::public.dia_semana,  false, '08:00', '18:00')
  ON CONFLICT (agenda_id, dia) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_agenda_created ON public.agendas;
CREATE TRIGGER on_agenda_created 
  AFTER INSERT ON public.agendas 
  FOR EACH ROW 
  EXECUTE FUNCTION public.criar_agenda_hours();


-- 4. Trigger: Converter Lead em Cliente ao mudar status para "converteu"
CREATE OR REPLACE FUNCTION public.converter_lead_em_cliente()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'converteu'::public.lead_status THEN
    INSERT INTO public.clientes (lead_id, data_primeira_visita, valor_pago) 
    VALUES (NEW.id, CURRENT_DATE, COALESCE(NEW.valor_pago, 0.00)) 
    ON CONFLICT (lead_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_lead_status_changed ON public.leads;
CREATE TRIGGER on_lead_status_changed 
  AFTER UPDATE OF status ON public.leads 
  FOR EACH ROW 
  EXECUTE FUNCTION public.converter_lead_em_cliente();


-- 5. Trigger: Registrar a Jornada do Lead (Mudanças de Status, Valores e Serviços contratados)
CREATE OR REPLACE FUNCTION public.log_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Se for inserção de lead novo
  IF (TG_OP = 'INSERT') THEN
    NEW.jornada = jsonb_build_array(
      jsonb_build_object(
        'status', NEW.status,
        'timestamp', timezone('utc', now())::text,
        'valor_pago', CASE WHEN NEW.status = 'converteu'::public.lead_status THEN COALESCE(NEW.valor_pago, 0.00) ELSE null END,
        'servicos_contratados', CASE WHEN NEW.status = 'converteu'::public.lead_status THEN NEW.servicos_contratados ELSE null END
      )
    );
  -- Se for atualização e o status mudou
  ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Garante que o campo não seja nulo
    IF NEW.jornada IS NULL THEN
      NEW.jornada = '[]'::jsonb;
    END IF;
    
    -- Anexa o novo status à lista
    NEW.jornada = NEW.jornada || jsonb_build_array(
      jsonb_build_object(
        'status', NEW.status,
        'timestamp', timezone('utc', now())::text,
        'valor_pago', CASE WHEN NEW.status = 'converteu'::public.lead_status THEN COALESCE(NEW.valor_pago, 0.00) ELSE null END,
        'servicos_contratados', CASE WHEN NEW.status = 'converteu'::public.lead_status THEN NEW.servicos_contratados ELSE null END
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_lead_status_change ON public.leads;
CREATE TRIGGER trigger_log_lead_status_change
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.log_lead_status_change();

-- --------------------------------------------------------------------------------------
-- CONFIGURAÇÕES DE SEGURANÇA E POLÍTICAS RLS (Row Level Security)
-- --------------------------------------------------------------------------------------

ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_hours  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_hours  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_tokens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos      ENABLE ROW LEVEL SECURITY;

-- Aplica a política de Shared Access a todas as tabelas (Acesso apenas para usuários autenticados)
DO $$
DECLARE 
  t_name TEXT;
BEGIN
  FOR t_name IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename IN ('users', 'clinic_config', 'clinic_hours', 'agendas', 'agenda_hours', 'leads', 'clientes', 'agendamentos', 'api_tokens', 'servicos')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Shared Access" ON public.%I;', t_name);
    EXECUTE format('CREATE POLICY "Shared Access" ON public.%I FOR ALL USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'');', t_name);
  END LOOP;
END $$;

-- --------------------------------------------------------------------------------------
-- CONFIGURAÇÃO DE BUCKETS DE STORAGE & POLÍTICAS
-- --------------------------------------------------------------------------------------

-- Bucket de storage público para logos e assets da clínica
INSERT INTO storage.buckets (id, name, public) 
VALUES ('clinic-assets', 'clinic-assets', true) 
ON CONFLICT (id) DO NOTHING;

-- Política 1: Acesso de leitura público a todos os objetos do bucket clinic-assets
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects 
  FOR SELECT 
  USING (bucket_id = 'clinic-assets');

-- Política 2: Inserção permitida apenas para usuários logados
DROP POLICY IF EXISTS "Auth Insert" ON storage.objects;
CREATE POLICY "Auth Insert" ON storage.objects 
  FOR INSERT 
  WITH CHECK (bucket_id = 'clinic-assets' AND auth.role() = 'authenticated');

-- --------------------------------------------------------------------------------------
-- CARGA DE DADOS INICIAIS (SEEDING)
-- --------------------------------------------------------------------------------------

-- Configuração inicial da Clínica
INSERT INTO public.clinic_config (id, nome) 
VALUES (1, 'Minha Empresa') 
ON CONFLICT (id) DO NOTHING;

-- Agenda Principal
INSERT INTO public.agendas (nome, cor, ativo) 
VALUES ('Agenda Principal', '#C47E7E', true) 
ON CONFLICT (nome) DO NOTHING;

-- Horários de funcionamento padrão da Clínica
INSERT INTO public.clinic_hours (dia, aberto, hora_inicio, hora_fim) VALUES
  ('domingo'::public.dia_semana, false, '08:00', '18:00'),
  ('segunda'::public.dia_semana, true,  '08:00', '18:00'),
  ('terca'::public.dia_semana,   true,  '08:00', '18:00'),
  ('quarta'::public.dia_semana,  true,  '08:00', '18:00'),
  ('quinta'::public.dia_semana,  true,  '08:00', '18:00'),
  ('sexta'::public.dia_semana,   true,  '08:00', '18:00'),
  ('sabado'::public.dia_semana,  false, '08:00', '18:00')
ON CONFLICT (dia) DO NOTHING;

-- Serviços recomendados para iniciar
INSERT INTO public.servicos (nome) VALUES
  ('Consulta Inicial'),
  ('Retorno'),
  ('Procedimento Geral')
ON CONFLICT (nome) DO NOTHING;
