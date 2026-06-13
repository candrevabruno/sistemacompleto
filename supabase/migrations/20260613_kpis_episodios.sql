-- ETAPA 3B — Episódio de atendimento + KPIs configuráveis + Investimento em Marketing
-- Execute no Supabase SQL Editor

-- ── 1. Coluna episodio_id em agendamentos ──────────────────────────────────────
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS episodio_id UUID;

-- ── 2. Tabela episodio_atendimento ────────────────────────────────────────────
-- Base permanente de métricas por coorte: 1 ID por intenção de consulta,
-- independente de quantos reagendamentos ocorram.
CREATE TABLE IF NOT EXISTS public.episodio_atendimento (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  agendamento_id   UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),    -- define a COORTE
  scheduled_for    TIMESTAMPTZ,                           -- data pretendida atual
  final_status     TEXT CHECK (final_status IN ('realizado', 'no_show', 'cancelado', 'reagendado')),
  final_status_at  TIMESTAMPTZ,
  n_reagendamentos INTEGER NOT NULL DEFAULT 0
);

-- ── 3. Trigger: criar episódio ao inserir agendamento ─────────────────────────
CREATE OR REPLACE FUNCTION public.criar_episodio_atendimento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE ep_id UUID;
BEGIN
  IF NEW.episodio_id IS NULL THEN
    -- Novo agendamento → novo episódio
    ep_id := gen_random_uuid();
    INSERT INTO public.episodio_atendimento
      (id, lead_id, agendamento_id, created_at, scheduled_for)
    VALUES
      (ep_id, NEW.lead_id, NEW.id, NOW(), NEW.data_hora_inicio);
    NEW.episodio_id := ep_id;
  ELSE
    -- Reagendamento: mantém o mesmo episódio, atualiza data e incrementa contador
    UPDATE public.episodio_atendimento
    SET scheduled_for    = NEW.data_hora_inicio,
        n_reagendamentos = n_reagendamentos + 1,
        final_status     = NULL,
        final_status_at  = NULL
    WHERE id = NEW.episodio_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_criar_episodio ON public.agendamentos;
CREATE TRIGGER trg_criar_episodio
  BEFORE INSERT ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.criar_episodio_atendimento();

-- ── 4. Trigger: fechar episódio ao alterar status ────────────────────────────
CREATE OR REPLACE FUNCTION public.fechar_episodio_atendimento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.episodio_id IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'compareceu' THEN
      UPDATE public.episodio_atendimento
        SET final_status = 'realizado', final_status_at = NOW()
        WHERE id = NEW.episodio_id AND final_status IS NULL;
    ELSIF NEW.status = 'nao_compareceu' THEN
      UPDATE public.episodio_atendimento
        SET final_status = 'no_show', final_status_at = NOW()
        WHERE id = NEW.episodio_id AND final_status IS NULL;
    ELSIF NEW.status = 'cancelado' THEN
      UPDATE public.episodio_atendimento
        SET final_status = 'cancelado', final_status_at = NOW()
        WHERE id = NEW.episodio_id AND final_status IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fechar_episodio ON public.agendamentos;
CREATE TRIGGER trg_fechar_episodio
  AFTER UPDATE OF status ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.fechar_episodio_atendimento();

-- ── 5. Backfill: cria episódios para agendamentos históricos ──────────────────
DO $$
DECLARE r RECORD; ep_id UUID;
BEGIN
  FOR r IN
    SELECT id, lead_id, data_hora_inicio, created_at
    FROM public.agendamentos
    WHERE episodio_id IS NULL
  LOOP
    ep_id := gen_random_uuid();
    INSERT INTO public.episodio_atendimento
      (id, lead_id, agendamento_id, created_at, scheduled_for)
    VALUES
      (ep_id, r.lead_id, r.id, r.created_at, r.data_hora_inicio)
    ON CONFLICT DO NOTHING;
    UPDATE public.agendamentos SET episodio_id = ep_id WHERE id = r.id;
  END LOOP;
END;
$$;

-- ── 6. kpi_catalog ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kpi_catalog (
  codigo              TEXT PRIMARY KEY,
  nome                TEXT NOT NULL,
  descricao           TEXT,
  unidade             TEXT NOT NULL DEFAULT '%',
  verde_min           NUMERIC,
  verde_max           NUMERIC,
  amarelo_min         NUMERIC,
  amarelo_max         NUMERIC,
  quanto_maior_melhor BOOLEAN NOT NULL DEFAULT true,
  pilar               TEXT NOT NULL CHECK (pilar IN ('operacional', 'comercial', 'experiencia')),
  fonte               TEXT NOT NULL DEFAULT 'calculado',  -- 'calculado' | 'aguardando'
  ordem               INTEGER NOT NULL DEFAULT 99
);

-- ── 7. clinic_kpi_selection ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinic_kpi_selection (
  kpi_codigo TEXT PRIMARY KEY REFERENCES public.kpi_catalog(codigo) ON DELETE CASCADE,
  ativo      BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 8. marketing_investimento ─────────────────────────────────────────────────
-- Campo manual de investimento em marketing — alimenta CAC, ROAS e CPL
CREATE TABLE IF NOT EXISTS public.marketing_investimento (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_inicio DATE NOT NULL,
  periodo_fim    DATE NOT NULL,
  valor          NUMERIC(12,2) NOT NULL,
  canal          TEXT,
  descricao      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 9. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.episodio_atendimento   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_catalog            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_kpi_selection   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_investimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "episodio_atendimento_auth"  ON public.episodio_atendimento   FOR ALL     TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "kpi_catalog_read"           ON public.kpi_catalog            FOR SELECT  TO authenticated USING (true);
CREATE POLICY "kpi_selection_auth"         ON public.clinic_kpi_selection   FOR ALL     TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "marketing_inv_auth"         ON public.marketing_investimento  FOR ALL     TO authenticated USING (true) WITH CHECK (true);

-- ── 10. Seed kpi_catalog ──────────────────────────────────────────────────────
INSERT INTO public.kpi_catalog
  (codigo, nome, descricao, unidade, verde_min, verde_max, amarelo_min, amarelo_max, quanto_maior_melhor, pilar, fonte, ordem)
VALUES
  -- Pilar Operacional — dados já existem, calculado sobre episódios por coorte
  ('op_ocupacao',          'Ocupação da Agenda',        'Agendamentos realizados vs. total marcado no período',         '%',   80,   NULL, 60,   79,   true,  'operacional', 'calculado',  1),
  ('op_no_show',           'Taxa de No-show',           'Pacientes que não compareceram sem aviso prévio',              '%',   NULL, 10,   10,   20,   false, 'operacional', 'calculado',  2),
  ('op_cancelamento',      'Taxa de Cancelamento',      'Agendamentos cancelados definitivamente no período',           '%',   NULL, 10,   10,   20,   false, 'operacional', 'calculado',  3),
  ('op_instabilidade',     'Taxa de Instabilidade',     'Agendamentos que sofreram ao menos 1 reagendamento',           '%',   NULL, 15,   15,   30,   false, 'operacional', 'calculado',  4),
  ('op_retorno',           'Taxa de Retorno',           'Pacientes que retornaram para 2ª consulta ou mais (acumulado)','%',   40,   NULL, 20,   39,   true,  'operacional', 'calculado',  5),
  ('op_atend_prof_dia',    'Atend./Prof./Dia',          'Média de atendimentos realizados por profissional no período', 'qtd', 6,    NULL, 4,    5.9,  true,  'operacional', 'calculado',  6),
  ('op_lead_time',         'Lead Time (dias)',           'Tempo médio entre agendamento e a data da consulta',           'dias',NULL, 3,    4,    7,    false, 'operacional', 'calculado',  7),
  ('op_reaproveitamento',  'Reaproveitamento de Slots', 'Reagendamentos que resultaram em atendimento realizado',       '%',   70,   NULL, 40,   69,   true,  'operacional', 'calculado',  8),
  -- Pilar Comercial — parcialmente calculável
  ('com_taxa_agendamento', 'Taxa de Agendamento',       'Leads que geraram ao menos um agendamento',                   '%',   40,   NULL, 20,   39,   true,  'comercial',   'calculado',  10),
  ('com_taxa_comparecimento','Taxa de Comparecimento',  'Agendados que efetivamente compareceram',                     '%',   80,   NULL, 60,   79,   true,  'comercial',   'calculado',  11),
  ('com_taxa_fechamento',  'Taxa de Fechamento',        'Leads convertidos em pacientes no período',                   '%',   30,   NULL, 15,   29,   true,  'comercial',   'calculado',  12),
  ('com_cpl',              'CPL (Custo por Lead)',      'Custo médio para atrair um lead — requer investimento cadastrado','R$',NULL, NULL, NULL, NULL, false, 'comercial',   'aguardando', 13),
  ('com_cac',              'CAC',                       'Custo médio para converter um paciente',                      'R$',  NULL, NULL, NULL, NULL, false, 'comercial',   'aguardando', 14),
  ('com_ltv',              'LTV (Valor Vitalício)',     'Receita total média por paciente ao longo do tempo',           'R$',  NULL, NULL, NULL, NULL, true,  'comercial',   'aguardando', 15),
  ('com_roas',             'ROAS',                     'Retorno sobre investimento em anúncios',                       'x',   NULL, NULL, NULL, NULL, true,  'comercial',   'aguardando', 16),
  ('com_contato_30min',    'Contato em 30 min',        'Leads respondidos em até 30 minutos',                         '%',   80,   NULL, 60,   79,   true,  'comercial',   'aguardando', 17),
  ('com_indicacao',        'Indicação Orgânica',       'Novos leads originados por indicação',                        '%',   30,   NULL, 15,   29,   true,  'comercial',   'aguardando', 18),
  -- Pilar Experiência — aguardando dados de NPS/CSAT/churn
  ('exp_nps',              'NPS',                      'Net Promoter Score (–100 a 100)',                              'pts', 50,   NULL, 0,    49,   true,  'experiencia', 'aguardando', 20),
  ('exp_csat',             'CSAT',                     'Satisfação média (escala 1–5)',                                'pts', 4.5,  NULL, 3.5,  4.4,  true,  'experiencia', 'aguardando', 21),
  ('exp_churn',            'Taxa de Churn',            'Pacientes que não retornaram após 90 dias',                   '%',   NULL, 10,   10,   25,   false, 'experiencia', 'aguardando', 22),
  ('exp_adesao',           'Taxa de Adesão',           'Pacientes que concluíram o plano de tratamento',               '%',   70,   NULL, 40,   69,   true,  'experiencia', 'aguardando', 23),
  ('exp_resp_tempo',       'Tempo de Resposta',        'Tempo médio de resposta ao paciente (minutos)',                'min', NULL, 30,   30,   60,   false, 'experiencia', 'aguardando', 24),
  ('exp_reativacao',       'Taxa de Reativação',       'Pacientes inativos reengajados no período',                   '%',   20,   NULL, 5,    19,   true,  'experiencia', 'aguardando', 25)
ON CONFLICT (codigo) DO NOTHING;

-- ── 11. Ativar KPIs calculáveis por padrão ────────────────────────────────────
INSERT INTO public.clinic_kpi_selection (kpi_codigo, ativo)
SELECT codigo, (fonte = 'calculado') FROM public.kpi_catalog
ON CONFLICT (kpi_codigo) DO NOTHING;
