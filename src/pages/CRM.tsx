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
  { id: 'iniciou_atendimento', title: 'Iniciou', colorClass: 'border-[#C47E7E]' },
  { id: 'conversando', title: 'Conversando', colorClass: 'border-blue-400' },
  { id: 'agendado', title: 'Agendado', colorClass: 'border-[#7A9E87]' },
  { id: 'compareceu', title: 'Compareceu', colorClass: 'border-green-500' },
  { id: 'faltou', title: 'Faltou', colorClass: 'border-gray-600' },
  { id: 'cancelou_agendamento', title: 'Cancelou Agendamento', colorClass: 'border-[#E8A87C]' },
  { id: 'follow_up', title: 'Follow Up', colorClass: 'border-amber-400' },
  { id: 'abandonou_conversa', title: 'Abandonou', colorClass: 'border-red-500' }
];

export function CRM() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Lead
  const [openNewLead, setOpenNewLead] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({ whatsapp: '', nome: '', procedimento: '', motivo: '' });

  // Compareceu Confirmation
  const [confirmCompareceu, setConfirmCompareceu] = useState<{ leadId: string, sourceCol: string } | null>(null);

  // Lead Details
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [openLeadDetails, setOpenLeadDetails] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase.from('leads').select('*').order('ultima_mensagem', { ascending: false });
    if (data) setLeads(data);
    setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, []);

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const leadId = draggableId;
    const oldStatus = source.droppableId;
    const newStatus = destination.droppableId;

    if (newStatus === 'compareceu' && oldStatus !== 'compareceu') {
      setConfirmCompareceu({ leadId, sourceCol: oldStatus });
      return;
    }

    // Optimistic UI update
    updateLeadState(leadId, newStatus);
    
    // DB update
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
    if (error) {
       updateLeadState(leadId, oldStatus); // revert
       alert('Erro ao mover lead.');
    }
  };

  const updateLeadState = (id: string, newStatus: string) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
  };

  const confirmCompareceuAction = async () => {
    if (!confirmCompareceu) return;
    const { leadId, sourceCol } = confirmCompareceu;
    
    updateLeadState(leadId, 'compareceu');
    setConfirmCompareceu(null);

    const { error } = await supabase.from('leads').update({ status: 'compareceu' }).eq('id', leadId);
    if (error) {
       updateLeadState(leadId, sourceCol);
       console.error('ERRO COMPARECEU DETALHADO:', JSON.stringify(error));
       alert(`Erro ao marcar comparecimento.\n\nDetalhes: ${error.message}\nCódigo: ${error.code}`);
    } else {
       // O DB trigger converte para Paciente. O card ficará no kanban com status 'compareceu' pois mantemos o lead visível
       // de acordo as regras ("o registro em leads é mantido").
    }
  };

  const cancelCompareceuAction = () => {
    setConfirmCompareceu(null);
  };

  const handleSaveNewLead = async () => {
    if (!newLeadForm.whatsapp) return;
    await supabase.from('leads').insert({
      whatsapp_lead: newLeadForm.whatsapp,
      nome_lead: newLeadForm.nome,
      procedimento_interesse: newLeadForm.procedimento,
      historico_conversa: newLeadForm.motivo,
      status: 'iniciou_atendimento'
    });
    setOpenNewLead(false);
    setNewLeadForm({ whatsapp: '', nome: '', procedimento: '', motivo: '' });
    fetchLeads();
  };

  const openDrawer = (lead: any) => {
    setSelectedLead(lead);
    setOpenLeadDetails(true);
  };

  // Organize cards by column map for performance
  const cardsByCol = COLUMNS.reduce((acc, col) => {
    acc[col.id] = leads.filter(l => l.status === col.id);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--color-bg-base)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
         <div>
            <h1 className="font-cormorant text-2xl font-bold">CRM — Funil de Atendimento</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Navegue os contatos pelos estágios de venda.</p>
         </div>
         <Button onClick={() => setOpenNewLead(true)} className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-2"/> Novo lead</Button>
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
                  <div key={col.id} className={`flex flex-col flex-shrink-0 w-[300px] h-full max-h-full bg-[var(--color-bg-sidebar)] rounded-[12px] border border-[var(--color-border-card)] border-t-4 shadow-sm ${col.colorClass}`}>
                    <div className="p-3 font-semibold text-[var(--color-text-main)] flex justify-between items-center bg-white/50 border-b border-[var(--color-border-card)] rounded-t-[10px]">
                      <span className="truncate pr-2">{col.title}</span>
                      <span className="bg-white border rounded-full px-2 py-0.5 text-xs text-[var(--color-text-muted)] font-mono">{colCards.length}</span>
                    </div>

                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 overflow-y-auto p-2 space-y-2 transition-colors ${snapshot.isDraggingOver ? 'bg-[var(--color-primary-light)]/50' : ''}`}
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
                                  className={`bg-[var(--color-bg-card)] p-3 rounded-[8px] border-2 shadow-[var(--shadow-card)] cursor-grab hover:border-[var(--color-primary)] transition-colors ${col.colorClass} ${snapshot.isDragging ? 'opacity-90 scale-[1.02] shadow-lg ring-2 ring-[var(--color-primary)]' : ''}`}
                                >
                                  <div className="font-semibold text-sm line-clamp-1 mb-1">{card.nome_lead || 'Lead sem nome'}</div>
                                  <div className="text-xs text-[var(--color-text-muted)] mb-3">{card.whatsapp_lead}</div>
                                  
                                  {card.procedimento_interesse && (
                                    <div className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded mb-3 truncate border">
                                      {card.procedimento_interesse}
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
          <Input label="Procedimento de interesse" placeholder="Ex: Botox" value={newLeadForm.procedimento} onChange={e => setNewLeadForm({...newLeadForm, procedimento: e.target.value})} />
          <Input label="Motivo do contato" placeholder="Ex: Veio pelo Instagram" value={newLeadForm.motivo} onChange={e => setNewLeadForm({...newLeadForm, motivo: e.target.value})} />
          <Button onClick={handleSaveNewLead} className="w-full" disabled={!newLeadForm.whatsapp}>Criar Lead</Button>
        </div>
      </Modal>

      {/* CONFIRMAÇÃO COMPARECEU */}
      <Modal isOpen={!!confirmCompareceu} onClose={cancelCompareceuAction} title="Confirmar Comparecimento">
        <div className="space-y-4">
          <div className="p-4 bg-[var(--color-success)]/10 border border-[var(--color-success)] rounded-[8px] text-[var(--color-success)] font-medium">
            Confirmar que este lead compareceu à clínica?
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">Ao confirmar, o sistema promoverá este lead automaticamente para a base de <strong>Pacientes</strong> (tabela de Pacientes da clínica).</p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="secondary" onClick={cancelCompareceuAction}>Cancelar</Button>
            <Button className="bg-[var(--color-success)] text-white hover:bg-green-700 border-none" onClick={confirmCompareceuAction}>Confirmar Comparecimento</Button>
          </div>
        </div>
      </Modal>

      {/* DRAWER DETALHES DO LEAD (usando componente Modal como base centralizada para facilidade, as specs indicam Modal/Drawer lateral, mas o funcionamento e o conteudo sao os mesmos) */}
      <Modal isOpen={openLeadDetails} onClose={() => setOpenLeadDetails(false)} title="Detalhes do Contato">
        {selectedLead && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            <div className="flex items-center gap-4 bg-[var(--color-primary-light)] p-4 rounded-[12px] border border-[var(--color-border-card)]">
               <div className="flex-1">
                 <h2 className="font-cormorant text-2xl font-bold">{selectedLead.nome_lead || 'Lead sem nome'}</h2>
                 <p className="text-sm font-medium opacity-80 mt-1">{selectedLead.whatsapp_lead}</p>
                 <Badge variant={selectedLead.status} className="mt-2">{selectedLead.status}</Badge>
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
                <div className="flex flex-col p-2 border rounded bg-white gap-1"><span className="text-xs text-gray-500">Procedimento de interesse</span><span className="text-sm font-medium">{selectedLead.procedimento_interesse || '-'}</span></div>
                <div className="flex flex-col p-2 border rounded bg-white gap-1"><span className="text-xs text-gray-500">Motivo do contato</span><span className="text-sm font-medium">{selectedLead.historico_conversa || '-'}</span></div>
                {selectedLead.data_agendamento && <div className="flex flex-col p-2 border rounded bg-white gap-1"><span className="text-xs text-gray-500">Data Agendada Inicial</span><span className="text-sm font-medium">{format(parseISO(selectedLead.data_agendamento), 'dd/MM/yyyy HH:mm')}</span></div>}
              </div>
            </div>

             <div className="space-y-3">
              <h3 className="font-semibold text-sm border-b pb-1">Follow Ups (Tentativas)</h3>
              <ul className="text-sm space-y-1">
                <li className="flex justify-between border-b border-dashed py-1.5"><span className="text-gray-600">Follow up 1:</span> <span className="font-medium">{selectedLead.data_followup_1 ? format(parseISO(selectedLead.data_followup_1), 'dd/MM HH:mm') : 'Pendente'}</span></li>
                <li className="flex justify-between border-b border-dashed py-1.5"><span className="text-gray-600">Follow up 2:</span> <span className="font-medium">{selectedLead.data_followup_2 ? format(parseISO(selectedLead.data_followup_2), 'dd/MM HH:mm') : 'Pendente'}</span></li>
                <li className="flex justify-between border-b border-dashed py-1.5"><span className="text-gray-600">Follow up 3:</span> <span className="font-medium">{selectedLead.data_followup_3 ? format(parseISO(selectedLead.data_followup_3), 'dd/MM HH:mm') : 'Pendente'}</span></li>
              </ul>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
