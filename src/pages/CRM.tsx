import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { format } from 'date-fns';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Trash2 } from 'lucide-react';
import { LeadDetailsModal } from '../components/crm/LeadDetailsModal';


// ── Modal style tokens ────────────────────────────────────────────────────────

const crmFormLabel: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: 600,
  letterSpacing: '0.8px', textTransform: 'uppercase',
  color: 'var(--muted)', marginBottom: '5px',
};

const crmBtnGhost: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  background: 'transparent', color: 'var(--muted)',
  border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)',
  padding: '7px 13px', fontSize: '12px', fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit',
};

const crmBtnPrimary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  background: 'var(--sage-dark)', color: 'white', border: 'none',
  borderRadius: 'var(--r-xs)', padding: '7px 14px',
  fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
};

const crmBtnDanger: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  background: '#dc2626', color: 'white', border: 'none',
  borderRadius: 'var(--r-xs)', padding: '7px 14px',
  fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
};

const COLUMNS = [
  { id: 'iniciou_atendimento', title: 'Iniciou', colorClass: 'border-[var(--sage-dark)]' },
  { id: 'conversando', title: 'Conversando', colorClass: 'border-[var(--ink)]' },
  { id: 'follow_up', title: 'Follow-Up', colorClass: 'border-blue-500' },
  { id: 'agendado', title: 'Agendado', colorClass: 'border-emerald-500' },
  { id: 'retorno', title: 'Retorno', colorClass: 'border-[var(--sage-dark)]' },
  { id: 'reagendado', title: 'Reagendado', colorClass: 'border-amber-400' },
  { id: 'faltou', title: 'Faltou', colorClass: 'border-slate-500' },
  { id: 'cancelou_agendamento', title: 'Cancelou Agendamento', colorClass: 'border-rose-400' },
  { id: 'converteu', title: 'Converteu (Venda)', colorClass: 'border-green-600 font-bold' },
  { id: 'nao_converteu', title: 'Não Converteu', colorClass: 'border-rose-600' },
  { id: 'abandonou_conversa', title: 'Abandonou', colorClass: 'border-gray-400' }
];

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map((p: string) => p[0]).slice(0, 2).join('').toUpperCase();
}

const COLUMN_STRIPE: Record<string, string> = {
  iniciou_atendimento: 'var(--champ)',
  conversando: '#93C5FD',
  follow_up: 'var(--sage)',
  agendado: '#C4B5FD',
  reagendado: '#FCD34D',
  faltou: '#94A3B8',
  cancelou_agendamento: '#F87171',
  converteu: 'var(--sage-dark)',
  nao_converteu: '#F87171',
  abandonou_conversa: '#CBD5E1',
};

const COLUMN_BADGE: Record<string, { bg: string; color: string }> = {
  iniciou_atendimento: { bg: 'var(--champ-light)', color: 'var(--champ-text)' },
  conversando: { bg: '#EFF6FF', color: '#1D4ED8' },
  follow_up: { bg: 'var(--sage-xlight)', color: 'var(--sage-dark)' },
  agendado: { bg: '#F3E8FF', color: '#7C3AED' },
  reagendado: { bg: 'var(--champ-light)', color: 'var(--champ-text)' },
  faltou: { bg: '#F1F5F9', color: '#64748B' },
  cancelou_agendamento: { bg: 'var(--rose-light)', color: 'var(--rose-text)' },
  converteu: { bg: 'var(--sage-xlight)', color: 'var(--sage-dark)' },
  nao_converteu: { bg: 'var(--rose-light)', color: 'var(--rose-text)' },
  abandonou_conversa: { bg: '#F1F5F9', color: '#64748B' },
};

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
  const [converteuForm, setConverteuForm] = useState<{ servicos: string[], valor: string, observacao: string }>({ servicos: [], valor: '', observacao: '' });
  const [savingConverteu, setSavingConverteu] = useState(false);
  const [availableServicos, setAvailableServicos] = useState<any[]>([]);

  // Não Converteu Modal
  const [confirmNaoConverteu, setConfirmNaoConverteu] = useState<{ leadId: string, sourceCol: string, lead: any } | null>(null);
  const [naoConverteuForm, setNaoConverteuForm] = useState({ objecao: '', motivo: '' });
  const [savingNaoConverteu, setSavingNaoConverteu] = useState(false);

  // Reagendado Modal
  const [confirmReagendado, setConfirmReagendado] = useState<{ leadId: string, sourceCol: string, lead: any } | null>(null);
  const [reagendadoForm, setReagendadoForm] = useState({ dataHora: '', agendaId: '', modalidade: 'presencial' });
  const [savingReagendado, setSavingReagendado] = useState(false);

  // Lead Details
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [openLeadDetails, setOpenLeadDetails] = useState(false);


  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('leads').select('*').order('ultima_mensagem', { ascending: false });
      if (error) {
        console.error('Erro ao buscar leads:', error);
      } else if (data) {
        setLeads(data);
        setSelectedLead((prev: any) => {
          if (!prev) return null;
          const updated = data.find(l => l.id === prev.id);
          return updated ? updated : prev;
        });
      }
    } catch (err) {
      console.error('Falha de rede ao buscar leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgendas = async () => {
    try {
      const { data, error } = await supabase.from('agendas').select('id, nome, cor').eq('ativo', true);
      if (error) {
        console.error('Erro ao buscar agendas:', error);
      } else if (data) {
        setAgendas(data);
      }
    } catch (err) {
      console.error('Falha de rede ao buscar agendas:', err);
    }
  };

  const fetchServicos = async () => {
    const { data } = await supabase.from('servicos').select('*').order('nome');
    if (data) setAvailableServicos(data);
  };

  useEffect(() => {
    fetchLeads();
    fetchAgendas();
    fetchServicos();

    const handleFocus = () => { fetchLeads(); fetchAgendas(); fetchServicos(); };
    const handleOnline = () => { fetchLeads(); fetchAgendas(); fetchServicos(); };
    const handleVisibility = () => { if (document.visibilityState === 'visible') { fetchLeads(); fetchAgendas(); fetchServicos(); } };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

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
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
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
        servicos: lead.servicos_contratados || [],
        valor: String(lead.valor_pago || ''),
        observacao: ''
      });
      setConfirmConverteu({ leadId, sourceCol: oldStatus, lead });
      return;
    }

    if (newStatus === 'nao_converteu' && oldStatus !== 'nao_converteu') {
      setNaoConverteuForm({ objecao: lead.objecao || '', motivo: lead.motivo_perda || '' });
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
       updates.objecao = null;
       updates.motivo_perda = null;
    }
    if (['iniciou_atendimento', 'conversando'].includes(newStatus)) {
       updates.data_agendamento = null;
       updates.id_agendamento = null;
       updates.agendamento_criado_em = null;
       updates.modalidade = null;
       if (lead.id_agendamento) {
         await supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', lead.id_agendamento);
       }
    }

    if (['faltou', 'cancelou_agendamento'].includes(newStatus) && lead.id_agendamento) {
      await supabase.from('agendamentos').update({ status: newStatus }).eq('id', lead.id_agendamento);
    }

    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));
    setSelectedLead((prev: any) => prev?.id === leadId ? { ...prev, ...updates } : prev);
    const { data, error } = await supabase.from('leads').update(updates).eq('id', leadId).select();
    if (error) {
       setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: oldStatus } : l));
       setSelectedLead((prev: any) => prev?.id === leadId ? { ...prev, status: oldStatus } : prev);
       alert(`Erro ao salvar status: ${error.message}`);
    } else if (data && data[0]) {
       const updatedRow = data[0];
       setLeads(prev => prev.map(l => l.id === leadId ? updatedRow : l));
       setSelectedLead((prev: any) => prev?.id === leadId ? updatedRow : prev);
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

      const { data: updatedLeads, error: updateError } = await supabase
        .from('leads')
        .update({
          status: 'agendado',
          data_agendamento: new Date(agendadoForm.dataHora).toISOString(),
          agendamento_criado_em: new Date().toISOString(),
          id_agendamento: agendamento.id,
          modalidade: agendadoForm.modalidade
        })
        .eq('id', leadId)
        .select();

      if (updateError) throw updateError;

      if (updatedLeads && updatedLeads[0]) {
        const updatedRow = updatedLeads[0];
        setLeads(prev => prev.map(l => l.id === leadId ? updatedRow : l));
        setSelectedLead((prev: any) => prev?.id === leadId ? updatedRow : prev);
      } else {
        updateLeadState(leadId, 'agendado');
      }
      setConfirmAgendado(null);
      fetchLeads();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSavingAgendado(false);
    }
  };

  const confirmConverteuAction = async () => {
    if (!confirmConverteu || !converteuForm.valor || converteuForm.servicos.length === 0) return;
    const { leadId, lead } = confirmConverteu;
    setSavingConverteu(true);
    try {
      const { data: updatedLeads, error } = await supabase
        .from('leads')
        .update({ 
          status: 'converteu',
          valor_pago: parseFloat(converteuForm.valor.replace(',', '.')),
          servicos_contratados: converteuForm.servicos,
          observacoes: converteuForm.observacao ? `${confirmConverteu.lead.observacoes || ''}\nInformações Complementares: ${converteuForm.observacao}` : confirmConverteu.lead.observacoes
        })
        .eq('id', leadId)
        .select();
      if (error) throw error;

      if (lead.id_agendamento) {
        await supabase
          .from('agendamentos')
          .update({ 
            status: 'compareceu',
            valor_pago: parseFloat(converteuForm.valor.replace(',', '.'))
          })
          .eq('id', lead.id_agendamento);
      }

      // Check if client is registered in clientes table (redundancy check on frontend)
      const { data: existingClient } = await supabase
        .from('clientes')
        .select('id')
        .eq('lead_id', leadId)
        .maybeSingle();

      if (!existingClient) {
        await supabase
          .from('clientes')
          .insert({
            lead_id: leadId,
            data_primeira_visita: new Date().toISOString(),
            valor_pago: parseFloat(converteuForm.valor.replace(',', '.'))
          });
      } else {
        // Increment LTV
        const { data: currentClient } = await supabase
          .from('clientes')
          .select('valor_pago')
          .eq('lead_id', leadId)
          .single();
        const currentLTV = parseFloat(currentClient?.valor_pago || '0');
        await supabase
          .from('clientes')
          .update({
            valor_pago: currentLTV + parseFloat(converteuForm.valor.replace(',', '.'))
          })
          .eq('lead_id', leadId);
      }

      if (updatedLeads && updatedLeads[0]) {
        const updatedRow = updatedLeads[0];
        setLeads(prev => prev.map(l => l.id === leadId ? updatedRow : l));
        setSelectedLead((prev: any) => prev?.id === leadId ? updatedRow : prev);
      } else {
        updateLeadState(leadId, 'converteu');
      }
      setConfirmConverteu(null);
      fetchLeads();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSavingConverteu(false);
    }
  };

  const confirmNaoConverteuAction = async () => {
    if (!confirmNaoConverteu || !naoConverteuForm.objecao || (naoConverteuForm.objecao === 'Outro' && !naoConverteuForm.motivo)) return;
    const { leadId } = confirmNaoConverteu;
    setSavingNaoConverteu(true);
    try {
      const updates = { 
        status: 'nao_converteu', 
        objecao: naoConverteuForm.objecao,
        motivo_perda: naoConverteuForm.objecao === 'Outro' ? naoConverteuForm.motivo : null 
      };
      const { data: updatedLeads, error } = await supabase.from('leads').update(updates).eq('id', leadId).select();
      if (error) throw error;
      if (updatedLeads && updatedLeads[0]) {
        const updatedRow = updatedLeads[0];
        setLeads(prev => prev.map(l => l.id === leadId ? updatedRow : l));
        setSelectedLead((prev: any) => prev?.id === leadId ? updatedRow : prev);
      } else {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));
        setSelectedLead((prev: any) => prev?.id === leadId ? { ...prev, ...updates } : prev);
      }
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
      let agId = lead.id_agendamento;
      if (agId) {
        await supabase.from('agendamentos').update({ data_hora_inicio: novaData, status: 'reagendado', modalidade: reagendadoForm.modalidade }).eq('id', agId);
      } else {
        const { data: newAg, error: insertError } = await supabase
          .from('agendamentos')
          .insert({
            lead_id: leadId,
            agenda_id: reagendadoForm.agendaId || null,
            procedimento_nome: lead.procedimento_interesse || 'Consulta Inicial',
            nome_lead: lead.nome_lead || 'Lead sem nome',
            whatsapp_lead: lead.whatsapp_lead || '',
            data_hora_inicio: novaData,
            status: 'reagendado',
            modalidade: reagendadoForm.modalidade
          })
          .select()
          .single();
        if (insertError) throw insertError;
        agId = newAg.id;
      }
      const { data: updatedLeads, error } = await supabase.from('leads').update({ status: 'reagendado', data_agendamento: novaData, modalidade: reagendadoForm.modalidade, id_agendamento: agId }).eq('id', leadId).select();
      if (error) throw error;
      if (updatedLeads && updatedLeads[0]) {
        const updatedRow = updatedLeads[0];
        setLeads(prev => prev.map(l => l.id === leadId ? updatedRow : l));
        setSelectedLead((prev: any) => prev?.id === leadId ? updatedRow : prev);
      } else {
        updateLeadState(leadId, 'reagendado');
      }
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



  const cardsByCol = COLUMNS.reduce((acc, col) => {
    acc[col.id] = leads.filter(l => l.status === col.id);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 18px', flexShrink: 0 }}>
        <div>
          <div className="font-display" style={{ fontSize: '22px', fontWeight: 300, fontStyle: 'italic', color: 'var(--ink)' }}>Pipeline de contatos</div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            Navegue pelos estágios de venda · {leads.length} leads ativos
          </p>
        </div>
        <button onClick={() => setOpenNewLead(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--sage-dark)', color: 'white', border: 'none', borderRadius: 'var(--r-xs)', padding: '8px 14px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Plus style={{ width: '14px', height: '14px' }} /> Novo lead
        </button>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--muted)' }}>Carregando...</div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div style={{ display: 'flex', height: '100%', gap: '12px', alignItems: 'flex-start', width: 'fit-content', padding: '0 22px 16px' }}>
              {COLUMNS.map(col => {
                const colCards = cardsByCol[col.id] || [];
                const badge = COLUMN_BADGE[col.id] || { bg: 'var(--sage-xlight)', color: 'var(--sage-dark)' };
                return (
                  <div key={col.id} style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Column header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)' }}>
                        {col.title}
                      </span>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '20px', background: badge.bg, color: badge.color }}>
                        {colCards.length}
                      </span>
                    </div>

                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div ref={provided.innerRef} {...provided.droppableProps}
                          style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', padding: '2px', minHeight: '80px', background: snapshot.isDraggingOver ? 'var(--sage-xlight)' : 'transparent', borderRadius: '10px', transition: 'background 0.1s' }}>

                          {colCards.length === 0 && !snapshot.isDraggingOver && (
                            <div style={{ background: 'rgba(143,174,154,0.04)', border: '1.5px dashed var(--border-md)', borderRadius: '10px', padding: '24px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: '11.5px', fontStyle: 'italic' }}>
                              Vazio
                            </div>
                          )}

                          {colCards.map((card, index) => (
                            <Draggable key={card.id} draggableId={card.id} index={index}>
                              {(provided, snapshot) => (
                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                  className="group"
                                  onClick={() => { setSelectedLead(card); setOpenLeadDetails(true); }}
                                  style={{ ...provided.draggableProps.style, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', cursor: 'pointer', position: 'relative', overflow: 'hidden', boxShadow: snapshot.isDragging ? '0 8px 24px rgba(30,41,59,0.12)' : 'none', transition: 'box-shadow 0.12s' }}>

                                  {/* Left stripe */}
                                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: COLUMN_STRIPE[col.id] || 'var(--sage)' }} />

                                  {/* Delete button */}
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteLead(card.id); }}
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                    style={{ width: '20px', height: '20px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Trash2 style={{ width: '12px', height: '12px' }} />
                                  </button>

                                  {/* Avatar */}
                                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, marginBottom: '8px', background: badge.bg, color: badge.color }}>
                                    {getInitials(card.nome_lead)}
                                  </div>

                                  <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink)', marginBottom: '2px', paddingRight: '20px', lineHeight: 1.3 }}>
                                    {card.nome_lead || 'Lead sem nome'}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                                    {card.whatsapp_lead}
                                  </div>

                                  {/* Footer */}
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 8px', borderRadius: '20px', background: badge.bg, color: badge.color }}>
                                      {col.title}
                                    </span>
                                    <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                                      {card.ultima_mensagem ? formatDistanceToNow(parseISO(card.ultima_mensagem), { locale: ptBR, addSuffix: true }) : 'Sem msg'}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}

                          {/* Add card */}
                          <button onClick={() => setOpenNewLead(true)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: 'transparent', border: '1.5px dashed var(--border-md)', borderRadius: '10px', padding: '8px', fontSize: '11.5px', color: 'var(--muted)', cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}>
                            <Plus style={{ width: '13px', height: '13px' }} /> Adicionar
                          </button>
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        )}
      </div>

      <Modal isOpen={openNewLead} onClose={() => setOpenNewLead(false)} title="Novo Lead Manual">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={crmFormLabel}>WhatsApp *</label>
            <Input placeholder="+5511999999999" value={newLeadForm.whatsapp} onChange={e => setNewLeadForm({...newLeadForm, whatsapp: e.target.value})} className="h-9" />
          </div>
          <div>
            <label style={crmFormLabel}>Nome</label>
            <Input placeholder="Ex: Maria" value={newLeadForm.nome} onChange={e => setNewLeadForm({...newLeadForm, nome: e.target.value})} className="h-9" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button onClick={handleSaveNewLead} disabled={!newLeadForm.whatsapp} style={{ ...crmBtnPrimary, opacity: !newLeadForm.whatsapp ? 0.6 : 1 }}>
              Criar Lead
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!confirmAgendado} onClose={() => setConfirmAgendado(null)} title="Registrar Agendamento">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '10px 12px', background: 'var(--sage-xlight)', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', fontSize: '12px', fontWeight: 500, color: 'var(--sage-dark)' }}>
            📅 {confirmAgendado?.lead?.nome_lead}
          </div>
          <div>
            <label style={crmFormLabel}>Data / Hora *</label>
            <input type="datetime-local" value={agendadoForm.dataHora} onChange={e => setAgendadoForm({...agendadoForm, dataHora: e.target.value})} className="w-full rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--sage-dark)]" style={{ border: '1px solid var(--border-md)', background: 'var(--bg)' }} />
          </div>
          <div>
            <label style={crmFormLabel}>Serviço</label>
            <Input placeholder="Ex: Inventário" value={agendadoForm.procedimento} onChange={e => setAgendadoForm({...agendadoForm, procedimento: e.target.value})} className="h-9" />
          </div>
          <div>
            <label style={crmFormLabel}>Modalidade</label>
            <select value={agendadoForm.modalidade} onChange={e => setAgendadoForm({...agendadoForm, modalidade: e.target.value})} className="w-full rounded-[8px] px-3 py-2 text-sm focus:outline-none" style={{ border: '1px solid var(--border-md)', background: 'var(--bg)' }}>
              <option value="presencial">Presencial</option>
              <option value="online">Online</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button onClick={() => setConfirmAgendado(null)} style={crmBtnGhost}>Cancelar</button>
            <button onClick={confirmAgendadoAction} disabled={!agendadoForm.dataHora || savingAgendado} style={{ ...crmBtnPrimary, opacity: (!agendadoForm.dataHora || savingAgendado) ? 0.7 : 1 }}>Confirmar</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!confirmConverteu} onClose={() => setConfirmConverteu(null)} title="Finalizar Venda">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '10px 12px', background: 'var(--sage-xlight)', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', fontSize: '12px', fontWeight: 500, color: 'var(--sage-dark)' }}>
            🚀 Parabéns! Preencha os dados do contrato.
          </div>
          <div>
            <label style={crmFormLabel}>Serviços Contratados *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', maxHeight: '180px', overflowY: 'auto', padding: '2px' }}>
              {availableServicos.map(srv => (
                <label key={srv.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', background: converteuForm.servicos.includes(srv.nome) ? 'var(--sage-xlight)' : 'transparent' }}>
                  <input type="checkbox" checked={converteuForm.servicos.includes(srv.nome)} onChange={e => {
                    if (e.target.checked) setConverteuForm(prev => ({ ...prev, servicos: [...prev.servicos, srv.nome] }));
                    else setConverteuForm(prev => ({ ...prev, servicos: prev.servicos.filter(n => n !== srv.nome) }));
                  }} style={{ accentColor: 'var(--sage-dark)' }} />
                  <span style={{ color: 'var(--ink)' }}>{srv.nome}</span>
                </label>
              ))}
              {availableServicos.length === 0 && (
                <p style={{ gridColumn: '1/-1', fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>Nenhum serviço cadastrado.</p>
              )}
            </div>
          </div>
          <div>
            <label style={crmFormLabel}>Valor Total Faturado (R$) *</label>
            <Input placeholder="0,00" value={converteuForm.valor} onChange={e => setConverteuForm({...converteuForm, valor: e.target.value})} className="h-9" />
          </div>
          <div>
            <label style={crmFormLabel}>Informações Complementares</label>
            <textarea rows={3} value={converteuForm.observacao} onChange={e => setConverteuForm({...converteuForm, observacao: e.target.value})} style={{ width: '100%', border: '1px solid var(--border-md)', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', background: 'var(--bg)', fontFamily: 'inherit', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button onClick={() => setConfirmConverteu(null)} style={crmBtnGhost}>Cancelar</button>
            <button onClick={confirmConverteuAction} disabled={!converteuForm.valor || converteuForm.servicos.length === 0 || savingConverteu} style={{ ...crmBtnPrimary, opacity: (!converteuForm.valor || converteuForm.servicos.length === 0 || savingConverteu) ? 0.7 : 1 }}>Confirmar</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!confirmNaoConverteu} onClose={() => setConfirmNaoConverteu(null)} title="Registrar Não Conversão">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '10px 12px', background: 'var(--rose-light)', border: '1px solid #E9C0C0', borderRadius: 'var(--r-xs)', fontSize: '12px', fontWeight: 500, color: 'var(--rose-text)' }}>
            Entender o motivo da perda ajuda a melhorar o funil.
          </div>
          <div>
            <label style={crmFormLabel}>Principal Objeção *</label>
            <select value={naoConverteuForm.objecao} onChange={e => setNaoConverteuForm({...naoConverteuForm, objecao: e.target.value})} className="w-full rounded-[8px] px-3 py-2 text-sm focus:outline-none" style={{ border: '1px solid var(--border-md)', background: 'var(--bg)' }}>
              <option value="" disabled>Selecione uma opção...</option>
              <option value="Valor/Orçamento">Valor/Orçamento</option>
              <option value="Condições de Pagamento">Condições de Pagamento</option>
              <option value="Insegurança/Falta de Confiança">Insegurança/Falta de Confiança</option>
              <option value="Falta de Urgência/Prioridade">Falta de Urgência/Prioridade</option>
              <option value="Sem Resposta (Ghosting)">Sem Resposta (Ghosting)</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
          {naoConverteuForm.objecao === 'Outro' && (
            <div>
              <label style={crmFormLabel}>Especifique o Motivo *</label>
              <textarea rows={3} value={naoConverteuForm.motivo} onChange={e => setNaoConverteuForm({...naoConverteuForm, motivo: e.target.value})} style={{ width: '100%', border: '1px solid var(--border-md)', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', background: 'var(--bg)', fontFamily: 'inherit', resize: 'vertical' }} placeholder="Descreva o motivo..." />
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button onClick={() => setConfirmNaoConverteu(null)} style={crmBtnGhost}>Cancelar</button>
            <button onClick={confirmNaoConverteuAction} disabled={!naoConverteuForm.objecao || (naoConverteuForm.objecao === 'Outro' && !naoConverteuForm.motivo) || savingNaoConverteu} style={{ ...crmBtnDanger, opacity: (!naoConverteuForm.objecao || savingNaoConverteu) ? 0.7 : 1 }}>Salvar</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!confirmReagendado} onClose={() => setConfirmReagendado(null)} title="Reagendar Lead">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '10px 12px', background: 'var(--champ-light)', border: '1px solid var(--champ)', borderRadius: 'var(--r-xs)', fontSize: '12px', fontWeight: 500, color: 'var(--champ-text)' }}>
            Defina o novo horário do agendamento.
          </div>
          <div>
            <label style={crmFormLabel}>Nova Data / Hora *</label>
            <input type="datetime-local" value={reagendadoForm.dataHora} onChange={e => setReagendadoForm({...reagendadoForm, dataHora: e.target.value})} className="w-full rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--sage-dark)]" style={{ border: '1px solid var(--border-md)', background: 'var(--bg)' }} />
          </div>
          <div>
            <label style={crmFormLabel}>Modalidade</label>
            <select value={reagendadoForm.modalidade} onChange={e => setReagendadoForm({...reagendadoForm, modalidade: e.target.value})} className="w-full rounded-[8px] px-3 py-2 text-sm focus:outline-none" style={{ border: '1px solid var(--border-md)', background: 'var(--bg)' }}>
              <option value="presencial">Presencial</option>
              <option value="online">Online</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button onClick={() => setConfirmReagendado(null)} style={crmBtnGhost}>Cancelar</button>
            <button onClick={confirmReagendadoAction} disabled={!reagendadoForm.dataHora || savingReagendado} style={{ ...crmBtnPrimary, opacity: (!reagendadoForm.dataHora || savingReagendado) ? 0.7 : 1 }}>Salvar</button>
          </div>
        </div>
      </Modal>

      <LeadDetailsModal 
        isOpen={openLeadDetails}
        onClose={() => setOpenLeadDetails(false)}
        leadId={selectedLead?.id}
        onUpdate={fetchLeads}
      />
    </div>
  );
}
