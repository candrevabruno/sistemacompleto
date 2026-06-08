import React, { useEffect, useState } from 'react';
import { useVisibilityRefresh } from '../hooks/useVisibilityRefresh';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Users, MessageSquare, CalendarPlus, ClipboardList, ExternalLink } from 'lucide-react';
import { DadosTab } from '../components/pacientes/DadosTab';
import { ConsultasTab } from '../components/pacientes/ConsultasTab';
import { ProcedimentosTab } from '../components/pacientes/ProcedimentosTab';
import { ComportamentoTab } from '../components/pacientes/ComportamentoTab';
import { AnotacoesProfissionalTab } from '../components/pacientes/AnotacoesProfissionalTab';

type Tab = 'dados' | 'consultas' | 'procedimentos' | 'comportamento' | 'profissional';

function getIniciais(nome: string | null | undefined): string {
  if (!nome) return '?';
  return nome.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

export function Pacientes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'profissional';

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

  const TABS: { id: Tab; label: string }[] = [
    { id: 'dados',          label: 'Dados' },
    { id: 'consultas',      label: 'Consultas' },
    { id: 'procedimentos',  label: 'Procedimentos' },
    { id: 'comportamento',  label: 'Comportamento' },
    ...(isAdmin ? [{ id: 'profissional' as Tab, label: 'Anotações do Profissional' }] : []),
  ];

  // Carrega lista de pacientes (leads convertidos)
  const loadPacientes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('leads')
      .select('id, nome_lead, whatsapp_lead, procedimento_interesse, status, email')
      .eq('status', 'converteu')
      .order('nome_lead', { ascending: true });
    if (data) setLeads(data);
    setLoading(false);
  };

  useEffect(() => { loadPacientes(); }, []);

  // Refresh ao voltar ao tab ou reconectar rede
  useVisibilityRefresh(loadPacientes);

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
    agendado:   { label: 'Agendado',   color: 'var(--sage-dark)', bg: 'var(--sage-xlight)'        },
  };
  const nextBadge = proximaConsulta ? BADGE_STATUS[proximaConsulta.status] || BADGE_STATUS.agendado : null;

  return (
    <div className="flex h-[calc(100vh-60px)] -m-6 overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── Lista lateral ── */}
      <div className="w-[300px] flex-shrink-0 flex flex-col border-r" style={{ borderColor: 'var(--border)', background: '#fff' }}>
        <div className="px-4 pt-5 pb-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-[18px]" style={{ color: 'var(--ink)', letterSpacing: '-0.2px' }}>
              Pacientes
            </h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--sage-xlight)', color: 'var(--sage-dark)' }}>
              {leads.length}
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
            <input
              type="text" placeholder="Buscar paciente..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full rounded-[9px] pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-2"
              style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', '--tw-ring-color': 'var(--sage)' } as React.CSSProperties}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>Carregando...</div>
          ) : leadsFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6 gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--sage-xlight)' }}>
                <Users className="w-5 h-5" style={{ color: 'var(--sage)' }} />
              </div>
              <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
                {search ? 'Nenhum paciente encontrado' : 'Nenhum paciente ainda'}
              </p>
            </div>
          ) : (
            <div className="py-1">
              {leadsFiltrados.map(lead => {
                const isSelected = leadSelecionado?.id === lead.id;
                return (
                  <button key={lead.id} onClick={() => selecionarLead(lead)}
                    className="w-full text-left px-3 py-3 flex gap-3 items-center transition-colors relative"
                    style={{
                      background: isSelected ? 'var(--sage-xlight)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--sage-dark)' : '3px solid transparent',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--sage-xlight)'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, var(--sage-dark), var(--sage))' }}>
                      {getIniciais(lead.nome_lead)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                        {lead.nome_lead || 'Sem nome'}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--muted)' }}>
                        {lead.procedimento_interesse || lead.whatsapp_lead || '—'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Área do perfil ── */}
      {!leadSelecionado ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--sage-xlight)' }}>
              <ClipboardList className="w-7 h-7" style={{ color: 'var(--sage)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Selecione uma paciente para ver o perfil</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 min-w-0">

          {/* ── Header do perfil ── */}
          <div className="flex items-center gap-4 px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)', background: '#fff' }}>
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--sage-dark), var(--sage))' }}>
              {getIniciais(leadSelecionado.nome_lead)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-[20px] leading-tight" style={{ color: 'var(--ink)', letterSpacing: '-0.3px' }}>
                  {leadSelecionado.nome_lead || 'Sem nome'}
                </h2>
                {/* Badge convênio/particular */}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    background: tipoConvenio === 'convenio' ? 'rgba(59,130,246,0.1)' : 'var(--sage-xlight)',
                    color: tipoConvenio === 'convenio' ? '#2563eb' : 'var(--sage-dark)',
                  }}>
                  {tipoConvenio === 'convenio' ? 'Convênio' : 'Particular'}
                </span>
                {/* Badge próxima consulta */}
                {nextBadge && !loadingProfile && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: nextBadge.bg, color: nextBadge.color }}>
                    {nextBadge.label}
                  </span>
                )}
              </div>
              {leadSelecionado.whatsapp_lead && (
                <p className="text-[12px] font-mono mt-0.5" style={{ color: 'var(--muted)' }}>
                  {leadSelecionado.whatsapp_lead}
                </p>
              )}
            </div>

            {/* Botões de ação */}
            <div className="flex gap-2 flex-shrink-0">
              {leadSelecionado.whatsapp_lead && (
                <button
                  onClick={() => navigate('/inbox', { state: { lead_id: leadSelecionado.id } })}
                  className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-[8px] text-white transition-opacity hover:opacity-90"
                  style={{ background: 'var(--sage-dark)' }}>
                  <MessageSquare className="w-3.5 h-3.5" />
                  WhatsApp
                </button>
              )}
              {calcomLink && (
                <button
                  onClick={abrirAgendamento}
                  className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-[8px] border transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink)', background: 'transparent' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--sage-dark)'; e.currentTarget.style.color = 'var(--sage-dark)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink)'; }}>
                  <CalendarPlus className="w-3.5 h-3.5" />
                  Agendar
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </button>
              )}
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="flex border-b px-6 flex-shrink-0 overflow-x-auto" style={{ borderColor: 'var(--border)', background: '#fff' }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="px-4 py-3 text-[13px] font-medium border-b-2 transition-colors -mb-px whitespace-nowrap"
                style={{
                  borderBottomColor: activeTab === tab.id ? 'var(--sage-dark)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--sage-dark)' : 'var(--muted)',
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Conteúdo da tab ── */}
          <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
            {loadingProfile ? (
              <div className="flex items-center justify-center p-12">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Carregando perfil...</p>
              </div>
            ) : (
              <>
                {activeTab === 'dados' && (
                  <DadosTab lead={leadSelecionado} pacienteId={pacienteId} />
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
                {activeTab === 'profissional' && pacienteId && isAdmin && (
                  <AnotacoesProfissionalTab pacienteId={pacienteId} />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
