import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import {
  Loader2, Lock, Star, ChevronDown, ChevronRight,
  ClipboardList, Sparkles, Crown, CalendarCheck, FileText,
  MessageSquare, RotateCcw, MessageCircle, TrendingUp, Plus,
  MoreHorizontal, Archive, Trash2,
} from 'lucide-react';
import { ResumoConsultaSection } from './ResumoConsultaSection';
import { useClinic } from '../../contexts/ClinicContext';

interface Props {
  pacienteId: string;
  leadId?: string;
  nomePaciente?: string;
}

type SubTab = 'pre' | 'pos' | 'jornada';

interface TallyResposta {
  id: string;
  conteudo: object;
  resumo_ia: string | null;
  created_at: string;
}

const UPGRADE_MSG = encodeURIComponent('Olá! Gostaria de solicitar acesso à Experiência Premium no sistema da clínica.');

// ─── LockedState ──────────────────────────────────────────────────────────────

function LockedState() {
  const { config } = useClinic();
  const whatsapp = config?.heroic_leap_whatsapp || '5511999999999';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '52px 32px', gap: '16px', textAlign: 'center' }}>
      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--champ-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Star size={24} style={{ color: 'var(--champ-text)' }} />
      </div>
      <div>
        <p className="font-display" style={{ fontSize: '20px', fontStyle: 'italic', fontWeight: 300, color: 'var(--ink)', marginBottom: '6px' }}>
          Experiência Premium
        </p>
        <p style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '280px' }}>
          Pré-consulta via Tally, resumo gerado por IA e envio automatizado para o paciente.
          Recurso disponível no plano Premium da Heroic Leap.
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: 'var(--r-xs)', background: 'var(--border)', borderLeft: '3px solid var(--champ-text)' }}>
        <Lock size={12} style={{ color: 'var(--champ-text)', flexShrink: 0 }} />
        <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
          Liberado pela Heroic Leap · Controlado pelo admin da clínica
        </span>
      </div>
      <a
        href={`https://wa.me/${whatsapp}?text=${UPGRADE_MSG}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          background: 'var(--sage-dark)', color: 'white',
          padding: '9px 18px', borderRadius: 'var(--r-xs)',
          fontSize: '13px', fontWeight: 600, textDecoration: 'none', fontFamily: 'inherit',
        }}
      >
        <Sparkles size={14} />
        Solicitar acesso Premium
      </a>
    </div>
  );
}

// ─── RespostaCard ─────────────────────────────────────────────────────────────

function RespostaCard({ resposta }: { resposta: TallyResposta }) {
  const [expandido, setExpandido] = useState(false);
  const campos = Object.entries(resposta.conteudo || {});

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', overflow: 'hidden' }}>
      <button
        onClick={() => setExpandido(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
      >
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--ink)' }}>
          Formulário de pré-consulta
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
            {format(new Date(resposta.created_at), "dd/MM/yyyy '·' HH:mm", { locale: ptBR })}
          </span>
          {expandido
            ? <ChevronDown size={14} style={{ color: 'var(--muted)' }} />
            : <ChevronRight size={14} style={{ color: 'var(--muted)' }} />}
        </div>
      </button>

      {expandido && campos.length > 0 && (
        <div style={{ padding: '0 14px 12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {campos.map(([key, val]) => (
              <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '8px', fontSize: '12px' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{key}</span>
                <span style={{ color: 'var(--ink)' }}>{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {resposta.resumo_ia && (
        <div style={{ margin: '0 14px 12px', padding: '9px 12px', background: 'var(--sage-xlight)', borderRadius: 'var(--r-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--sage-dark)', marginBottom: '5px' }}>
            <Sparkles size={11} />
            Resumo gerado pela IA
          </div>
          <p style={{ fontSize: '12px', color: 'var(--ink)', lineHeight: 1.6 }}>{resposta.resumo_ia}</p>
        </div>
      )}
    </div>
  );
}

// ─── Jornada Premium — tipos ──────────────────────────────────────────────────

type EtapaType = 'pre_consulta' | 'consulta' | 'resumo_pos' | 'csat' | 'checkin' | 'evolucao' | 'nps' | 'reativacao';
type EstStatus = 'pendente' | 'concluido' | 'pulado';
type CicloStatus = 'ativo' | 'concluido' | 'perdido';

interface Ciclo {
  id: string;
  numero_ciclo: number | null;
  status: CicloStatus;
  retorno_esperado_em: string | null;
  iniciado_em: string | null;
  fechado_em: string | null;
  created_at: string;
  lead_id: string | null;
}

interface EvJornada {
  id: string;
  etapa: EtapaType;
  status: EstStatus;
  concluido_em: string | null;
  dados: Record<string, any> | null;
}

// ─── Config das etapas ────────────────────────────────────────────────────────

const ETAPAS_ORDEM: EtapaType[] = [
  'pre_consulta', 'consulta', 'resumo_pos', 'csat', 'checkin', 'evolucao', 'nps', 'reativacao',
];

const ETAPA_CFG: Record<EtapaType, { label: string; periodo?: string; icon: React.ReactNode; cor: string; badge: string }> = {
  pre_consulta: { label: 'Pré-consulta',        icon: <ClipboardList size={14} />, cor: '#7C3AED', badge: '#F5F3FF' },
  consulta:     { label: 'Consulta',             icon: <CalendarCheck  size={14} />, cor: '#059669', badge: '#F0FDF4' },
  resumo_pos:   { label: 'Resumo Pós-consulta',  icon: <FileText       size={14} />, cor: '#6366F1', badge: '#EEF2FF' },
  csat:         { label: 'CSAT',     periodo: 'D+2',  icon: <Star           size={14} />, cor: '#D97706', badge: '#FFFBEB' },
  checkin:      { label: 'Check-in', periodo: 'D+15', icon: <MessageCircle  size={14} />, cor: '#0891B2', badge: '#F0FDFF' },
  evolucao:     { label: 'Evolução', periodo: 'D+30', icon: <TrendingUp     size={14} />, cor: '#059669', badge: '#F0FDF4' },
  nps:          { label: 'NPS',      periodo: 'D+45', icon: <MessageSquare  size={14} />, cor: '#7C3AED', badge: '#F3E8FF' },
  reativacao:   { label: 'Reativação',            icon: <RotateCcw      size={14} />, cor: '#0369A1', badge: '#E0F2FE' },
};

const CICLO_STATUS_COR: Record<CicloStatus, string> = {
  ativo:     '#22C55E',
  concluido: '#6366F1',
  perdido:   '#EF4444',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cicloLabel(c: Ciclo, idx: number): string {
  const num = c.numero_ciclo ?? idx + 1;
  const ref = c.iniciado_em || c.created_at;
  const mes = format(parseISO(ref), 'MMM/yyyy', { locale: ptBR });
  return `Ciclo ${num} · ${mes.charAt(0).toUpperCase() + mes.slice(1)}`;
}

// Deriva eventos a partir das tabelas-fonte (fallback pré-n8n).
// Usa janela de tempo: 30d antes do ciclo até 120d depois (ou fechado_em).
function derivarFallback(
  ciclo: Ciclo,
  agendamentos: any[],
  tallys: any[],
  csats: any[],
  npss: any[],
): Partial<Record<EtapaType, EvJornada>> {
  const inicio = new Date(ciclo.iniciado_em || ciclo.created_at);
  const from   = new Date(inicio.getTime() - 30 * 86400000);
  const to     = ciclo.fechado_em
    ? new Date(ciclo.fechado_em)
    : new Date(inicio.getTime() + 120 * 86400000);

  const inRange = (d: string) => { const dt = new Date(d); return dt >= from && dt <= to; };
  const r: Partial<Record<EtapaType, EvJornada>> = {};

  const ag = agendamentos.find(a => a.status === 'compareceu' && inRange(a.data_hora_inicio));
  if (ag) r.consulta = { id: ag.id, etapa: 'consulta', status: 'concluido', concluido_em: ag.data_hora_inicio, dados: { procedimento: ag.procedimento_nome } };

  const tally = tallys.find(t => inRange(t.created_at));
  if (tally) r.pre_consulta = { id: tally.id, etapa: 'pre_consulta', status: 'concluido', concluido_em: tally.created_at, dados: { preenchido: true, resumo_ia: tally.resumo_ia } };

  const csat = csats.find(c => inRange(c.created_at));
  if (csat) r.csat = { id: csat.id, etapa: 'csat', status: 'concluido', concluido_em: csat.created_at, dados: { nota: csat.score } };

  const nps = npss.find(n => inRange(n.created_at));
  if (nps) r.nps = { id: nps.id, etapa: 'nps', status: 'concluido', concluido_em: nps.created_at, dados: { nota: nps.score, comentario: nps.comentario } };

  return r;
}

function buildDados(etapa: EtapaType, dados: Record<string, any>, ciclo: Ciclo | null): React.ReactNode {
  const d = dados;
  switch (etapa) {
    case 'pre_consulta':
      return <>{d.preenchido ? '✓ Formulário preenchido' : 'Enviado, aguardando resposta'}{d.resumo_ia ? ` · ${String(d.resumo_ia).slice(0, 60)}…` : ''}</>;
    case 'consulta':
      return <>{d.procedimento || 'Consulta realizada'}{d.profissional ? ` · ${d.profissional}` : ''}</>;
    case 'resumo_pos':
      return <>{d.recebeu === false ? 'Envio não confirmado' : '✓ Enviado ao paciente'}{d.trecho ? ` · "${String(d.trecho).slice(0, 40)}…"` : ''}</>;
    case 'csat': {
      const emoji = d.nota >= 4 ? '😊' : d.nota >= 3 ? '😐' : '😞';
      const label = d.nota >= 4 ? 'Satisfeito' : d.nota >= 3 ? 'Neutro' : 'Insatisfeito';
      return <>Nota {d.nota}/5 · {emoji} {label}</>;
    }
    case 'checkin':
      return <>{d.respondeu ? '✓ Respondeu' : 'Registrado'}{d.relato ? ` · ${String(d.relato).slice(0, 50)}…` : ''}</>;
    case 'evolucao':
      return <>{d.satisfacao ? `Satisfação ${d.satisfacao}/5` : '✓ Registrado'}{d.relato ? ` · ${String(d.relato).slice(0, 50)}…` : ''}</>;
    case 'nps': {
      const tipo = d.nota >= 9 ? '⭐ Promotor' : d.nota >= 7 ? '😐 Neutro' : '👎 Detrator';
      return <>Nota {d.nota}/10 · {tipo}{d.comentario ? ` · ${String(d.comentario).slice(0, 40)}…` : ''}</>;
    }
    case 'reativacao': {
      const ret = ciclo?.retorno_esperado_em;
      const retLabel = ret ? `Retorno previsto: ${format(parseISO(ret), 'dd/MM/yyyy', { locale: ptBR })}` : 'D+60 / D+180';
      return <>{d.reagendou ? '✓ Reagendou' : `${d.ondas ?? 0} ondas disparadas`} · {retLabel}</>;
    }
    default: return null;
  }
}

// ─── StageCard ────────────────────────────────────────────────────────────────

function StageCard({ etapa, ev, ciclo, isLast }: {
  etapa: EtapaType;
  ev: EvJornada | null;
  ciclo: Ciclo | null;
  isLast: boolean;
}) {
  const cfg = ETAPA_CFG[etapa];
  const status   = ev?.status ?? 'pendente';
  const isDone   = status === 'concluido';
  const isSkip   = status === 'pulado';
  const isPend   = status === 'pendente';

  const circleCor  = isDone ? cfg.cor : isSkip ? '#EF4444' : '#CBD5E1';
  const circleBg   = isDone ? cfg.badge : isSkip ? '#FEF2F2' : '#F8FAFC';
  const cardBorder = isDone
    ? `1px solid ${cfg.cor}55`
    : isSkip
    ? '1px dashed #FCA5A5'
    : '1px dashed #E2E8F0';
  const cardBg     = isDone ? 'white' : isSkip ? '#FFFAFA' : '#FAFAFA';
  const lineCor    = isDone ? `${cfg.cor}33` : '#E2E8F0';

  // Reativação pending: mostrar retorno_esperado_em do ciclo
  let pendNote: string | null = null;
  if (isPend && etapa === 'reativacao') {
    const ret = ciclo?.retorno_esperado_em;
    pendNote = ret
      ? `Retorno previsto: ${format(parseISO(ret), 'dd/MM/yyyy', { locale: ptBR })}`
      : 'Reativação D+60 / D+180';
  }

  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      {/* Circle + vertical connector */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: circleBg, border: `1.5px solid ${circleCor}`, color: circleCor, zIndex: 1,
        }}>
          {cfg.icon}
        </div>
        {!isLast && (
          <div style={{ width: '1px', flex: 1, minHeight: '18px', background: lineCor, marginTop: '3px' }} />
        )}
      </div>

      {/* Card */}
      <div style={{
        flex: 1,
        marginBottom: isLast ? '0' : '6px',
        borderRadius: '10px',
        padding: '10px 14px',
        background: cardBg,
        border: cardBorder,
        borderLeft: isDone ? `3px solid ${cfg.cor}` : undefined,
        opacity: isPend ? 0.6 : 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: isDone ? 600 : 400, color: isDone ? cfg.cor : isSkip ? '#EF4444' : '#94A3B8' }}>
                {cfg.label}
              </span>
              {cfg.periodo && (
                <span style={{
                  fontSize: '9.5px', padding: '1px 5px', borderRadius: '999px', fontWeight: 500,
                  background: isDone ? cfg.badge : '#F1F5F9',
                  color: isDone ? cfg.cor : '#94A3B8',
                }}>
                  {cfg.periodo}
                </span>
              )}
            </div>

            {isDone && ev?.dados && (
              <p style={{ fontSize: '11px', color: '#64748B', marginTop: '3px', lineHeight: 1.4 }}>
                {buildDados(etapa, ev.dados, ciclo)}
              </p>
            )}
            {isSkip && (
              <p style={{ fontSize: '11px', color: '#EF4444', marginTop: '3px' }}>Não respondeu</p>
            )}
            {isPend && pendNote && (
              <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px' }}>{pendNote}</p>
            )}
          </div>

          {ev?.concluido_em && (
            <span style={{ fontSize: '10px', color: '#94A3B8', flexShrink: 0, marginTop: '2px' }}>
              {format(parseISO(ev.concluido_em), 'dd/MM/yy', { locale: ptBR })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── JornadaPremiumTab ────────────────────────────────────────────────────────

function JornadaPremiumTab({ pacienteId, leadId }: { pacienteId: string; leadId?: string }) {
  const [ciclos, setCiclos]             = useState<Ciclo[]>([]);
  const [cicloId, setCicloId]           = useState<string | null>(null);
  const [eventos, setEventos]           = useState<EvJornada[]>([]);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [tallys, setTallys]             = useState<any[]>([]);
  const [csats, setCsats]               = useState<any[]>([]);
  const [npss, setNpss]                 = useState<any[]>([]);
  const [agsSemCiclo, setAgsSemCiclo]   = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [criando, setCriando]           = useState(false);
  const [menuAberto, setMenuAberto]     = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState(false);
  const [salvandoAcao, setSalvandoAcao] = useState(false);
  const [histExpand, setHistExpand]     = useState(false);

  useEffect(() => { carregarTudo(); }, [pacienteId, leadId]);
  useEffect(() => { if (cicloId) carregarEventos(cicloId); else setEventos([]); }, [cicloId]);

  const carregarTudo = async () => {
    setLoading(true);

    const agQuery = leadId
      ? supabase.from('agendamentos').select('id,data_hora_inicio,status,procedimento_nome').eq('lead_id', leadId).order('data_hora_inicio')
      : Promise.resolve({ data: [] as any[], error: null });

    const csatQuery = leadId
      ? supabase.from('csat_respostas').select('id,score,created_at').eq('lead_id', leadId).order('created_at')
      : supabase.from('csat_respostas').select('id,score,created_at').eq('paciente_id', pacienteId).order('created_at');

    const npsQuery = leadId
      ? supabase.from('nps_respostas').select('id,score,created_at,comentario').eq('lead_id', leadId).order('created_at')
      : supabase.from('nps_respostas').select('id,score,created_at,comentario').eq('paciente_id', pacienteId).order('created_at');

    const [ciclosRes, agRes, tallyRes, csatRes, npsRes] = await Promise.all([
      supabase.from('ciclos_jornada_paciente').select('*').eq('paciente_id', pacienteId).order('created_at'),
      agQuery,
      supabase.from('tally_respostas').select('id,created_at,resumo_ia').eq('paciente_id', pacienteId).order('created_at'),
      csatQuery,
      npsQuery,
    ]);

    const ags        = (agRes.data    || []) as any[];
    const tallyData  = (tallyRes.data || []) as any[];
    const csatData   = (csatRes.data  || []) as any[];
    const npsData    = (npsRes.data   || []) as any[];
    const ciclosData = (ciclosRes.data || []) as Ciclo[];

    setAgendamentos(ags);
    setTallys(tallyData);
    setCsats(csatData);
    setNpss(npsData);
    setCiclos(ciclosData);

    // Agendamentos 'compareceu' sem ciclo correspondente (para propor criação)
    const semCiclo = ags.filter((ag: any) => ag.status === 'compareceu' && !ciclosData.some(c => {
      const ci  = new Date(c.iniciado_em || c.created_at).getTime();
      const agt = new Date(ag.data_hora_inicio).getTime();
      return Math.abs(ci - agt) < 10 * 86400000;
    }));
    setAgsSemCiclo(semCiclo);

    if (ciclosData.length > 0) {
      const ativo = [...ciclosData].reverse().find(c => c.status === 'ativo') ?? ciclosData[ciclosData.length - 1];
      setCicloId(ativo.id);
    } else {
      setCicloId(null);
    }

    setLoading(false);
  };

  const carregarEventos = async (cid: string) => {
    const { data } = await supabase
      .from('eventos_jornada')
      .select('id,etapa,status,concluido_em,dados')
      .eq('ciclo_id', cid);
    setEventos((data || []) as EvJornada[]);
  };

  const criarCiclo = async (ag?: any) => {
    setCriando(true);
    const { data: novo } = await supabase
      .from('ciclos_jornada_paciente')
      .insert({
        paciente_id:  pacienteId,
        lead_id:      leadId || null,
        numero_ciclo: ciclos.length + 1,
        status:       'ativo',
        iniciado_em:  ag?.data_hora_inicio ?? new Date().toISOString(),
      })
      .select()
      .single();

    if (novo) {
      if (ag) {
        await supabase.from('eventos_jornada').insert({
          ciclo_id: novo.id, etapa: 'consulta', status: 'concluido',
          concluido_em: ag.data_hora_inicio,
          dados: { procedimento: ag.procedimento_nome },
        });
      }
      // Notifica o agente (não crítico)
      supabase.from('agente_eventos').insert({
        tipo: 'ciclo_iniciado', lead_id: leadId || null,
        payload: { ciclo_id: novo.id, paciente_id: pacienteId },
      });
    }

    setCriando(false);
    carregarTudo();
  };

  const guardarHistorico = async (id: string) => {
    setSalvandoAcao(true);
    await supabase.from('ciclos_jornada_paciente').update({ status: 'concluido', fechado_em: new Date().toISOString() }).eq('id', id);
    setMenuAberto(false);
    setSalvandoAcao(false);
    carregarTudo();
  };

  const excluirCiclo = async (id: string) => {
    setSalvandoAcao(true);
    await supabase.from('ciclos_jornada_paciente').delete().eq('id', id);
    setMenuAberto(false);
    setConfirmExcluir(false);
    setSalvandoAcao(false);
    carregarTudo();
  };

  const ciclosAtivos    = ciclos.filter(c => c.status === 'ativo');
  const ciclosHistorico = ciclos.filter(c => c.status !== 'ativo');

  // Merge: eventos_jornada > fallback tabelas-fonte
  const cicloAtual = ciclos.find(c => c.id === cicloId) ?? null;
  const fallback   = cicloAtual ? derivarFallback(cicloAtual, agendamentos, tallys, csats, npss) : {};
  const evMap: Partial<Record<EtapaType, EvJornada>> = {};
  eventos.forEach(e => { evMap[e.etapa] = e; });
  const mergedEv = (etapa: EtapaType): EvJornada | null => evMap[etapa] ?? fallback[etapa] ?? null;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
      <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--muted)' }} />
    </div>
  );

  // Estado vazio: sem ciclos e sem consultas realizadas para vincular
  if (ciclos.length === 0 && agsSemCiclo.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '52px 24px', gap: '14px', textAlign: 'center' }}>
      <Crown size={32} style={{ color: 'var(--champ-text)', opacity: 0.4 }} />
      <div>
        <p className="font-display" style={{ fontSize: '16px', fontStyle: 'italic', fontWeight: 300, color: 'var(--muted)', marginBottom: '6px' }}>
          Nenhum ciclo iniciado
        </p>
        <p style={{ fontSize: '11.5px', color: 'var(--muted)', opacity: 0.7, maxWidth: '260px', lineHeight: 1.6 }}>
          A jornada começa quando uma consulta é realizada. Você pode iniciar um ciclo manualmente abaixo.
        </p>
      </div>
      <button
        onClick={() => criarCiclo()}
        disabled={criando}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 18px', background: 'var(--sage-dark)', color: 'white',
          border: 'none', borderRadius: 'var(--r-xs)',
          fontSize: '12.5px', fontWeight: 600, cursor: criando ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', opacity: criando ? 0.7 : 1,
        }}
      >
        {criando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
        Iniciar primeiro ciclo
      </button>
    </div>
  );

  return (
    <div>
      {/* ── Seletor de ciclos ── */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center',
      }}>
        {/* Ciclos ativos */}
        {ciclosAtivos.map((c, idx) => {
          const isSelected = c.id === cicloId;
          return (
            <button
              key={c.id}
              onClick={() => setCicloId(c.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 12px', borderRadius: '999px',
                background: isSelected ? 'var(--sage-xlight)' : 'var(--surface)',
                border: isSelected ? '1.5px solid var(--sage-dark)' : '1px solid var(--border)',
                color: isSelected ? 'var(--sage-dark)' : 'var(--muted)',
                fontSize: '11.5px', fontWeight: isSelected ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: CICLO_STATUS_COR[c.status], flexShrink: 0 }} />
              {cicloLabel(c, ciclos.indexOf(c))}
            </button>
          );
        })}

        {/* Propor criação de ciclo a partir de consultas realizadas sem ciclo */}
        {agsSemCiclo.length > 0 && (
          <button
            onClick={() => criarCiclo(agsSemCiclo[0])}
            disabled={criando}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '5px 12px', borderRadius: '999px',
              background: 'var(--surface)', border: '1px dashed var(--sage-dark)',
              color: 'var(--sage-dark)', fontSize: '11.5px', fontWeight: 500,
              cursor: criando ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {criando ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            Novo ciclo
            {agsSemCiclo[0]?.data_hora_inicio
              ? ` · ${format(parseISO(agsSemCiclo[0].data_hora_inicio), 'dd/MM', { locale: ptBR })}`
              : ''}
          </button>
        )}

        {/* Histórico de ciclos concluídos/perdidos */}
        {ciclosHistorico.length > 0 && (
          <>
            <span style={{ width: '1px', height: '16px', background: 'var(--border)', flexShrink: 0 }} />
            <button
              onClick={() => setHistExpand(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 10px', borderRadius: '999px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                color: 'var(--muted)', fontSize: '11px', fontWeight: 400,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <Archive size={11} />
              Histórico ({ciclosHistorico.length})
              {histExpand ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
            {histExpand && ciclosHistorico.map((c) => {
              const isSelected = c.id === cicloId;
              return (
                <button
                  key={c.id}
                  onClick={() => setCicloId(c.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '5px 12px', borderRadius: '999px',
                    background: isSelected ? '#F1F5F9' : 'var(--surface)',
                    border: isSelected ? '1.5px solid #94A3B8' : '1px solid var(--border)',
                    color: isSelected ? '#475569' : 'var(--muted)',
                    fontSize: '11.5px', fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: CICLO_STATUS_COR[c.status], flexShrink: 0 }} />
                  {cicloLabel(c, ciclos.indexOf(c))}
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* ── Timeline 8 etapas ── */}
      {cicloAtual && (
        <div style={{ padding: '20px 20px 24px' }}>
          {/* Badge de status do ciclo + menu de ações */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase',
                padding: '3px 8px', borderRadius: '999px',
                background: cicloAtual.status === 'ativo' ? '#F0FDF4' : cicloAtual.status === 'concluido' ? '#EEF2FF' : '#FEF2F2',
                color: CICLO_STATUS_COR[cicloAtual.status],
              }}>
                {cicloAtual.status === 'ativo' ? 'Em andamento' : cicloAtual.status === 'concluido' ? 'Concluído' : 'Perdido'}
              </span>
              {cicloAtual.iniciado_em && (
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  Iniciado em {format(parseISO(cicloAtual.iniciado_em), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              )}
            </div>

            {/* Menu de ações do ciclo */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setMenuAberto(v => !v); setConfirmExcluir(false); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '28px', height: '28px', borderRadius: '6px',
                  background: menuAberto ? 'var(--border)' : 'transparent',
                  border: '1px solid transparent', cursor: 'pointer',
                  color: 'var(--muted)',
                  transition: 'all 0.15s',
                }}
              >
                <MoreHorizontal size={14} />
              </button>

              {menuAberto && (
                <div style={{
                  position: 'absolute', top: '32px', right: 0, zIndex: 50,
                  background: 'white', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '4px', minWidth: '176px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                }}>
                  {!confirmExcluir ? (
                    <>
                      {cicloAtual.status === 'ativo' && (
                        <button
                          onClick={() => guardarHistorico(cicloAtual.id)}
                          disabled={salvandoAcao}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            width: '100%', padding: '7px 10px', border: 'none',
                            background: 'none', borderRadius: '6px', cursor: 'pointer',
                            fontSize: '12px', color: 'var(--ink)', fontFamily: 'inherit',
                            textAlign: 'left',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          {salvandoAcao ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} style={{ color: '#6366F1' }} />}
                          Guardar no histórico
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmExcluir(true)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          width: '100%', padding: '7px 10px', border: 'none',
                          background: 'none', borderRadius: '6px', cursor: 'pointer',
                          fontSize: '12px', color: '#EF4444', fontFamily: 'inherit',
                          textAlign: 'left',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        <Trash2 size={13} />
                        Excluir ciclo
                      </button>
                    </>
                  ) : (
                    <div style={{ padding: '8px 10px' }}>
                      <p style={{ fontSize: '11.5px', color: 'var(--ink)', marginBottom: '2px', fontWeight: 500 }}>Excluir este ciclo?</p>
                      <p style={{ fontSize: '10.5px', color: 'var(--muted)', marginBottom: '10px', lineHeight: 1.4 }}>
                        Todos os eventos da jornada deste ciclo serão removidos.
                      </p>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => excluirCiclo(cicloAtual.id)}
                          disabled={salvandoAcao}
                          style={{
                            flex: 1, padding: '5px 0', border: 'none', borderRadius: '5px',
                            background: '#EF4444', color: 'white', fontSize: '11.5px',
                            fontWeight: 600, cursor: salvandoAcao ? 'not-allowed' : 'pointer',
                            fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                          }}
                        >
                          {salvandoAcao ? <Loader2 size={11} className="animate-spin" /> : null}
                          Excluir
                        </button>
                        <button
                          onClick={() => setConfirmExcluir(false)}
                          style={{
                            flex: 1, padding: '5px 0', border: '1px solid var(--border)',
                            borderRadius: '5px', background: 'white', color: 'var(--ink)',
                            fontSize: '11.5px', fontWeight: 500, cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Etapas */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {ETAPAS_ORDEM.map((etapa, idx) => (
              <StageCard
                key={etapa}
                etapa={etapa}
                ev={mergedEv(etapa)}
                ciclo={cicloAtual}
                isLast={idx === ETAPAS_ORDEM.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ExperienciaPremiumTab ────────────────────────────────────────────────────

export function ExperienciaPremiumTab({ pacienteId, leadId, nomePaciente }: Props) {
  const [premiumEnabled, setPremiumEnabled] = useState<boolean | null>(null);
  const [subTab, setSubTab]                 = useState<SubTab>('pre');
  const [respostas, setRespostas]           = useState<TallyResposta[]>([]);
  const [loading, setLoading]               = useState(true);

  useEffect(() => {
    if (!pacienteId) return;
    carregarDados();
  }, [pacienteId]);

  const carregarDados = async () => {
    setLoading(true);
    const [{ data: config }, { data: resp }] = await Promise.all([
      supabase.from('clinic_config').select('premium_enabled').single(),
      supabase
        .from('tally_respostas')
        .select('id, conteudo, resumo_ia, created_at')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false }),
    ]);
    setPremiumEnabled(config?.premium_enabled ?? false);
    if (resp) setRespostas(resp);
    setLoading(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
      <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--muted)' }} />
    </div>
  );

  if (!premiumEnabled) return <LockedState />;

  return (
    <div style={{ padding: '20px 22px' }}>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
        {([
          { id: 'pre'     as SubTab, label: 'Pré-consulta' },
          { id: 'pos'     as SubTab, label: 'Pós-consulta' },
          { id: 'jornada' as SubTab, label: 'Jornada Premium' },
        ]).map(st => (
          <button
            key={st.id}
            onClick={() => setSubTab(st.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight:  subTab === st.id ? 600 : 400,
              color:       subTab === st.id ? 'var(--sage-dark)' : 'var(--muted)',
              background:  'none',
              border:      'none',
              borderBottom: `2px solid ${subTab === st.id ? 'var(--sage-dark)' : 'transparent'}`,
              marginBottom: '-1px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {st.label}
          </button>
        ))}
      </div>

      {subTab === 'pre' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
            <ClipboardList size={13} style={{ color: 'var(--sage-dark)' }} /> Formulários recebidos via Tally
          </div>
          {respostas.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px', gap: '10px', textAlign: 'center' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--champ-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClipboardList size={18} style={{ color: 'var(--champ-text)' }} />
              </div>
              <p className="font-display" style={{ fontSize: '16px', fontStyle: 'italic', fontWeight: 300, color: 'var(--muted)' }}>
                Nenhum formulário recebido ainda
              </p>
              <p style={{ fontSize: '11.5px', color: 'var(--muted)', opacity: 0.8 }}>
                Os formulários preenchidos pelo paciente via Tally aparecerão aqui
              </p>
            </div>
          ) : (
            respostas.map(r => <RespostaCard key={r.id} resposta={r} />)
          )}
        </div>
      )}

      {subTab === 'pos' && (
        <ResumoConsultaSection
          pacienteId={pacienteId}
          leadId={leadId}
          nomePaciente={nomePaciente}
        />
      )}

      {subTab === 'jornada' && (
        <div style={{ margin: '-20px -22px' }}>
          <JornadaPremiumTab pacienteId={pacienteId} leadId={leadId} />
        </div>
      )}
    </div>
  );
}
