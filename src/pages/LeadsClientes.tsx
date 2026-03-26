import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { UserSearch, UserCheck, Search, Calendar, ExternalLink } from 'lucide-react';
import { formatDistanceToNow, parseISO, startOfToday, endOfToday, startOfYesterday, endOfYesterday, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type DateFilter = 'hoje' | 'ontem' | '7dias' | '14semanas' | 'mes' | 'ano' | 'custom';

export function LeadsClientes() {
  const [activeTab, setActiveTab] = useState<'leads' | 'clientes'>('leads');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date filter state
  const [dateFilter, setDateFilter] = useState<DateFilter>('hoje');
  const [dateRange, setDateRange] = useState({ start: startOfToday(), end: endOfToday() });
  const [customStart, setCustomStart] = useState(format(startOfToday(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(endOfToday(), 'yyyy-MM-dd'));

  // Data state
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  
  // Drawer/Modal state
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [openLeadDetails, setOpenLeadDetails] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [openClienteDetails, setOpenClienteDetails] = useState(false);

  useEffect(() => {
    applyFilter(dateFilter);
  }, [dateFilter]);

  useEffect(() => {
    fetchData();
  }, [activeTab, dateRange]);

  const applyFilter = (f: DateFilter) => {
    const today = new Date();
    switch(f) {
      case 'hoje': setDateRange({ start: startOfToday(), end: endOfToday() }); break;
      case 'ontem': setDateRange({ start: startOfYesterday(), end: endOfYesterday() }); break;
      case '7dias': setDateRange({ start: subDays(today, 7), end: endOfToday() }); break;
      case '14semanas': setDateRange({ start: subDays(today, 14 * 7), end: endOfToday() }); break;
      case 'mes': setDateRange({ start: startOfMonth(today), end: endOfMonth(today) }); break;
      case 'ano': setDateRange({ start: startOfYear(today), end: endOfYear(today) }); break;
      case 'custom':
        if (customStart && customEnd) setDateRange({ start: new Date(customStart + 'T00:00:00'), end: new Date(customEnd + 'T23:59:59') });
        break;
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const startIso = dateRange.start.toISOString();
    const endIso = dateRange.end.toISOString();

    if (activeTab === 'leads') {
      // Leads que não estão em clientes
      const { data } = await supabase.rpc('get_leads_not_in_clientes', { start_date: startIso, end_date: endIso });
      
      // Como não criamos RPC manual no diff anterior, vamos simular via Join normal do JS 
      // Em produção: `await supabase.from('leads_estetica').select('*').not('id', 'in', `(${clientLeadIds})`)`
      const reqAllLeads = await supabase.from('leads_estetica').select('*').gte('inicio_atendimento', startIso).lte('inicio_atendimento', endIso);
      const reqClientLeadIds = await supabase.from('clientes_estetica').select('lead_id');
      const clientIds = new Set(reqClientLeadIds.data?.map(c => c.lead_id) || []);
      const pendingLeads = (reqAllLeads.data || []).filter(l => !clientIds.has(l.id));
      setLeads(pendingLeads);
    } else {
      // Clientes + Leads
      const { data } = await supabase.from('clientes_estetica')
        .select('*, leads_estetica(*)')
        .gte('created_at', startIso).lte('created_at', endIso)
        .order('created_at', { ascending: false });
      
      // Precisamos contar os agendamentos compareceu
      // Em uma aplicação real seria com aggregate, faremos loop simples pro MVP
      const resolvedClients = [];
      for (const c of (data || [])) {
        const reqCompareceu = await supabase.from('agendamentos_estetica').select('id', { count: 'exact' }).eq('cliente_id', c.id).eq('status', 'compareceu');
        const reqProx = await supabase.from('agendamentos_estetica').select('data_hora_inicio').eq('cliente_id', c.id).gte('data_hora_inicio', new Date().toISOString()).order('data_hora_inicio', { ascending: true }).limit(1);
        resolvedClients.push({
           ...c,
           countCompareceu: reqCompareceu.count || 0,
           proxAgendamento: reqProx.data?.[0]?.data_hora_inicio || null
        });
      }
      setClientes(resolvedClients);
    }
    setLoading(false);
  };

  const filteredLeads = leads.filter(l => {
    const term = searchTerm.toLowerCase();
    return (l.nome_lead?.toLowerCase().includes(term) || l.whatsapp_lead?.includes(term));
  });

  const filteredClientes = clientes.filter(c => {
    const term = searchTerm.toLowerCase();
    return (c.leads_estetica?.nome_lead?.toLowerCase().includes(term) || c.leads_estetica?.whatsapp_lead?.includes(term));
  });

  return (
    <div className="space-y-6 flex flex-col h-full bg-[var(--color-bg-base)]">
      {/* Top Cards Explanation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <Card className="border-l-4 border-l-[var(--color-primary)]">
           <CardContent className="flex items-center gap-4 p-4">
             <div className="p-3 bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded-full shrink-0"><UserSearch className="w-5 h-5"/></div>
             <div>
               <h3 className="font-semibold text-lg">Lead</h3>
               <p className="text-sm text-[var(--color-text-muted)]">Pessoa que entrou em contato com a clínica, mas ainda não compareceu presencialmente.</p>
             </div>
           </CardContent>
         </Card>
         <Card className="border-l-4 border-l-[var(--color-success)]">
           <CardContent className="flex items-center gap-4 p-4">
             <div className="p-3 bg-green-100 text-[var(--color-success)] rounded-full shrink-0"><UserCheck className="w-5 h-5"/></div>
             <div>
               <h3 className="font-semibold text-lg">Cliente</h3>
               <p className="text-sm text-[var(--color-text-muted)]">Pessoa que agendou e compareceu à clínica pelo menos uma vez.</p>
             </div>
           </CardContent>
         </Card>
      </div>

      {/* Date Filter & Search */}
      <Card>
         <CardContent className="p-4">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-wrap gap-2 items-center">
                {(['hoje', 'ontem', '7dias', '14semanas', 'mes', 'ano'] as DateFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setDateFilter(f)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-[8px] transition-colors ${dateFilter === f ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-base)] text-[var(--color-text-main)] hover:bg-[var(--color-primary-light)]'}`}
                  >
                    {f === 'hoje' ? 'Hoje' : f === 'ontem' ? 'Ontem' : f === '7dias' ? '7 dias' : f === '14semanas' ? '14 semanas' : f === 'mes' ? 'Mês' : 'Ano'}
                  </button>
                ))}
                <div className="flex items-center gap-2 ml-2 border-l border-[var(--color-border-card)] pl-4">
                  <Input type="date" value={customStart} onChange={e => { setCustomStart(e.target.value); setDateFilter('custom'); }} className="h-9"/>
                  <span className="text-sm text-[var(--color-text-muted)]">até</span>
                  <Input type="date" value={customEnd} onChange={e => { setCustomEnd(e.target.value); setDateFilter('custom'); }} className="h-9"/>
                </div>
              </div>
           </div>
         </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-[var(--color-border-card)]">
         <div className="flex space-x-6">
           <button onClick={() => setActiveTab('leads')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'leads' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}>
             Base de Leads ({activeTab === 'leads' ? filteredLeads.length : '...'})
           </button>
           <button onClick={() => setActiveTab('clientes')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'clientes' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}>
             Base de Clientes ({activeTab === 'clientes' ? filteredClientes.length : '...'})
           </button>
         </div>
         <div className="pb-2 w-64">
           <Input 
             placeholder="Buscar nome ou zap..." 
             value={searchTerm} 
             onChange={e => setSearchTerm(e.target.value)}
             icon={<Search className="w-4 h-4"/>}
             className="h-9"
           />
         </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-x-auto bg-[var(--color-bg-card)] rounded-[12px] border border-[var(--color-border-card)] shadow-[var(--shadow-card)] p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#FAF0EE] dark:bg-black/20 text-[var(--color-text-main)] border-b border-[var(--color-border-card)]">
            <tr>
              <th className="px-6 py-4 font-semibold">Nome</th>
              <th className="px-6 py-4 font-semibold">WhatsApp</th>
              {activeTab === 'leads' ? (
                <>
                  <th className="px-6 py-4 font-semibold">Serviço de Interesse</th>
                  <th className="px-6 py-4 font-semibold">Status do Lead</th>
                  <th className="px-6 py-4 font-semibold">Última Mensagem</th>
                  <th className="px-6 py-4 font-semibold">Agendamento</th>
                  <th className="px-6 py-4 font-semibold">Data de Início</th>
                </>
              ) : (
                <>
                  <th className="px-6 py-4 font-semibold text-center">Procedimentos Realizados (Qtd)</th>
                  <th className="px-6 py-4 font-semibold">Próximo Agendamento</th>
                  <th className="px-6 py-4 font-semibold">Cliente Desde</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={activeTab === 'leads' ? 7 : 5} className="py-20 text-center">Carregando dados...</td></tr>
            ) : activeTab === 'leads' ? (
              filteredLeads.map(lead => (
                <tr key={lead.id} onClick={() => { setSelectedLead(lead); setOpenLeadDetails(true); }} className="border-b border-[var(--color-border-card)] last:border-0 hover:bg-[var(--color-bg-base)] transition-colors cursor-pointer group">
                  <td className="px-6 py-4 font-medium group-hover:text-[var(--color-primary)]">{lead.nome_lead || 'Sem Nome'}</td>
                  <td className="px-6 py-4 text-[var(--color-text-muted)] font-mono text-xs">{lead.whatsapp_lead}</td>
                  <td className="px-6 py-4">{lead.servico_interesse || '-'}</td>
                  <td className="px-6 py-4"><Badge variant={lead.status}>{lead.status}</Badge></td>
                  <td className="px-6 py-4 text-[var(--color-text-muted)] text-xs">{lead.ultima_mensagem ? formatDistanceToNow(parseISO(lead.ultima_mensagem), { locale: ptBR, addSuffix: true }) : '-'}</td>
                  <td className="px-6 py-4">{lead.data_agendamento ? format(parseISO(lead.data_agendamento), 'dd/MM/yyyy HH:mm') : '-'}</td>
                  <td className="px-6 py-4 text-[var(--color-text-muted)]">{lead.inicio_atendimento ? format(parseISO(lead.inicio_atendimento), 'dd/MM/yyyy') : '-'}</td>
                </tr>
              ))
            ) : (
              filteredClientes.map(cliente => (
                <tr key={cliente.id} onClick={() => { setSelectedCliente(cliente); setOpenClienteDetails(true); }} className="border-b border-[var(--color-border-card)] last:border-0 hover:bg-[var(--color-bg-base)] transition-colors cursor-pointer group">
                  <td className="px-6 py-4 font-medium group-hover:text-[var(--color-primary)]">{cliente.leads_estetica?.nome_lead || 'Sem Nome'}</td>
                  <td className="px-6 py-4 text-[var(--color-text-muted)] font-mono text-xs">{cliente.leads_estetica?.whatsapp_lead}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-[var(--color-primary-light)] text-[var(--color-primary)] px-3 py-1 rounded-full font-bold">{cliente.countCompareceu}</span>
                  </td>
                  <td className="px-6 py-4 text-[var(--color-text-muted)]">{cliente.proxAgendamento ? format(parseISO(cliente.proxAgendamento), 'dd/MM/yyyy HH:mm') : <span className="text-gray-400 italic">Sem agendamentos futuros</span>}</td>
                  <td className="px-6 py-4 text-[var(--color-text-muted)]">{format(parseISO(cliente.data_primeira_visita), 'dd/MM/yyyy')}</td>
                </tr>
              ))
            )}
            
            {!loading && (activeTab === 'leads' ? filteredLeads.length === 0 : filteredClientes.length === 0) && (
              <tr><td colSpan={activeTab === 'leads' ? 7 : 5} className="py-20 text-center text-[var(--color-text-muted)]">
                Nenhum registro encontrado para este filtro.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DRAWER LAYER FOR LEADS/CLIENTS (Modal reuse) */}
      <Modal isOpen={openLeadDetails} onClose={() => setOpenLeadDetails(false)} title="Detalhes do Lead">
        {selectedLead && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            <h2 className="font-cormorant text-2xl font-bold">{selectedLead.nome_lead || 'Sem nome'}</h2>
            <div className="text-sm border p-4 rounded bg-gray-50">
               <p><strong>WhatsApp:</strong> {selectedLead.whatsapp_lead}</p>
               <p className="mt-2"><strong>Status Atual:</strong> <Badge variant={selectedLead.status}>{selectedLead.status}</Badge></p>
               <p className="mt-2"><strong>Serviço de interesse:</strong> {selectedLead.servico_interesse || '-'}</p>
               <p className="mt-2"><strong>Motivo:</strong> {selectedLead.historico_conversa || '-'}</p>
               <p className="mt-2"><strong>Início:</strong> {selectedLead.inicio_atendimento ? format(parseISO(selectedLead.inicio_atendimento), 'dd/MM/yyyy HH:mm') : '-'}</p>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={openClienteDetails} onClose={() => setOpenClienteDetails(false)} title="Detalhes Ficha Clínica do Cliente">
        {selectedCliente && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center bg-[var(--color-primary-light)] p-5 border border-[var(--color-border-card)] rounded-[12px]">
              <div>
                <h2 className="font-cormorant text-2xl font-bold">{selectedCliente.leads_estetica?.nome_lead || 'Cliente sem nome'}</h2>
                <p className="text-sm font-medium opacity-80 mt-1">{selectedCliente.leads_estetica?.whatsapp_lead}</p>
              </div>
              <Button size="sm" variant="secondary"><ExternalLink className="w-4 h-4 mr-2"/> Ver no CRM</Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border bg-gray-50 rounded-[8px]">
                <span className="text-xs text-gray-500 block mb-1">Cliente desde</span>
                <span className="font-medium text-sm">{format(parseISO(selectedCliente.data_primeira_visita), 'dd/MM/yyyy')}</span>
              </div>
              <div className="p-4 border bg-gray-50 rounded-[8px]">
                <span className="text-xs text-gray-500 block mb-1">LTV (Lifetime Value)</span>
                <span className="font-medium text-[var(--color-primary)] text-lg">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedCliente.valor_pago || 0)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm border-b pb-1">Procedimentos Realizados ({selectedCliente.countCompareceu})</h3>
              <p className="text-sm text-[var(--color-text-muted)] italic">Consultar painel de Agendamentos para os detalhes estritos de cada comparecimento.</p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm border-b pb-1">Campos Extras do Perfil</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500 block text-xs">Data de nascimento:</span> {selectedCliente.data_nascimento || '-'}</div>
                <div><span className="text-gray-500 block text-xs">Gênero:</span> {selectedCliente.genero || '-'}</div>
                <div className="col-span-2"><span className="text-gray-500 block text-xs">Observações Médicas:</span> {selectedCliente.observacoes || 'Nenhuma observação cadastrada.'}</div>
              </div>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
