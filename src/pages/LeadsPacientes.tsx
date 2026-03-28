import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { UserSearch, UserCheck, Search, Calendar, ExternalLink, Download, FileText } from 'lucide-react';
import { formatDistanceToNow, parseISO, startOfToday, endOfToday, startOfYesterday, endOfYesterday, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DateFilter = 'ontem' | 'hoje' | '7dias' | '14dias' | 'mes' | 'ano' | 'custom';

export function LeadsPacientes() {
  const [activeTab, setActiveTab] = useState<'leads' | 'pacientes'>('leads');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date filter state
  const [dateFilter, setDateFilter] = useState<DateFilter>('hoje');
  const [dateRange, setDateRange] = useState({ start: startOfToday(), end: endOfToday() });
  const [customStart, setCustomStart] = useState(format(startOfToday(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(endOfToday(), 'yyyy-MM-dd'));

  // Data state
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [pacientes, setPacientes] = useState<any[]>([]);
  
  // Drawer/Modal state
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [openLeadDetails, setOpenLeadDetails] = useState(false);
  const [selectedPaciente, setSelectedPaciente] = useState<any>(null);
  const [openPacienteDetails, setOpenPacienteDetails] = useState(false);

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
      case '14dias': setDateRange({ start: subDays(today, 14), end: endOfToday() }); break;
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
      // Leads que não estão em pacientes
      const reqAllLeads = await supabase.from('leads').select('*').gte('inicio_atendimento', startIso).lte('inicio_atendimento', endIso);
      const reqPatientLeadIds = await supabase.from('pacientes').select('lead_id');
      const patientIds = new Set(reqPatientLeadIds.data?.map(c => c.lead_id) || []);
      const pendingLeads = (reqAllLeads.data || []).filter(l => !patientIds.has(l.id));
      setLeads(pendingLeads);
    } else {
      // Pacientes + Leads
      const { data } = await supabase.from('pacientes')
        .select('*, leads(*)')
        .gte('created_at', startIso).lte('created_at', endIso)
        .order('created_at', { ascending: false });
      
      const resolvedPatients = [];
      for (const p of (data || [])) {
        const reqCompareceu = await supabase.from('agendamentos').select('id', { count: 'exact' }).eq('paciente_id', p.id).eq('status', 'compareceu');
        const reqProx = await supabase.from('agendamentos').select('data_hora_inicio').eq('paciente_id', p.id).gte('data_hora_inicio', new Date().toISOString()).order('data_hora_inicio', { ascending: true }).limit(1);
        resolvedPatients.push({
           ...p,
           countCompareceu: reqCompareceu.count || 0,
           proxAgendamento: reqProx.data?.[0]?.data_hora_inicio || null
        });
      }
      setPacientes(resolvedPatients);
    }
    setLoading(false);
  };

  const filteredLeads = leads.filter(l => {
    const term = searchTerm.toLowerCase();
    return (l.nome_lead?.toLowerCase().includes(term) || l.whatsapp_lead?.includes(term));
  });

  const filteredPacientes = pacientes.filter(p => {
    const term = searchTerm.toLowerCase();
    return (p.leads?.nome_lead?.toLowerCase().includes(term) || p.leads?.whatsapp_lead?.includes(term));
  });

  const handleExportCSV = () => {
    const isLeads = activeTab === 'leads';
    const data = isLeads ? filteredLeads : filteredPacientes;
    if (data.length === 0) return alert('Nenhum dado para exportar no filtro atual.');

    const headers = isLeads
      ? ['Nome', 'WhatsApp', 'Serviço de Interesse', 'Status do Lead', 'Última Mensagem', 'Agendamento', 'Data de Início']
      : ['Nome', 'WhatsApp', 'Procedimentos Realizados (Qtd)', 'Próximo Agendamento', 'Paciente Desde'];

    const rows = data.map(item => {
      if (isLeads) {
        return [
          item.nome_lead || 'Sem Nome',
          item.whatsapp_lead || '',
          item.procedimento_interesse || '-',
          item.status || '',
          item.ultima_mensagem ? format(parseISO(item.ultima_mensagem), 'dd/MM/yyyy HH:mm') : '-',
          item.data_agendamento ? format(parseISO(item.data_agendamento), 'dd/MM/yyyy HH:mm') : '-',
          item.inicio_atendimento ? format(parseISO(item.inicio_atendimento), 'dd/MM/yyyy') : '-'
        ];
      } else {
        return [
          item.leads?.nome_lead || 'Sem Nome',
          item.leads?.whatsapp_lead || '',
          item.countCompareceu?.toString() || '0',
          item.proxAgendamento ? format(parseISO(item.proxAgendamento), 'dd/MM/yyyy HH:mm') : 'Sem agendamentos futuros',
          item.data_primeira_visita ? format(parseISO(item.data_primeira_visita), 'dd/MM/yyyy') : '-'
        ];
      }
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_${activeTab}_${format(new Date(), 'dd-MM-yyyy')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const isLeads = activeTab === 'leads';
    const data = isLeads ? filteredLeads : filteredPacientes;
    if (data.length === 0) return alert('Nenhum dado para exportar no filtro atual.');

    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text(`Relatório de ${isLeads ? 'Leads' : 'Pacientes'}`, 14, 22);
    doc.setFontSize(11);
    doc.text(`Período de filtro gerado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);

    const head = isLeads
      ? [['Nome', 'WhatsApp', 'Serviço', 'Status', 'Últ. Msg', 'Agendado', 'Início']]
      : [['Nome', 'WhatsApp', 'Procedimentos (Qtd)', 'Próx. Agendamento', 'Paciente Desde']];

    const body = data.map(item => {
      if (isLeads) {
        return [
          item.nome_lead || 'Sem Nome',
          item.whatsapp_lead || '',
          item.procedimento_interesse || '-',
          item.status || '',
          item.ultima_mensagem ? format(parseISO(item.ultima_mensagem), 'dd/MM/yyyy HH:mm') : '-',
          item.data_agendamento ? format(parseISO(item.data_agendamento), 'dd/MM/yyyy HH:mm') : '-',
          item.inicio_atendimento ? format(parseISO(item.inicio_atendimento), 'dd/MM/yyyy') : '-'
        ];
      } else {
        return [
          item.leads?.nome_lead || 'Sem Nome',
          item.leads?.whatsapp_lead || '',
          item.countCompareceu?.toString() || '0',
          item.proxAgendamento ? format(parseISO(item.proxAgendamento), 'dd/MM/yyyy HH:mm') : '-',
          item.data_primeira_visita ? format(parseISO(item.data_primeira_visita), 'dd/MM/yyyy') : '-'
        ];
      }
    });

    autoTable(doc, {
      startY: 35,
      head,
      body,
      theme: 'striped',
      headStyles: { fillColor: [142, 98, 98] }, // Cor base da paleta Heroic Leap Health
      styles: { fontSize: 9 }
    });

    doc.save(`relatorio_${activeTab}_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
  };

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
               <h3 className="font-semibold text-lg">Paciente</h3>
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
                {(['ontem', 'hoje', '7dias', '14dias', 'mes', 'ano'] as DateFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setDateFilter(f)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-[8px] transition-colors ${dateFilter === f ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-base)] text-[var(--color-text-main)] hover:bg-[var(--color-primary-light)]'}`}
                  >
                    {f === 'ontem' ? 'Ontem' : f === 'hoje' ? 'Hoje' : f === '7dias' ? '7 dias' : f === '14dias' ? '14 dias' : f === 'mes' ? 'Mês' : 'Ano'}
                  </button>
                ))}
                <div className="flex items-center gap-2 ml-2 border-l border-[var(--color-border-card)] pl-4">
                  <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-9"/>
                  <span className="text-sm text-[var(--color-text-muted)]">até</span>
                  <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-9"/>
                  <button 
                    onClick={() => setDateFilter('custom')}
                    className="ml-2 px-3 py-1.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-[8px] transition-colors hover:bg-opacity-90 whitespace-nowrap"
                  >
                    Filtrar
                  </button>
                </div>
              </div>
           </div>
         </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-[var(--color-border-card)] gap-4 pb-2">
         <div className="flex space-x-6">
           <button onClick={() => setActiveTab('leads')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'leads' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}>
             Base de Leads ({activeTab === 'leads' ? filteredLeads.length : '...'})
           </button>
           <button onClick={() => setActiveTab('pacientes')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'pacientes' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}>
             Base de Pacientes ({activeTab === 'pacientes' ? filteredPacientes.length : '...'})
           </button>
         </div>
         <div className="flex flex-wrap items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
           <Input 
             placeholder="Buscar nome ou zap..." 
             value={searchTerm} 
             onChange={e => setSearchTerm(e.target.value)}
             icon={<Search className="w-4 h-4"/>}
             className="h-9 w-full md:w-56"
           />
           <Button size="sm" variant="secondary" onClick={handleExportCSV} title="Exportar filtrados para CSV" className="h-9 border-[var(--color-border-card)] text-[var(--color-text-main)] hover:bg-[var(--color-bg-sidebar)]">
             <Download className="w-4 h-4 mr-2"/> CSV
           </Button>
           <Button size="sm" variant="secondary" onClick={handleExportPDF} title="Exportar filtrados para PDF" className="h-9 border-[var(--color-border-card)] text-[var(--color-text-main)] hover:bg-[var(--color-bg-sidebar)]">
             <FileText className="w-4 h-4 mr-2"/> PDF
           </Button>
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
                  <th className="px-6 py-4 font-semibold">Paciente Desde</th>
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
                  <td className="px-6 py-4">{lead.procedimento_interesse || '-'}</td>
                  <td className="px-6 py-4"><Badge variant={lead.status}>{lead.status}</Badge></td>
                  <td className="px-6 py-4 text-[var(--color-text-muted)] text-xs">{lead.ultima_mensagem ? formatDistanceToNow(parseISO(lead.ultima_mensagem), { locale: ptBR, addSuffix: true }) : '-'}</td>
                  <td className="px-6 py-4">{lead.data_agendamento ? format(parseISO(lead.data_agendamento), 'dd/MM/yyyy HH:mm') : '-'}</td>
                  <td className="px-6 py-4 text-[var(--color-text-muted)]">{lead.inicio_atendimento ? format(parseISO(lead.inicio_atendimento), 'dd/MM/yyyy') : '-'}</td>
                </tr>
              ))
            ) : (
              filteredPacientes.map(paciente => (
                <tr key={paciente.id} onClick={() => { setSelectedPaciente(paciente); setOpenPacienteDetails(true); }} className="border-b border-[var(--color-border-card)] last:border-0 hover:bg-[var(--color-bg-base)] transition-colors cursor-pointer group">
                  <td className="px-6 py-4 font-medium group-hover:text-[var(--color-primary)]">{paciente.leads?.nome_lead || 'Sem Nome'}</td>
                  <td className="px-6 py-4 text-[var(--color-text-muted)] font-mono text-xs">{paciente.leads?.whatsapp_lead}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-[var(--color-primary-light)] text-[var(--color-primary)] px-3 py-1 rounded-full font-bold">{paciente.countCompareceu}</span>
                  </td>
                  <td className="px-6 py-4 text-[var(--color-text-muted)]">{paciente.proxAgendamento ? format(parseISO(paciente.proxAgendamento), 'dd/MM/yyyy HH:mm') : <span className="text-gray-400 italic">Sem agendamentos futuros</span>}</td>
                  <td className="px-6 py-4 text-[var(--color-text-muted)]">{format(parseISO(paciente.data_primeira_visita), 'dd/MM/yyyy')}</td>
                </tr>
              ))
            )}
            
            {!loading && (activeTab === 'leads' ? filteredLeads.length === 0 : filteredPacientes.length === 0) && (
              <tr><td colSpan={activeTab === 'leads' ? 7 : 5} className="py-20 text-center text-[var(--color-text-muted)]">
                Nenhum registro encontrado para este filtro.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DRAWER LAYER FOR LEADS/PATIENTS (Modal reuse) */}
      <Modal isOpen={openLeadDetails} onClose={() => setOpenLeadDetails(false)} title="Detalhes do Lead">
        {selectedLead && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            <h2 className="font-cormorant text-2xl font-bold">{selectedLead.nome_lead || 'Sem nome'}</h2>
            <div className="text-sm border p-4 rounded bg-gray-50">
               <p><strong>WhatsApp:</strong> {selectedLead.whatsapp_lead}</p>
               <p className="mt-2"><strong>Status Atual:</strong> <Badge variant={selectedLead.status}>{selectedLead.status}</Badge></p>
               <p className="mt-2"><strong>Procedimento de interesse:</strong> {selectedLead.procedimento_interesse || '-'}</p>
               <p className="mt-2"><strong>Motivo:</strong> {selectedLead.historico_conversa || '-'}</p>
               <p className="mt-2"><strong>Início:</strong> {selectedLead.inicio_atendimento ? format(parseISO(selectedLead.inicio_atendimento), 'dd/MM/yyyy HH:mm') : '-'}</p>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={openPacienteDetails} onClose={() => setOpenPacienteDetails(false)} title="Detalhes Ficha Clínica do Paciente">
        {selectedPaciente && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center bg-[var(--color-primary-light)] p-5 border border-[var(--color-border-card)] rounded-[12px]">
              <div>
                <h2 className="font-cormorant text-2xl font-bold">{selectedPaciente.leads?.nome_lead || 'Paciente sem nome'}</h2>
                <p className="text-sm font-medium opacity-80 mt-1">{selectedPaciente.leads?.whatsapp_lead}</p>
              </div>
              <Button size="sm" variant="secondary"><ExternalLink className="w-4 h-4 mr-2"/> Ver no CRM</Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border bg-gray-50 rounded-[8px]">
                <span className="text-xs text-gray-500 block mb-1">Paciente desde</span>
                <span className="font-medium text-sm">{format(parseISO(selectedPaciente.data_primeira_visita), 'dd/MM/yyyy')}</span>
              </div>
              <div className="p-4 border bg-gray-50 rounded-[8px]">
                <span className="text-xs text-gray-500 block mb-1">LTV (Lifetime Value)</span>
                <span className="font-medium text-[var(--color-primary)] text-lg">
                   {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedPaciente.valor_pago || 0)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm border-b pb-1">Procedimentos Realizados ({selectedPaciente.countCompareceu})</h3>
              <p className="text-sm text-[var(--color-text-muted)] italic">Consultar painel de Agendamentos para os detalhes estritos de cada comparecimento.</p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm border-b pb-1">Campos Extras do Perfil</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500 block text-xs">Data de nascimento:</span> {selectedPaciente.data_nascimento || '-'}</div>
                <div><span className="text-gray-500 block text-xs">Gênero:</span> {selectedPaciente.genero || '-'}</div>
                <div className="col-span-2"><span className="text-gray-500 block text-xs">Observações Médicas:</span> {selectedPaciente.observacoes || 'Nenhuma observação cadastrada.'}</div>
              </div>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
