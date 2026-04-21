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
import { Plus, User, FileText, Calendar, DollarSign, Clock, Trash2 } from 'lucide-react';

const COLUMNS = [
  { id: 'iniciou_atendimento', title: 'Iniciou', colorClass: 'border-[var(--color-primary)]' },
  { id: 'conversando', title: 'Conversando', colorClass: 'border-[var(--color-text-main)]' },
  { id: 'agendado', title: 'Agendado', colorClass: 'border-emerald-500' },
  { id: 'reagendado', title: 'Reagendado', colorClass: 'border-amber-400' },
  { id: 'faltou', title: 'Faltou', colorClass: 'border-slate-500' },
  { id: 'cancelou_agendamento', title: 'Cancelou Agendamento', colorClass: 'border-rose-400' },
  { id: 'converteu', title: 'Converteu (Venda)', colorClass: 'border-green-600 font-bold' },
  { id: 'nao_converteu', title: 'Não Converteu', colorClass: 'border-rose-600' }
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

  // Lead Details Edit State
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState({ 
    genero: '', 
    data_nascimento: '', 
    observacoes: '',
    nome_lead: '',
    procedimento_interesse: ''
  });
  const [savingDetails, setSavingDetails] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase.from('leads').select('*').order('ultima_mensagem', { ascending: false });
    if (data) setLeads(data);
    setLoading(false);
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    // Se for um status que exige modal, abrimos o modal em vez de salvar direto
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    if (newStatus === 'converteu') {
      setConverteuForm({ servico: lead.procedimento_interesse || '', valor: String(lead.valor_pago || ''), observacao: '' });
      setConfirmConverteu({ leadId, sourceCol: lead.status, lead });
      return;
    }
    if (newStatus === 'nao_converteu') {
      setNaoConverteuForm({ motivo: lead.motivo_perda || '' });
      setConfirmNaoConverteu({ leadId, sourceCol: lead.status, lead });
      return;
    }
    if (newStatus === 'agendado') {
        setAgendadoForm({ dataHora: '', procedimento: lead.procedimento_interesse || '', agendaId: agendas[0]?.id || '', modalidade: 'presencial' });
        setConfirmAgendado({ leadId, sourceCol: lead.status, lead });
        return;
    }

    setSavingStatus(true);
    
    // Reset logic: se estiver saindo de converteu ou nao_converteu, limpa os campos financeiros/perda
    const updates: any = { status: newStatus };
    if (['converteu', 'nao_converteu'].includes(lead.status)) {
       updates.valor_pago = 0;
       updates.motivo_perda = null;
    }

    await supabase.from('leads').update(updates).eq('id', leadId);
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));
    setSelectedLead((prev: any) => ({ ...prev, ...updates }));
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

    const updates: any = { status: newStatus };
    if (['converteu', 'nao_converteu'].includes(oldStatus)) {
       updates.valor_pago = 0;
       updates.motivo_perda = null;
    }

    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));
    const { error } = await supabase.from('leads').update(updates).eq('id', leadId);
    if (error) {
       setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: oldStatus } : l));
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
          observacoes: converteuForm.observacao ? `${confirmConverteu.lead.observacoes || ''}\nInformações Complementares: ${converteuForm.observacao}` : confirmConverteu.lead.observacoes
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
        await supabase.from('agendamentos').update({ data_hora_inicio: novaData, status: 'reagendado', modalidade: reagendadoForm.modalidade }).eq('id', lead.id_agendamento);
      }
      await supabase.from('leads').update({ status: 'reagendado', data_agendamento: novaData, modalidade: reagendadoForm.modalidade }).eq('id', leadId);
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

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('Tem certeza que deseja excluir permanentemente este lead?')) return;
    await supabase.from('leads').delete().eq('id', leadId);
    setLeads(prev => prev.filter(l => l.id !== leadId));
  };

  const handleUpdateDetails = async () => {
    if (!selectedLead) return;
    setSavingDetails(true);
    try {
      const { error } = await supabase.from('leads').update({
        nome_lead: detailsForm.nome_lead,
        genero: detailsForm.genero,
        data_nascimento: detailsForm.data_nascimento || null,
        observacoes: detailsForm.observacoes,
        procedimento_interesse: detailsForm.procedimento_interesse
      }).eq('id', selectedLead.id);
      
      if (error) throw error;
      
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, ...detailsForm } : l));
      setSelectedLead((prev: any) => ({ ...prev, ...detailsForm }));
      setEditingDetails(false);
    } catch (err: any) {
      alert(`Erro ao salvar detalhes: ${err.message}`);
    } finally {
      setSavingDetails(false);
    }
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
                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={`bg-white p-4 rounded-[12px] border-l-4 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.06)] cursor-grab hover:shadow-md hover:-translate-y-0.5 transition-all group relative ${col.colorClass} ${snapshot.isDragging ? 'opacity-90 scale-[1.02] shadow-xl ring-1 ring-[var(--color-primary)]/20' : ''}`} onClick={() => { 
                                  setSelectedLead(card); 
                                  setDetailsForm({
                                    nome_lead: card.nome_lead || '',
                                    genero: card.genero || '',
                                    data_nascimento: card.data_nascimento || '',
                                    observacoes: card.observacoes || '',
                                    procedimento_interesse: card.procedimento_interesse || ''
                                  });
                                  setEditingDetails(false);
                                  setOpenLeadDetails(true); 
                                }}>
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteLead(card.id); }} className="absolute top-2 right-2 p-1 text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                  <div className="font-semibold text-sm line-clamp-1 mb-1 pr-6">{card.nome_lead || 'Lead sem nome'}</div>
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
          <div>
            <label className="block text-sm font-medium mb-1">Modalidade</label>
            <select value={agendadoForm.modalidade} onChange={e => setAgendadoForm({...agendadoForm, modalidade: e.target.value})} className="w-full border rounded-[8px] px-3 py-2 text-sm">
              <option value="presencial">Presencial</option>
              <option value="online">Online</option>
            </select>
          </div>
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
          <div><label className="block text-sm font-medium mb-1">Informações Complementares</label><textarea rows={3} value={converteuForm.observacao} onChange={e => setConverteuForm({...converteuForm, observacao: e.target.value})} className="w-full border rounded-[8px] px-3 py-2 text-sm bg-[var(--color-bg-base)]" /></div>
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
          <div>
            <label className="block text-sm font-medium mb-1">Modalidade</label>
            <select value={reagendadoForm.modalidade} onChange={e => setReagendadoForm({...reagendadoForm, modalidade: e.target.value})} className="w-full border rounded-[8px] px-3 py-2 text-sm">
              <option value="presencial">Presencial</option>
              <option value="online">Online</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="secondary" onClick={() => setConfirmReagendado(null)}>Cancelar</Button>
            <Button className="bg-amber-500 text-white" onClick={confirmReagendadoAction} disabled={!reagendadoForm.dataHora || savingReagendado}>Salvar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={openLeadDetails} onClose={() => setOpenLeadDetails(false)} title="Detalhes do Contato">
        {selectedLead && (
          <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
            {/* Header com Status */}
            <div className="bg-gray-50 p-5 rounded-[16px] border border-[var(--color-border-card)] shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    {editingDetails ? (
                       <Input value={detailsForm.nome_lead} onChange={e => setDetailsForm({...detailsForm, nome_lead: e.target.value})} className="text-xl font-bold font-cormorant mb-1" />
                    ) : (
                       <h2 className="font-cormorant text-2xl font-bold text-[var(--color-text-main)]">{selectedLead.nome_lead || 'Lead sem nome'}</h2>
                    )}
                    <p className="text-sm text-[var(--color-text-muted)] font-medium">{selectedLead.whatsapp_lead}</p>
                  </div>
                  <Badge variant={selectedLead.status}>{COLUMNS.find(c => c.id === selectedLead.status)?.title}</Badge>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">Mudar Estágio</label>
                  <select 
                    value={selectedLead.status} 
                    onChange={(e) => handleStatusChange(selectedLead.id, e.target.value)}
                    disabled={savingStatus}
                    className="w-full bg-white border border-[var(--color-border-card)] rounded-[8px] px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                  >
                    {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
            </div>

            {/* Grid de Informações - Editável */}
            <div className="grid grid-cols-2 gap-4">
               <div className="p-3 bg-[var(--color-bg-base)] rounded-[12px] border border-[var(--color-border-card)]">
                  <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase">Gênero</span>
                  {editingDetails ? (
                    <select 
                      value={detailsForm.genero} 
                      onChange={e => setDetailsForm({...detailsForm, genero: e.target.value})}
                      className="w-full mt-1 border rounded px-2 py-1 text-sm bg-white"
                    >
                      <option value="">Não informado</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Outro">Outro</option>
                    </select>
                  ) : (
                    <p className="text-sm font-medium mt-1">{selectedLead.genero || 'Não informado'}</p>
                  )}
               </div>
               <div className="p-3 bg-[var(--color-bg-base)] rounded-[12px] border border-[var(--color-border-card)]">
                  <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase">Nascimento</span>
                  {editingDetails ? (
                    <input 
                      type="date" 
                      value={detailsForm.data_nascimento} 
                      onChange={e => setDetailsForm({...detailsForm, data_nascimento: e.target.value})}
                      className="w-full mt-1 border rounded px-2 py-1 text-sm bg-white"
                    />
                  ) : (
                    <p className="text-sm font-medium mt-1">{selectedLead.data_nascimento ? format(parseISO(selectedLead.data_nascimento), 'dd/MM/yyyy') : 'Não informado'}</p>
                  )}
               </div>
               <div className="p-3 bg-[var(--color-bg-base)] rounded-[12px] border border-[var(--color-border-card)]">
                  <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase">Serviço/Assunto</span>
                  {editingDetails ? (
                    <Input 
                      value={detailsForm.procedimento_interesse} 
                      onChange={e => setDetailsForm({...detailsForm, procedimento_interesse: e.target.value})}
                      className="mt-1 h-8"
                    />
                  ) : (
                    <p className="text-sm font-medium mt-1">{selectedLead.procedimento_interesse || 'Não informado'}</p>
                  )}
               </div>
               <div className="p-3 bg-[var(--color-bg-base)] rounded-[12px] border border-[var(--color-border-card)]">
                  <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase">Agendamento</span>
                  <p className="text-sm font-medium mt-1">{selectedLead.data_agendamento ? format(parseISO(selectedLead.data_agendamento), "dd/MM 'às' HH:mm", { locale: ptBR }) : 'Sem agendamento'}</p>
               </div>
            </div>

            {/* Ação de Edição */}
            <div className="flex gap-2">
              {editingDetails ? (
                <>
                  <Button onClick={handleUpdateDetails} disabled={savingDetails} className="flex-1 bg-green-600">Salvar Alterações</Button>
                  <Button variant="secondary" onClick={() => setEditingDetails(false)}>Cancelar</Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => setEditingDetails(true)} className="w-full">Editar Informações</Button>
              )}
            </div>

            {/* Resumo e Observações/Histórico */}
            <div className="space-y-4">
              {selectedLead.resumo_conversa && !editingDetails && (
                <div className="p-4 border border-[var(--color-border-card)] rounded-[12px] bg-white relative">
                  <span className="absolute -top-2 left-3 bg-white px-2 text-[10px] text-[var(--color-primary)] font-bold uppercase tracking-tight">IA - Resumo Automático</span>
                  <p className="text-sm text-[var(--color-text-main)] italic leading-relaxed pt-1">"{selectedLead.resumo_conversa}"</p>
                </div>
              )}

              {selectedLead.status === 'nao_converteu' && selectedLead.motivo_perda && (
                <div className="p-4 border-l-4 border-rose-500 bg-rose-50 rounded-[12px]">
                   <span className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">Motivo da Não Conversão</span>
                   <p className="text-sm font-medium text-rose-900 mt-1">{selectedLead.motivo_perda}</p>
                </div>
              )}

              {selectedLead.status === 'converteu' && selectedLead.valor_pago > 0 && (
                <div className="p-4 border-l-4 border-green-500 bg-green-50 rounded-[12px] flex justify-between items-center">
                   <div>
                     <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Negócio Fechado</span>
                     <p className="text-lg font-bold text-green-900 mt-1">R$ {selectedLead.valor_pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                   </div>
                   <DollarSign className="w-8 h-8 text-green-200" />
                </div>
              )}

              <div className="p-4 bg-gray-50 rounded-[12px] border border-[var(--color-border-card)]">
                <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Histórico / Observações Manuais</span>
                {editingDetails ? (
                  <textarea 
                    rows={4} 
                    value={detailsForm.observacoes} 
                    onChange={e => setDetailsForm({...detailsForm, observacoes: e.target.value})}
                    className="w-full mt-2 border rounded p-2 text-sm bg-white"
                    placeholder="Escreva algo aqui..."
                  />
                ) : (
                  <p className="text-sm text-[var(--color-text-main)] mt-2 whitespace-pre-wrap">{selectedLead.observacoes || 'Nenhuma observação manual registrada.'}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
