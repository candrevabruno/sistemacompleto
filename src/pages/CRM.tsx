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
  { id: 'compareceu', title: 'Compareceu', colorClass: 'border-green-600' },
  { id: 'faltou', title: 'Faltou', colorClass: 'border-slate-500' },
  { id: 'cancelou_agendamento', title: 'Cancelou Agendamento', colorClass: 'border-rose-400' },
  { id: 'follow_up', title: 'Follow Up', colorClass: 'border-sky-400' },
  { id: 'abandonou_conversa', title: 'Abandonou', colorClass: 'border-gray-400' }
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

  // Compareceu Confirmation
  const [confirmCompareceu, setConfirmCompareceu] = useState<{ leadId: string, sourceCol: string } | null>(null);

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

    // Sincronização em Tempo Real (Supabase Realtime)
    const leadsChannel = supabase
      .channel('crm-leads-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        (payload) => {
          console.log('Mudança detectada no banco:', payload);
          fetchLeads(); // Recarrega para garantir consistência total
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

    console.log(`Movendo lead ${leadId} de ${oldStatus} para ${newStatus}`);

    const lead = leads.find(l => l.id === leadId);
    if (!lead) {
      console.error("Lead não encontrado no estado local!");
      alert("Erro crítico: Lead não encontrado. Por favor, recarregue a página.");
      return;
    }

    // Agendado: abre modal para coletar dados do agendamento
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

    // Compareceu: confirma e aciona trigger DB
    if (newStatus === 'compareceu' && oldStatus !== 'compareceu') {
      setConfirmCompareceu({ leadId, sourceCol: oldStatus });
      return;
    }

    // Reagendado: abre modal para nova data e sincroniza agendamento
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

    // Demais colunas: update simples
    updateLeadState(leadId, newStatus);
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
    if (error) {
       console.error('Erro ao mover lead no Supabase:', error);
       updateLeadState(leadId, oldStatus);
       alert(`Erro ao salvar status: ${error.message}`);
    }
  };

  const updateLeadState = (id: string, newStatus: string) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
  };

  // ── AGENDADO ──────────────────────────────────────────────────────────────
  const confirmAgendadoAction = async () => {
    if (!confirmAgendado || !agendadoForm.dataHora) return;
    const { leadId, sourceCol, lead } = confirmAgendado;
    setSavingAgendado(true);

    try {
      // 1. Cria o agendamento na tabela agendamentos
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

      if (agError) {
        alert(`Erro ao criar agendamento: ${agError.message}`);
        return;
      }

      // 2. Atualiza o lead com referência ao agendamento
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          status: 'agendado',
          data_agendamento: new Date(agendadoForm.dataHora).toISOString(),
          agendamento_criado_em: new Date().toISOString(),
          id_agendamento: agendamento.id,
          modalidade: agendadoForm.modalidade
        })
        .eq('id', leadId);

      if (leadError) {
        console.error('Erro ao atualizar lead para agendado:', leadError);
        alert(`Erro ao atualizar lead: ${leadError.message}`);
        return;
      }

      updateLeadState(leadId, 'agendado');
      setConfirmAgendado(null);
      setAgendadoForm({ dataHora: '', procedimento: '', agendaId: '', modalidade: 'presencial' });
      fetchLeads();
    } finally {
      setSavingAgendado(false);
    }
  };

  const cancelAgendadoAction = () => {
    setConfirmAgendado(null);
    setAgendadoForm({ dataHora: '', procedimento: '', agendaId: '', modalidade: 'presencial' });
  };

  // ── COMPARECEU ───────────────────────────────────────────────────────────
  const confirmCompareceuAction = async () => {
    if (!confirmCompareceu) return;
    const { leadId, sourceCol } = confirmCompareceu;

    updateLeadState(leadId, 'compareceu');
    setConfirmCompareceu(null);

    const { error } = await supabase.from('leads').update({ status: 'compareceu' }).eq('id', leadId);
    if (error) {
       updateLeadState(leadId, sourceCol);
       alert('Erro ao marcar comparecimento.');
    }
  };

  const cancelCompareceuAction = () => {
    setConfirmCompareceu(null);
  };

  // ── REAGENDADO ──────────────────────────────────────────────────────────
  const confirmReagendadoAction = async () => {
    if (!confirmReagendado || !reagendadoForm.dataHora) {
      alert("Por favor, informe a nova data e horário.");
      return;
    }
    const { leadId, sourceCol, lead } = confirmReagendado;
    setSavingReagendado(true);

    try {
      const novaData = new Date(reagendadoForm.dataHora).toISOString();

      // 1. Atualizar o Agendamento vinculado
      // Se tiver id_agendamento, usamos ele. Se não tiver, buscamos pelo lead_id com status ativo
      let agId = lead.id_agendamento;
      if (!agId) {
        console.log("Buscando agendamento vinculado para o lead:", leadId);
        const { data: searchAg, error: searchError } = await supabase
          .from('agendamentos')
          .select('id')
          .eq('lead_id', leadId)
          .in('status', ['agendado', 'confirmado']) // Aceita ambos os status ativos
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (searchError) console.error("Erro na busca de agendamento:", searchError);
        if (searchAg && searchAg.length > 0) {
          agId = searchAg[0].id;
          console.log("Agendamento encontrado:", agId);
        }
      }

      if (agId) {
        const { error: agUpdateError } = await supabase
          .from('agendamentos')
          .update({ 
            data_hora_inicio: novaData,
            status: 'reagendado'
          })
          .eq('id', agId);
        
        if (agUpdateError) {
          console.error("Erro ao atualizar agendamento:", agUpdateError);
          // Opcional: decidimos se paramos aqui ou continuamos apenas no CRM
        }
      } else {
        console.warn("Nenhum agendamento vinculado encontrado para este lead. O status no CRM será atualizado sozinho.");
      }

      // 2. Atualizar o Lead
      const { error } = await supabase
        .from('leads')
        .update({
          status: 'reagendado',
          data_agendamento: novaData,
          id_agendamento: agId || lead.id_agendamento // Mantém o vínculo se acabamos de descobrir o ID
        })
        .eq('id', leadId);

      if (error) {
        alert(`Erro ao reagendar no CRM: ${error.message}`);
        return;
      }

      updateLeadState(leadId, 'reagendado');
      setConfirmReagendado(null);
      fetchLeads();
    } catch (err: any) {
      console.error("Erro interno ao reagendar:", err);
      alert("Ocorreu um erro interno ao processar o reagendamento.");
    } finally {
      setSavingReagendado(false);
    }
  };

  // ── NOVO LEAD ─────────────────────────────────────────────────────────────
  const handleSaveNewLead = async () => {
    if (!newLeadForm.whatsapp) return;
    const { error } = await supabase.from('leads').insert({
      whatsapp_lead: newLeadForm.whatsapp,
      nome_lead: newLeadForm.nome || null,
      procedimento_interesse: newLeadForm.procedimento || null,
      motivo_contato: newLeadForm.motivo || null,
      status: 'iniciou_atendimento'
    });
    if (error) {
      alert(`Erro ao criar lead: ${error.message}`);
      return;
    }
    setOpenNewLead(false);
    setNewLeadForm({ whatsapp: '', nome: '', procedimento: '', motivo: '' });
    fetchLeads();
  };

  const openDrawer = (lead: any) => {
    setSelectedLead(lead);
    setOpenLeadDetails(true);
  };

  // Organize cards by column for performance
  const cardsByCol = COLUMNS.reduce((acc, col) => {
    acc[col.id] = leads.filter(l => l.status === col.id);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--color-bg-base)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
             <p className="text-sm text-[var(--color-text-muted)] mt-1">Navegue os contatos pelos estágios de venda.</p>
          </div>
          <Button onClick={() => setOpenNewLead(true)} className="w-full sm:w-auto text-[var(--color-text-main)] font-bold"><Plus className="w-4 h-4 mr-2"/> Novo lead</Button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">Carregando CRM...</div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex h-full gap-4 items-start w-fit px-1">
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
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 overflow-y-auto p-2 space-y-3 transition-colors bg-[#F9FAFB]/80 ${snapshot.isDraggingOver ? 'bg-[var(--color-primary-light)]/40' : ''}`}
                        >
                          {colCards.map((card, index) => (
                            <Draggable key={card.id} draggableId={card.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  onClick={() => openDrawer(card)}
                                  style={provided.draggableProps.style}
                                  className={`bg-white p-4 rounded-[12px] border-l-4 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.06)] cursor-grab hover:shadow-md hover:-translate-y-0.5 transition-all ${col.colorClass} ${snapshot.isDragging ? 'opacity-90 scale-[1.02] shadow-xl ring-1 ring-[var(--color-primary)]/20' : ''}`}
                                >
                                  <div className="font-semibold text-sm line-clamp-1 mb-1">{card.nome_lead || 'Lead sem nome'}</div>
                                  <div className="text-xs text-[var(--color-text-muted)] mb-3">{card.whatsapp_lead}</div>

                                  {card.procedimento_interesse && (
                                    <div className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded mb-2 truncate border">
                                      {card.procedimento_interesse}
                                    </div>
                                  )}

                                  {card.data_agendamento && (
                                    <div className="flex items-center gap-1.5 mb-3">
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${card.modalidade === 'online' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {card.modalidade === 'online' ? '💻 Online' : '📍 Presencial'}
                                      </span>
                                    </div>
                                  )}

                                  <div className="flex justify-between items-center mt-auto">
                                    <Badge variant={card.status} className="scale-90 origin-left">{col.title}</Badge>
                                    <div className="text-[10px] text-[var(--color-text-muted)] font-medium">
                                      {card.ultima_mensagem ? `há ${formatDistanceToNow(parseISO(card.ultima_mensagem), { locale: ptBR })}` : 'Sem msg'}
                                    </div>
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

      {/* MODAL NOVO LEAD */}
      <Modal isOpen={openNewLead} onClose={() => setOpenNewLead(false)} title="Novo Lead Manual">
        <div className="space-y-4">
          <Input label="WhatsApp (Obrigatório)" placeholder="+5511999999999" value={newLeadForm.whatsapp} onChange={e => setNewLeadForm({...newLeadForm, whatsapp: e.target.value})} />
          <Input label="Nome do lead" placeholder="Ex: Maria" value={newLeadForm.nome} onChange={e => setNewLeadForm({...newLeadForm, nome: e.target.value})} />
          <Input label="Serviço de interesse" placeholder="Ex: Inventário, Divórcio, Consultoria" value={newLeadForm.procedimento} onChange={e => setNewLeadForm({...newLeadForm, procedimento: e.target.value})} />
          <Input label="Motivo do contato" placeholder="Ex: Veio pelo Instagram" value={newLeadForm.motivo} onChange={e => setNewLeadForm({...newLeadForm, motivo: e.target.value})} />
          <Button onClick={handleSaveNewLead} className="w-full" disabled={!newLeadForm.whatsapp}>Criar Lead</Button>
        </div>
      </Modal>

      {/* MODAL AGENDAMENTO (ao arrastar para "Agendado") */}
      <Modal isOpen={!!confirmAgendado} onClose={cancelAgendadoAction} title="Registrar Agendamento">
        <div className="space-y-4">
          <div className="p-3 bg-[#7A9E87]/10 border border-[#7A9E87] rounded-[8px] text-[#7A9E87] font-medium text-sm">
            📅 Preencha os dados do agendamento de <strong>{confirmAgendado?.lead?.nome_lead || confirmAgendado?.lead?.whatsapp_lead}</strong>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Data e Horário <span className="text-red-500">*</span></label>
            <input
              type="datetime-local"
              value={agendadoForm.dataHora}
              onChange={e => setAgendadoForm({...agendadoForm, dataHora: e.target.value})}
              className="w-full border border-[var(--color-border-card)] rounded-[8px] px-3 py-2 text-sm bg-[var(--color-bg-base)] text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Serviço</label>
            <input
              type="text"
              placeholder="Ex: Inventário, Divórcio, Consultoria..."
              value={agendadoForm.procedimento}
              onChange={e => setAgendadoForm({...agendadoForm, procedimento: e.target.value})}
              className="w-full border border-[var(--color-border-card)] rounded-[8px] px-3 py-2 text-sm bg-[var(--color-bg-base)] text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {agendas.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Agenda</label>
              <select
                value={agendadoForm.agendaId}
                onChange={e => setAgendadoForm({...agendadoForm, agendaId: e.target.value})}
                className="w-full border border-[var(--color-border-card)] rounded-[8px] px-3 py-2 text-sm bg-[var(--color-bg-base)] text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="">— Sem agenda definida —</option>
                {agendas.map(a => (
                  <option key={a.id} value={a.id}>{a.nome}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Modalidade</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="modalidade" value="presencial" checked={agendadoForm.modalidade === 'presencial'} onChange={e => setAgendadoForm({...agendadoForm, modalidade: e.target.value})} />
                <span className="text-sm">📍 Presencial</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="modalidade" value="online" checked={agendadoForm.modalidade === 'online'} onChange={e => setAgendadoForm({...agendadoForm, modalidade: e.target.value})} />
                <span className="text-sm">💻 Online</span>
              </label>
            </div>
          </div>

          <p className="text-xs text-[var(--color-text-muted)]">
            O agendamento será criado automaticamente na aba <strong>Agenda</strong> e o lead será marcado como <strong>Agendado</strong>.
          </p>

          <div className="flex gap-3 justify-end mt-4">
            <Button variant="secondary" onClick={cancelAgendadoAction}>Cancelar</Button>
            <Button
              className="bg-[#7A9E87] text-white hover:bg-[#5f8a6e] border-none"
              onClick={confirmAgendadoAction}
              disabled={!agendadoForm.dataHora || savingAgendado}
            >
              {savingAgendado ? 'Salvando...' : 'Confirmar Agendamento'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* CONFIRMAÇÃO COMPARECEU */}
      <Modal isOpen={!!confirmCompareceu} onClose={cancelCompareceuAction} title="Confirmar Comparecimento">
        <div className="space-y-4">
          <div className="p-4 bg-[var(--color-success)]/10 border border-[var(--color-success)] rounded-[8px] text-[var(--color-success)] font-medium">
            Confirmar que este lead compareceu à clínica?
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">Ao confirmar, o sistema promoverá este lead automaticamente para a base de <strong>Clientes</strong>.</p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="secondary" onClick={cancelCompareceuAction}>Cancelar</Button>
            <Button className="bg-[var(--color-success)] text-white hover:bg-green-700 border-none" onClick={confirmCompareceuAction}>Confirmar Comparecimento</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL REAGENDAR / GOOGLE CALENDAR AVISO */}
      <Modal isOpen={!!confirmReagendado} onClose={() => {
        if(confirmReagendado?.leadId) updateLeadState(confirmReagendado.leadId, confirmReagendado.sourceCol);
        setConfirmReagendado(null);
      }} title="Reagendar Lead (Cal.com)">
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-[8px] text-amber-800 text-sm font-medium">
             <h4 className="font-bold flex items-center gap-2 mb-2">Aviso de Sincronia</h4>
             <p>Lembre-se de primeiro remarcar o horário remotamente usando o painel central do <strong>Cal.com</strong>.</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Qual foi a nova data e horário definida no Cal.com? <span className="text-red-500">*</span></label>
            <input
              type="datetime-local"
              value={reagendadoForm.dataHora}
              onChange={e => setReagendadoForm({...reagendadoForm, dataHora: e.target.value})}
              className="w-full border border-[var(--color-border-card)] rounded-[8px] px-3 py-2 text-sm bg-[var(--color-bg-base)] text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Modalidade</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="modalidade_re" value="presencial" checked={reagendadoForm.modalidade === 'presencial'} onChange={e => setReagendadoForm({...reagendadoForm, modalidade: e.target.value})} />
                <span className="text-sm">📍 Presencial</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="modalidade_re" value="online" checked={reagendadoForm.modalidade === 'online'} onChange={e => setReagendadoForm({...reagendadoForm, modalidade: e.target.value})} />
                <span className="text-sm">💻 Online</span>
              </label>
            </div>
          </div>
          
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="secondary" onClick={() => {
               if(confirmReagendado?.leadId) updateLeadState(confirmReagendado.leadId, confirmReagendado.sourceCol);
               setConfirmReagendado(null);
            }}>Cancelar</Button>
            <Button
              className="bg-amber-500 text-white hover:bg-amber-600 border-none"
              onClick={confirmReagendadoAction}
              disabled={!reagendadoForm.dataHora || savingReagendado}
            >
              {savingReagendado ? 'Salvando...' : 'Confirmar Reagendamento'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* DRAWER DETALHES DO LEAD */}
      <Modal isOpen={openLeadDetails} onClose={() => setOpenLeadDetails(false)} title="Detalhes do Contato">
        {selectedLead && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            <div className="flex items-center gap-4 bg-[var(--color-primary-light)] p-4 rounded-[12px] border border-[var(--color-border-card)]">
               <div className="flex-1">
                 <h2 className="font-cormorant text-2xl font-bold">{selectedLead.nome_lead || 'Lead sem nome'}</h2>
                 <p className="text-sm font-medium opacity-80 mt-1">{selectedLead.whatsapp_lead}</p>
                 <div className="mt-2">
                   <label className="text-xs text-gray-500 block mb-1">Etapa do funil</label>
                   <select
                     value={selectedLead.status}
                     disabled={savingStatus}
                     onChange={e => handleStatusChange(selectedLead.id, e.target.value)}
                     className="text-sm font-medium border border-gray-300 rounded-[6px] px-2 py-1.5 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-60 w-full"
                   >
                     {COLUMNS.map(col => (
                       <option key={col.id} value={col.id}>{col.title}</option>
                     ))}
                   </select>
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 border p-3 rounded-[8px]">
                <div className="text-xs text-gray-500 mb-1 flex items-center"><Calendar className="w-3 h-3 mr-1"/> Iniciado em</div>
                <div className="text-sm font-medium">{selectedLead.inicio_atendimento ? format(parseISO(selectedLead.inicio_atendimento), 'dd/MM/yyyy HH:mm') : '-'}</div>
              </div>
              <div className="bg-gray-50 border p-3 rounded-[8px]">
                <div className="text-xs text-gray-500 mb-1 flex items-center"><Clock className="w-3 h-3 mr-1"/> Última interação</div>
                <div className="text-sm font-medium">{selectedLead.ultima_mensagem ? format(parseISO(selectedLead.ultima_mensagem), 'dd/MM/yyyy HH:mm') : '-'}</div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm border-b pb-1">Informações de Negócio</h3>
              <div className="flex flex-col gap-2">
                <div className="flex flex-col p-2 border rounded bg-white gap-1"><span className="text-xs text-gray-500">Serviço de interesse</span><span className="text-sm font-medium">{selectedLead.procedimento_interesse || '-'}</span></div>
                <div className="flex flex-col p-2 border rounded bg-white gap-1"><span className="text-xs text-gray-500">Motivo do contato</span><span className="text-sm font-medium">{selectedLead.motivo_contato || '-'}</span></div>
                {selectedLead.data_agendamento && (
                  <>
                    <div className="flex flex-col p-2 border rounded bg-white gap-1">
                      <span className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wider">Dados do Agendamento</span>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Data e Hora</span>
                          <span className="text-sm font-bold text-[var(--color-primary)]">{format(parseISO(selectedLead.data_agendamento), 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Modalidade</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-bold ${selectedLead.modalidade === 'online' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                            {selectedLead.modalidade === 'online' ? '💻 ONLINE' : '📍 PRESENCIAL'}
                          </span>
                        </div>
                        {selectedLead.link_meet && (
                          <div className="flex flex-col mt-1 p-2 bg-blue-50 border border-blue-200 rounded">
                            <span className="text-[10px] text-blue-600 font-bold mb-1 uppercase">Link da Reunião</span>
                            <a href={selectedLead.link_meet} target="_blank" rel="noopener noreferrer" className="text-blue-700 text-xs font-semibold underline truncate">
                              Acessar Google Meet
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

             <div className="space-y-3">
              <h3 className="font-semibold text-sm border-b pb-1">Follow Ups (Tentativas)</h3>
              <ul className="text-sm space-y-1">
                <li className="flex justify-between border-b border-dashed py-1.5"><span className="text-gray-600">Follow up 1:</span> <span className="font-medium">{selectedLead.follow_up_1 ? format(parseISO(selectedLead.follow_up_1), 'dd/MM HH:mm') : 'Pendente'}</span></li>
                <li className="flex justify-between border-b border-dashed py-1.5"><span className="text-gray-600">Follow up 2:</span> <span className="font-medium">{selectedLead.follow_up_2 ? format(parseISO(selectedLead.follow_up_2), 'dd/MM HH:mm') : 'Pendente'}</span></li>
                <li className="flex justify-between border-b border-dashed py-1.5"><span className="text-gray-600">Follow up 3:</span> <span className="font-medium">{selectedLead.follow_up_3 ? format(parseISO(selectedLead.follow_up_3), 'dd/MM HH:mm') : 'Pendente'}</span></li>
              </ul>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
