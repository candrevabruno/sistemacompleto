-- ============================================================
-- ETAPA 4: Gestão de Equipe
-- Execute este script no Supabase SQL Editor
-- ============================================================

-- 1. Adicionar nome e email à tabela users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS nome  TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Tabela de convites pendentes
CREATE TABLE IF NOT EXISTS team_invites (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'atendente',
  invited_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  token       UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS em team_invites
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados gerenciam convites
CREATE POLICY "auth_all_team_invites"
  ON team_invites FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Anon pode ler convites não aceitos (para página de aceite sem login)
CREATE POLICY "anon_select_team_invites"
  ON team_invites FOR SELECT TO anon
  USING (accepted_at IS NULL);

-- 4. Permitir que admins atualizem o role de outros usuários
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'users'
      AND policyname = 'admin_update_users'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "admin_update_users"
        ON users FOR UPDATE TO authenticated
        USING (
          (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
          OR id = auth.uid()
        )
        WITH CHECK (
          (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
          OR id = auth.uid()
        )
    $policy$;
  END IF;
END $$;

-- 5. Função SECURITY DEFINER para listar membros da equipe com email
--    (necessária pois auth.users não é acessível pelo client por padrão)
CREATE OR REPLACE FUNCTION get_team_members()
RETURNS TABLE(
  id         UUID,
  email      TEXT,
  role       TEXT,
  nome       TEXT,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
LANGUAGE SQL
STABLE
AS $$
  SELECT
    u.id,
    COALESCE(u.email, au.email) AS email,
    u.role,
    u.nome,
    au.created_at
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  ORDER BY au.created_at;
$$;

-- Conceder execução para usuários autenticados
GRANT EXECUTE ON FUNCTION get_team_members() TO authenticated;
