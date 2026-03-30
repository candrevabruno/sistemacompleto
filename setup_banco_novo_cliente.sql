-- ======================================================================================
-- SETUP DE NOVO CLIENTE — HEROIC LEAP HEALTH
-- Versão: 2.0 (atualizada após migration de produção)
-- 
-- Instruções:
-- 1. Acesse o SQL Editor do novo projeto Supabase do cliente
-- 2. Cole este script e clique em RUN
-- 3. Execute o PASSO 8 por último (criar usuário admin)
--
-- Ordem: ENUMs → Tabelas → VIEW → Índices → Triggers → RLS → Dados Iniciais
-- ======================================================================================

-- PASSO 0 — TIMEZONE
ALTER DATABASE postgres SET timezone TO 'America/Sao_Paulo';

-- PASSO 1 — ENUMs
DO $$ BEGIN CREATE TYPE lead_status AS ENUM ('iniciou_atendimento','conversando','agendado','compareceu','cancelou_agendamento','follow_up','abandonou_conversa'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE agendamento_status AS ENUM ('agendado','confirmado','compareceu','faltou','cancelado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE dia_semana AS ENUM ('domingo','segunda','terca','quarta','quinta','sexta','sabado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('admin','user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PASSO 2 — TABELAS

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.clinic_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nome TEXT NOT NULL DEFAULT 'Minha Clínica',
  logo_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.clinic_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dia TEXT NOT NULL UNIQUE,
  aberto BOOLEAN NOT NULL DEFAULT false,
  hora_inicio TIME,
  hora_fim TIME
);

CREATE TABLE IF NOT EXISTS public.agendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#C47E7E',
  ativo BOOLEAN NOT NULL DEFAULT true,
  horarios JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agenda_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id UUID NOT NULL REFERENCES public.agendas(id) ON DELETE CASCADE,
  dia dia_semana NOT NULL,
  aberto BOOLEAN NOT NULL DEFAULT false,
  hora_inicio TIME,
  hora_fim TIME,
  UNIQUE (agenda_id, dia)
);

-- Tabela central: leads
-- Único campo obrigatório: whatsapp_lead
-- inicio_atendimento preenchido automaticamente
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_lead TEXT NOT NULL,
  inicio_atendimento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  nome_lead TEXT,
  motivo_contato TEXT,
  procedimento_interesse TEXT,
  resumo_conversa TEXT,
  status TEXT NOT NULL DEFAULT 'iniciou_atendimento',
  ultima_mensagem TIMESTAMPTZ,
  -- Campos Chatwoot (NUNCA exibir no sistema — uso exclusivo N8N)
  id_conta_chatwoot TEXT,
  id_conversa_chatwoot TEXT,
  id_lead_chatwoot TEXT,
  inbox_id_chatwoot TEXT,
  -- Follow ups
  follow_up_1 TIMESTAMPTZ,
  follow_up_2 TIMESTAMPTZ,
  follow_up_3 TIMESTAMPTZ,
  -- Referência agendamento para N8N
  data_agendamento TIMESTAMPTZ,
  agendamento_criado_em TIMESTAMPTZ,
  id_agendamento TEXT,
  -- Preenchido manualmente pela recepcionista
  observacoes TEXT,
  data_nascimento DATE,
  genero TEXT,
  valor_pago NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pacientes: criado automaticamente via trigger ao marcar 'compareceu'
CREATE TABLE IF NOT EXISTS public.pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE SET NULL,
  data_primeira_visita DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agendamentos: data_hora_fim calculada automaticamente (inicio + 60 min)
CREATE TABLE IF NOT EXISTS public.agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id UUID REFERENCES public.agendas(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE,
  procedimento_nome TEXT,
  nome_lead TEXT,
  whatsapp_lead TEXT,
  data_hora_inicio TIMESTAMPTZ NOT NULL,
  data_hora_fim TIMESTAMPTZ GENERATED ALWAYS AS (data_hora_inicio + INTERVAL '60 minutes') STORED,
  status TEXT NOT NULL DEFAULT 'agendado',
  observacoes TEXT,
  valor_pago NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PASSO 3 — VIEW v_leads (minutos_ultima_mensagem em tempo real)
-- NOW() nao pode ser GENERATED STORED — VIEW resolve isso
-- N8N deve usar v_leads para acessar minutos_ultima_mensagem
CREATE OR REPLACE VIEW public.v_leads AS
SELECT
  *,
  CASE
    WHEN ultima_mensagem IS NOT NULL
    THEN ROUND(EXTRACT(EPOCH FROM (NOW() - ultima_mensagem)) / 60, 1)
    ELSE NULL
  END AS minutos_ultima_mensagem
FROM public.leads;

-- PASSO 4 — ÍNDICES
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp      ON public.leads(whatsapp_lead);
CREATE INDEX IF NOT EXISTS idx_leads_status        ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_inicio        ON public.leads(inicio_atendimento);
CREATE INDEX IF NOT EXISTS idx_pacientes_lead_id   ON public.pacientes(lead_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_agenda ON public.agendamentos(agenda_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data   ON public.agendamentos(data_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON public.agendamentos(status);
CREATE INDEX IF NOT EXISTS idx_agenda_hours_agenda ON public.agenda_hours(agenda_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash     ON public.api_tokens(token_hash);

-- PASSO 5 — TRIGGERS

-- Trigger 1: Sincroniza users ao criar usuário no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, role) VALUES (NEW.id, 'user') ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger 2: Cria 7 linhas em agenda_hours ao criar uma agenda
CREATE OR REPLACE FUNCTION public.criar_agenda_hours()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.agenda_hours (agenda_id, dia, aberto, hora_inicio, hora_fim) VALUES
    (NEW.id, 'domingo'::dia_semana, false, '08:00', '18:00'),
    (NEW.id, 'segunda'::dia_semana, true,  '08:00', '18:00'),
    (NEW.id, 'terca'::dia_semana,   true,  '08:00', '18:00'),
    (NEW.id, 'quarta'::dia_semana,  true,  '08:00', '18:00'),
    (NEW.id, 'quinta'::dia_semana,  true,  '08:00', '18:00'),
    (NEW.id, 'sexta'::dia_semana,   true,  '08:00', '18:00'),
    (NEW.id, 'sabado'::dia_semana,  false, '08:00', '18:00')
  ON CONFLICT (agenda_id, dia) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS on_agenda_created ON public.agendas;
CREATE TRIGGER on_agenda_created AFTER INSERT ON public.agendas FOR EACH ROW EXECUTE FUNCTION public.criar_agenda_hours();

-- Trigger 3: Promoção bidirecional lead <-> paciente
-- Mover para 'compareceu' -> cria paciente | Sair de 'compareceu' -> deleta paciente
CREATE OR REPLACE FUNCTION public.converter_lead_em_paciente()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'compareceu' AND (OLD.status IS NULL OR OLD.status != 'compareceu') THEN
    INSERT INTO public.pacientes (lead_id, data_primeira_visita) VALUES (NEW.id, CURRENT_DATE) ON CONFLICT (lead_id) DO NOTHING;
  END IF;
  IF OLD.status = 'compareceu' AND NEW.status != 'compareceu' THEN
    DELETE FROM public.pacientes WHERE lead_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_lead_status_changed ON public.leads;
CREATE TRIGGER on_lead_status_changed AFTER UPDATE OF status ON public.leads FOR EACH ROW EXECUTE FUNCTION public.converter_lead_em_paciente();

-- Trigger 4: Impede reabilitação de token desabilitado
CREATE OR REPLACE FUNCTION public.prevent_token_reativation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.ativo = false AND NEW.ativo = true THEN
    RAISE EXCEPTION 'TOKEN_PERMANENTEMENTE_DESABILITADO';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS on_api_token_update ON public.api_tokens;
CREATE TRIGGER on_api_token_update BEFORE UPDATE ON public.api_tokens FOR EACH ROW EXECUTE FUNCTION public.prevent_token_reativation();

-- PASSO 6 — ROW LEVEL SECURITY (RLS)
ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_hours  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_hours  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_tokens    ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t_name TEXT;
BEGIN
  FOR t_name IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Shared Access" ON public.%I;', t_name);
    EXECUTE format('CREATE POLICY "Shared Access" ON public.%I FOR ALL USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'');', t_name);
  END LOOP;
END $$;

-- PASSO 6b — STORAGE (logos)
INSERT INTO storage.buckets (id, name, public) VALUES ('clinic-assets', 'clinic-assets', true) ON CONFLICT DO NOTHING;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'clinic-assets');
DROP POLICY IF EXISTS "Auth Insert" ON storage.objects;
CREATE POLICY "Auth Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'clinic-assets' AND auth.role() = 'authenticated');

-- PASSO 7 — DADOS INICIAIS
INSERT INTO public.clinic_config (id, nome) VALUES (1, 'Minha Clínica') ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clinic_hours (dia, aberto, hora_inicio, hora_fim) VALUES
  ('domingo', false, NULL, NULL), ('segunda', true, '08:00', '18:00'),
  ('terca',   true, '08:00', '18:00'), ('quarta',  true, '08:00', '18:00'),
  ('quinta',  true, '08:00', '18:00'), ('sexta',   true, '08:00', '18:00'),
  ('sabado',  false, NULL, NULL)
ON CONFLICT (dia) DO NOTHING;

-- O trigger on_agenda_created cria as 7 linhas em agenda_hours automaticamente
INSERT INTO public.agendas (nome, cor) VALUES ('Agenda Principal', '#C47E7E') ON CONFLICT DO NOTHING;

-- ======================================================================================
-- PASSO 8 — USUÁRIO ADMIN (execute por último)
-- 1. Desabilite "Confirm email": Authentication > Providers > Email
-- 2. Substitua os valores abaixo e descomente
-- ======================================================================================
/*
SELECT auth.create_user(
  '{"email": "SEU_EMAIL_AQUI", "password": "SUA_SENHA_AQUI", "email_confirm": true}'::jsonb
);
UPDATE public.users SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'SEU_EMAIL_AQUI');
*/
