import React, { useState, useEffect } from 'react';
import { useVisibilityRefresh } from '../hooks/useVisibilityRefresh';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
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
      <p className="text-sm text-[var(--ink)] leading-relaxed mb-6">
        Confirmar que <strong>{lead.nome_lead}</strong> compareceu à consulta e será movida para a aba Pacientes?
      </p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm rounded-[8px] border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--bg)] transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 text-sm font-semibold rounded-[8px] text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--sage-dark)' }}
        >
          Confirmar
        </button>
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

  const inputCls = 'w-full rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--sage-dark)]';
  const inputStyle = { border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)' };

  return (
    <Modal isOpen={!!lead} onClose={onClose} title="Arquivar Lead">
      <div className="space-y-4 mb-6">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-[1px] text-[var(--muted)] block mb-1.5">
            Motivo do arquivamento *
          </label>
          <select value={motivo} onChange={e => setMotivo(e.target.value)} className={inputCls} style={inputStyle}>
            <option value="">Selecionar motivo...</option>
            {MOTIVOS_ARQUIVAMENTO.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-[1px] text-[var(--muted)] block mb-1.5">
            Observação (opcional)
          </label>
          <textarea
            value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder="Nota interna sobre este arquivamento..."
            rows={3}
            className={inputCls + ' resize-none'}
            style={inputStyle}
          />
        </div>
        <label className="flex items-start gap-3 cursor-pointer p-3 rounded-[8px] border border-[var(--border)] hover:bg-[var(--sage-xlight)] transition-colors">
          <input
            type="checkbox"
            checked={lgpd}
            onChange={e => setLgpd(e.target.checked)}
            className="mt-0.5 accent-[var(--sage-dark)]"
          />
          <span className="text-sm text-[var(--ink)]">
            <strong>Paciente solicitou exclusão dos dados (LGPD)</strong>
            <span className="block text-[11px] text-[var(--muted)] mt-0.5">
              Nome, telefone e e-mail serão anonimizados. O registro é mantido para auditoria.
            </span>
          </span>
        </label>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-[8px] border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--bg)] transition-colors">
          Cancelar
        </button>
        <button
          onClick={() => motivo && onConfirm(motivo, obs, lgpd)}
          disabled={!motivo}
          className="px-4 py-2 text-sm font-semibold rounded-[8px] text-white disabled:opacity-40 transition-opacity hover:opacity-90"
          style={{ background: '#dc2626' }}
        >
          Arquivar
        </button>
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
        <p className="text-sm text-center py-6 text-[var(--muted)]">Carregando...</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-center py-6 text-[var(--muted)]">Nenhuma ação registrada.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {logs.map(log => (
            <div key={log.id} className="flex gap-3 p-3 rounded-[8px] border border-[var(--border)]">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--ink)]">
                  {ACTION_LABEL[log.action] || log.action}
                </p>
                {log.detalhes?.motivo && <p className="text-xs text-[var(--muted)] mt-0.5">Motivo: {log.detalhes.motivo}</p>}
                {log.detalhes?.observacao && <p className="text-xs text-[var(--muted)]">Obs: {log.detalhes.observacao}</p>}
                {log.detalhes?.tentativa && <p className="text-xs text-[var(--muted)]">Tentativa #{log.detalhes.tentativa}</p>}
              </div>
              <p className="text-xs text-[var(--muted)] flex-shrink-0 mt-0.5">
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
      <p className="text-sm text-[var(--ink)] leading-relaxed mb-6">
        Reativar <strong>{lead.nome_lead}</strong>? O registro voltará para a aba de Leads com status <em>Iniciou atendimento</em>.
      </p>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-[8px] border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--bg)] transition-colors">
          Cancelar
        </button>
        <button onClick={onConfirm} className="px-4 py-2 text-sm font-semibold rounded-[8px] text-white transition-opacity hover:opacity-90" style={{ background: 'var(--sage-dark)' }}>
          Reativar
        </button>
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

  // ── Estilos comuns ─────────────────────────────────────────────────────────
  const cardCls = 'rounded-[12px] border border-[var(--border)] bg-[var(--white)] shadow-[0_1px_4px_rgba(4,52,44,0.06)]';
  const thCls = 'px-3 py-3 text-[10px] font-semibold uppercase tracking-[1px] text-[var(--muted)] text-left whitespace-nowrap';
  const btnIconCls = 'p-1.5 rounded-[6px] transition-colors flex-shrink-0';

  // ── Render: modo clientes (legado) ─────────────────────────────────────────
  if (mode === 'clientes') {
    return (
      <div className="space-y-4 flex flex-col min-h-[calc(100vh-100px)] bg-[var(--bg)] pb-10">
        <Card><CardContent className="p-4">
          <div className="flex flex-col 2xl:flex-row gap-4 justify-between">
            <div className="flex flex-wrap gap-2">
              {(['ontem','hoje','7dias','14dias','mes','ano'] as DateFilter[]).map(f => (
                <button key={f} onClick={() => setDateFilter(f)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-[8px] transition-colors ${dateFilter === f ? 'text-white' : 'bg-[var(--bg)] text-[var(--ink)]'}`}
                  style={dateFilter === f ? { background: 'var(--sage-dark)' } : {}}>
                  {f === 'ontem' ? 'Ontem' : f === 'hoje' ? 'Hoje' : f === '7dias' ? '7 dias' : f === '14dias' ? '14 dias' : f === 'mes' ? 'Mês' : 'Ano'}
                </button>
              ))}
            </div>
            <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} icon={<Search className="w-4 h-4" />} className="h-9 w-64" />
          </div>
        </CardContent></Card>
        <div className={cardCls + ' overflow-x-auto'}>
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)]" style={{ background: 'var(--sage-xlight)' }}>
              <tr>
                <th className={thCls}>Nome</th>
                <th className={thCls}>WhatsApp</th>
                <th className={thCls + ' text-center'}>Consultas</th>
                <th className={thCls}>Próximo Agendamento</th>
                <th className={thCls}>Cliente Desde</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-16 text-center text-sm text-[var(--muted)]">Carregando...</td></tr>
              ) : filteredClientes.length === 0 ? (
                <tr><td colSpan={5} className="py-16 text-center text-sm text-[var(--muted)]">Nenhum cliente encontrado.</td></tr>
              ) : filteredClientes.map(c => (
                <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--sage-xlight)] transition-colors">
                  <td className="px-3 py-3 font-medium text-[var(--ink)]">{c.leads?.nome_lead || 'Sem Nome'}</td>
                  <td className="px-3 py-3 text-[var(--muted)] font-mono text-xs">{c.leads?.whatsapp_lead}</td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-sm font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'var(--sage-xlight)', color: 'var(--sage-dark)' }}>{c.countCompareceu}</span>
                  </td>
                  <td className="px-3 py-3 text-sm text-[var(--muted)]">
                    {c.proxAgendamento ? format(parseISO(c.proxAgendamento), 'dd/MM/yyyy HH:mm') : <span className="italic text-xs">Sem agendamentos</span>}
                  </td>
                  <td className="px-3 py-3 text-sm text-[var(--muted)]">
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

  return (
    <div className="space-y-4 flex flex-col min-h-[calc(100vh-100px)] pb-10" style={{ background: 'var(--bg)' }}>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Leads ativos',
            value: metricas.totalAtivos,
            icon: <Users className="w-4 h-4" />,
            badge: null,
          },
          {
            label: 'Cancelamentos',
            value: metricas.cancelamentos,
            icon: <AlertCircle className="w-4 h-4" />,
            badge: metricas.urgentes > 0 ? `${metricas.urgentes} urgente${metricas.urgentes > 1 ? 's' : ''}` : null,
            badgeColor: '#dc2626',
          },
          {
            label: 'Aguardando resposta',
            value: metricas.aguardando,
            icon: <Clock className="w-4 h-4" />,
            badge: null,
          },
          {
            label: 'Reagendados na semana',
            value: metricas.reagendadosSemana,
            icon: <CalendarCheck className="w-4 h-4" />,
            badge: null,
          },
        ].map(({ label, value, icon, badge, badgeColor }) => (
          <div key={label} className={cardCls + ' p-4'}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-[1.1px] text-[var(--muted)]">{label}</p>
              <span className="p-1.5 rounded-[7px]" style={{ background: 'var(--sage-xlight)', color: 'var(--sage-dark)' }}>{icon}</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-[28px] font-bold leading-none" style={{ color: 'var(--sage-dark)' }}>{value}</span>
              {badge && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full mb-0.5" style={{ background: 'rgba(220,38,38,0.1)', color: badgeColor || '#dc2626' }}>
                  {badge}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Filtros de data + busca + export ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col 2xl:flex-row gap-4 justify-between">
            <div className="flex flex-col xl:flex-row gap-3 xl:items-center">
              <div className="flex flex-wrap gap-1.5">
                {(['ontem','hoje','7dias','14dias','mes','ano'] as DateFilter[]).map(f => (
                  <button key={f} onClick={() => setDateFilter(f)}
                    className="px-3 py-1.5 text-xs font-medium rounded-[8px] transition-colors"
                    style={dateFilter === f ? { background: 'var(--sage-dark)', color: '#fff' } : { background: 'var(--sage-xlight)', color: 'var(--ink)' }}>
                    {f === 'ontem' ? 'Ontem' : f === 'hoje' ? 'Hoje' : f === '7dias' ? '7 dias' : f === '14dias' ? '14 dias' : f === 'mes' ? 'Mês' : 'Ano'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 xl:border-l border-[var(--border)] xl:pl-3">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                  className="h-8 px-2 text-xs rounded-[7px] border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)]" />
                <span className="text-xs text-[var(--muted)]">até</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                  className="h-8 px-2 text-xs rounded-[7px] border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)]" />
                <button onClick={() => setDateFilter('custom')}
                  className="h-8 px-3 text-xs font-semibold rounded-[7px] text-white"
                  style={{ background: 'var(--sage-dark)' }}>Filtrar</button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-56">
                <Input placeholder="Buscar nome ou zap..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} icon={<Search className="w-4 h-4" />} className="h-9" />
              </div>
              <button onClick={handleExportCSV} title="CSV" className={btnIconCls + ' border border-[var(--border)] text-[var(--muted)] hover:text-[var(--sage-dark)] hover:border-[var(--sage)]'}>
                <Download className="w-4 h-4" />
              </button>
              <button onClick={handleExportPDF} title="PDF" className={btnIconCls + ' border border-[var(--border)] text-[var(--muted)] hover:text-[var(--sage-dark)] hover:border-[var(--sage)]'}>
                <FileText className="w-4 h-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs Leads / Arquivados ── */}
      <div className="flex border-b border-[var(--border)] gap-0">
        {([
          { key: 'leads',     label: `Leads (${filteredLeads.length})` },
          { key: 'arquivados',label: `Arquivados (${arquivados.length})` },
        ] as { key: TabLeads; label: string }[]).map(tab => (
          <button key={tab.key} onClick={() => { setTabLeads(tab.key); setSearchTerm(''); }}
            className="pb-3 px-1 mr-6 text-sm font-medium border-b-2 transition-colors -mb-px"
            style={{
              borderBottomColor: tabLeads === tab.key ? 'var(--sage-dark)' : 'transparent',
              color: tabLeads === tab.key ? 'var(--sage-dark)' : 'var(--muted)',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Chips de filtro (só na aba leads) ── */}
      {tabLeads === 'leads' && (
        <div className="flex flex-wrap gap-1.5">
          {FILTER_CHIPS.map(({ key, label }) => {
            const count = chipCounts[key] ?? 0;
            const active = filtroStatus === key;
            return (
              <button key={key} onClick={() => setFiltroStatus(key)}
                className="px-3 py-1.5 text-xs font-medium rounded-full border transition-colors"
                style={active
                  ? { background: 'var(--sage-dark)', color: '#fff', borderColor: 'var(--sage-dark)' }
                  : { background: 'var(--white)', color: 'var(--ink)', borderColor: 'var(--border)' }}>
                {label} <span className={active ? 'opacity-70' : 'text-[var(--muted)]'}>({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Tabela de leads ativos ── */}
      {tabLeads === 'leads' && (
        <div className={cardCls + ' overflow-x-auto'}>
          <table className="w-full text-sm min-w-[860px]">
            <thead className="border-b border-[var(--border)]" style={{ background: 'var(--sage-xlight)' }}>
              <tr>
                <th className={thCls}>Nome</th>
                <th className={thCls}>Pipeline</th>
                <th className={thCls}>Motivo</th>
                <th className={thCls}>Tentativas</th>
                <th className={thCls}>Próximo contato</th>
                <th className={thCls}>Início</th>
                <th className={thCls + ' text-right'}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-16 text-center text-sm text-[var(--muted)]">Carregando...</td></tr>
              ) : filteredLeads.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-sm text-[var(--muted)]">Nenhum lead encontrado para este filtro.</td></tr>
              ) : filteredLeads.map(lead => {
                const pc = proximoContatoDisplay(lead.proximo_contato);
                const tentativas = lead.tentativas || 0;
                const podeConverter = lead.status === 'agendado' || lead.status === 'reagendado';
                const motBadge = lead.motivo ? MOTIVO_BADGE[lead.motivo] : null;

                return (
                  <tr key={lead.id}
                    onClick={() => { setSelectedLead(lead); setOpenLeadDetails(true); }}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--sage-xlight)] transition-colors cursor-pointer group">

                    {/* Nome */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, var(--sage-dark), var(--sage))' }}>
                          {getInitials(lead.nome_lead)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--ink)] truncate text-sm">{lead.nome_lead || 'Sem Nome'}</p>
                          <p className="text-[11px] text-[var(--muted)] font-mono truncate">{lead.whatsapp_lead}</p>
                        </div>
                      </div>
                    </td>

                    {/* Pipeline */}
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <Badge variant={lead.status as any}>{lead.status}</Badge>
                    </td>

                    {/* Motivo (editável inline) */}
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <select
                        value={lead.motivo || ''}
                        onChange={e => atualizarMotivo(lead, e.target.value)}
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full border-0 focus:outline-none focus:ring-1 cursor-pointer"
                        style={{
                          background: motBadge ? motBadge.bg : 'var(--sage-xlight)',
                          color: motBadge ? motBadge.color : 'var(--muted)',
                          focusRingColor: 'var(--sage)',
                        } as React.CSSProperties}
                      >
                        <option value="">— sem motivo —</option>
                        {MOTIVO_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>

                    {/* Tentativas */}
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {[0, 1, 2].map(i => (
                          <span key={i} className="w-2.5 h-2.5 rounded-full"
                            style={{ background: i < tentativas ? 'var(--sage)' : 'var(--border)' }} />
                        ))}
                        {tentativas >= 3 && (
                          <span className="text-[9px] font-bold ml-1 px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
                            3×
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Próximo contato */}
                    <td className="px-3 py-3">
                      <span className="text-xs font-medium" style={{ color: pc.color }}>{pc.text}</span>
                    </td>

                    {/* Início */}
                    <td className="px-3 py-3 text-xs text-[var(--muted)] whitespace-nowrap">
                      {lead.inicio_atendimento ? format(parseISO(lead.inicio_atendimento), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                    </td>

                    {/* Ações */}
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5 justify-end">
                        {/* Registrar tentativa */}
                        <button onClick={() => registrarTentativa(lead)} title="Registrar tentativa de contato"
                          disabled={tentativas >= 3}
                          className={btnIconCls + ' disabled:opacity-30'}
                          style={{ background: 'var(--sage-xlight)', color: 'var(--sage-dark)' }}>
                          <Check className="w-3.5 h-3.5" />
                        </button>

                        {/* Abrir no Inbox */}
                        {lead.whatsapp_lead && (
                          <button onClick={() => navigate('/inbox', { state: { lead_id: lead.id } })} title="Abrir no Inbox"
                            className={btnIconCls} style={{ background: 'var(--sage-xlight)', color: 'var(--sage-dark)' }}>
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Converteu */}
                        {podeConverter && (
                          <button onClick={() => setLeadConverteu(lead)} title="Marcar como converteu"
                            className={btnIconCls} style={{ background: 'rgba(15,110,86,0.1)', color: 'var(--sage-dark)' }}>
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Arquivar */}
                        <button onClick={() => setLeadArquivar(lead)} title="Arquivar lead"
                          className={btnIconCls} style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tabela de arquivados ── */}
      {tabLeads === 'arquivados' && (
        <div className={cardCls + ' overflow-x-auto'}>
          <table className="w-full text-sm min-w-[720px]">
            <thead className="border-b border-[var(--border)]" style={{ background: 'var(--sage-xlight)' }}>
              <tr>
                <th className={thCls}>Nome</th>
                <th className={thCls}>Motivo</th>
                <th className={thCls}>Observação</th>
                <th className={thCls}>Arquivado em</th>
                <th className={thCls + ' text-right'}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredArquivados.length === 0 ? (
                <tr><td colSpan={5} className="py-16 text-center text-sm text-[var(--muted)]">Nenhum lead arquivado.</td></tr>
              ) : filteredArquivados.map(lead => (
                <tr key={lead.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--sage-xlight)] transition-colors">
                  {/* Nome */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #94a3b8, #64748b)' }}>
                        {getInitials(lead.nome_lead)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--ink)] truncate text-sm">{lead.nome_lead || 'Sem Nome'}</p>
                        <p className="text-[11px] text-[var(--muted)] font-mono">{lead.whatsapp_lead || '—'}</p>
                      </div>
                    </div>
                  </td>

                  {/* Motivo arquivamento */}
                  <td className="px-3 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(100,116,139,0.1)', color: '#64748b' }}>
                      {lead.motivo_arquivamento || '—'}
                    </span>
                  </td>

                  {/* Observação */}
                  <td className="px-3 py-3 text-xs text-[var(--muted)] max-w-[200px] truncate">
                    {lead.observacao_arquivamento || '—'}
                  </td>

                  {/* Arquivado em */}
                  <td className="px-3 py-3 text-xs text-[var(--muted)] whitespace-nowrap">
                    {lead.arquivado_em ? format(parseISO(lead.arquivado_em), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—'}
                  </td>

                  {/* Ações */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => setLeadReativar(lead)} title="Reativar lead"
                        className={btnIconCls + ' flex items-center gap-1.5 px-2.5 text-xs font-semibold'}
                        style={{ background: 'var(--sage-xlight)', color: 'var(--sage-dark)' }}>
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reativar
                      </button>
                      <button onClick={() => setLeadHistorico(lead)} title="Ver histórico"
                        className={btnIconCls} style={{ background: 'var(--sage-xlight)', color: 'var(--muted)' }}>
                        <History className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
