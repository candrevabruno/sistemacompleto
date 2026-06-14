-- ETAPA 5 — Hierarquia em 3 níveis + permissões granulares (PARTE A)
-- Execute no Supabase SQL Editor.
--
-- Modelo: UMA instância Supabase por clínica.
--   super_admin (Heroic Leap) → admin (dono/médico) → membro
-- Agente/n8n usam service_role (bypassa RLS). Esta migração NÃO endurece
-- RLS das tabelas existentes — isso é a PARTE B, validada workflow a workflow.

-- ── 1. Feature flags controladas pela Heroic Leap (super_admin) ───────────────
ALTER TABLE public.clinic_config
  ADD COLUMN IF NOT EXISTS premium_enabled  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eventos_enabled  BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Consolidação dos cargos antigos no novo modelo de 3 níveis ─────────────
-- A tabela users tem um CHECK que só aceita os cargos antigos. Soltamos antes
-- de converter, e recriamos no fim com os 3 novos níveis.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- atendente / profissional / user  →  membro    (admin permanece admin)
UPDATE public.users
   SET role = 'membro'
 WHERE role IN ('atendente', 'profissional', 'user') OR role IS NULL;

-- A conta da Heroic Leap vira super_admin (controla as feature flags).
-- O e-mail vive em auth.users (public.users não tem coluna email).
-- Qualquer conta do domínio @heroicleap.com.br é Heroic Leap.
UPDATE public.users u
   SET role = 'super_admin'
  FROM auth.users au
 WHERE au.id = u.id
   AND (lower(au.email) = 'heroicleapoficial@gmail.com'
        OR lower(au.email) LIKE '%@heroicleap.com.br');

-- Recria o CHECK com os 3 níveis válidos.
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'admin', 'membro'));

-- ── 3. Tabela de permissões granulares por usuário ────────────────────────────
-- item_key ex.: 'modulo:dashboard', 'paciente_tab:dados', 'feature:premium',
--               'feature:eventos:disparos'
-- level: 'none' (sem acesso) | 'view' (só visualizar) | 'view_edit' (visualizar e editar)
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key    TEXT NOT NULL,
  level       TEXT NOT NULL CHECK (level IN ('none', 'view', 'view_edit')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);

-- ── 4. Convites de equipe ─────────────────────────────────────────────────────
-- Cria a tabela se ainda não existir nesta instância.
CREATE TABLE IF NOT EXISTS public.team_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'membro',
  token       TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  invited_by  UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Para instâncias que já tinham a tabela: garante as colunas novas.
ALTER TABLE public.team_invites
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Convites passam a nascer como 'membro' por padrão (cargos predefinidos removidos).
ALTER TABLE public.team_invites
  ALTER COLUMN role SET DEFAULT 'membro';

CREATE INDEX IF NOT EXISTS idx_team_invites_token ON public.team_invites(token);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON public.team_invites(lower(email));

-- RLS: a página /convite lê por token ANTES do login (anon); o resto é authenticated.
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_invites'
      AND policyname = 'team_invites_select'
  ) THEN
    CREATE POLICY "team_invites_select" ON public.team_invites
      FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_invites'
      AND policyname = 'team_invites_write'
  ) THEN
    CREATE POLICY "team_invites_write" ON public.team_invites
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 5. RLS apenas na tabela nova (PARTE A) ────────────────────────────────────
-- Permissiva para authenticated: o frontend gateia a escrita (rota Equipe é admin).
-- service_role (agente/n8n) bypassa tudo. Endurecimento fica para a PARTE B.
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_permissions'
      AND policyname = 'user_permissions_auth'
  ) THEN
    CREATE POLICY "user_permissions_auth" ON public.user_permissions
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 6. Função get_team_members (lista membros + e-mail de auth.users) ──────────
-- SECURITY DEFINER: necessário para ler auth.users (restrito ao postgres role).
CREATE OR REPLACE FUNCTION public.get_team_members()
RETURNS TABLE (id UUID, email TEXT, role TEXT, nome TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id,
         au.email::text AS email,
         u.role,
         COALESCE(au.raw_user_meta_data->>'full_name',
                  au.raw_user_meta_data->>'name')::text AS nome,
         au.created_at
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  ORDER BY au.created_at;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_members() TO authenticated;

-- ── 7. Remove o trigger de auto-criação de usuário ────────────────────────────
-- O trigger handle_new_user inseria role='user' (cargo antigo) em public.users a
-- cada novo auth.user, o que: (a) viola o novo CHECK e dá rollback no signup
-- OAuth, e (b) conflita com o provisionamento por convite feito no app
-- (AuthContext.tryProvisionFromInvite). O app passa a controlar 100% da criação
-- da linha em public.users (cargo + permissões vêm do convite).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Default da coluna alinhado ao novo modelo (caso algo ainda insira sem role).
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'membro';

-- NOTA: com login Google + provisionamento por convite, o "Disable public
-- signups" do Supabase NÃO pode ficar ligado (ele bloquearia até os convidados,
-- que só nascem no 1º login). O invite-only é garantido pelo app: quem não tem
-- convite cai na tela de "acesso restrito".
