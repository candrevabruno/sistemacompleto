import React, { useState, useEffect } from 'react';
import { useVisibilityRefresh } from '../hooks/useVisibilityRefresh';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useClinic } from '../contexts/ClinicContext';
import { Modal } from '../components/ui/Modal';
import {
  Search, Download, FileText, Archive,
  RotateCcw, MessageSquare, History, CalendarCheck, ClipboardList,
  Trash2, CheckCircle2,
} from 'lucide-react';
import {
  parseISO, format,
  addDays, addHours,
  startOfToday, endOfToday, startOfYesterday, endOfYesterday,
  subDays, startOfMonth, endOfMonth, startOfYear, endOfYear,
  isToday, isTomorrow,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LeadDetailsModal } from '../components/crm/LeadDetailsModal';
import { calcularTemperatura, getInitials } from '../lib/lead-utils';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type DateFilter = 'ontem' | 'hoje' | '7dias' | '14dias' | 'mes' | 'ano' | 'custom';
type TabLeads = 'leads' | 'agendados_hoje' | 'confirmados' | 'arquivados';
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

// Ordenação de temperatura para sort
const TEMP_ORDER: Record<string, number> = { quente: 0, esfriando: 1, morno: 1, novo: 2, frio: 3 };

function getLeadTemp(lead: any): string {
  return lead.score_temperatura || calcularTemperatura(lead);
}

function tempDot(lead: any): string {
  const t = getLeadTemp(lead);
  if (t === 'quente')               return '#dc2626';
  if (t === 'esfriando' || t === 'morno') return '#d97706';
  if (t === 'novo')                 return 'var(--sage-dark)';
  return '#cbd5e1';
}

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
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'var(--rose-light)', border: '1px solid rgba(139,68,68,0.15)', borderRadius: 'var(--r-xs)', padding: '12px 14px', cursor: 'pointer' }}>
          <input type="checkbox" checked={lgpd} onChange={e => setLgpd(e.target.checked)}
            style={{ width: '16px', height: '16px', borderRadius: '4px', marginTop: '1px', accentColor: 'var(--rose-text)', flexShrink: 0 } as React.CSSProperties} />
          <div>
            <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--rose-text)' }}>Paciente solicitou exclusão dos dados (LGPD)</div>
            <div style={{ fontSize: '11px', color: 'var(--rose-text)', opacity: 0.75, marginTop: '3px', lineHeight: 1.5 }}>Nome, telefone e e-mail serão anonimizados.</div>
          </div>
        </label>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', padding: '8px 16px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={() => motivo && onConfirm(motivo, obs, lgpd)} disabled={!motivo}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#64748b', color: 'white', border: 'none', borderRadius: 'var(--r-xs)', padding: '8px 16px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: motivo ? 1 : 0.4 }}>
            <Archive className="w-3.5 h-3.5" /> Arquivar
          </button>
        </div>
      </div>
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
        <div style={{ padding: '10px 12px', background: 'var(--sage-xlight)', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', fontSize: '12px', fontWeight: 500, color: 'var(--sage-dark)' }}>
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
  const { config } = useClinic();
  const navigate = useNavigate();

  const [tabLeads, setTabLeads] = useState<TabLeads>('leads');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Filtro de data — usado só no modo clientes e nos exports
  const [dateFilter, setDateFilter] = useState<DateFilter>('hoje');
  const [dateRange, setDateRange] = useState({ start: startOfToday(), end: endOfToday() });
  const [customStart, setCustomStart] = useState(format(startOfToday(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(endOfToday(), 'yyyy-MM-dd'));

  const [leads, setLeads] = useState<any[]>([]);
  const [arquivados, setArquivados] = useState<any[]>([]);
  const [agendadosHoje, setAgendadosHoje] = useState<any[]>([]);
  const [loadingAgendados, setLoadingAgendados] = useState(false);
  const [confirmados, setConfirmados] = useState<any[]>([]);
  const [loadingConfirmados, setLoadingConfirmados] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [leadArquivar, setLeadArquivar] = useState<any | null>(null);
  const [leadReativar, setLeadReativar] = useState<any | null>(null);
  const [leadApagar, setLeadApagar] = useState<any | null>(null);
  const [confirmTextApagar, setConfirmTextApagar] = useState('');
  const [apagando, setApagando] = useState(false);
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [openLeadDetails, setOpenLeadDetails] = useState(false);

  // ── Filtro de data (para clientes) ────────────────────────────────────────
  useEffect(() => { applyFilter(dateFilter); }, [dateFilter]);

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

  // ── Leads: sem filtro de data — sempre todos ativos ───────────────────────
  useEffect(() => {
    if (mode === 'leads' || !mode) {
      fetchLeads();
      fetchArquivados();
      fetchAgendadosHoje();
      fetchConfirmados();
    }
  }, [tabLeads]);

  // ── Clientes: com filtro de data ──────────────────────────────────────────
  useEffect(() => {
    if (mode === 'clientes') fetchClientes();
  }, [dateRange]);

  useVisibilityRefresh(() => {
    if (mode === 'leads' || !mode) { fetchLeads(); fetchArquivados(); fetchAgendadosHoje(); fetchConfirmados(); }
    else fetchClientes();
  });

  useEffect(() => {
    const ch = supabase.channel('leads-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        if (mode === 'leads' || !mode) { fetchLeads(); fetchArquivados(); }
        else fetchClientes();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase.from('leads')
      .select('*')
      .neq('status', 'arquivado')
      .neq('status', 'converteu');
    if (data) setLeads(data);
    setLoading(false);
  };

  const fetchArquivados = async () => {
    const { data } = await supabase.from('leads')
      .select('*')
      .eq('status', 'arquivado')
      .order('arquivado_em', { ascending: false, nullsFirst: false });
    if (data) setArquivados(data);
  };

  const fetchAgendadosHoje = async () => {
    setLoadingAgendados(true);
    const { data } = await supabase
      .from('agendamentos')
      .select('id, data_hora_inicio, status, lead_id, nome_lead, agenda_id, agendas:agenda_id(nome), leads:lead_id(id, nome_lead, whatsapp_lead, status)')
      .gte('data_hora_inicio', startOfToday().toISOString())
      .lte('data_hora_inicio', endOfToday().toISOString())
      .not('status', 'in', '("cancelado","cancelou_agendamento","reagendado")')
      .order('data_hora_inicio', { ascending: true });

    if (data) {
      // Enriquecer com status de anamnese quando Tally configurado
      const tallyId = config?.tally_formulario_id;
      if (tallyId) {
        const leadIds = data.map((ag: any) => ag.lead_id).filter(Boolean);
        const { data: subs } = leadIds.length
          ? await supabase.from('form_submissions').select('lead_id').in('lead_id', leadIds)
          : { data: [] };
        const comAnamnese = new Set((subs || []).map((s: any) => s.lead_id));
        setAgendadosHoje(data.map((ag: any) => ({ ...ag, anamnese_ok: comAnamnese.has(ag.lead_id) })));
      } else {
        setAgendadosHoje(data);
      }
    }
    setLoadingAgendados(false);
  };

  // Consultas futuras confirmadas pela paciente na confirmação de 48h (WF03
  // grava agendamentos.status='confirmado' quando ela responde SIM).
  const fetchConfirmados = async () => {
    setLoadingConfirmados(true);
    const { data } = await supabase
      .from('agendamentos')
      .select('id, data_hora_inicio, status, lead_id, nome_lead, agenda_id, modalidade, agendas:agenda_id(nome), leads:lead_id(id, nome_lead, whatsapp_lead, status)')
      .eq('status', 'confirmado')
      .gte('data_hora_inicio', startOfToday().toISOString())
      .order('data_hora_inicio', { ascending: true });
    if (data) setConfirmados(data);
    setLoadingConfirmados(false);
  };

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
  };

  const confirmarReativacao = async () => {
    if (!leadReativar || !user) return;
    const lead = leadReativar;
    await supabase.from('leads').update({
      status: 'iniciou_atendimento',
      arquivado_em: null, arquivado_por: null,
      motivo_arquivamento: null, observacao_arquivamento: null, lgpd_exclusao: false,
    }).eq('id', lead.id);
    await supabase.from('audit_log').insert({ user_id: user.id, action: 'lead_reativado', record_id: lead.id, detalhes: { timestamp: new Date().toISOString() } });
    setLeadReativar(null);
    fetchArquivados();
    fetchLeads();
  };

  // Apagar lead definitivamente (mesma RPC usada em Pacientes — remove lead,
  // conversas, agendamentos e demais registros vinculados). Restrito a admin.
  const confirmarApagarLead = async () => {
    if (!leadApagar || !user || apagando) return;
    setApagando(true);
    // Auditoria ANTES de apagar (o record_id deixa de existir depois).
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'lead_apagado',
      record_id: leadApagar.id,
      detalhes: { nome: leadApagar.nome_lead, whatsapp: leadApagar.whatsapp_lead },
    });
    const { error } = await supabase.rpc('apagar_paciente_completo', { p_lead_id: leadApagar.id });
    setApagando(false);
    if (error) { alert('Erro ao apagar: ' + error.message); return; }
    setLeadApagar(null);
    setConfirmTextApagar('');
    fetchLeads();
    fetchArquivados();
  };

  const atualizarMotivo = async (lead: any, novoMotivo: string) => {
    const now = new Date();
    const proximoContato = novoMotivo ? calcularProximoContato(novoMotivo, now).toISOString() : null;
    await supabase.from('leads').update({ motivo: novoMotivo || null, proximo_contato: proximoContato, tentativas: 0 }).eq('id', lead.id);
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, motivo: novoMotivo || null, proximo_contato: proximoContato, tentativas: 0 } : l));
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const data = tabLeads === 'arquivados' ? filteredArquivados : sortedFilteredLeads;
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
    if (!sortedFilteredLeads.length) return alert('Nenhum dado para exportar.');
    const doc = new jsPDF('landscape');
    doc.setFontSize(16); doc.text('Relatório de Leads', 14, 20);
    doc.setFontSize(10); doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
    autoTable(doc, {
      startY: 33,
      head: [['Nome', 'WhatsApp', 'Pipeline', 'Motivo', 'Tentativas', 'Próximo contato', 'Início']],
      body: sortedFilteredLeads.map(l => [
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

  // Ordenação: temperatura (quente primeiro) + próximo contato
  const sortedFilteredLeads = [...filteredLeads].sort((a, b) => {
    const tA = TEMP_ORDER[getLeadTemp(a)] ?? 3;
    const tB = TEMP_ORDER[getLeadTemp(b)] ?? 3;
    if (tA !== tB) return tA - tB;
    if (!a.proximo_contato && !b.proximo_contato) return 0;
    if (!a.proximo_contato) return 1;
    if (!b.proximo_contato) return -1;
    return new Date(a.proximo_contato).getTime() - new Date(b.proximo_contato).getTime();
  });

  const filteredArquivados = arquivados.filter(lead => {
    const term = searchTerm.toLowerCase();
    return !term || lead.nome_lead?.toLowerCase().includes(term) || lead.whatsapp_lead?.includes(term);
  });

  const chipCounts: Record<string, number> = {
    todos:          leads.length,
    cancelou:       leads.filter(l => l.motivo === 'cancelou').length,
    'no-show':      leads.filter(l => l.motivo === 'no-show').length,
    abandonou:      leads.filter(l => l.motivo === 'abandonou').length,
    reativacao:     leads.filter(l => l.motivo === 'reativação').length,
    'sem-resposta': leads.filter(l => l.motivo === 'sem resposta').length,
    reagendado:     leads.filter(l => l.status === 'reagendado').length,
  };

  // ── Render: modo clientes ─────────────────────────────────────────────────
  if (mode === 'clientes') {
    const filteredClientes = clientes.filter(p => {
      const term = searchTerm.toLowerCase();
      return p.leads?.nome_lead?.toLowerCase().includes(term) || p.leads?.whatsapp_lead?.includes(term);
    });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 'calc(100vh - 100px)', background: 'var(--bg)', paddingBottom: '40px' }}>
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {(['ontem','hoje','7dias','14dias','mes','ano'] as DateFilter[]).map(f => (
              <button key={f} onClick={() => setDateFilter(f)}
                style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: dateFilter === f ? 'var(--sage-dark)' : 'var(--sage-xlight)', color: dateFilter === f ? 'white' : 'var(--ink)', border: dateFilter === f ? '1px solid var(--sage-dark)' : '1px solid transparent' }}>
                {f === 'ontem' ? 'Ontem' : f === 'hoje' ? 'Hoje' : f === '7dias' ? '7 dias' : f === '14dias' ? '14 dias' : f === 'mes' ? 'Mês' : 'Ano'}
              </button>
            ))}
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search style={{ position: 'absolute', left: '10px', width: '14px', height: '14px', color: 'var(--muted)', pointerEvents: 'none' }} />
            <input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '32px', paddingRight: '10px', paddingTop: '6px', paddingBottom: '6px', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', fontSize: '12.5px', color: 'var(--ink)', background: 'var(--white)', outline: 'none', width: '200px', fontFamily: 'inherit' }} />
          </div>
        </div>
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
                <tr key={c.id} onMouseEnter={e => (e.currentTarget.style.background = 'var(--sage-xlight)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} style={{ borderBottom: '1px solid var(--border)', cursor: 'default' }}>
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
    { key: 'todos',        label: 'Todos' },
    { key: 'cancelou',     label: 'Cancelou' },
    { key: 'no-show',      label: 'No-show' },
    { key: 'abandonou',    label: 'Abandonou' },
    { key: 'reativacao',   label: 'Reativação' },
    { key: 'sem-resposta', label: 'Sem resposta' },
    { key: 'reagendado',   label: 'Reagendado' },
  ];

  const tabs: { key: TabLeads; label: string }[] = [
    { key: 'leads',           label: `Leads (${sortedFilteredLeads.length})` },
    { key: 'agendados_hoje',  label: `Agendados hoje (${agendadosHoje.length})` },
    { key: 'confirmados',     label: `Confirmados (${confirmados.length})` },
    { key: 'arquivados',      label: `Arquivados (${arquivados.length})` },
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
            Todos os leads ativos — ordenados por temperatura e próximo contato
          </p>
        </div>
      </div>

      {/* ── Busca + export + filtros de status ── */}
      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Chips de status */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {FILTER_CHIPS.map(({ key, label }) => {
            const count = chipCounts[key] ?? 0;
            const active = filtroStatus === key;
            return (
              <button key={key} onClick={() => setFiltroStatus(key)}
                style={{ padding: '4px 11px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: active ? 'var(--sage-dark)' : 'var(--white)', color: active ? 'white' : 'var(--muted)', border: active ? '1px solid var(--sage-dark)' : '1px solid var(--border-md)' }}>
                {label} ({count})
              </button>
            );
          })}
        </div>
        {/* Busca + export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search style={{ position: 'absolute', left: '10px', width: '13px', height: '13px', color: 'var(--muted)', pointerEvents: 'none' }} />
            <input placeholder="Buscar nome ou zap..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '30px', paddingRight: '10px', paddingTop: '6px', paddingBottom: '6px', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', fontSize: '12px', color: 'var(--ink)', background: 'var(--white)', outline: 'none', width: '200px', fontFamily: 'inherit' }} />
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
            style={{ padding: '8px 14px', fontSize: '12px', fontWeight: tabLeads === tab.key ? 600 : 400, color: tabLeads === tab.key ? 'var(--sage-dark)' : 'var(--muted)', marginBottom: '-1px', cursor: 'pointer', background: 'none', border: 'none', borderBottomWidth: '2px', borderBottomStyle: 'solid', borderBottomColor: tabLeads === tab.key ? 'var(--sage-dark)' : 'transparent', fontFamily: 'inherit' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tabela de leads ativos ── */}
      {tabLeads === 'leads' && (
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
              <thead>
                <tr>
                  {['Nome', 'Estágio', 'Motivo', 'Tentativas', 'Próximo contato', 'Início', 'Ações'].map((h, i) => (
                    <th key={h} style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', padding: '10px 14px', textAlign: i === 6 ? 'right' : 'left', borderBottom: '1px solid var(--border)', background: 'var(--bg)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: '64px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>Carregando...</td></tr>
                ) : sortedFilteredLeads.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '64px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>Nenhum lead encontrado para este filtro.</td></tr>
                ) : sortedFilteredLeads.map(lead => {
                  const pc = proximoContatoDisplay(lead.proximo_contato);
                  const tentativas = lead.tentativas || 0;
                  const motBadge = lead.motivo ? MOTIVO_BADGE[lead.motivo] : null;
                  const dot = tempDot(lead);

                  return (
                    <tr key={lead.id}
                      onClick={() => { setSelectedLead(lead); setOpenLeadDetails(true); }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--sage-xlight)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>

                      {/* Nome + dot temperatura */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dot, flexShrink: 0 }} />
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0, background: 'var(--champ-light)', color: 'var(--champ-text)' }}>
                            {getInitials(lead.nome_lead)}
                          </div>
                          <div>
                            <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink)' }}>{lead.nome_lead || 'Sem Nome'}</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>{lead.whatsapp_lead}</div>
                          </div>
                        </div>
                      </td>

                      {/* Estágio */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 500, background: 'var(--champ-light)', color: 'var(--champ-text)' }}>
                          {lead.status}
                        </span>
                      </td>

                      {/* Motivo (editável inline) */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                        <select value={lead.motivo || ''} onChange={e => atualizarMotivo(lead, e.target.value)}
                          style={{ fontSize: '10.5px', fontWeight: 500, padding: '3px 8px', borderRadius: '20px', border: 'none', outline: 'none', cursor: 'pointer', fontFamily: 'inherit', background: motBadge ? motBadge.bg : 'var(--sage-xlight)', color: motBadge ? motBadge.color : 'var(--muted)' }}>
                          <option value="">— sem motivo —</option>
                          {MOTIVO_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </td>

                      {/* Tentativas */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          {[0, 1, 2].map(i => (
                            <span key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: i < tentativas ? 'var(--sage-dark)' : 'var(--border-md)', display: 'inline-block' }} />
                          ))}
                          {tentativas >= 3 && (
                            <span style={{ fontSize: '9px', fontWeight: 700, marginLeft: '2px', padding: '1px 5px', borderRadius: '20px', background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
                              {tentativas}×
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Próximo contato */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 500, color: pc.color }}>{pc.text}</span>
                      </td>

                      {/* Início */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle', fontSize: '11.5px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {lead.inicio_atendimento ? format(parseISO(lead.inicio_atendimento), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                      </td>

                      {/* Ações */}
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end' }}>
                          {lead.whatsapp_lead && (
                            <button onClick={() => navigate('/inbox', { state: { lead_id: lead.id } })} title="Abrir no Inbox"
                              style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'var(--sage-xlight)', color: 'var(--sage-dark)', flexShrink: 0 }}>
                              <MessageSquare style={{ width: '13px', height: '13px' }} />
                            </button>
                          )}
                          <button onClick={() => setLeadArquivar(lead)} title="Arquivar lead"
                            style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'rgba(100,116,139,0.08)', color: '#64748b', flexShrink: 0 }}>
                            <Archive style={{ width: '13px', height: '13px' }} />
                          </button>
                          {isAdmin && (
                            <button onClick={() => { setConfirmTextApagar(''); setLeadApagar(lead); }} title="Apagar lead definitivamente"
                              style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'var(--rose-light)', color: 'var(--rose-text)', flexShrink: 0 }}>
                              <Trash2 style={{ width: '13px', height: '13px' }} />
                            </button>
                          )}
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

      {/* ── Tabela: agendados hoje ── */}
      {tabLeads === 'agendados_hoje' && (
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr>
                  {['Horário', 'Nome', 'Profissional', 'Anamnese', 'Status'].map((h, i) => (
                    <th key={h} style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', padding: '10px 14px', textAlign: i === 4 ? 'right' : 'left', borderBottom: '1px solid var(--border)', background: 'var(--bg)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingAgendados ? (
                  <tr><td colSpan={5} style={{ padding: '64px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>Carregando...</td></tr>
                ) : agendadosHoje.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '64px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <CalendarCheck style={{ width: '28px', height: '28px', color: 'var(--border-md)' }} />
                        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Nenhum lead agendado para hoje.</span>
                      </div>
                    </td>
                  </tr>
                ) : agendadosHoje.map(ag => {
                  const lead = ag.leads as any;
                  const nome = lead?.nome_lead || ag.nome_lead || 'Sem Nome';
                  const horario = format(parseISO(ag.data_hora_inicio), 'HH:mm', { locale: ptBR });
                  const profissional = (ag.agendas as any)?.nome || '—';

                  const statusBadge: Record<string, { label: string; bg: string; color: string }> = {
                    confirmado:  { label: 'Confirmado',  bg: 'rgba(34,197,94,0.12)',   color: '#15803d' },
                    pendente:    { label: 'Pendente',    bg: 'rgba(245,158,11,0.12)',  color: '#b45309' },
                    compareceu:  { label: 'Compareceu',  bg: 'rgba(34,197,94,0.2)',    color: '#166534' },
                    faltou:      { label: 'Faltou',      bg: 'rgba(239,68,68,0.1)',    color: '#dc2626' },
                  };
                  const badge = statusBadge[ag.status] || { label: ag.status, bg: 'rgba(100,116,139,0.1)', color: '#64748b' };

                  return (
                    <tr key={ag.id}
                      onClick={() => { if (ag.lead_id) { setSelectedLead({ id: ag.lead_id }); setOpenLeadDetails(true); } }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--sage-xlight)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      style={{ borderBottom: '1px solid var(--border)', cursor: ag.lead_id ? 'pointer' : 'default' }}>
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sage-dark)', fontVariantNumeric: 'tabular-nums' }}>{horario}</span>
                      </td>
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0, background: 'var(--champ-light)', color: 'var(--champ-text)' }}>
                            {getInitials(nome)}
                          </div>
                          <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink)' }}>{nome}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle', fontSize: '11.5px', color: 'var(--muted)' }}>{profissional}</td>
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                        {config?.tally_formulario_id ? (
                          ag.anamnese_ok ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 600, background: 'rgba(34,197,94,0.12)', color: '#15803d' }}>
                              <ClipboardList style={{ width: '11px', height: '11px' }} /> Preenchida
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 500, background: 'rgba(148,163,184,0.12)', color: '#64748b' }}>
                              <ClipboardList style={{ width: '11px', height: '11px' }} /> Pendente
                            </span>
                          )
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 500, background: badge.bg, color: badge.color }}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tabela: confirmados (48h) ── */}
      {tabLeads === 'confirmados' && (
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr>
                  {['Data', 'Horário', 'Nome', 'Profissional', 'Modalidade', 'Status'].map((h, i) => (
                    <th key={h} style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', padding: '10px 14px', textAlign: i === 5 ? 'right' : 'left', borderBottom: '1px solid var(--border)', background: 'var(--bg)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingConfirmados ? (
                  <tr><td colSpan={6} style={{ padding: '64px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>Carregando...</td></tr>
                ) : confirmados.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '64px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <CheckCircle2 style={{ width: '28px', height: '28px', color: 'var(--border-md)' }} />
                        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Nenhuma consulta confirmada pela paciente ainda.</span>
                      </div>
                    </td>
                  </tr>
                ) : confirmados.map(ag => {
                  const lead = ag.leads as any;
                  const nome = lead?.nome_lead || ag.nome_lead || 'Sem Nome';
                  const dataConsulta = format(parseISO(ag.data_hora_inicio), 'dd/MM/yyyy', { locale: ptBR });
                  const horario = format(parseISO(ag.data_hora_inicio), 'HH:mm', { locale: ptBR });
                  const profissional = (ag.agendas as any)?.nome || '—';

                  return (
                    <tr key={ag.id}
                      onClick={() => { if (ag.lead_id) { setSelectedLead({ id: ag.lead_id }); setOpenLeadDetails(true); } }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--sage-xlight)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      style={{ borderBottom: '1px solid var(--border)', cursor: ag.lead_id ? 'pointer' : 'default' }}>
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle', whiteSpace: 'nowrap', fontSize: '11.5px', color: 'var(--muted)' }}>
                        {dataConsulta}
                      </td>
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sage-dark)', fontVariantNumeric: 'tabular-nums' }}>{horario}</span>
                      </td>
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0, background: 'rgba(34,197,94,0.12)', color: '#15803d' }}>
                            {getInitials(nome)}
                          </div>
                          <div>
                            <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink)' }}>{nome}</div>
                            {lead?.whatsapp_lead && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>{lead.whatsapp_lead}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle', fontSize: '11.5px', color: 'var(--muted)' }}>{profissional}</td>
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle', fontSize: '11.5px', color: 'var(--muted)', textTransform: 'capitalize' }}>
                        {ag.modalidade || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 600, background: 'rgba(34,197,94,0.12)', color: '#15803d' }}>
                          <CheckCircle2 style={{ width: '11px', height: '11px' }} /> Confirmada
                        </span>
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
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '680px' }}>
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
                    onClick={() => { setSelectedLead(lead); setOpenLeadDetails(true); }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--sage-xlight)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0, background: 'rgba(100,116,139,0.1)', color: '#64748b' }}>
                          {getInitials(lead.nome_lead)}
                        </div>
                        <div>
                          <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink)' }}>{lead.nome_lead || 'Sem Nome'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>{lead.whatsapp_lead || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 500, background: 'rgba(100,116,139,0.1)', color: '#64748b' }}>
                        {lead.motivo_arquivamento || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle', fontSize: '11.5px', color: 'var(--muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lead.observacao_arquivamento || '—'}
                    </td>
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle', fontSize: '11.5px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {lead.arquivado_em ? format(parseISO(lead.arquivado_em), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setLeadReativar(lead)} title="Reativar lead"
                          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'var(--sage-xlight)', color: 'var(--sage-dark)', fontSize: '11.5px', fontWeight: 500, fontFamily: 'inherit' }}>
                          <RotateCcw style={{ width: '13px', height: '13px' }} />
                          Reativar
                        </button>
                        <button onClick={() => { setSelectedLead(lead); setOpenLeadDetails(true); }} title="Ver prontuário"
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
        onUpdate={() => { fetchLeads(); fetchArquivados(); }}
      />
      <ModalArquivar lead={leadArquivar} onConfirm={confirmarArquivamento} onClose={() => setLeadArquivar(null)} />
      <ModalReativar lead={leadReativar} onConfirm={confirmarReativacao} onClose={() => setLeadReativar(null)} />

      {/* ── Modal: apagar lead definitivamente ── */}
      <Modal isOpen={!!leadApagar} onClose={() => { setLeadApagar(null); setConfirmTextApagar(''); }} title="Apagar lead definitivamente?">
        {leadApagar && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, padding: '8px', borderRadius: '50%', background: 'var(--rose-light)', color: 'var(--rose-text)' }}>
                <Trash2 size={18} />
              </div>
              <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
                Isso remove <strong style={{ color: 'var(--ink)' }}>{leadApagar.nome_lead || 'este lead'}</strong> e
                todos os registros vinculados (conversas, agendamentos, formulários). A ação não pode ser desfeita.
              </p>
            </div>
            <div>
              <label style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: '5px' }}>
                Digite <strong>APAGAR</strong> para confirmar
              </label>
              <input value={confirmTextApagar} onChange={e => setConfirmTextApagar(e.target.value)} placeholder="APAGAR"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', fontSize: '13px', color: 'var(--ink)', fontFamily: 'inherit', background: 'var(--white)', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setLeadApagar(null); setConfirmTextApagar(''); }}
                style={{ background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', padding: '8px 16px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={confirmarApagarLead} disabled={confirmTextApagar.trim().toUpperCase() !== 'APAGAR' || apagando}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 'var(--r-xs)', padding: '8px 16px', fontSize: '12.5px', fontWeight: 500, fontFamily: 'inherit', cursor: confirmTextApagar.trim().toUpperCase() === 'APAGAR' && !apagando ? 'pointer' : 'not-allowed', opacity: confirmTextApagar.trim().toUpperCase() === 'APAGAR' && !apagando ? 1 : 0.5 }}>
                <Trash2 style={{ width: '13px', height: '13px' }} /> {apagando ? 'Apagando...' : 'Apagar definitivamente'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
