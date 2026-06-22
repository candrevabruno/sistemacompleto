import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import {
  Loader2, Lock, Star, ChevronDown, ChevronRight,
  ClipboardList, Sparkles, Crown, CalendarCheck, FileText,
  MessageSquare, RotateCcw, MessageCircle, TrendingUp, Plus,
  MoreHorizontal, Archive, Trash2, Send, X, History,
} from 'lucide-react';
import { ResumoConsultaSection } from './ResumoConsultaSection';
import { useClinic } from '../../contexts/ClinicContext';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  pacienteId: string;
  leadId?: string;
  nomePaciente?: string;
}

type SubTab = 'pre' | 'pos' | 'jornada';

interface AnamneseSubmission {
  id: string;
  dados: Record<string, any> | null;
  resumo_ia: string | null;
  criado_em: string;
  created_at: string;
  visualizado: boolean;
  arquivado: boolean;
  origem: 'tally';
}

interface QueixaItem {
  id: string;
  conteudo: string;
  created_at: string;
  origem: 'whatsapp';
}

type AnamneseItem = AnamneseSubmission | QueixaItem;

const UPGRADE_MSG = encodeURIComponent('Olá! Gostaria de solicitar acesso à Experiência Premium no sistema da clínica.');

// ─── AnamneseCard ─────────────────────────────────────────────────────────────

function AnamneseCard({ item, onArquivar, onIniciarApagar, confirmApagar, onConfirmarApagar, onCancelarApagar, apagando }: {
  item: AnamneseItem;
  onArquivar?: (id: string) => void;
  onIniciarApagar: (id: string) => void;
  confirmApagar: string | null;
  onConfirmarApagar: (id: string) => void;
  onCancelarApagar: () => void;
  apagando: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isTally = item.origem === 'tally';
  const sub = item as AnamneseSubmission;
  const queixa = item as QueixaItem;
  const dataRef = isTally ? (sub.criado_em || sub.created_at) : queixa.created_at;

  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', overflow: 'hidden',
      opacity: (isTally && sub.arquivado) ? 0.6 : 1,
    }}>
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--ink)' }}>
              {isTally ? 'Formulário Tally' : 'Resposta WhatsApp'}
            </span>
            <span style={{ fontSize: '9.5px', padding: '1px 6px', borderRadius: '20px', fontWeight: 500, background: isTally ? '#F5F3FF' : '#F0FDFF', color: isTally ? '#7C3AED' : '#0891B2' }}>
              {isTally ? 'Tally' : 'WhatsApp'}
            </span>
            {isTally && !sub.visualizado && (
              <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '20px', background: '#FEF3C7', color: '#B45309', fontWeight: 600 }}>Novo</span>
            )}
            {isTally && sub.arquivado && (
              <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '20px', background: '#F1F5F9', color: '#64748B', fontWeight: 500 }}>Arquivado</span>
            )}
          </div>
          <span style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
            {format(parseISO(dataRef), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>
        {/* Ações */}
        <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
          {isTally && !sub.arquivado && onArquivar && (
            <button
              onClick={() => onArquivar(item.id)}
              title="Arquivar"
              style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: '5px', background: '#F1F5F9', color: '#64748B', cursor: 'pointer' }}
            >
              <Archive size={12} />
            </button>
          )}
          {confirmApagar !== item.id ? (
            <button
              onClick={() => onIniciarApagar(item.id)}
              title="Apagar"
              style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: '5px', background: '#FEF2F2', color: '#EF4444', cursor: 'pointer' }}
            >
              <Trash2 size={12} />
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#FEF2F2', borderRadius: '6px', padding: '3px 8px' }}>
              <span style={{ fontSize: '10.5px', color: '#EF4444', fontWeight: 500 }}>Apagar? Não pode ser desfeito.</span>
              <button onClick={() => onConfirmarApagar(item.id)} disabled={apagando}
                style={{ fontSize: '10.5px', fontWeight: 700, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                {apagando ? '...' : 'Confirmar'}
              </button>
              <button onClick={onCancelarApagar}
                style={{ fontSize: '10.5px', color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      {isTally ? (
        <>
          {sub.resumo_ia && (
            <div style={{ margin: '0 14px 10px', padding: '9px 12px', background: 'var(--sage-xlight)', borderRadius: 'var(--r-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--sage-dark)', marginBottom: '5px' }}>
                <Sparkles size={11} /> Resumo gerado pela IA
              </div>
              <p style={{ fontSize: '12px', color: 'var(--ink)', lineHeight: 1.6 }}>{sub.resumo_ia}</p>
            </div>
          )}
          {sub.dados && Object.keys(sub.dados).length > 0 && (
            <>
              <button onClick={() => setExpanded(v => !v)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px 10px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '11px', color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Respostas brutas
              </button>
              {expanded && (
                <div style={{ margin: '0 14px 12px', border: '1px solid var(--border)', borderRadius: '7px', overflow: 'hidden' }}>
                  {Object.entries(sub.dados).map(([k, v]) => (
                    <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '8px', padding: '6px 10px', borderBottom: '1px solid var(--border)', fontSize: '11.5px' }}>
                      <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{k}</span>
                      <span style={{ color: 'var(--ink)' }}>{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div style={{ margin: '0 14px 12px', padding: '9px 12px', background: '#F0FDFF', borderRadius: 'var(--r-xs)', borderLeft: '3px solid #0891B2' }}>
          <p style={{ fontSize: '12.5px', color: 'var(--ink)', lineHeight: 1.6 }}>{queixa.conteudo}</p>
        </div>
      )}
    </div>
  );
}

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
  formSubs: any[],
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

  const sub = formSubs.find(s => inRange(s.criado_em || s.created_at));
  if (sub) r.pre_consulta = { id: sub.id, etapa: 'pre_consulta', status: 'concluido', concluido_em: sub.criado_em || sub.created_at, dados: { preenchido: true, resumo_ia: sub.resumo_ia } };

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
  const { config }                      = useClinic();
  const [ciclos, setCiclos]             = useState<Ciclo[]>([]);
  const [cicloId, setCicloId]           = useState<string | null>(null);
  const [eventos, setEventos]           = useState<EvJornada[]>([]);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [formSubs, setFormSubs]         = useState<any[]>([]);
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

    const subsQuery = leadId
      ? supabase.from('form_submissions').select('id,criado_em,created_at,resumo_ia').eq('lead_id', leadId).order('criado_em')
      : supabase.from('form_submissions').select('id,criado_em,created_at,resumo_ia').eq('lead_id', 'x-no-match').order('criado_em');

    const [ciclosRes, agRes, subsRes, csatRes, npsRes] = await Promise.all([
      supabase.from('ciclos_jornada_paciente').select('*').eq('paciente_id', pacienteId).order('created_at'),
      agQuery,
      subsQuery,
      csatQuery,
      npsQuery,
    ]);

    const ags        = (agRes.data    || []) as any[];
    const subsData   = (subsRes.data  || []) as any[];
    const csatData   = (csatRes.data  || []) as any[];
    const npsData    = (npsRes.data   || []) as any[];
    const ciclosData = (ciclosRes.data || []) as Ciclo[];

    setAgendamentos(ags);
    setFormSubs(subsData);
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
  const fallback   = cicloAtual ? derivarFallback(cicloAtual, agendamentos, formSubs, csats, npss) : {};
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
  const { config: clinicConfig }      = useClinic();
  const { user }                      = useAuth();
  const [premiumEnabled, setPremiumEnabled] = useState<boolean | null>(null);
  const [subTab, setSubTab]           = useState<SubTab>('pre');
  const [submissions, setSubmissions] = useState<AnamneseSubmission[]>([]);
  const [queixes, setQueixes]         = useState<QueixaItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [histPopup, setHistPopup]     = useState(false);
  const [confirmApagar, setConfirmApagar] = useState<string | null>(null);
  const [apagando, setApagando]       = useState(false);

  useEffect(() => {
    if (!pacienteId) return;
    carregarDados();
  }, [pacienteId]);

  const carregarDados = async () => {
    setLoading(true);
    const subsQuery = leadId
      ? supabase.from('form_submissions')
          .select('id, dados, resumo_ia, criado_em, created_at, formulario_id, visualizado, arquivado')
          .eq('lead_id', leadId)
          .order('criado_em', { ascending: false })
      : Promise.resolve({ data: [] as any[] });

    const queixaQuery = leadId
      ? supabase.from('mensagens')
          .select('id, conteudo, created_at')
          .eq('lead_id', leadId)
          .eq('tipo', 'queixa_principal')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] });

    const [{ data: configData }, subsRes, queixaRes] = await Promise.all([
      supabase.from('clinic_config').select('premium_enabled').single(),
      subsQuery,
      queixaQuery,
    ]);

    setPremiumEnabled(configData?.premium_enabled ?? false);
    const subs = (subsRes.data || []) as any[];
    setSubmissions(subs.map((s: any) => ({ ...s, origem: 'tally' as const })));
    const qs = (queixaRes.data || []) as any[];
    setQueixes(qs.map((q: any) => ({ ...q, origem: 'whatsapp' as const })));

    // Marcar como visualizado (não-arquivados não visualizados)
    const naoVistos = subs.filter((s: any) => !s.visualizado && !s.arquivado).map((s: any) => s.id);
    if (naoVistos.length) {
      supabase.from('form_submissions').update({ visualizado: true }).in('id', naoVistos);
    }

    setLoading(false);
  };

  const arquivarSubmission = async (id: string) => {
    await supabase.from('form_submissions').update({ arquivado: true }).eq('id', id);
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, arquivado: true } : s));
  };

  const apagarItem = async (item: AnamneseItem) => {
    setApagando(true);
    if (item.origem === 'tally') {
      const sub = item as AnamneseSubmission;
      await supabase.from('form_submissions').delete().eq('id', item.id);
      await supabase.from('audit_log').insert({
        acao: 'anamnese_apagada',
        tabela: 'form_submissions',
        registro_id: item.id,
        realizado_por: user?.id ?? null,
        detalhes: {
          lead_id: leadId,
          paciente_id: pacienteId,
          resumo_ia: sub.resumo_ia,
          dados_trecho: JSON.stringify(sub.dados || {}).slice(0, 500),
          apagado_em: new Date().toISOString(),
        },
      });
      setSubmissions(prev => prev.filter(s => s.id !== item.id));
    } else {
      await supabase.from('mensagens').delete().eq('id', item.id);
      setQueixes(prev => prev.filter(q => q.id !== item.id));
    }
    setApagando(false);
    setConfirmApagar(null);
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

      {subTab === 'pre' && (() => {
        const ativos = submissions.filter(s => !s.arquivado);
        const allItems: AnamneseItem[] = [
          ...ativos,
          ...queixes,
        ].sort((a, b) => {
          const da = (a as AnamneseSubmission).criado_em || a.created_at;
          const db = (b as AnamneseSubmission).criado_em || b.created_at;
          return new Date(db).getTime() - new Date(da).getTime();
        });
        const historicoItems: AnamneseItem[] = [
          ...submissions.filter(s => s.arquivado),
        ];
        const isEmpty = allItems.length === 0;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)' }}>
                <ClipboardList size={13} style={{ color: 'var(--sage-dark)' }} /> Pré-consulta
              </div>
              {historicoItems.length > 0 && (
                <button
                  onClick={() => setHistPopup(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <History size={12} /> Histórico ({historicoItems.length})
                </button>
              )}
            </div>

            {/* Fonte 1: Tally */}
            {ativos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#7C3AED', opacity: 0.8 }}>Formulário Tally</span>
                {ativos.map(s => (
                  <AnamneseCard
                    key={s.id}
                    item={s}
                    onArquivar={arquivarSubmission}
                    onIniciarApagar={setConfirmApagar}
                    confirmApagar={confirmApagar}
                    onConfirmarApagar={() => apagarItem(s)}
                    onCancelarApagar={() => setConfirmApagar(null)}
                    apagando={apagando}
                  />
                ))}
              </div>
            )}

            {/* Fonte 2: WhatsApp queixas */}
            {queixes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#0891B2', opacity: 0.8 }}>Via WhatsApp</span>
                {queixes.map(q => (
                  <AnamneseCard
                    key={q.id}
                    item={q}
                    onIniciarApagar={setConfirmApagar}
                    confirmApagar={confirmApagar}
                    onConfirmarApagar={() => apagarItem(q)}
                    onCancelarApagar={() => setConfirmApagar(null)}
                    apagando={apagando}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {isEmpty && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px', gap: '12px', textAlign: 'center' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--champ-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ClipboardList size={18} style={{ color: 'var(--champ-text)' }} />
                </div>
                <p className="font-display" style={{ fontSize: '16px', fontStyle: 'italic', fontWeight: 300, color: 'var(--muted)' }}>
                  Nenhuma pré-consulta recebida ainda
                </p>
                <p style={{ fontSize: '11.5px', color: 'var(--muted)', opacity: 0.8 }}>
                  Formulários Tally e queixas via WhatsApp aparecerão aqui
                </p>
                {clinicConfig?.tally_formulario_id && leadId && (
                  <a
                    href={`https://tally.so/r/${clinicConfig.tally_formulario_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 16px', background: 'var(--sage-dark)', color: 'white',
                      border: 'none', borderRadius: 'var(--r-xs)',
                      fontSize: '12.5px', fontWeight: 600, textDecoration: 'none', fontFamily: 'inherit', cursor: 'pointer',
                    }}
                  >
                    <Send size={13} /> Enviar formulário de anamnese
                  </a>
                )}
              </div>
            )}

            {/* Popup histórico arquivados */}
            {histPopup && (
              <div
                onClick={() => setHistPopup(false)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '520px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', margin: '0 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>Histórico de pré-consulta</span>
                    <button onClick={() => setHistPopup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}><X size={16} /></button>
                  </div>
                  <div style={{ overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {historicoItems.length === 0 ? (
                      <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>Sem registros arquivados</p>
                    ) : historicoItems.map(item => (
                      <AnamneseCard
                        key={item.id}
                        item={item}
                        onIniciarApagar={setConfirmApagar}
                        confirmApagar={confirmApagar}
                        onConfirmarApagar={() => apagarItem(item)}
                        onCancelarApagar={() => setConfirmApagar(null)}
                        apagando={apagando}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

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
