import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { format } from 'date-fns';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, User, FileText, Calendar, DollarSign, Clock } from 'lucide-react';

const COLUMNS = [
  { id: 'iniciou_atendimento', title: 'Iniciou', colorClass: 'border-[var(--color-primary)]' },
  { id: 'conversando', title: 'Conversando', colorClass: 'border-[var(--color-text-main)]' },
  { id: 'agendado', title: 'Agendado', colorClass: 'border-emerald-500' },
  { id: 'reagendado', title: 'Reagendado', colorClass: 'border-amber-400' },
  { id: 'converteu', title: 'Converteu', colorClass: 'border-green-600' },
  { id: 'nao_converteu', title: 'Não Converteu', colorClass: 'border-rose-600' },
  { id: 'faltou', title: 'Faltou', colorClass: 'border-slate-500' },
  { id: 'cancelou_agendamento', title: 'Cancelou Agendamento', colorClass: 'border-rose-400' }
];

export function CRM() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [agendas, setAgendas] = useState<any[]>([]);

  // New Lead
  const [openNewLead, setOpenNewLead] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({ whatsapp: '', nome: '', procedimento: '', motivo: '' });

  // Agendado Modal
  const [confirmAgendado, setConfirmAgendado] = useState<{ leadId: string, sourceCol: string, lead: any } | null>(null);
  const [agendadoForm, setAgendadoForm] = useState({ dataHora: '', procedimento: '', agendaId: '', modalidade: 'presencial' });
  const [savingAgendado, setSavingAgendado] = useState(false);

  // Converteu Modal
  const [confirmConverteu, setConfirmConverteu] = useState<{ leadId: string, sourceCol: string, lead: any } | null>(null);
  const [converteuForm, setConverteuForm] = useState({ servico: '', valor: '', observacao: '' });
  const [savingConverteu, setSavingConverteu] = useState(false);

  // Não Converteu Modal
  const [confirmNaoConverteu, setConfirmNaoConverteu] = useState<{ leadId: string, sourceCol: string, lead: any } | null>(null);
  const [naoConverteuForm, setNaoConverteuForm] = useState({ motivo: '' });
  const [savingNaoConverteu, setSavingNaoConverteu] = useState(false);

  // Reagendado Modal
  const [confirmReagendado, setConfirmReagendado] = useState<{ leadId: string, sourceCol: string, lead: any } | null>(null);
  const [reagendadoForm, setReagendadoForm] = useState({ dataHora: '', agendaId: '', modalidade: 'presencial' });
  const [savingReagendado, setSavingReagendado] = useState(false);

  // Lead Details
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [openLeadDetails, setOpenLeadDetails] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase.from('leads').select('*').order('ultima_mensagem', { ascending: false });
    if (data) setLeads(data);
    setLoading(false);
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    setSavingStatus(true);
    await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    setSelectedLead((prev: any) => ({ ...prev, status: newStatus }));
    setSavingStatus(false);
  };

  const fetchAgendas = async () => {
    const { data } = await supabase.from('agendas').select('id, nome, cor').eq('ativo', true);
    if (data) setAgendas(data);
  };

  useEffect(() => {
    fetchLeads();
    fetchAgendas();

    const leadsChannel = supabase
      .channel('crm-leads-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => {
          fetchLeads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
    };
  }, []);

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const leadId = draggableId;
    const oldStatus = source.droppableId;
    const newStatus = destination.droppableId;

    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    if (newStatus === 'agendado' && oldStatus !== 'agendado') {
      setAgendadoForm({
        dataHora: '',
        procedimento: lead.procedimento_interesse || '',
        agendaId: agendas[0]?.id || '',
        modalidade: 'presencial'
      });
      setConfirmAgendado({ leadId, sourceCol: oldStatus, lead });
      return;
    }

    if (newStatus === 'converteu' && oldStatus !== 'converteu') {
      setConverteuForm({
        servico: lead.procedimento_interesse || '',
        valor: String(lead.valor_pago || ''),
        observacao: ''
      });
      setConfirmConverteu({ leadId, sourceCol: oldStatus, lead });
      return;
    }

    if (newStatus === 'nao_converteu' && oldStatus !== 'nao_converteu') {
      setNaoConverteuForm({ motivo: lead.motivo_perda || '' });
      setConfirmNaoConverteu({ leadId, sourceCol: oldStatus, lead });
      return;
    }

    if (newStatus === 'reagendado') {
      const currentIso = lead.data_agendamento || null;
      setReagendadoForm({
        dataHora: currentIso ? format(parseISO(currentIso), "yyyy-MM-dd'T'HH:mm") : '',
        agendaId: agendas[0]?.id || '',
        modalidade: lead.modalidade || 'presencial'
      });
      setConfirmReagendado({ leadId, sourceCol: oldStatus, lead });
      return;
    }

    updateLeadState(leadId, newStatus);
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
    if (error) {
       updateLeadState(leadId, oldStatus);
       alert(`Erro ao salvar status: ${error.message}`);
    }
  };

  const updateLeadState = (id: string, newStatus: string) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
  };

  const confirmAgendadoAction = async () => {
    if (!confirmAgendado || !agendadoForm.dataHora) return;
    const { leadId, lead } = confirmAgendado;
    setSavingAgendado(true);

    try {
      const { data: agendamento, error: agError } = await supabase
        .from('agendamentos')
        .insert({
          lead_id: leadId,
          agenda_id: agendadoForm.agendaId || null,
          procedimento_nome: agendadoForm.procedimento || lead?.procedimento_interesse || null,
          nome_lead: lead?.nome_lead || null,
          whatsapp_lead: lead?.whatsapp_lead || null,
          data_hora_inicio: new Date(agendadoForm.dataHora).toISOString(),
          modalidade: agendadoForm.modalidade,
          status: 'agendado'
        })
        .select()
        .single();

      if (agError) throw agError;

      await supabase
        .from('leads')
        .update({
          status: 'agendado',
          data_agendamento: new Date(agendadoForm.dataHora).toISOString(),
          agendamento_criado_em: new Date().toISOString(),
          id_agendamento: agendamento.id,
          modalidade: agendadoForm.modalidade
        })
        .eq('id', leadId);

      updateLeadState(leadId, 'agendado');
      setConfirmAgendado(null);
      fetchLeads();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSavingAgendado(false);
    }
  };

  const confirmConverteuAction = async () => {
    if (!confirmConverteu || !converteuForm.valor) return;
    const { leadId } = confirmConverteu;
    setSavingConverteu(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ 
          status: 'converteu',
          valor_pago: parseFloat(converteuForm.valor.replace(',', '.')),
          procedimento_interesse: converteuForm.servico,
          observacoes: converteuForm.observacao ? `${confirmConverteu.lead.observacoes || ''}\nObs: ${converteuForm.observacao}` : confirmConverteu.lead.observacoes
        })
        .eq('id', leadId);
      if (error) throw error;
      updateLeadState(leadId, 'converteu');
      setConfirmConverteu(null);
      fetchLeads();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSavingConverteu(false);
    }
  };

  const confirmNaoConverteuAction = async () => {
    if (!confirmNaoConverteu || !naoConverteuForm.motivo) return;
    const { leadId } = confirmNaoConverteu;
    setSavingNaoConverteu(true);
    try {
      const { error } = await supabase.from('leads').update({ status: 'nao_converteu', motivo_perda: naoConverteuForm.motivo }).eq('id', leadId);
      if (error) throw error;
      updateLeadState(leadId, 'nao_converteu');
      setConfirmNaoConverteu(null);
      fetchLeads();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSavingNaoConverteu(false);
    }
  };

  const confirmReagendadoAction = async () => {
    if (!confirmReagendado || !reagendadoForm.dataHora) return;
    const { leadId, lead } = confirmReagendado;
    setSavingReagendado(true);
    try {
      const novaData = new Date(reagendadoForm.dataHora).toISOString();
      if (lead.id_agendamento) {
        await supabase.from('agendamentos').update({ data_hora_inicio: novaData, status: 'reagendado' }).eq('id', lead.id_agendamento);
      }
      await supabase.from('leads').update({ status: 'reagendado', data_agendamento: novaData }).eq('id', leadId);
      updateLeadState(leadId, 'reagendado');
      setConfirmReagendado(null);
      fetchLeads();
    } catch (err: any) {
       console.error(err);
    } finally {
      setSavingReagendado(false);
    }
  };

  const handleSaveNewLead = async () => {
    if (!newLeadForm.whatsapp) return;
    await supabase.from('leads').insert({
      whatsapp_lead: newLeadForm.whatsapp,
      nome_lead: newLeadForm.nome || null,
      procedimento_interesse: newLeadForm.procedimento || null,
      motivo_contato: newLeadForm.motivo || null,
      status: 'iniciou_atendimento'
    });
    setOpenNewLead(false);
    setNewLeadForm({ whatsapp: '', nome: '', procedimento: '', motivo: '' });
    fetchLeads();
  };

  const cardsByCol = COLUMNS.reduce((acc, col) => {
    acc[col.id] = leads.filter(l => l.status === col.id);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--color-bg-base)]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 p-4 text-[var(--color-text-main)]">
          <div><p className="text-sm text-[var(--color-text-muted)] mt-1 font-medium">Navegue os contatos pelos estágios de venda.</p></div>
          <Button onClick={() => setOpenNewLead(true)} className="w-full sm:w-auto font-bold"><Plus className="w-4 h-4 mr-2"/> Novo Lead</Button>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">Carregando CRM...</div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex h-full gap-4 items-start w-fit px-4">
              {COLUMNS.map(col => {
                const colCards = cardsByCol[col.id] || [];
                return (
                  <div key={col.id} className={`flex flex-col flex-shrink-0 w-[300px] h-full max-h-full bg-white rounded-[12px] border border-[var(--color-border-card)] border-t-4 shadow-sm transition-all ${col.colorClass}`}>
                    <div className="p-3 font-semibold text-[var(--color-text-main)] flex justify-between items-center bg-gray-50/50 border-b border-[var(--color-border-card)] rounded-t-[10px]">
                      <span className="truncate pr-2 font-cormorant text-lg">{col.title}</span>
                      <span className="bg-white border border-[var(--color-border-card)] rounded-full px-2 py-0.5 text-[10px] text-[var(--color-text-muted)] font-mono">{colCards.length}</span>
                    </div>

                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className={`flex-1 overflow-y-auto p-2 space-y-3 transition-colors bg-[#F9FAFB]/80 ${snapshot.isDraggingOver ? 'bg-[var(--color-primary-light)]/40' : ''}`}>
                          {colCards.map((card, index) => (
                            <Draggable key={card.id} draggableId={card.id} index={index}>
                              {(provided, snapshot) => (
                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} onClick={() => { setSelectedLead(card); setOpenLeadDetails(true); }} className={`bg-white p-4 rounded-[12px] border-l-4 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.06)] cursor-grab hover:shadow-md hover:-translate-y-0.5 transition-all ${col.colorClass} ${snapshot.isDragging ? 'opacity-90 scale-[1.02] shadow-xl ring-1 ring-[var(--color-primary)]/20' : ''}`}>
                                  <div className="font-semibold text-sm line-clamp-1 mb-1">{card.nome_lead || 'Lead sem nome'}</div>
                                  <div className="text-xs text-[var(--color-text-muted)] mb-3">{card.whatsapp_lead}</div>
                                  <div className="flex justify-between items-center mt-auto">
                                    <Badge variant={card.status} className="scale-90 origin-left">{col.title}</Badge>
                                    <div className="text-[10px] text-[var(--color-text-muted)] font-medium">{card.ultima_mensagem ? `há ${formatDistanceToNow(parseISO(card.ultima_mensagem), { locale: ptBR })}` : 'Sem msg'}</div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )
              })}
            </div>
          </DragDropContext>
        )}
      </div>

      <Modal isOpen={openNewLead} onClose={() => setOpenNewLead(false)} title="Novo Lead Manual">
        <div className="space-y-4">
          <Input label="WhatsApp *" placeholder="+5511999999999" value={newLeadForm.whatsapp} onChange={e => setNewLeadForm({...newLeadForm, whatsapp: e.target.value})} />
          <Input label="Nome" placeholder="Ex: Maria" value={newLeadForm.nome} onChange={e => setNewLeadForm({...newLeadForm, nome: e.target.value})} />
          <Button onClick={handleSaveNewLead} className="w-full" disabled={!newLeadForm.whatsapp}>Criar Lead</Button>
        </div>
      </Modal>

      <Modal isOpen={!!confirmAgendado} onClose={() => setConfirmAgendado(null)} title="Registrar Agendamento">
        <div className="space-y-4">
          <div className="p-3 bg-[#7A9E87]/10 border border-[#7A9E87] rounded-[8px] text-[#7A9E87] font-medium text-sm">📅 {confirmAgendado?.lead?.nome_lead}</div>
          <div><label className="block text-sm font-medium mb-1">Data/Hora *</label><input type="datetime-local" value={agendadoForm.dataHora} onChange={e => setAgendadoForm({...agendadoForm, dataHora: e.target.value})} className="w-full border rounded-[8px] px-3 py-2 text-sm" /></div>
          <div><label className="block text-sm font-medium mb-1">Serviço</label><Input placeholder="Ex: Inventário" value={agendadoForm.procedimento} onChange={e => setAgendadoForm({...agendadoForm, procedimento: e.target.value})} /></div>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="secondary" onClick={() => setConfirmAgendado(null)}>Cancelar</Button>
            <Button className="bg-[#7A9E87] text-white" onClick={confirmAgendadoAction} disabled={!agendadoForm.dataHora || savingAgendado}>Confirmar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!confirmConverteu} onClose={() => setConfirmConverteu(null)} title="Finalizar Venda">
        <div className="space-y-4">
          <div className="p-3 bg-green-50 border border-green-200 rounded-[8px] text-green-800 font-medium text-sm">🚀 Parabéns! Preencha os dados do contrato.</div>
          <div><label className="block text-sm font-medium mb-1">Serviço *</label><Input placeholder="Ex: Inventário" value={converteuForm.servico} onChange={e => setConverteuForm({...converteuForm, servico: e.target.value})} /></div>
          <div><label className="block text-sm font-medium mb-1">Valor do Honorário (R$) *</label><Input placeholder="0,00" value={converteuForm.valor} onChange={e => setConverteuForm({...converteuForm, valor: e.target.value})} /></div>
          <div><label className="block text-sm font-medium mb-1">Obs</label><textarea rows={3} value={converteuForm.observacao} onChange={e => setConverteuForm({...converteuForm, observacao: e.target.value})} className="w-full border rounded-[8px] px-3 py-2 text-sm bg-[var(--color-bg-base)]" /></div>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="secondary" onClick={() => setConfirmConverteu(null)}>Cancelar</Button>
            <Button className="bg-green-600 text-white" onClick={confirmConverteuAction} disabled={!converteuForm.valor || savingConverteu}>Confirmar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!confirmNaoConverteu} onClose={() => setConfirmNaoConverteu(null)} title="Registrar Não Conversão">
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-[8px] text-rose-800 font-medium text-sm">Entender o motivo da perda ajuda a melhorar.</div>
          <div><label className="block text-sm font-medium mb-1">Motivo/Objeção *</label><textarea rows={4} value={naoConverteuForm.motivo} onChange={e => setNaoConverteuForm({...naoConverteuForm, motivo: e.target.value})} className="w-full border rounded-[8px] px-3 py-2 text-sm bg-[var(--color-bg-base)]" /></div>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="secondary" onClick={() => setConfirmNaoConverteu(null)}>Cancelar</Button>
            <Button className="bg-rose-600 text-white" onClick={confirmNaoConverteuAction} disabled={!naoConverteuForm.motivo || savingNaoConverteu}>Salvar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!confirmReagendado} onClose={() => setConfirmReagendado(null)} title="Reagendar Lead">
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 rounded-[8px] text-amber-800 text-sm font-medium">Lembre-se de remarcar no Cal.com primeiro.</div>
          <div><label className="block text-sm font-medium mb-1">Nova Data/Hora *</label><input type="datetime-local" value={reagendadoForm.dataHora} onChange={e => setReagendadoForm({...reagendadoForm, dataHora: e.target.value})} className="w-full border rounded-[8px] px-3 py-2 text-sm bg-[var(--color-bg-base)]" /></div>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="secondary" onClick={() => setConfirmReagendado(null)}>Cancelar</Button>
            <Button className="bg-amber-500 text-white" onClick={confirmReagendadoAction} disabled={!reagendadoForm.dataHora || savingReagendado}>Salvar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={openLeadDetails} onClose={() => setOpenLeadDetails(false)} title="Detalhes do Contato">
        {selectedLead && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            <div className="bg-gray-50 p-4 rounded-[12px] border">
               <h2 className="font-cormorant text-2xl font-bold">{selectedLead.nome_lead || 'Lead sem nome'}</h2>
               <p className="text-sm opacity-80">{selectedLead.whatsapp_lead}</p>
            </div>
            {selectedLead.resumo_conversa && <div className="p-3 border rounded bg-white"><span className="text-xs text-gray-400 font-bold uppercase">Resumo</span><p className="text-sm italic mt-1">{selectedLead.resumo_conversa}</p></div>}
            {selectedLead.status === 'nao_converteu' && <div className="p-3 border border-rose-200 bg-rose-50 rounded"><span className="text-xs text-rose-600 font-bold uppercase">Motivo Perda</span><p className="text-sm font-medium mt-1">{selectedLead.motivo_perda}</p></div>}
            {selectedLead.status === 'converteu' && <div className="p-3 border border-green-200 bg-green-50 rounded"><span className="text-xs text-green-600 font-bold uppercase">Dados da Venda</span><div className="grid grid-cols-2 gap-2 mt-1"><div><p className="text-[10px] text-gray-500">Serviço</p><p className="text-sm font-bold">{selectedLead.procedimento_interesse}</p></div><div><p className="text-[10px] text-gray-500">Valor</p><p className="text-sm font-bold text-green-700">R$ {selectedLead.valor_pago?.toLocaleString('pt-BR')}</p></div></div></div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
