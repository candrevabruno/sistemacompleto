import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { differenceInDays, parseISO } from 'date-fns';
import { Loader2, Settings, X } from 'lucide-react';

interface KpiCatalog {
  codigo: string;
  nome: string;
  descricao: string;
  unidade: string;
  verde_min: number | null;
  verde_max: number | null;
  amarelo_min: number | null;
  amarelo_max: number | null;
  quanto_maior_melhor: boolean;
  pilar: string;
  fonte: string;
  ordem: number;
}

type Semaforo = 'verde' | 'amarelo' | 'vermelho' | 'aguardando';

const SEMAFOR: Record<Semaforo, { cor: string; texto: string }> = {
  verde:      { cor: '#22C55E', texto: '#166534' },
  amarelo:    { cor: '#F59E0B', texto: '#B45309' },
  vermelho:   { cor: '#EF4444', texto: '#991B1B' },
  aguardando: { cor: 'var(--border-md)', texto: 'var(--muted)' },
};

const PILAR_LABEL: Record<string, string> = {
  operacional: 'Operacional',
  comercial:   'Comercial',
  experiencia: 'Experiência',
};

// ── Semáforo ──────────────────────────────────────────────────────────────────

function calcSemaforo(kpi: KpiCatalog, valor: number | null): Semaforo {
  if (kpi.fonte === 'aguardando' || valor === null) return 'aguardando';
  if (kpi.quanto_maior_melhor) {
    if (kpi.verde_min !== null && valor >= kpi.verde_min) return 'verde';
    if (kpi.amarelo_min !== null && valor >= kpi.amarelo_min) return 'amarelo';
    return 'vermelho';
  } else {
    if (kpi.verde_max !== null && valor <= kpi.verde_max) return 'verde';
    if (kpi.amarelo_max !== null && valor <= kpi.amarelo_max) return 'amarelo';
    return 'vermelho';
  }
}

function formatVal(valor: number | null, unidade: string): string {
  if (valor === null) return '—';
  if (unidade === '%')   return `${valor}%`;
  if (unidade === 'R$')  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  if (unidade === 'x')   return `${valor}×`;
  if (unidade === 'dias') return `${valor} d`;
  if (unidade === 'min') return `${valor} min`;
  return String(valor);
}

function metaLabel(kpi: KpiCatalog): string {
  if (kpi.quanto_maior_melhor && kpi.verde_min !== null)
    return `Meta: ≥${kpi.verde_min}${kpi.unidade === '%' ? '%' : ' ' + kpi.unidade}`;
  if (!kpi.quanto_maior_melhor && kpi.verde_max !== null)
    return `Meta: ≤${kpi.verde_max}${kpi.unidade === '%' ? '%' : ' ' + kpi.unidade}`;
  return '';
}

// ── Cálculo dos KPIs ──────────────────────────────────────────────────────────

function calcularKpis(
  ag: any[],
  leads: any[],
  agTodos: any[],
  csat: Array<{ score: number }>,
  nps: Array<{ score: number }>,
  leadsArq: Array<{ id: string }>,
): Record<string, number | null> {
  const total       = ag.length;
  const compareceu  = ag.filter(a => a.status === 'compareceu').length;
  const naoComp     = ag.filter(a => a.status === 'nao_compareceu').length;
  const cancelado   = ag.filter(a => a.status === 'cancelado').length;
  const reagendado  = ag.filter(a => a.status === 'reagendado').length;
  const totalFech   = compareceu + naoComp + cancelado;
  const totalAtivos = total - cancelado;

  // Operacional
  const op_ocupacao        = totalAtivos > 0  ? Math.round(compareceu / totalAtivos * 100) : null;
  const op_no_show         = totalFech > 0    ? Math.round(naoComp    / totalFech * 100)   : null;
  const op_cancelamento    = total > 0        ? Math.round(cancelado  / total * 100)       : null;
  const op_instabilidade   = total > 0        ? Math.round(reagendado / total * 100)       : null;

  // Atend./Prof./Dia — divide por profissionais únicos no período
  const uniqueProfs = new Set(ag.filter(a => a.agenda_id).map(a => a.agenda_id)).size || 1;
  const op_atend_prof_dia = compareceu > 0
    ? Math.round(compareceu / uniqueProfs * 10) / 10
    : null;

  // Lead time: média de dias entre criação do agendamento e data da consulta
  const lts = ag
    .filter(a => a.data_hora_inicio && a.created_at)
    .map(a => Math.max(0, differenceInDays(parseISO(a.data_hora_inicio), parseISO(a.created_at))));
  const op_lead_time = lts.length > 0
    ? Math.round(lts.reduce((s, v) => s + v, 0) / lts.length * 10) / 10
    : null;

  // Reaproveitamento de slots — proxy: leads que reagendaram E depois compareceram
  const leadsReag = new Set(ag.filter(a => a.status === 'reagendado' && a.lead_id).map(a => a.lead_id));
  const leadsComp = new Set(ag.filter(a => a.status === 'compareceu'  && a.lead_id).map(a => a.lead_id));
  const reap = [...leadsReag].filter(l => leadsComp.has(l)).length;
  const op_reaproveitamento = leadsReag.size > 0
    ? Math.round(reap / leadsReag.size * 100)
    : null;

  // Taxa de retorno — acumulado all-time: pacientes com 2+ comparecimentos
  const countComp: Record<string, number> = {};
  agTodos.filter(a => a.status === 'compareceu' && a.lead_id)
         .forEach(a => { countComp[a.lead_id] = (countComp[a.lead_id] || 0) + 1; });
  const comUma  = Object.keys(countComp).length;
  const comDuas = Object.values(countComp).filter(v => v >= 2).length;
  const op_retorno = comUma > 0 ? Math.round(comDuas / comUma * 100) : null;

  // Comercial
  const leadsComAg = new Set(ag.filter(a => a.lead_id).map(a => a.lead_id)).size;
  const com_taxa_agendamento     = leads.length > 0             ? Math.round(leadsComAg / leads.length * 100) : null;
  const com_taxa_comparecimento  = (compareceu + naoComp) > 0   ? Math.round(compareceu / (compareceu + naoComp) * 100) : null;
  const convertidos              = leads.filter(l => l.status === 'converteu').length;
  const com_taxa_fechamento      = leads.length > 0             ? Math.round(convertidos / leads.length * 100) : null;

  // Experiência — CSAT (média 1–5)
  const csatScores = csat.map(r => r.score).filter(s => typeof s === 'number');
  const exp_csat = csatScores.length > 0
    ? Math.round(csatScores.reduce((a, b) => a + b, 0) / csatScores.length * 10) / 10
    : null;

  // Experiência — NPS (% promotores - % detratores, escala –100 a 100)
  const npsScores = nps.map(r => r.score).filter(s => typeof s === 'number');
  const promoters   = npsScores.filter(s => s >= 9).length;
  const detractors  = npsScores.filter(s => s <= 6).length;
  const exp_nps = npsScores.length > 0
    ? Math.round((promoters / npsScores.length - detractors / npsScores.length) * 100)
    : null;

  // Experiência — Reativação (% leads arquivados com agendamento no período)
  const arqIds = new Set(leadsArq.map((l: any) => l.id));
  const reativados = new Set(ag.filter(a => a.lead_id && arqIds.has(a.lead_id)).map(a => a.lead_id)).size;
  const exp_reativacao = arqIds.size > 0 ? Math.round(reativados / arqIds.size * 100) : null;

  return {
    op_ocupacao, op_no_show, op_cancelamento, op_instabilidade,
    op_atend_prof_dia, op_lead_time, op_reaproveitamento, op_retorno,
    com_taxa_agendamento, com_taxa_comparecimento, com_taxa_fechamento,
    exp_csat, exp_nps, exp_reativacao,
  };
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ kpi, valor, semaforo }: { kpi: KpiCatalog; valor: number | null; semaforo: Semaforo }) {
  const { cor, texto } = SEMAFOR[semaforo];
  const aguardando = semaforo === 'aguardando';

  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-sm)',
      padding: '14px 16px',
      borderTop: `3px solid ${cor}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: cor, flexShrink: 0, marginTop: '4px' }} />
        <div>
          <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25 }}>{kpi.nome}</div>
        </div>
      </div>

      {/* Value */}
      <div className="font-display" style={{
        fontSize: '28px', fontWeight: 400, fontStyle: 'italic', letterSpacing: '-0.5px', lineHeight: 1,
        color: aguardando ? 'var(--border-md)' : 'var(--ink)',
      }}>
        {formatVal(valor, kpi.unidade)}
      </div>

      {/* Meta / aguardando */}
      <div style={{
        fontSize: '10.5px', fontWeight: 500,
        color: aguardando ? 'var(--muted)' : texto,
        fontStyle: aguardando ? 'italic' : 'normal',
      }}>
        {aguardando ? 'Aguardando dados' : metaLabel(kpi)}
      </div>
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      style={{
        width: '34px', height: '18px', borderRadius: '9px',
        background: on ? 'var(--sage-dark)' : 'var(--border-md)',
        border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
        transition: 'background 0.15s',
      }}
    >
      <div style={{
        position: 'absolute', top: '2px', left: on ? '18px' : '2px',
        width: '14px', height: '14px', borderRadius: '50%', background: 'white',
        transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

// ── Config Modal ──────────────────────────────────────────────────────────────

function ConfigModal({ catalog, selection, onToggle, onClose }: {
  catalog: KpiCatalog[];
  selection: Record<string, boolean>;
  onToggle: (codigo: string, ativo: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--white)', borderRadius: 'var(--r)', width: '520px', maxHeight: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)' }}>KPIs ativos no dashboard</p>
            <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
              KPIs "Aguardando dados" ficam visíveis mas sem valor até a fonte ser configurada.
            </p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px', lineHeight: 1 }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {['operacional', 'comercial', 'experiencia'].map(pilar => {
            const kpis = catalog.filter(k => k.pilar === pilar);
            return (
              <div key={pilar}>
                <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)', paddingBottom: '6px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
                  {PILAR_LABEL[pilar]}
                </div>
                {kpis.map(kpi => (
                  <div
                    key={kpi.codigo}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 8px', borderRadius: 'var(--r-xs)', gap: '10px',
                      background: selection[kpi.codigo] ? 'var(--sage-xlight)' : 'transparent',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--ink)' }}>{kpi.nome}</span>
                        {kpi.fonte === 'aguardando' && (
                          <span style={{ fontSize: '9px', padding: '1px 5px', background: 'var(--champ-light)', color: 'var(--champ-text)', borderRadius: '3px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            aguardando dados
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--muted)', marginTop: '1px' }}>{kpi.descricao}</div>
                    </div>
                    <Toggle on={!!selection[kpi.codigo]} onChange={v => onToggle(kpi.codigo, v)} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── KpiPainel (exported) ──────────────────────────────────────────────────────

export function KpiPainel({ dateRange }: { dateRange: { start: Date; end: Date } }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [loading, setLoading]     = useState(true);
  const [catalog, setCatalog]     = useState<KpiCatalog[]>([]);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [valores, setValores]     = useState<Record<string, number | null>>({});
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    carregar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.start.getTime(), dateRange.end.getTime()]);

  const carregar = async () => {
    setLoading(true);
    const s = dateRange.start.toISOString();
    const e = dateRange.end.toISOString();

    const [catReq, selReq, agReq, ldReq, agTodosReq, csatReq, npsReq, ldArqReq] = await Promise.all([
      supabase.from('kpi_catalog').select('*').order('ordem'),
      supabase.from('clinic_kpi_selection').select('*'),
      supabase.from('agendamentos').select('id,status,lead_id,agenda_id,data_hora_inicio,created_at').gte('created_at', s).lte('created_at', e),
      supabase.from('leads').select('id,status').gte('inicio_atendimento', s).lte('inicio_atendimento', e),
      supabase.from('agendamentos').select('lead_id,status'),
      supabase.from('csat_respostas').select('score').gte('created_at', s).lte('created_at', e),
      supabase.from('nps_respostas').select('score').gte('created_at', s).lte('created_at', e),
      supabase.from('leads').select('id').eq('arquivado', true),
    ]);

    if (catReq.data) setCatalog(catReq.data);

    const sel: Record<string, boolean> = {};
    (selReq.data || []).forEach(r => { sel[r.kpi_codigo] = r.ativo; });
    setSelection(sel);

    setValores(calcularKpis(
      agReq.data || [], ldReq.data || [], agTodosReq.data || [],
      csatReq.data || [], npsReq.data || [], ldArqReq.data || [],
    ));
    setLoading(false);
  };

  const toggleKpi = async (codigo: string, ativo: boolean) => {
    setSelection(prev => ({ ...prev, [codigo]: ativo }));
    await supabase
      .from('clinic_kpi_selection')
      .upsert({ kpi_codigo: codigo, ativo, updated_at: new Date().toISOString() }, { onConflict: 'kpi_codigo' });
  };

  const ativos = catalog.filter(k => selection[k.codigo]);

  if (loading) {
    return (
      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--muted)' }} />
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div>
          <h3 className="font-display leading-none" style={{ fontSize: '17px', fontWeight: 400, fontStyle: 'italic', color: 'var(--ink)', letterSpacing: '-0.2px' }}>
            Painel de KPIs Clínicos
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
            Métricas com faixa saudável · calculadas por coorte de criação no período selecionado
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowConfig(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', fontSize: '12px', fontWeight: 500,
              color: 'var(--muted)', border: '1px solid var(--border-md)',
              borderRadius: 'var(--r-xs)', background: 'transparent',
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            <Settings size={12} />
            Configurar
          </button>
        )}
      </div>

      {/* Legenda semáforo */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {([['#22C55E', 'Saudável'], ['#F59E0B', 'Atenção'], ['#EF4444', 'Crítico'], ['var(--border-md)', 'Aguardando']] as const).map(([cor, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: cor, flexShrink: 0 }} />
            <span style={{ fontSize: '10.5px', color: 'var(--muted)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Cards agrupados por categoria */}
      {ativos.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Nenhum KPI ativo.{isAdmin ? ' Clique em "Configurar" para selecionar métricas.' : ''}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {(['operacional', 'comercial', 'experiencia'] as const).map(pilar => {
            const doPilar = ativos.filter(k => k.pilar === pilar);
            if (doPilar.length === 0) return null;
            return (
              <div key={pilar}>
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--sage-dark)', paddingBottom: '8px', marginBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                  {PILAR_LABEL[pilar]}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(176px, 1fr))', gap: '10px' }}>
                  {doPilar.map(kpi => {
                    const val = valores[kpi.codigo] ?? null;
                    return <KpiCard key={kpi.codigo} kpi={kpi} valor={val} semaforo={calcSemaforo(kpi, val)} />;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de configuração */}
      {showConfig && (
        <ConfigModal catalog={catalog} selection={selection} onToggle={toggleKpi} onClose={() => setShowConfig(false)} />
      )}
    </div>
  );
}
