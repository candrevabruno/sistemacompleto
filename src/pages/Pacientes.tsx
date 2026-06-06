import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Search, MessageSquare, Calendar, ClipboardList } from 'lucide-react';
import { DadosTab } from '../components/pacientes/DadosTab';
import { JornadaTab } from '../components/pacientes/JornadaTab';
import { ConsultasTab } from '../components/pacientes/ConsultasTab';
import { DocumentosTab } from '../components/pacientes/DocumentosTab';

type Tab = 'dados' | 'jornada' | 'consultas' | 'documentos';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dados', label: 'Dados' },
  { id: 'jornada', label: 'Jornada' },
  { id: 'consultas', label: 'Consultas' },
  { id: 'documentos', label: 'Documentos' },
];

export function Pacientes() {
  const [leads, setLeads] = useState<any[]>([]);
  const [leadSelecionado, setLeadSelecionado] = useState<any | null>(null);
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [totalConsultas, setTotalConsultas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('dados');

  // Load all leads that have had at least one agendamento
  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: ags } = await supabase
        .from('agendamentos')
        .select('lead_id')
        .not('lead_id', 'is', null);

      if (!ags?.length) {
        setLeads([]);
        setLoading(false);
        return;
      }

      const leadIds = [...new Set(ags.map((a: any) => a.lead_id))];

      const { data: leadsData } = await supabase
        .from('leads')
        .select('id, nome_lead, whatsapp_lead, procedimento_interesse, status')
        .in('id', leadIds)
        .order('nome_lead', { ascending: true });

      if (leadsData) setLeads(leadsData);
      setLoading(false);
    }
    load();
  }, []);

  // When a lead is selected, load/create the paciente record
  async function selecionarLead(lead: any) {
    setLeadSelecionado(lead);
    setActiveTab('dados');
    setLoadingProfile(true);
    setPacienteId(null);

    // Find or create paciente record
    let { data: paciente } = await supabase
      .from('pacientes')
      .select('id')
      .eq('lead_id', lead.id)
      .single();

    if (!paciente) {
      const { data: novo } = await supabase
        .from('pacientes')
        .insert({ lead_id: lead.id })
        .select('id')
        .single();
      paciente = novo;
    }

    if (paciente) setPacienteId(paciente.id);

    // Count consultations
    const { count } = await supabase
      .from('agendamentos')
      .select('id', { count: 'exact', head: true })
      .eq('lead_id', lead.id);

    setTotalConsultas(count || 0);
    setLoadingProfile(false);
  }

  const leadsFiltrados = leads.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.nome_lead?.toLowerCase().includes(q) ||
      l.whatsapp_lead?.includes(q) ||
      l.procedimento_interesse?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-[calc(100vh-110px)] -m-6 overflow-hidden bg-[var(--color-bg-base)]">
      {/* ── Lista de pacientes ─────────────────────────────────── */}
      <div className="w-[300px] flex-shrink-0 flex flex-col border-r border-[var(--color-border-card)]">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-[var(--color-border-card)]">
          <h2 className="font-cormorant font-bold text-lg text-[var(--color-text-main)] mb-3">
            Pacientes
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Buscar paciente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-[var(--color-border-card)] rounded-[8px] pl-9 pr-3 py-2 text-sm bg-[var(--color-bg-base)] text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-sm text-[var(--color-text-muted)]">Carregando...</div>
          ) : leadsFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-3">
              <ClipboardList className="w-8 h-8 text-[var(--color-text-muted)] opacity-30" />
              <p className="text-sm text-[var(--color-text-muted)]">
                {search ? 'Nenhum paciente encontrado' : 'Nenhum paciente com consultas registradas'}
              </p>
            </div>
          ) : (
            leadsFiltrados.map(lead => (
              <button
                key={lead.id}
                onClick={() => selecionarLead(lead)}
                className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-[var(--color-primary-light)] transition-colors border-b border-[var(--color-border-card)]/40 ${
                  leadSelecionado?.id === lead.id ? 'bg-[var(--color-primary-light)]' : ''
                }`}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-semibold text-sm uppercase">
                  {lead.nome_lead ? lead.nome_lead.charAt(0) : <User className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-main)] truncate">
                    {lead.nome_lead || 'Sem nome'}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">
                    {lead.procedimento_interesse || lead.whatsapp_lead || '—'}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Perfil do paciente ─────────────────────────────────── */}
      {!leadSelecionado ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-8 h-8 text-[var(--color-primary)] opacity-50" />
            </div>
            <p className="text-[var(--color-text-muted)] text-sm">
              Selecione um paciente para ver o perfil
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Patient header */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-[var(--color-border-card)] bg-[var(--color-bg-base)] flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-bold text-lg uppercase flex-shrink-0">
              {leadSelecionado.nome_lead ? leadSelecionado.nome_lead.charAt(0) : <User className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-cormorant font-bold text-xl text-[var(--color-text-main)] truncate">
                {leadSelecionado.nome_lead || 'Sem nome'}
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                {leadSelecionado.procedimento_interesse && (
                  <span className="text-sm text-[var(--color-text-muted)]">
                    {leadSelecionado.procedimento_interesse}
                  </span>
                )}
                {leadSelecionado.procedimento_interesse && totalConsultas > 0 && (
                  <span className="text-[var(--color-text-muted)]">·</span>
                )}
                {totalConsultas > 0 && (
                  <span className="text-sm text-[var(--color-text-muted)]">
                    {totalConsultas} {totalConsultas === 1 ? 'consulta' : 'consultas'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {leadSelecionado.whatsapp_lead && (
                <a
                  href={`https://wa.me/${leadSelecionado.whatsapp_lead.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-[8px] bg-green-500 text-white hover:bg-green-600 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  WhatsApp
                </a>
              )}
              <button
                onClick={() => {/* future: open scheduling modal */}}
                className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-[8px] border border-[var(--color-border-card)] text-[var(--color-text-main)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
              >
                <Calendar className="w-4 h-4" />
                Agendar
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[var(--color-border-card)] px-6 bg-[var(--color-bg-base)] flex-shrink-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.id
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {loadingProfile ? (
              <div className="flex items-center justify-center p-12">
                <div className="text-sm text-[var(--color-text-muted)]">Carregando perfil...</div>
              </div>
            ) : (
              <>
                {activeTab === 'dados' && (
                  <DadosTab lead={leadSelecionado} pacienteId={pacienteId} />
                )}
                {activeTab === 'jornada' && (
                  <JornadaTab leadId={leadSelecionado.id} />
                )}
                {activeTab === 'consultas' && (
                  <ConsultasTab leadId={leadSelecionado.id} />
                )}
                {activeTab === 'documentos' && (
                  <DocumentosTab leadId={leadSelecionado.id} />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
