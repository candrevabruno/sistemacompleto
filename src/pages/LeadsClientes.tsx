import React, { useState, useEffect } from 'react';
import { useVisibilityRefresh } from '../hooks/useVisibilityRefresh';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/ui/Modal';
import {
  Search, Download, FileText, CheckCircle, Archive,
  RotateCcw, AlertCircle, Users, Clock, CalendarCheck,
  History, Check, MessageSquare,
} from 'lucide-react';
import {
  parseISO, format, addDays, addHours,
  startOfToday, endOfToday, startOfYesterday, endOfYesterday,
  subDays, startOfMonth, endOfMonth, startOfYear, endOfYear,
  isToday, isTomorrow, startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LeadDetailsModal } from '../components/crm/LeadDetailsModal';
import { calcularDataReativacao, getInitials } from '../lib/lead-utils';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type DateFilter = 'ontem' | 'hoje' | '7dias' | '14dias' | 'mes' | 'ano' | 'custom';
type TabLeads = 'leads' | 'arquivados';
type FiltroStatus = 'todos' | 'cancelou' | 'no-show' | 'abandonou' | 'reativacao' | 'sem-resposta' | 'reagendado';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MOTIVO_OPTIONS = ['cancelou', 'no-show', 'abandonou', 'reativação', 'sem resposta'];

const MOTIVO_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  cancelou:       { label: 'Cancelou',     bg: 'rgba(245,158,11,0.12)',  color: '#b45309' },
  'no-show':      { label: 'No-show',      bg: 'rgba(239,68,68,0.1)',    color: '#dc2626' },
  abandonou:      { label: 'Abandonou',    bg: 'rgba(239,68,68,0.1)',    color: '#dc2626' },
  'reativação':   { label: 'Reativação',   bg: 'rgba(59,130,246,0.1)',   color: '#2563eb' },
  'sem resposta': { label: 'Sem resposta', bg: 'rgba(100,116,139,0.1)',  color: '#64748b' },
};

const MOTIVOS_ARQUIVAMENTO = [
  'Não quer mais atendimento',
  'Sem resposta após tentativas',
  'Atende em outro lugar',
  'Valor fora do orçamento',
  'Outro motivo',
];

const ACTION_LABEL: Record<string, string> = {
  lead_convertido:  'Lead convertido',
  lead_arquivado:   'Lead arquivado',
  lead_reativado:   'Lead reativado',
  tentativa_contato:'Tentativa de contato',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcularProximoContato(motivo: string, ref: Date): Date {
  switch (motivo) {
    case 'cancelou':     return addHours(ref, 2);
    case 'no-show':      return addHours(ref, 24);
    case 'abandonou':    return addHours(ref, 48);
    case 'reativação':   return addDays(ref, 3);
    case 'sem resposta': return addDays(ref, 3);
    default:             return addDays(ref, 3);
  }
}

function proximoContatoDisplay(iso: string | null): { text: string; color: string } {
  if (!iso) return { text: '—', color: 'var(--muted)' };
  const d = parseISO(iso);
  if (isToday(d))    return { text: 'Hoje — urgente', color: '#dc2626' };
  if (isTomorrow(d)) return { text: format(d, 'dd/MM HH:mm'), color: '#d97706' };
  return { text: format(d, 'dd/MM/yy HH:mm'), color: 'var(--muted)' };
}

// ─── Modal: Confirmar conversão ───────────────────────────────────────────────

function ModalConverteu({ lead, onConfirm, onClose }: {
  lead: any | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!lead) return null;
  return (
    <Modal isOpen={!!lead} onClose={onClose} title="Confirmar Conversão">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ padding: '10px 12px', background: 'var(--sage-xlight)', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', fontSize: '12px', fontWeight: 500, color: 'var(--sage-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ✓ Confirmar conversão de <strong>{lead.nome_lead}</strong>?
        </div>
        <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
          O lead será movido para Pacientes.
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', padding: '8px 16px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={onConfirm} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--sage-dark)', color: 'white', border: 'none', borderRadius: 'var(--r-xs)', padding: '8px 16px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Check className="w-3.5 h-3.5" /> Confirmar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal: Arquivar ──────────────────────────────────────────────────────────

function ModalArquivar({ lead, onConfirm, onClose }: {
  lead: any | null;
  onConfirm: (motivo: string, obs: string, lgpd: boolean) => void;
  onClose: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [obs, setObs] = useState('');
  const [lgpd, setLgpd] = useState(false);

  useEffect(() => {
    if (lead) { setMotivo(''); setObs(''); setLgpd(false); }
  }, [lead?.id]);

  if (!lead) return null;

  return (
    <Modal isOpen={!!lead} onClose={onClose} title="Arquivar Lead">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        <div>
          <label style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: '5px' }}>
            Motivo do arquivamento <span style={{ color: 'var(--rose-text)' }}>*</span>
          </label>
          <select value={motivo} onChange={e => setMotivo(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', fontSize: '13px', color: 'var(--ink)', fontFamily: 'inherit', background: 'var(--white)', outline: 'none' }}>
            <option value="">Selecionar motivo...</option>
            {MOTIVOS_ARQUIVAMENTO.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: '5px' }}>
            Observação (opcional)
          </label>
          <textarea value={obs} onChange={e => setObs(e.target.value)}
            placeholder="Nota interna sobre este arquivamento..."
            rows={3}
            style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', fontSize: '13px', color: 'var(--ink)', fontFamily: 'inherit', background: 'var(--white)', outline: 'none', resize: 'none', lineHeight: 1.5 }} />
        </div>

        {/* LGPD */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'var(--rose-light)', border: '1px solid rgba(139,68,68,0.15)', borderRadius: 'var(--r-xs)', padding: '12px 14px', cursor: 'pointer' }}>
          <input type="checkbox" checked={lgpd} onChange={e => setLgpd(e.target.checked)}
            style={{ width: '16px', height: '16px', borderRadius: '4px', marginTop: '1px', accentColor: 'var(--rose-text)', flexShrink: 0 } as React.CSSProperties} />
          <div>
            <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--rose-text)' }}>Paciente solicitou exclusão dos dados (LGPD)</div>
            <div style={{ fontSize: '11px', color: 'var(--rose-text)', opacity: 0.75, marginTop: '3px', lineHeight: 1.5 }}>Nome, telefone e e-mail serão anonimizados. O registro é mantido para auditoria.</div>
          </div>
        </label>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', padding: '8px 16px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={() => motivo && onConfirm(motivo, obs, lgpd)} disabled={!motivo}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--rose-text)', color: 'white', border: 'none', borderRadius: 'var(--r-xs)', padding: '8px 16px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: motivo ? 1 : 0.4 }}>
            <Archive className="w-3.5 h-3.5" /> Arquivar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal: Histórico ─────────────────────────────────────────────────────────

function ModalHistorico({ lead, onClose }: { lead: any | null; onClose: () => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lead) return;
    setLoading(true);
    supabase.from('audit_log')
      .select('*')
      .eq('record_id', lead.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setLogs(data); setLoading(false); });
  }, [lead?.id]);

  if (!lead) return null;

  return (
    <Modal isOpen={!!lead} onClose={onClose} title={`Histórico — ${lead.nome_lead}`} className="max-w-xl">
      {loading ? (
        <p style={{ fontSize: '13px', textAlign: 'center', padding: '24px 0', color: 'var(--muted)' }}>Carregando...</p>
      ) : logs.length === 0 ? (
        <p style={{ fontSize: '13px', textAlign: 'center', padding: '24px 0', color: 'var(--muted)' }}>Nenhuma ação registrada.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
          {logs.map((log, idx) => (
            <div key={log.id} style={{
              display: 'flex', gap: '12px', padding: '10px 0',
              borderBottom: idx < logs.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                  {ACTION_LABEL[log.action] || log.action}
                </p>
                {log.detalhes?.motivo && (
                  <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase' }}>Motivo</span>
                    {' '}{log.detalhes.motivo}
                  </p>
                )}
                {log.detalhes?.observacao && (
                  <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '1px 0 0' }}>
                    <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase' }}>Obs</span>
                    {' '}{log.detalhes.observacao}
                  </p>
                )}
                {log.detalhes?.tentativa && (
                  <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '1px 0 0' }}>
                    Tentativa #{log.detalhes.tentativa}
                  </p>
                )}
              </div>
              <p style={{ fontSize: '11px', color: 'var(--muted)', flexShrink: 0, marginTop: '1px' }}>
                {format(new Date(log.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
              </p>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ─── Modal: Confirmar reativação ──────────────────────────────────────────────

function ModalReativar({ lead, onConfirm, onClose }: {
  lead: any | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!lead) return null;
  return (
    <Modal isOpen={!!lead} onClose={onClose} title="Reativar Lead">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ padding: '10px 12px', background: 'var(--sage-xlight)', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', fontSize: '12px', fontWeight: 500, color: 'var(--sage-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Reativar <strong>{lead.nome_lead}</strong>?
        </div>
        <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
          O registro voltará para a aba de Leads com status <em>Iniciou atendimento</em>.
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', padding: '8px 16px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={onConfirm} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--sage-dark)', color: 'white', border: 'none', borderRadius: 'var(--r-xs)', padding: '8px 16px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            <RotateCcw className="w-3.5 h-3.5" /> Reativar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function LeadsClientes({ mode }: { mode?: 'leads' | 'clientes' }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Tabs e filtros ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'leads' | 'clientes'>(mode || 'leads');
  const [tabLeads, setTabLeads] = useState<TabLeads>('leads');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // ── Filtro de data ─────────────────────────────────────────────────────────
  const [dateFilter, setDateFilter] = useState<DateFilter>('hoje');
  const [dateRange, setDateRange] = useState({ start: startOfToday(), end: endOfToday() });
  const [customStart, setCustomStart] = useState(format(startOfToday(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(endOfToday(), 'yyyy-MM-dd'));

  // ── Dados ──────────────────────────────────────────────────────────────────
  const [leads, setLeads] = useState<any[]>([]);
  const [arquivados, setArquivados] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [metricas, setMetricas] = useState({ totalAtivos: 0, cancelamentos: 0, urgentes: 0, aguardando: 0, reagendadosSemana: 0 });

  // ── Modais ─────────────────────────────────────────────────────────────────
  const [leadConverteu, setLeadConverteu] = useState<any | null>(null);
  const [leadArquivar, setLeadArquivar] = useState<any | null>(null);
  const [leadHistorico, setLeadHistorico] = useState<any | null>(null);
  const [leadReativar, setLeadReativar] = useState<any | null>(null);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [openLeadDetails, setOpenLeadDetails] = useState(false);

  // ── useEffects ─────────────────────────────────────────────────────────────
  useEffect(() => { applyFilter(dateFilter); }, [dateFilter]);

  useEffect(() => {
    if (mode === 'leads' || !mode) {
      fetchLeads();
      fetchArquivados();
      fetchMetricas();
    } else {
      fetchClientes();
    }
  }, [dateRange, activeTab]);

  // Refresh ao voltar ao tab ou reconectar rede
  useVisibilityRefresh(() => {
    if (mode === 'leads' || !mode) {
      fetchLeads(); fetchArquivados(); fetchMetricas();
    } else {
      fetchClientes();
    }
  });

  // Realtime: atualiza automaticamente quando leads mudam
  useEffect(() => {
    const ch = supabase.channel('leads-clientes-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        if (mode === 'leads' || !mode) {
          fetchLeads(); fetchArquivados(); fetchMetricas();
        } else {
          fetchClientes();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [dateRange]);

  const applyFilter = (f: DateFilter) => {
    const today = new Date();
    switch (f) {
      case 'hoje':   setDateRange({ start: startOfToday(),      end: endOfToday() }); break;
      case 'ontem':  setDateRange({ start: startOfYesterday(),  end: endOfYesterday() }); break;
      case '7dias':  setDateRange({ start: subDays(today, 7),   end: endOfToday() }); break;
      case '14dias': setDateRange({ start: subDays(today, 14),  end: endOfToday() }); break;
      case 'mes':    setDateRange({ start: startOfMonth(today), end: endOfMonth(today) }); break;
      case 'ano':    setDateRange({ start: startOfYear(today),  end: endOfYear(today) }); break;
      case 'custom':
        if (customStart && customEnd)
          setDateRange({ start: new Date(customStart + 'T00:00:00'), end: new Date(customEnd + 'T23:59:59') });
        break;
    }
  };

  // ── Fetch leads ativos ─────────────────────────────────────────────────────
  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase.from('leads')
      .select('*')
      .neq('status', 'arquivado')
      .neq('status', 'converteu')
      .gte('inicio_atendimento', dateRange.start.toISOString())
      .lte('inicio_atendimento', dateRange.end.toISOString())
      .order('inicio_atendimento', { ascending: false });
    if (data) setLeads(data);
    setLoading(false);
  };

  // ── Fetch arquivados ───────────────────────────────────────────────────────
  const fetchArquivados = async () => {
    const { data } = await supabase.from('leads')
      .select('*')
      .eq('status', 'arquivado')
      .order('arquivado_em', { ascending: false, nullsFirst: false });
    if (data) setArquivados(data);
  };

  // ── Fetch métricas ─────────────────────────────────────────────────────────
  const fetchMetricas = async () => {
    const semana = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
    const now = new Date().toISOString();
    const [
      { count: totalAtivos },
      { count: cancelamentos },
      { count: urgentes },
      { count: aguardando },
      { count: reagendadosSemana },
    ] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }).neq('status', 'arquivado').neq('status', 'converteu'),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('motivo', 'cancelou').neq('status', 'arquivado').neq('status', 'converteu'),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('motivo', 'cancelou').neq('status', 'arquivado').neq('status', 'converteu').lte('proximo_contato', now).not('proximo_contato', 'is', null),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('motivo', 'sem resposta').neq('status', 'arquivado').neq('status', 'converteu'),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'reagendado').gte('inicio_atendimento', semana),
    ]);
    setMetricas({
      totalAtivos: totalAtivos || 0,
      cancelamentos: cancelamentos || 0,
      urgentes: urgentes || 0,
      aguardando: aguardando || 0,
      reagendadosSemana: reagendadosSemana || 0,
    });
  };

  // ── Fetch clientes (modo legado) ───────────────────────────────────────────
  const fetchClientes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('clientes')
      .select('*, leads(*)')
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())
      .order('created_at', { ascending: false });

    const resolved = await Promise.all(
      (data || []).map(async p => {
        const [reqC, reqP] = await Promise.all([
          supabase.from('agendamentos').select('id', { count: 'exact' }).eq('lead_id', p.lead_id).eq('status', 'compareceu'),
          supabase.from('agendamentos').select('data_hora_inicio').eq('lead_id', p.lead_id)
            .gte('data_hora_inicio', new Date().toISOString()).order('data_hora_inicio', { ascending: true }).limit(1),
        ]);
        return { ...p, countCompareceu: reqC.count || 0, proxAgendamento: reqP.data?.[0]?.data_hora_inicio || null };
      })
    );
    setClientes(resolved);
    setLoading(false);
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const confirmarConversao = async () => {
    if (!leadConverteu || !user) return;
    const lead = leadConverteu;
    const now = new Date().toISOString();
    await supabase.from('leads').update({ status: 'converteu', converteu_em: now, converteu_por: user.id }).eq('id', lead.id);
    const { data: pac } = await supabase.from('pacientes').select('id').eq('lead_id', lead.id).maybeSingle();
    if (!pac) await supabase.from('pacientes').insert({ lead_id: lead.id });
    await supabase.from('audit_log').insert({ user_id: user.id, action: 'lead_convertido', record_id: lead.id, detalhes: { nome: lead.nome_lead, timestamp: now } });
    setLeadConverteu(null);
    fetchLeads();
    fetchMetricas();
  };

  const confirmarArquivamento = async (motivo: string, obs: string, lgpd: boolean) => {
    if (!leadArquivar || !user) return;
    const lead = leadArquivar;
    const now = new Date().toISOString();
    if (lgpd) {
      await supabase.from('leads').update({ nome_lead: 'REMOVIDO', whatsapp_lead: null, email: null }).eq('id', lead.id);
    }
    await supabase.from('leads').update({
      status: 'arquivado',
      motivo_arquivamento: motivo,
      observacao_arquivamento: obs || null,
      arquivado_em: now,
      arquivado_por: user.id,
      lgpd_exclusao: lgpd,
    }).eq('id', lead.id);
    await supabase.from('audit_log').insert({ user_id: user.id, action: 'lead_arquivado', record_id: lead.id, detalhes: { motivo, observacao: obs || null, lgpd, timestamp: now } });
    setLeadArquivar(null);
    fetchLeads();
    fetchArquivados();
    fetchMetricas();
  };

  const confirmarReativacao = async () => {
    if (!leadReativar || !user) return;
    const lead = leadReativar;
    await supabase.from('leads').update({
      status: 'iniciou_atendimento',
      arquivado_em: null,
      arquivado_por: null,
      motivo_arquivamento: null,
      observacao_arquivamento: null,
      lgpd_exclusao: false,
    }).eq('id', lead.id);
    await supabase.from('audit_log').insert({ user_id: user.id, action: 'lead_reativado', record_id: lead.id, detalhes: { timestamp: new Date().toISOString() } });
    setLeadReativar(null);
    fetchArquivados();
    fetchLeads();
    fetchMetricas();
  };

  const registrarTentativa = async (lead: any) => {
    const novas = (lead.tentativas || 0) + 1;
    const now = new Date();
    const proximoContato = lead.motivo ? calcularProximoContato(lead.motivo, now).toISOString() : null;
    await supabase.from('leads').update({ tentativas: novas, proximo_contato: proximoContato }).eq('id', lead.id);
    await supabase.from('audit_log').insert({ user_id: user?.id, action: 'tentativa_contato', record_id: lead.id, detalhes: { tentativa: novas, timestamp: now.toISOString() } });
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, tentativas: novas, proximo_contato: proximoContato } : l));
  };

  const atualizarMotivo = async (lead: any, novoMotivo: string) => {
    const now = new Date();
    const proximoContato = novoMotivo ? calcularProximoContato(novoMotivo, now).toISOString() : null;
    await supabase.from('leads').update({ motivo: novoMotivo || null, proximo_contato: proximoContato, tentativas: 0 }).eq('id', lead.id);
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, motivo: novoMotivo || null, proximo_contato: proximoContato, tentativas: 0 } : l));
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const data = tabLeads === 'arquivados' ? filteredArquivados : filteredLeads;
    if (!data.length) return alert('Nenhum dado para exportar.');
    const headers = tabLeads === 'arquivados'
      ? ['Nome', 'Telefone', 'Motivo', 'Observação', 'Arquivado em']
      : ['Nome', 'WhatsApp', 'Pipeline', 'Motivo', 'Tentativas', 'Início'];
    const rows = data.map(l => tabLeads === 'arquivados'
      ? [l.nome_lead || '', l.whatsapp_lead || '', l.motivo_arquivamento || '', l.observacao_arquivamento || '', l.arquivado_em ? format(parseISO(l.arquivado_em), 'dd/MM/yyyy') : '']
      : [l.nome_lead || '', l.whatsapp_lead || '', l.status || '', l.motivo || '', String(l.tentativas || 0), l.inicio_atendimento ? format(parseISO(l.inicio_atendimento), 'dd/MM/yyyy') : '']
    );
    const csv = [headers.join(','), ...rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `leads_${format(new Date(), 'dd-MM-yyyy')}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleExportPDF = () => {
    const data = filteredLeads;
    if (!data.length) return alert('Nenhum dado para exportar.');
    const doc = new jsPDF('landscape');
    doc.setFontSize(16); doc.text('Relatório de Leads', 14, 20);
    doc.setFontSize(10); doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
    autoTable(doc, {
      startY: 33,
      head: [['Nome', 'WhatsApp', 'Pipeline', 'Motivo', 'Tentativas', 'Próximo contato', 'Início']],
      body: data.map(l => [
        l.nome_lead || 'Sem Nome',
        l.whatsapp_lead || '',
        l.status || '',
        l.motivo || '—',
        String(l.tentativas || 0),
        l.proximo_contato ? format(parseISO(l.proximo_contato), 'dd/MM/yy HH:mm') : '—',
        l.inicio_atendimento ? format(parseISO(l.inicio_atendimento), 'dd/MM/yyyy') : '—',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 110, 86] },
    });
    doc.save(`leads_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const chipCounts: Record<string, number> = {
    todos:          leads.length,
    cancelou:       leads.filter(l => l.motivo === 'cancelou').length,
    'no-show':      leads.filter(l => l.motivo === 'no-show').length,
    abandonou:      leads.filter(l => l.motivo === 'abandonou').length,
    reativacao:     leads.filter(l => l.motivo === 'reativação').length,
    'sem-resposta': leads.filter(l => l.motivo === 'sem resposta').length,
    reagendado:     leads.filter(l => l.status === 'reagendado').length,
  };

  const filteredLeads = leads.filter(lead => {
    const term = searchTerm.toLowerCase();
    const m = !term || lead.nome_lead?.toLowerCase().includes(term) || lead.whatsapp_lead?.includes(term);
    let s = true;
    switch (filtroStatus) {
      case 'cancelou':     s = lead.motivo === 'cancelou'; break;
      case 'no-show':      s = lead.motivo === 'no-show'; break;
      case 'abandonou':    s = lead.motivo === 'abandonou'; break;
      case 'reativacao':   s = lead.motivo === 'reativação'; break;
      case 'sem-resposta': s = lead.motivo === 'sem resposta'; break;
      case 'reagendado':   s = lead.status === 'reagendado'; break;
    }
    return m && s;
  });

  const filteredArquivados = arquivados.filter(lead => {
    const term = searchTerm.toLowerCase();
    return !term || lead.nome_lead?.toLowerCase().includes(term) || lead.whatsapp_lead?.includes(term);
  });

  const filteredClientes = clientes.filter(p => {
    const term = searchTerm.toLowerCase();
    return p.leads?.nome_lead?.toLowerCase().includes(term) || p.leads?.whatsapp_lead?.includes(term);
  });

  // ── Render: modo clientes (legado) ─────────────────────────────────────────
  if (mode === 'clientes') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 'calc(100vh - 100px)', background: 'var(--bg)', paddingBottom: '40px' }}>
        {/* Filtro */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {(['ontem','hoje','7dias','14dias','mes','ano'] as DateFilter[]).map(f => (
              <button key={f} onClick={() => setDateFilter(f)}
                style={{
                  padding: '5px 12px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: dateFilter === f ? 'var(--sage-dark)' : 'var(--sage-xlight)',
                  color: dateFilter === f ? 'white' : 'var(--ink)',
                  border: dateFilter === f ? '1px solid var(--sage-dark)' : '1px solid transparent',
                }}>
                {f === 'ontem' ? 'Ontem' : f === 'hoje' ? 'Hoje' : f === '7dias' ? '7 dias' : f === '14dias' ? '14 dias' : f === 'mes' ? 'Mês' : 'Ano'}
              </button>
            ))}
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search style={{ position: 'absolute', left: '10px', width: '14px', height: '14px', color: 'var(--muted)', pointerEvents: 'none' }} />
            <input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '32px', paddingRight: '10px', paddingTop: '6px', paddingBottom: '6px', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', fontSize: '12.5px', color: 'var(--ink)', background: 'var(--white)', outline: 'none', width: '200px', fontFamily: 'inherit' }}
            />
          </div>
        </div>
        {/* Tabela clientes */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nome', 'WhatsApp', 'Consultas', 'Próximo Agendamento', 'Cliente Desde'].map(h => (
                  <th key={h} style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', padding: '10px 14px', textAlign: 'left', borderBottom: '1px solid var(--border)', background: 'var(--bg)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: '64px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>Carregando...</td></tr>
              ) : filteredClientes.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '64px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>Nenhum cliente encontrado.</td></tr>
              ) : filteredClientes.map(c => (
                <tr key={c.id}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--sage-xlight)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'default' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 500, color: 'var(--ink)', verticalAlign: 'middle' }}>{c.leads?.nome_lead || 'Sem Nome'}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '11.5px', fontFamily: 'monospace', verticalAlign: 'middle' }}>{c.leads?.whatsapp_lead}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'middle' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: 'var(--sage-xlight)', color: 'var(--sage-dark)' }}>{c.countCompareceu}</span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--muted)', verticalAlign: 'middle' }}>
                    {c.proxAgendamento ? format(parseISO(c.proxAgendamento), 'dd/MM/yyyy HH:mm') : <span style={{ fontStyle: 'italic', fontSize: '11.5px' }}>Sem agendamentos</span>}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--muted)', verticalAlign: 'middle' }}>
                    {c.data_primeira_visita ? format(parseISO(c.data_primeira_visita), 'dd/MM/yyyy') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Render: modo leads ─────────────────────────────────────────────────────
  const FILTER_CHIPS: { key: FiltroStatus; label: string }[] = [
    { key: 'todos',       label: 'Todos' },
    { key: 'cancelou',    label: 'Cancelou' },
    { key: 'no-show',     label: 'No-show' },
    { key: 'abandonou',   label: 'Abandonou' },
    { key: 'reativacao',  label: 'Reativação' },
    { key: 'sem-resposta',label: 'Sem resposta' },
    { key: 'reagendado',  label: 'Reagendado' },
  ];

  const tabs: { key: TabLeads; label: string }[] = [
    { key: 'leads',      label: `Leads (${filteredLeads.length})` },
    { key: 'arquivados', label: `Arquivados (${arquivados.length})` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 'calc(100vh - 100px)', background: 'var(--bg)', paddingBottom: '40px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div>
          <div className="font-display" style={{ fontSize: '22px', fontWeight: 300, fontStyle: 'italic', color: 'var(--ink)' }}>
            Gestão de leads
          </div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            Acompanhe e qualifique cada contato até a conversão
          </p>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        {[
          { label: 'Leads ativos',          value: metricas.totalAtivos,       iconBg: 'var(--sage-xlight)', iconColor: 'var(--sage-dark)',  icon: <Users style={{ width: '14px', height: '14px' }} /> },
          { label: 'Cancelamentos',         value: metricas.cancelamentos,     iconBg: 'var(--rose-light)',  iconColor: 'var(--rose-text)',  icon: <AlertCircle style={{ width: '14px', height: '14px' }} /> },
          { label: 'Aguard. resposta',      value: metricas.aguardando,        iconBg: 'var(--champ-light)', iconColor: 'var(--champ-text)', icon: <Clock style={{ width: '14px', height: '14px' }} /> },
          { label: 'Reagendados na semana', value: metricas.reagendadosSemana, iconBg: '#EFF6FF',            iconColor: '#1D4ED8',           icon: <CalendarCheck style={{ width: '14px', height: '14px' }} /> },
        ].map(({ label, value, iconBg, iconColor, icon }) => (
          <div key={label} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '10px', padding: '13px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: iconBg, color: iconColor }}>
              {icon}
            </div>
            <div>
              <div style={{ fontSize: '9.5px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500 }}>{label}</div>
              <div className="font-display" style={{ fontSize: '24px', fontWeight: 300, color: 'var(--ink)', lineHeight: 1, marginTop: '1px' }}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filtros de data + busca + export ── */}
      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Pills de período + date range */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          {(['ontem','hoje','7dias','14dias','mes','ano'] as DateFilter[]).map(f => (
            <button key={f} onClick={() => setDateFilter(f)}
              style={{
                padding: '5px 12px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
                background: dateFilter === f ? 'var(--sage-dark)' : 'var(--sage-xlight)',
                color: dateFilter === f ? 'white' : 'var(--ink)',
                border: dateFilter === f ? '1px solid var(--sage-dark)' : '1px solid transparent',
              }}>
              {f === 'ontem' ? 'Ontem' : f === 'hoje' ? 'Hoje' : f === '7dias' ? '7 dias' : f === '14dias' ? '14 dias' : f === 'mes' ? 'Mês' : 'Ano'}
            </button>
          ))}
          {/* Date range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '6px', borderLeft: '1px solid var(--border)', marginLeft: '2px' }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', padding: '5px 10px', display: 'flex', alignItems: 'center' }}>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                style={{ fontSize: '11.5px', color: 'var(--ink)', background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>até</span>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', padding: '5px 10px', display: 'flex', alignItems: 'center' }}>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                style={{ fontSize: '11.5px', color: 'var(--ink)', background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <button onClick={() => setDateFilter('custom')}
              style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: 'var(--sage-dark)', color: 'white', border: 'none' }}>
              Filtrar
            </button>
          </div>
        </div>
        {/* Busca + export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search style={{ position: 'absolute', left: '10px', width: '13px', height: '13px', color: 'var(--muted)', pointerEvents: 'none' }} />
            <input
              placeholder="Buscar nome ou zap..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '30px', paddingRight: '10px', paddingTop: '6px', paddingBottom: '6px', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', fontSize: '12px', color: 'var(--ink)', background: 'var(--white)', outline: 'none', width: '200px', fontFamily: 'inherit' }}
            />
          </div>
          <button onClick={handleExportCSV} title="Exportar CSV"
            style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--white)', color: 'var(--muted)', cursor: 'pointer', flexShrink: 0 }}>
            <Download style={{ width: '14px', height: '14px' }} />
          </button>
          <button onClick={handleExportPDF} title="Exportar PDF"
            style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--white)', color: 'var(--muted)', cursor: 'pointer', flexShrink: 0 }}>
            <FileText style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      </div>

      {/* ── Tabs Leads / Arquivados ── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => { setTabLeads(tab.key); setSearchTerm(''); }}
            style={{
              padding: '8px 14px', fontSize: '12px', fontWeight: tabLeads === tab.key ? 600 : 400,
              color: tabLeads === tab.key ? 'var(--sage-dark)' : 'var(--muted)',
              marginBottom: '-1px', cursor: 'pointer', background: 'none', border: 'none',
              borderBottomWidth: '2px', borderBottomStyle: 'solid',
              borderBottomColor: tabLeads === tab.key ? 'var(--sage-dark)' : 'transparent',
              fontFamily: 'inherit',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Chips de filtro (só na aba leads) ── */}
      {tabLeads === 'leads' && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {FILTER_CHIPS.map(({ key, label }) => {
            const count = chipCounts[key] ?? 0;
            const active = filtroStatus === key;
            return (
              <button key={key} onClick={() => setFiltroStatus(key)}
                style={{
                  padding: '4px 11px', borderRadius: '20px', fontSize: '11px', fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: active ? 'var(--sage-dark)' : 'var(--white)',
                  color: active ? 'white' : 'var(--muted)',
                  border: active ? '1px solid var(--sage-dark)' : '1px solid var(--border-md)',
                }}>
                {label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* ── Tabela de leads ativos ── */}
      {tabLeads === 'leads' && (
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}>
              <thead>
                <tr>
                  {['Nome', 'Pipeline', 'Motivo', 'Tentativas', 'Próximo contato', 'Início', 'Ações'].map((h, i) => (
                    <th key={h} style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', padding: '10px 14px', textAlign: i === 6 ? 'right' : 'left', borderBottom: '1px solid var(--border)', background: 'var(--bg)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: '64px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>Carregando...</td></tr>
                ) : filteredLeads.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '64px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>Nenhum lead encontrado para este filtro.</td></tr>
                ) : filteredLeads.map(lead => {
                  const pc = proximoContatoDisplay(lead.proximo_contato);
                  const tentativas = lead.tentativas || 0;
                  const podeConverter = lead.status === 'agendado' || lead.status === 'reagendado';
                  const motBadge = lead.motivo ? MOTIVO_BADGE[lead.motivo] : null;

                  return (
                    <tr key={lead.id}
                      onClick={() => { setSelectedLead(lead); setOpenLeadDetails(true); }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--sage-xlight)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>

                      {/* Nome */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0, background: 'var(--champ-light)', color: 'var(--champ-text)' }}>
                            {getInitials(lead.nome_lead)}
                          </div>
                          <div>
                            <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink)' }}>{lead.nome_lead || 'Sem Nome'}</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>{lead.whatsapp_lead}</div>
                          </div>
                        </div>
                      </td>

                      {/* Pipeline */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle', borderBottom: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 500, background: 'var(--champ-light)', color: 'var(--champ-text)' }}>
                          {lead.status}
                        </span>
                      </td>

                      {/* Motivo (editável inline) */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle', borderBottom: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                        <select
                          value={lead.motivo || ''}
                          onChange={e => atualizarMotivo(lead, e.target.value)}
                          style={{
                            fontSize: '10.5px', fontWeight: 500, padding: '3px 8px', borderRadius: '20px',
                            border: 'none', outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
                            background: motBadge ? motBadge.bg : 'var(--sage-xlight)',
                            color: motBadge ? motBadge.color : 'var(--muted)',
                          }}>
                          <option value="">— sem motivo —</option>
                          {MOTIVO_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </td>

                      {/* Tentativas */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle', borderBottom: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          {[0, 1, 2].map(i => (
                            <span key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: i < tentativas ? 'var(--sage-dark)' : 'var(--border-md)', display: 'inline-block' }} />
                          ))}
                          {tentativas >= 3 && (
                            <span style={{ fontSize: '9px', fontWeight: 700, marginLeft: '2px', padding: '1px 5px', borderRadius: '20px', background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
                              3×
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Próximo contato */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 500, color: pc.color }}>{pc.text}</span>
                      </td>

                      {/* Início */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle', borderBottom: '1px solid var(--border)', fontSize: '11.5px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {lead.inicio_atendimento ? format(parseISO(lead.inicio_atendimento), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                      </td>

                      {/* Ações */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle', borderBottom: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end' }}>
                          {/* Registrar tentativa */}
                          <button onClick={() => registrarTentativa(lead)} title="Registrar tentativa de contato"
                            disabled={tentativas >= 3}
                            style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: 'none', cursor: tentativas >= 3 ? 'not-allowed' : 'pointer', opacity: tentativas >= 3 ? 0.3 : 1, background: 'var(--sage-xlight)', color: 'var(--sage-dark)', flexShrink: 0 }}>
                            <Check style={{ width: '13px', height: '13px' }} />
                          </button>

                          {/* Abrir no Inbox */}
                          {lead.whatsapp_lead && (
                            <button onClick={() => navigate('/inbox', { state: { lead_id: lead.id } })} title="Abrir no Inbox"
                              style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'var(--sage-xlight)', color: 'var(--sage-dark)', flexShrink: 0 }}>
                              <MessageSquare style={{ width: '13px', height: '13px' }} />
                            </button>
                          )}

                          {/* Converteu */}
                          {podeConverter && (
                            <button onClick={() => setLeadConverteu(lead)} title="Marcar como converteu"
                              style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'var(--sage-xlight)', color: 'var(--sage-dark)', flexShrink: 0 }}>
                              <CheckCircle style={{ width: '13px', height: '13px' }} />
                            </button>
                          )}

                          {/* Arquivar */}
                          <button onClick={() => setLeadArquivar(lead)} title="Arquivar lead"
                            style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'var(--rose-light)', color: 'var(--rose-text)', flexShrink: 0 }}>
                            <Archive style={{ width: '13px', height: '13px' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tabela de arquivados ── */}
      {tabLeads === 'arquivados' && (
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
              <thead>
                <tr>
                  {['Nome', 'Motivo', 'Observação', 'Arquivado em', 'Ações'].map((h, i) => (
                    <th key={h} style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', padding: '10px 14px', textAlign: i === 4 ? 'right' : 'left', borderBottom: '1px solid var(--border)', background: 'var(--bg)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredArquivados.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '64px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>Nenhum lead arquivado.</td></tr>
                ) : filteredArquivados.map(lead => (
                  <tr key={lead.id}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--sage-xlight)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    style={{ borderBottom: '1px solid var(--border)' }}>

                    {/* Nome */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0, background: 'rgba(100,116,139,0.1)', color: '#64748b' }}>
                          {getInitials(lead.nome_lead)}
                        </div>
                        <div>
                          <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink)' }}>{lead.nome_lead || 'Sem Nome'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>{lead.whatsapp_lead || '—'}</div>
                        </div>
                      </div>
                    </td>

                    {/* Motivo arquivamento */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 500, background: 'rgba(100,116,139,0.1)', color: '#64748b' }}>
                        {lead.motivo_arquivamento || '—'}
                      </span>
                    </td>

                    {/* Observação */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle', borderBottom: '1px solid var(--border)', fontSize: '11.5px', color: 'var(--muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lead.observacao_arquivamento || '—'}
                    </td>

                    {/* Arquivado em */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle', borderBottom: '1px solid var(--border)', fontSize: '11.5px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {lead.arquivado_em ? format(parseISO(lead.arquivado_em), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—'}
                    </td>

                    {/* Ações */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setLeadReativar(lead)} title="Reativar lead"
                          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'var(--sage-xlight)', color: 'var(--sage-dark)', fontSize: '11.5px', fontWeight: 500, fontFamily: 'inherit' }}>
                          <RotateCcw style={{ width: '13px', height: '13px' }} />
                          Reativar
                        </button>
                        <button onClick={() => setLeadHistorico(lead)} title="Ver histórico"
                          style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'var(--sage-xlight)', color: 'var(--muted)', flexShrink: 0 }}>
                          <History style={{ width: '13px', height: '13px' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modais ── */}
      <LeadDetailsModal
        isOpen={openLeadDetails}
        onClose={() => setOpenLeadDetails(false)}
        leadId={selectedLead?.id}
        onUpdate={fetchLeads}
      />
      <ModalConverteu lead={leadConverteu} onConfirm={confirmarConversao} onClose={() => setLeadConverteu(null)} />
      <ModalArquivar lead={leadArquivar} onConfirm={confirmarArquivamento} onClose={() => setLeadArquivar(null)} />
      <ModalHistorico lead={leadHistorico} onClose={() => setLeadHistorico(null)} />
      <ModalReativar lead={leadReativar} onConfirm={confirmarReativacao} onClose={() => setLeadReativar(null)} />
    </div>
  );
}
