-- ETAPA 7 — Parte 2: Auditoria
-- Enriquece audit_log, adiciona triggers nas tabelas sensíveis e RPC para a tela admin.
-- Execute no Supabase SQL Editor.

-- ── 1. Enriquecer audit_log com campos de rastreabilidade ────────────────────
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS actor_email    TEXT,
  ADD COLUMN IF NOT EXISTS tabela         TEXT,
  ADD COLUMN IF NOT EXISTS modulo         TEXT,
  ADD COLUMN IF NOT EXISTS valor_anterior JSONB,
  ADD COLUMN IF NOT EXISTS valor_novo     JSONB;

-- ── 2. Índices para os filtros da tela ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id    ON public.audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON public.audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_tabela     ON public.audit_log (tabela);

-- ── 3. RLS: somente admin+ pode visualizar audit_log ──────────────────────────
DROP POLICY IF EXISTS "audit_log_select_auth"  ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_select_admin" ON public.audit_log;
CREATE POLICY "audit_log_select_admin" ON public.audit_log FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin')
  );

-- ── 4. Função de trigger genérica ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor_id    UUID;
  v_actor_email TEXT;
  v_acao        TEXT;
  v_modulo      TEXT;
  v_record_id   UUID;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NOT NULL THEN
    SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;
  END IF;

  v_acao := CASE TG_OP
    WHEN 'INSERT' THEN 'criado'
    WHEN 'UPDATE' THEN 'atualizado'
    WHEN 'DELETE' THEN 'apagado'
  END || '_' || TG_TABLE_NAME;

  v_modulo := CASE TG_TABLE_NAME
    WHEN 'user_permissions' THEN 'permissoes'
    WHEN 'agendas'          THEN 'agenda'
    WHEN 'servicos'         THEN 'agenda'
    ELSE TG_TABLE_NAME
  END;

  BEGIN
    v_record_id := CASE TG_OP
      WHEN 'DELETE' THEN (row_to_json(OLD)->>'id')::UUID
      ELSE (row_to_json(NEW)->>'id')::UUID
    END;
  EXCEPTION WHEN OTHERS THEN
    v_record_id := NULL;
  END;

  INSERT INTO public.audit_log (
    user_id, action, record_id, detalhes,
    actor_email, tabela, modulo, valor_anterior, valor_novo
  ) VALUES (
    v_actor_id,
    v_acao,
    v_record_id,
    NULL,
    v_actor_email,
    TG_TABLE_NAME,
    v_modulo,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── 5. Triggers nas tabelas sensíveis ─────────────────────────────────────────
-- user_permissions: quem deu/revogou acesso a quem
DROP TRIGGER IF EXISTS trg_audit_user_permissions ON public.user_permissions;
CREATE TRIGGER trg_audit_user_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- agendas: criação/edição/exclusão de agendas
DROP TRIGGER IF EXISTS trg_audit_agendas ON public.agendas;
CREATE TRIGGER trg_audit_agendas
  AFTER INSERT OR UPDATE OR DELETE ON public.agendas
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- servicos: criação/edição/exclusão de serviços
DROP TRIGGER IF EXISTS trg_audit_servicos ON public.servicos;
CREATE TRIGGER trg_audit_servicos
  AFTER INSERT OR UPDATE OR DELETE ON public.servicos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- ── 6. RPC para a tela de Auditoria (resolve email + filtra + pagina) ─────────
-- Usa duas queries separadas para evitar ambiguidade de 'id' no RETURNS TABLE.
CREATE OR REPLACE FUNCTION public.fn_get_audit_log(
  p_limit       INT  DEFAULT 25,
  p_offset      INT  DEFAULT 0,
  p_search      TEXT DEFAULT NULL,
  p_modulo      TEXT DEFAULT NULL,
  p_data_inicio DATE DEFAULT NULL,
  p_data_fim    DATE DEFAULT NULL
)
RETURNS TABLE(
  log_id         UUID,
  user_id        UUID,
  actor_email    TEXT,
  action         TEXT,
  record_id      UUID,
  detalhes       JSONB,
  tabela         TEXT,
  modulo         TEXT,
  valor_anterior JSONB,
  valor_novo     JSONB,
  created_at     TIMESTAMPTZ,
  display_email  TEXT,
  total_count    BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role  TEXT;
  v_total BIGINT;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Acesso negado: somente admin pode visualizar a auditoria.';
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.audit_log al
  LEFT JOIN auth.users u ON u.id = al.user_id
  WHERE
    (p_search IS NULL OR al.action ILIKE '%' || p_search || '%'
                      OR al.actor_email ILIKE '%' || p_search || '%'
                      OR COALESCE(u.email, '') ILIKE '%' || p_search || '%')
    AND (p_modulo IS NULL OR al.modulo = p_modulo)
    AND (p_data_inicio IS NULL OR al.created_at::DATE >= p_data_inicio)
    AND (p_data_fim    IS NULL OR al.created_at::DATE <= p_data_fim);

  RETURN QUERY
  SELECT
    al.id   AS log_id,
    al.user_id,
    al.actor_email,
    al.action,
    al.record_id,
    al.detalhes,
    al.tabela,
    al.modulo,
    al.valor_anterior,
    al.valor_novo,
    al.created_at,
    COALESCE(al.actor_email, u.email, 'Sistema') AS display_email,
    v_total AS total_count
  FROM public.audit_log al
  LEFT JOIN auth.users u ON u.id = al.user_id
  WHERE
    (p_search IS NULL OR al.action ILIKE '%' || p_search || '%'
                      OR al.actor_email ILIKE '%' || p_search || '%'
                      OR COALESCE(u.email, '') ILIKE '%' || p_search || '%')
    AND (p_modulo IS NULL OR al.modulo = p_modulo)
    AND (p_data_inicio IS NULL OR al.created_at::DATE >= p_data_inicio)
    AND (p_data_fim    IS NULL OR al.created_at::DATE <= p_data_fim)
  ORDER BY al.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_audit_log(INT, INT, TEXT, TEXT, DATE, DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
