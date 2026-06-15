import React, { useEffect, useState } from 'react';
import { useVisibilityRefresh } from '../hooks/useVisibilityRefresh';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useClinic } from '../contexts/ClinicContext';
import { Search, Users, MessageSquare, CalendarPlus, ClipboardList, ExternalLink, Check, X, Clock, Loader2, Upload, UserPlus, MoreVertical, Archive, ArchiveRestore, Trash2, AlertTriangle } from 'lucide-react';
import { DadosTab } from '../components/pacientes/DadosTab';
import { ConsultasTab } from '../components/pacientes/ConsultasTab';
import { ProcedimentosTab } from '../components/pacientes/ProcedimentosTab';
import { ComportamentoTab } from '../components/pacientes/ComportamentoTab';
import { AnotacoesProfissionalTab } from '../components/pacientes/AnotacoesProfissionalTab';
import { ExperienciaPremiumTab } from '../components/pacientes/ExperienciaPremiumTab';
import { ImportarPacientesModal } from '../components/pacientes/ImportarPacientesModal';
import { NovoPacienteModal } from '../components/pacientes/NovoPacienteModal';

type Tab = 'dados' | 'consultas' | 'procedimentos' | 'comportamento' | 'profissional' | 'premium';

function getIniciais(nome: string | null | undefined): string {
  if (!nome) return '?';
  return nome.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

export function Pacientes() {
  const navigate = useNavigate();
  const { can, canEdit, user } = useAuth();
  const { config } = useClinic();
  // Importação de pacientes exige poder editar o módulo.
  const canImport = canEdit('modulo:pacientes');
  const canProfissional = can('paciente_tab:profissional');
  const canPremium = Boolean(config?.premium_enabled) && can('feature:premium');

  const [leads, setLeads] = useState<any[]>([]);
  const [leadSelecionado, setLeadSelecionado] = useState<any | null>(null);
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [proximaConsulta, setProximaConsulta] = useState<any | null>(null);
  const [calcomLink, setCalcomLink] = useState<string | null>(null);
  const [tipoConvenio, setTipoConvenio] = useState<'particular' | 'convenio'>('particular');
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('dados');
  const [viewMode, setViewMode] = useState<'todos' | 'hoje'>('todos');
  const [agendamentosHoje, setAgendamentosHoje] = useState<any[]>([]);
  const [loadingHoje, setLoadingHoje] = useState(false);
  const [marcandoId, setMarcandoId] = useState<string | null>(null);
  const [showImportar, setShowImportar] = useState(false);
  const [showNovo, setShowNovo] = useState(false);
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [confirmAcao, setConfirmAcao] = useState<'arquivar' | 'apagar' | null>(null);
  const [processando, setProcessando] = useState(false);

  const TABS: { id: Tab; label: string }[] = [
    can('paciente_tab:dados')         && { id: 'dados' as Tab,         label: 'Dados' },
    can('paciente_tab:consultas')     && { id: 'consultas' as Tab,     label: 'Consultas' },
    can('paciente_tab:procedimentos') && { id: 'procedimentos' as Tab, label: 'Procedimentos' },
    can('paciente_tab:comportamento') && { id: 'comportamento' as Tab, label: 'Comportamento' },
    canProfissional                   && { id: 'profissional' as Tab,  label: 'Anotações do Profissional' },
    canPremium                        && { id: 'premium' as Tab,       label: '✦ Experiência Premium' },
  ].filter(Boolean) as { id: Tab; label: string }[];

  // Garante que a aba ativa é uma permitida.
  useEffect(() => {
    if (TABS.length > 0 && !TABS.some(t => t.id === activeTab)) {
      setActiveTab(TABS[0].id);
    }
  }, [TABS.map(t => t.id).join(','), activeTab]);

  // Carrega lista de pacientes (leads convertidos). mostrarArquivados troca o filtro.
  const loadPacientes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('leads')
      .select('id, nome_lead, whatsapp_lead, procedimento_interesse, status, email, data_nascimento, arquivado')
      .eq('status', 'converteu')
      .eq('arquivado', mostrarArquivados)
      .order('nome_lead', { ascending: true });
    if (data) setLeads(data);
    setLoading(false);
  };

  useEffect(() => { loadPacientes(); }, [mostrarArquivados]);

  // Refresh ao voltar ao tab ou reconectar rede
  useVisibilityRefresh(loadPacientes);

  const loadAgendamentosHoje = async () => {
    setLoadingHoje(true);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end   = new Date(); end.setHours(23, 59, 59, 999);
    const { data } = await supabase
      .from('agendamentos')
      .select('id, status, data_hora_inicio, procedimento_nome, lead_id, agendas(nome), leads:lead_id(id, nome_lead, whatsapp_lead, procedimento_interesse, status, email, data_nascimento)')
      .gte('data_hora_inicio', start.toISOString())
      .lte('data_hora_inicio', end.toISOString())
      .not('status', 'in', '("cancelado","cancelou_agendamento")')
      .order('data_hora_inicio', { ascending: true });
    if (data) setAgendamentosHoje(data);
    setLoadingHoje(false);
  };

  useEffect(() => {
    if (viewMode === 'hoje') loadAgendamentosHoje();
  }, [viewMode]);

  const marcarPresenca = async (agId: string, novoStatus: 'compareceu' | 'faltou', lead: any) => {
    setMarcandoId(agId);
    await supabase.from('agendamentos').update({ status: novoStatus }).eq('id', agId);
    if (novoStatus === 'compareceu' && lead?.status !== 'converteu') {
      await supabase.from('leads').update({
        status: 'converteu',
        converteu_em: new Date().toISOString(),
      }).eq('id', lead.id);
    }
    await loadAgendamentosHoje();
    setMarcandoId(null);
  };

  // Carrega link Cal.com (primeiro agenda ativo com link)
  useEffect(() => {
    supabase.from('agendas').select('calcom_link').eq('ativo', true).not('calcom_link', 'is', null).limit(1).maybeSingle()
      .then(({ data }) => setCalcomLink(data?.calcom_link || null));
  }, []);

  const selecionarLead = async (lead: any) => {
    setLeadSelecionado(lead);
    setActiveTab('dados');
    setLoadingProfile(true);
    setPacienteId(null);
    setProximaConsulta(null);

    // Buscar/criar paciente
    let { data: paciente } = await supabase
      .from('pacientes').select('id, tipo').eq('lead_id', lead.id).single();

    if (!paciente) {
      const { data: novo } = await supabase
        .from('pacientes').insert({ lead_id: lead.id }).select('id, tipo').single();
      paciente = novo;
    }
    if (paciente) {
      setPacienteId(paciente.id);
      setTipoConvenio(paciente.tipo || 'particular');
    }

    // Próxima consulta para o badge do header
    const { data: ag } = await supabase
      .from('agendamentos')
      .select('status, data_hora_inicio')
      .eq('lead_id', lead.id)
      .gte('data_hora_inicio', new Date().toISOString())
      .not('status', 'in', '("cancelado","faltou")')
      .order('data_hora_inicio', { ascending: true })
      .limit(1)
      .maybeSingle();
    setProximaConsulta(ag || null);

    setLoadingProfile(false);
  };

  // ── Arquivar / Restaurar / Apagar paciente ──────────────────────
  const limparSelecao = () => {
    setLeadSelecionado(null);
    setPacienteId(null);
    setProximaConsulta(null);
  };

  const arquivarPaciente = async () => {
    if (!leadSelecionado || !user) return;
    setProcessando(true);
    const arquivar = !mostrarArquivados; // na lista de arquivados, a ação é restaurar
    await supabase.from('leads').update({
      arquivado: arquivar,
      arquivado_em: arquivar ? new Date().toISOString() : null,
    }).eq('id', leadSelecionado.id);
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: arquivar ? 'paciente_arquivado' : 'paciente_restaurado',
      record_id: leadSelecionado.id,
      detalhes: { nome: leadSelecionado.nome_lead },
    });
    setProcessando(false);
    setConfirmAcao(null);
    setMenuAberto(false);
    limparSelecao();
    await loadPacientes();
  };

  const apagarPaciente = async () => {
    if (!leadSelecionado || !user) return;
    setProcessando(true);
    // Auditoria ANTES de apagar (o record_id deixa de existir depois).
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'paciente_apagado',
      record_id: leadSelecionado.id,
      detalhes: { nome: leadSelecionado.nome_lead, whatsapp: leadSelecionado.whatsapp_lead, paciente_id: pacienteId },
    });
    const { error } = await supabase.rpc('apagar_paciente_completo', { p_lead_id: leadSelecionado.id });
    setProcessando(false);
    setConfirmAcao(null);
    setMenuAberto(false);
    if (error) { alert('Erro ao apagar: ' + error.message); return; }
    limparSelecao();
    await loadPacientes();
  };

  const abrirAgendamento = () => {
    if (!calcomLink || !leadSelecionado) return;
    const nome = encodeURIComponent(leadSelecionado.nome_lead || '');
    const phone = encodeURIComponent(leadSelecionado.whatsapp_lead || '');
    const email = encodeURIComponent(leadSelecionado.email || '');
    const url = `${calcomLink}?name=${nome}&phone=${phone}${email ? `&email=${email}` : ''}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const leadsFiltrados = leads.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.nome_lead?.toLowerCase().includes(q) || l.whatsapp_lead?.includes(q) || l.procedimento_interesse?.toLowerCase().includes(q);
  });

  // Badge da próxima consulta
  const BADGE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
    confirmado: { label: 'Confirmou',  color: '#065F46', bg: 'rgba(16,185,129,0.15)' },
    reagendado: { label: 'Reagendou',  color: '#92400E', bg: 'rgba(245,158,11,0.15)' },
    cancelado:  { label: 'Cancelou',   color: '#991B1B', bg: 'rgba(220,38,38,0.15)'  },
    agendado:   { label: 'Agendado',   color: 'var(--sage-dark)', bg: 'var(--sage-xlight)' },
  };
  const nextBadge = proximaConsulta ? BADGE_STATUS[proximaConsulta.status] || BADGE_STATUS.agendado : null;

  return (
    <div
      className="flex h-[calc(100vh-60px)] -m-6 overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      {/* ── Lista lateral ── */}
      <div
        style={{
          width: '240px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--border)',
          background: 'var(--white)',
        }}
      >
        {/* Header da lista */}
        <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <h2 className="font-display" style={{ fontSize: '18px', fontWeight: 300, fontStyle: 'italic', color: 'var(--ink)', letterSpacing: '-0.2px' }}>
              Pacientes
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: 'var(--sage-xlight)', color: 'var(--sage-dark)' }}>
                {viewMode === 'hoje' ? agendamentosHoje.length : leads.length}
              </span>
              {canImport && (
                <>
                  <button
                    onClick={() => setShowNovo(true)}
                    title="Adicionar paciente manualmente"
                    style={{ display: 'flex', alignItems: 'center', padding: '3px 8px', fontSize: '10.5px', fontWeight: 600, background: 'var(--sage-dark)', color: 'white', border: 'none', borderRadius: 'var(--r-xs)', cursor: 'pointer', fontFamily: 'inherit', gap: '3px' }}
                  >
                    <UserPlus style={{ width: '10px', height: '10px' }} />
                    Adicionar
                  </button>
                  <button
                    onClick={() => setShowImportar(true)}
                    title="Importar pacientes (CSV)"
                    style={{ display: 'flex', alignItems: 'center', padding: '3px 7px', fontSize: '10.5px', fontWeight: 500, background: 'var(--champ-light)', color: 'var(--champ-text)', border: 'none', borderRadius: 'var(--r-xs)', cursor: 'pointer', fontFamily: 'inherit', gap: '3px' }}
                  >
                    <Upload style={{ width: '10px', height: '10px' }} />
                    CSV
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Toggle Todos / Hoje */}
          <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 'var(--r-xs)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '8px' }}>
            {(['todos', 'hoje'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  fontSize: '11.5px',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  border: 'none',
                  background: viewMode === mode ? 'var(--sage-dark)' : 'transparent',
                  color: viewMode === mode ? 'white' : 'var(--muted)',
                  transition: 'background 0.12s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                {mode === 'hoje' && <Clock style={{ width: '10px', height: '10px' }} />}
                {mode === 'todos' ? 'Todos' : 'Hoje'}
              </button>
            ))}
          </div>

          {/* Toggle Ativos / Arquivados — apenas no modo Todos */}
          {viewMode === 'todos' && canImport && (
            <button
              onClick={() => { setMostrarArquivados(v => !v); limparSelecao(); }}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px', padding: '3px 8px', fontSize: '10.5px', fontWeight: 500, background: mostrarArquivados ? 'var(--champ-light)' : 'transparent', color: mostrarArquivados ? 'var(--champ-text)' : 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <Archive style={{ width: '10px', height: '10px' }} />
              {mostrarArquivados ? 'Ver ativos' : 'Ver arquivados'}
            </button>
          )}

          {/* Search — apenas no modo Todos */}
          {viewMode === 'todos' && (
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', width: '13px', height: '13px', color: 'var(--muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Buscar paciente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', padding: '6px 10px 6px 28px', fontSize: '12.5px', color: 'var(--ink)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          )}
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {viewMode === 'todos' ? (
            /* ── Lista de pacientes (Todos) ── */
            loading ? (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '12.5px', color: 'var(--muted)' }}>Carregando...</div>
            ) : leadsFiltrados.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '24px', gap: '10px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sage-xlight)' }}>
                  <Users style={{ width: '18px', height: '18px', color: 'var(--sage-dark)' }} />
                </div>
                <p style={{ fontSize: '12px', textAlign: 'center', color: 'var(--muted)', fontStyle: 'italic' }}>
                  {search ? 'Nenhum paciente encontrado' : 'Nenhum paciente ainda'}
                </p>
              </div>
            ) : (
              leadsFiltrados.map(lead => {
                const isSelected = leadSelecionado?.id === lead.id;
                return (
                  <button
                    key={lead.id}
                    onClick={() => selecionarLead(lead)}
                    className="w-full text-left"
                    style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '10px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isSelected ? 'var(--sage-xlight)' : 'transparent', borderLeft: isSelected ? '3px solid var(--sage-dark)' : '3px solid transparent' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--sage-xlight)'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0, background: 'var(--sage-xlight)', color: 'var(--sage-dark)' }}>
                      {getIniciais(lead.nome_lead)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {lead.nome_lead || 'Sem nome'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lead.procedimento_interesse || lead.whatsapp_lead || '—'}
                      </div>
                    </div>
                  </button>
                );
              })
            )
          ) : (
            /* ── Pacientes do Dia (Hoje) ── */
            loadingHoje ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                <Loader2 size={18} className="animate-spin" style={{ color: 'var(--muted)' }} />
              </div>
            ) : agendamentosHoje.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '24px', gap: '10px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sage-xlight)' }}>
                  <Clock style={{ width: '18px', height: '18px', color: 'var(--sage-dark)' }} />
                </div>
                <p style={{ fontSize: '12px', textAlign: 'center', color: 'var(--muted)', fontStyle: 'italic' }}>Nenhum agendamento hoje</p>
              </div>
            ) : (
              agendamentosHoje.map(ag => {
                const lead = ag.leads;
                const isSelected = leadSelecionado?.id === lead?.id;
                const hora = ag.data_hora_inicio
                  ? new Date(ag.data_hora_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : '—';
                const isPending = ['agendado', 'confirmado', 'reagendado'].includes(ag.status);
                const isMarcando = marcandoId === ag.id;

                const statusCfg: Record<string, { label: string; bg: string; color: string }> = {
                  compareceu: { label: '✓ Compareceu', bg: 'var(--sage-xlight)',  color: 'var(--sage-dark)'  },
                  faltou:     { label: '✗ Faltou',      bg: 'var(--rose-light)',  color: 'var(--rose-text)'  },
                  agendado:   { label: 'Agendado',       bg: 'var(--champ-light)', color: 'var(--champ-text)' },
                  confirmado: { label: 'Confirmado',     bg: 'var(--sage-xlight)', color: 'var(--sage-dark)'  },
                  reagendado: { label: 'Reagendado',     bg: 'var(--champ-light)', color: 'var(--champ-text)' },
                };
                const badge = statusCfg[ag.status] || statusCfg.agendado;

                return (
                  <div
                    key={ag.id}
                    style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: isSelected ? 'var(--sage-xlight)' : 'transparent', borderLeft: isSelected ? '3px solid var(--sage-dark)' : '3px solid transparent', cursor: 'pointer' }}
                    onClick={() => lead && selecionarLead(lead)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sage-dark)', flexShrink: 0 }}>{hora}</span>
                      <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lead?.nome_lead || 'Paciente'}
                      </span>
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--muted)', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ag.procedimento_nome || ag.agendas?.nome || '—'}
                    </div>
                    {isPending ? (
                      <div style={{ display: 'flex', gap: '5px' }} onClick={e => e.stopPropagation()}>
                        <button
                          disabled={isMarcando}
                          onClick={() => marcarPresenca(ag.id, 'compareceu', lead)}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', padding: '4px 0', fontSize: '10.5px', fontWeight: 600, border: 'none', borderRadius: 'var(--r-xs)', background: 'var(--sage-xlight)', color: 'var(--sage-dark)', cursor: 'pointer', fontFamily: 'inherit', opacity: isMarcando ? 0.5 : 1 }}
                        >
                          {isMarcando ? <Loader2 size={10} className="animate-spin" /> : <Check style={{ width: '10px', height: '10px' }} />}
                          Compareceu
                        </button>
                        <button
                          disabled={isMarcando}
                          onClick={() => marcarPresenca(ag.id, 'faltou', lead)}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', padding: '4px 0', fontSize: '10.5px', fontWeight: 600, border: 'none', borderRadius: 'var(--r-xs)', background: 'var(--rose-light)', color: 'var(--rose-text)', cursor: 'pointer', fontFamily: 'inherit', opacity: isMarcando ? 0.5 : 1 }}
                        >
                          <X style={{ width: '10px', height: '10px' }} />
                          Faltou
                        </button>
                      </div>
                    ) : (
                      <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 500, background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                );
              })
            )
          )}
        </div>
      </div>

      {/* ── Área do perfil ── */}
      {!leadSelecionado ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--sage-xlight)',
                margin: '0 auto 14px',
              }}
            >
              <ClipboardList style={{ width: '26px', height: '26px', color: 'var(--sage)' }} />
            </div>
            <p style={{ fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic' }}>
              Selecione uma paciente para ver o perfil
            </p>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>

          {/* ── Header do perfil ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '16px 22px',
              background: 'var(--white)',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: 'var(--sage-xlight)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--sage-dark)',
                flexShrink: 0,
                border: '2px solid var(--sage-light)',
              }}
            >
              {getIniciais(leadSelecionado.nome_lead)}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="font-display"
                style={{
                  fontSize: '20px',
                  fontWeight: 300,
                  fontStyle: 'italic',
                  color: 'var(--ink)',
                  letterSpacing: '-0.3px',
                }}
              >
                {leadSelecionado.nome_lead || 'Sem nome'}
              </div>
              {leadSelecionado.whatsapp_lead && (
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  {leadSelecionado.whatsapp_lead}
                </div>
              )}
              {/* Badges */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 500,
                    padding: '3px 9px',
                    borderRadius: '20px',
                    background: tipoConvenio === 'convenio' ? 'var(--sage-xlight)' : 'var(--champ-light)',
                    color: tipoConvenio === 'convenio' ? 'var(--sage-dark)' : 'var(--champ-text)',
                  }}
                >
                  {tipoConvenio === 'convenio' ? 'Convênio' : 'Particular'}
                </span>
                {nextBadge && !loadingProfile && (
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 500,
                      padding: '3px 9px',
                      borderRadius: '20px',
                      background: nextBadge.bg,
                      color: nextBadge.color,
                    }}
                  >
                    {nextBadge.label} próxima consulta
                  </span>
                )}
              </div>
            </div>

            {/* Botões de ação */}
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              {leadSelecionado.whatsapp_lead && (
                <button
                  onClick={() => navigate('/inbox', { state: { lead_id: leadSelecionado.id } })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '7px 13px',
                    borderRadius: 'var(--r-xs)',
                    background: 'var(--sage-dark)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <MessageSquare style={{ width: '13px', height: '13px' }} />
                  WhatsApp
                </button>
              )}
              {calcomLink && (
                <button
                  onClick={abrirAgendamento}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '7px 13px',
                    borderRadius: 'var(--r-xs)',
                    border: '1px solid var(--border-md)',
                    color: 'var(--ink)',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--sage-dark)';
                    e.currentTarget.style.color = 'var(--sage-dark)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border-md)';
                    e.currentTarget.style.color = 'var(--ink)';
                  }}
                >
                  <CalendarPlus style={{ width: '13px', height: '13px' }} />
                  Agendar
                  <ExternalLink style={{ width: '11px', height: '11px', opacity: 0.5 }} />
                </button>
              )}

              {/* Menu de ações (arquivar / apagar) */}
              {canImport && (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setMenuAberto(v => !v)}
                    title="Mais ações"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: 'var(--r-xs)', border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}
                  >
                    <MoreVertical style={{ width: '15px', height: '15px' }} />
                  </button>
                  {menuAberto && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setMenuAberto(false)} />
                      <div style={{ position: 'absolute', zIndex: 40, top: '40px', right: 0, width: '190px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', boxShadow: 'var(--shadow)', overflow: 'hidden', fontSize: '12.5px' }}>
                        <button
                          onClick={() => { setMenuAberto(false); setConfirmAcao('arquivar'); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'transparent', border: 'none', color: 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {mostrarArquivados ? <ArchiveRestore style={{ width: '14px', height: '14px' }} /> : <Archive style={{ width: '14px', height: '14px' }} />}
                          {mostrarArquivados ? 'Restaurar paciente' : 'Arquivar paciente'}
                        </button>
                        <button
                          onClick={() => { setMenuAberto(false); setConfirmAcao('apagar'); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'transparent', border: 'none', borderTop: '1px solid var(--border)', color: 'var(--rose-text)', cursor: 'pointer', fontFamily: 'inherit' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--rose-light)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                          Apagar definitivamente
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Tabs ── */}
          <div
            style={{
              display: 'flex',
              gap: 0,
              borderBottom: '1px solid var(--border)',
              padding: '0 22px',
              background: 'var(--white)',
              flexShrink: 0,
              overflowX: 'auto',
            }}
          >
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '10px 14px',
                  fontSize: '12.5px',
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  color: activeTab === tab.id ? 'var(--sage-dark)' : 'var(--muted)',
                  borderBottom: `2px solid ${activeTab === tab.id ? 'var(--sage-dark)' : 'transparent'}`,
                  marginBottom: '-1px',
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  borderBottomWidth: '2px',
                  borderBottomStyle: 'solid',
                  borderBottomColor: activeTab === tab.id ? 'var(--sage-dark)' : 'transparent',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Conteúdo da tab ── */}
          <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
            {loadingProfile ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
                <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Carregando perfil...</p>
              </div>
            ) : (
              <>
                {activeTab === 'dados' && (
                  <DadosTab lead={leadSelecionado} pacienteId={pacienteId} proximaConsulta={proximaConsulta} />
                )}
                {activeTab === 'consultas' && (
                  <ConsultasTab leadId={leadSelecionado.id} />
                )}
                {activeTab === 'procedimentos' && pacienteId && (
                  <ProcedimentosTab pacienteId={pacienteId} />
                )}
                {activeTab === 'comportamento' && pacienteId && (
                  <ComportamentoTab leadId={leadSelecionado.id} pacienteId={pacienteId} />
                )}
                {activeTab === 'profissional' && pacienteId && canProfissional && (
                  <AnotacoesProfissionalTab pacienteId={pacienteId} />
                )}
                {activeTab === 'premium' && pacienteId && canPremium && (
                  <ExperienciaPremiumTab
                    pacienteId={pacienteId}
                    leadId={leadSelecionado?.id}
                    nomePaciente={leadSelecionado?.nome_lead}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showImportar && (
        <ImportarPacientesModal
          isOpen={showImportar}
          onClose={() => setShowImportar(false)}
          onSuccess={() => { setShowImportar(false); loadPacientes(); }}
        />
      )}

      {showNovo && (
        <NovoPacienteModal
          isOpen={showNovo}
          onClose={() => setShowNovo(false)}
          onSuccess={async (leadId) => {
            setShowNovo(false);
            await loadPacientes();
            // Abre o perfil do paciente recém-criado.
            const { data: novo } = await supabase
              .from('leads')
              .select('id, nome_lead, whatsapp_lead, procedimento_interesse, status, email, data_nascimento')
              .eq('id', leadId)
              .single();
            if (novo) selecionarLead(novo);
          }}
        />
      )}

      {/* Confirmação de arquivar / apagar */}
      {confirmAcao && leadSelecionado && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: '16px' }}
          onClick={() => !processando && setConfirmAcao(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--white)', borderRadius: '12px', boxShadow: 'var(--shadow-modal)', width: '100%', maxWidth: '420px', padding: '22px' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flexShrink: 0, padding: '8px', borderRadius: '50%', background: confirmAcao === 'apagar' ? 'var(--rose-light)' : 'var(--champ-light)', color: confirmAcao === 'apagar' ? 'var(--rose-text)' : 'var(--champ-text)' }}>
                {confirmAcao === 'apagar' ? <Trash2 size={18} /> : <AlertTriangle size={18} />}
              </div>
              <div style={{ flex: 1 }}>
                <h3 className="font-cormorant" style={{ fontSize: '17px', fontWeight: 600, color: 'var(--ink)' }}>
                  {confirmAcao === 'apagar'
                    ? 'Apagar paciente definitivamente?'
                    : mostrarArquivados ? 'Restaurar paciente?' : 'Arquivar paciente?'}
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '6px', lineHeight: 1.5 }}>
                  {confirmAcao === 'apagar'
                    ? <>Isso remove <strong>{leadSelecionado.nome_lead || 'o paciente'}</strong> e todos os dados ligados (consultas, conversas, procedimentos, anotações). <strong>Não pode ser desfeito.</strong> Para um cadastro que pode voltar, use arquivar.</>
                    : mostrarArquivados
                      ? <>O paciente <strong>{leadSelecionado.nome_lead || ''}</strong> volta para a lista de ativos.</>
                      : <>O paciente <strong>{leadSelecionado.nome_lead || ''}</strong> sai da lista, mas os dados são mantidos. Você pode restaurar depois em “Ver arquivados”.</>}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setConfirmAcao(null)}
                disabled={processando}
                style={{ padding: '8px 16px', fontSize: '12.5px', fontWeight: 500, borderRadius: 'var(--r-xs)', border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit', opacity: processando ? 0.5 : 1 }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmAcao === 'apagar' ? apagarPaciente : arquivarPaciente}
                disabled={processando}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '12.5px', fontWeight: 600, borderRadius: 'var(--r-xs)', border: 'none', color: 'white', cursor: 'pointer', fontFamily: 'inherit', opacity: processando ? 0.6 : 1, background: confirmAcao === 'apagar' ? 'var(--rose-text)' : 'var(--sage-dark)' }}
              >
                {processando && <Loader2 size={13} className="animate-spin" />}
                {confirmAcao === 'apagar' ? 'Apagar' : mostrarArquivados ? 'Restaurar' : 'Arquivar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
