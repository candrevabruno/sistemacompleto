import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User, Phone, Calendar, DollarSign, Clock, FileText, Check, X, ShieldAlert, Mail, IdCard, MessageCircle } from 'lucide-react';
import { calcularDataReativacao } from '../../lib/lead-utils';
import type { LeadDetalhes } from '../../types';

const COLUMNS = [
  { id: 'iniciou_atendimento', title: 'Iniciou', colorClass: 'border-[var(--sage-dark)]' },
  { id: 'conversando', title: 'Conversando', colorClass: 'border-[var(--ink)]' },
  { id: 'follow_up', title: 'Follow-Up', colorClass: 'border-blue-500' },
  { id: 'agendado', title: 'Agendado', colorClass: 'border-emerald-500' },
  { id: 'reagendado', title: 'Reagendado', colorClass: 'border-amber-400' },
  { id: 'faltou', title: 'Faltou', colorClass: 'border-slate-500' },
  { id: 'cancelou_agendamento', title: 'Cancelou Agendamento', colorClass: 'border-rose-400' },
  { id: 'converteu', title: 'Converteu (Venda)', colorClass: 'border-green-600 font-bold' },
  { id: 'nao_converteu', title: 'Não Converteu', colorClass: 'border-rose-600' },
  { id: 'abandonou_conversa', title: 'Abandonou', colorClass: 'border-gray-400' }
];

interface LeadDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string | null;
  onUpdate?: () => void;
}

export function LeadDetailsModal({ isOpen, onClose, leadId, onUpdate }: LeadDetailsModalProps) {
  const navigate = useNavigate();
  const [lead, setLead] = useState<LeadDetalhes | null>(null);
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [agendas, setAgendas] = useState<any[]>([]);
  const [availableServicos, setAvailableServicos] = useState<any[]>([]);
  
  // Status changing states
  const [savingStatus, setSavingStatus] = useState(false);

  // Edit fields state
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState({ 
    genero: '', 
    data_nascimento: '', 
    observacoes: '',
    nome_lead: '',
    procedimento_interesse: '',
    whatsapp_lead: '',
    email: '',
    cpf: ''
  });
  const [savingDetails, setSavingDetails] = useState(false);

  // Confirmation Overlays
  const [confirmAgendado, setConfirmAgendado] = useState(false);
  const [agendadoForm, setAgendadoForm] = useState({ dataHora: '', procedimento: '', agendaId: '', modalidade: 'presencial' });
  const [savingAgendado, setSavingAgendado] = useState(false);

  const [confirmConverteu, setConfirmConverteu] = useState(false);
  const [converteuForm, setConverteuForm] = useState<{ servicos: string[], valor: string, observacao: string }>({ servicos: [], valor: '', observacao: '' });
  const [savingConverteu, setSavingConverteu] = useState(false);

  const [confirmNaoConverteu, setConfirmNaoConverteu] = useState(false);
  const [naoConverteuForm, setNaoConverteuForm] = useState({ objecao: '', motivo: '' });
  const [savingNaoConverteu, setSavingNaoConverteu] = useState(false);

  const [confirmReagendado, setConfirmReagendado] = useState(false);
  const [reagendadoForm, setReagendadoForm] = useState({ dataHora: '', agendaId: '', modalidade: 'presencial' });
  const [savingReagendado, setSavingReagendado] = useState(false);

  useEffect(() => {
    if (isOpen && leadId) {
      loadAllData();
    } else {
      setLead(null);
      setAppointments([]);
    }
  }, [isOpen, leadId]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      
      // Load Lead
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();
        
      if (leadError) throw leadError;
      setLead(leadData);
      
      // Setup edit details form
      setDetailsForm({
        genero: leadData.genero || '',
        data_nascimento: leadData.data_nascimento || '',
        observacoes: leadData.observacoes || '',
        nome_lead: leadData.nome_lead || '',
        procedimento_interesse: leadData.procedimento_interesse || '',
        whatsapp_lead: leadData.whatsapp_lead || '',
        email: leadData.email || '',
        cpf: leadData.cpf || ''
      });

      // Load Appointments
      const { data: apptData } = await supabase
        .from('agendamentos')
        .select('*, agendas(nome, cor)')
        .eq('lead_id', leadId)
        .order('data_hora_inicio', { ascending: false });
      setAppointments(apptData || []);

      // Load Agendas
      const { data: agendasData } = await supabase
        .from('agendas')
        .select('id, nome, cor')
        .eq('ativo', true);
      setAgendas(agendasData || []);

      // Load Services
      const { data: servicosData } = await supabase
        .from('servicos')
        .select('*')
        .order('nome');
      setAvailableServicos(servicosData || []);

    } catch (err) {
      console.error('Erro ao carregar dados do lead:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDetails = async () => {
    if (!lead) return;
    setSavingDetails(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          nome_lead: detailsForm.nome_lead,
          genero: detailsForm.genero || null,
          data_nascimento: detailsForm.data_nascimento || null,
          procedimento_interesse: detailsForm.procedimento_interesse || null,
          observacoes: detailsForm.observacoes || null,
          whatsapp_lead: detailsForm.whatsapp_lead,
          email: detailsForm.email || null,
          cpf: detailsForm.cpf || null
        })
        .eq('id', lead.id);
        
      if (error) throw error;
      
      setEditingDetails(false);
      await loadAllData();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      alert(`Erro ao salvar observações: ${err.message}`);
    } finally {
      setSavingDetails(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!lead) return;
    if (newStatus === 'nao_converteu') {
      setNaoConverteuForm({ objecao: '', motivo: '' });
      setConfirmNaoConverteu(true);
      return;
    }
    if (newStatus === 'converteu') {
      setConverteuForm({ servicos: [], valor: '', observacao: '' });
      setConfirmConverteu(true);
      return;
    }
    if (newStatus === 'agendado') {
      setAgendadoForm({ dataHora: '', procedimento: lead.procedimento_interesse || '', agendaId: agendas[0]?.id || '', modalidade: 'presencial' });
      setConfirmAgendado(true);
      return;
    }
    if (newStatus === 'reagendado') {
      setReagendadoForm({ dataHora: '', agendaId: lead.agenda_id || agendas[0]?.id || '', modalidade: lead.modalidade || 'presencial' });
      setConfirmReagendado(true);
      return;
    }

    setSavingStatus(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', lead.id);
      if (error) throw error;
      
      await loadAllData();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSavingStatus(false);
    }
  };

  const confirmAgendadoAction = async () => {
    if (!lead || !agendadoForm.dataHora) return;
    setSavingAgendado(true);
    try {
      const { data: agendamento, error: agError } = await supabase
        .from('agendamentos')
        .insert({
          lead_id: lead.id,
          agenda_id: agendadoForm.agendaId || null,
          procedimento_nome: agendadoForm.procedimento || lead.procedimento_interesse || null,
          nome_lead: lead.nome_lead || null,
          whatsapp_lead: lead.whatsapp_lead || null,
          data_hora_inicio: new Date(agendadoForm.dataHora).toISOString(),
          modalidade: agendadoForm.modalidade,
          status: 'agendado'
        })
        .select()
        .single();

      if (agError) throw agError;

      const { error: updateError } = await supabase
        .from('leads')
        .update({
          status: 'agendado',
          data_agendamento: new Date(agendadoForm.dataHora).toISOString(),
          agendamento_criado_em: new Date().toISOString(),
          id_agendamento: agendamento.id,
          modalidade: agendadoForm.modalidade
        })
        .eq('id', lead.id);

      if (updateError) throw updateError;

      setConfirmAgendado(false);
      await loadAllData();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSavingAgendado(false);
    }
  };

  const confirmConverteuAction = async () => {
    if (!lead || !converteuForm.valor || converteuForm.servicos.length === 0) return;
    setSavingConverteu(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ 
          status: 'converteu',
          valor_pago: parseFloat(converteuForm.valor.replace(',', '.')),
          servicos_contratados: converteuForm.servicos,
          observacoes: converteuForm.observacao ? `${lead.observacoes || ''}\nInformações Complementares: ${converteuForm.observacao}` : lead.observacoes
        })
        .eq('id', lead.id);
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

      // Check if client is registered in clientes table
      const { data: existingClient } = await supabase
        .from('clientes')
        .select('id')
        .eq('lead_id', lead.id)
        .maybeSingle();

      if (!existingClient) {
        await supabase
          .from('clientes')
          .insert({
            lead_id: lead.id,
            data_primeira_visita: new Date().toISOString(),
            valor_pago: parseFloat(converteuForm.valor.replace(',', '.'))
          });
      } else {
        // Increment LTV
        const { data: currentClient } = await supabase
          .from('clientes')
          .select('valor_pago')
          .eq('lead_id', lead.id)
          .single();
        const currentLTV = parseFloat(currentClient?.valor_pago || '0');
        await supabase
          .from('clientes')
          .update({
            valor_pago: currentLTV + parseFloat(converteuForm.valor.replace(',', '.'))
          })
          .eq('lead_id', lead.id);
      }

      setConfirmConverteu(false);
      await loadAllData();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSavingConverteu(false);
    }
  };

  const confirmNaoConverteuAction = async () => {
    if (!lead || !naoConverteuForm.objecao || (naoConverteuForm.objecao === 'Outro' && !naoConverteuForm.motivo)) return;
    setSavingNaoConverteu(true);
    try {
      const updates = { 
        status: 'nao_converteu', 
        objecao: naoConverteuForm.objecao,
        motivo_perda: naoConverteuForm.objecao === 'Outro' ? naoConverteuForm.motivo : null 
      };
      const { error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', lead.id);
      if (error) throw error;

      setConfirmNaoConverteu(false);
      await loadAllData();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSavingNaoConverteu(false);
    }
  };

  const confirmReagendadoAction = async () => {
    if (!lead || !reagendadoForm.dataHora) return;
    setSavingReagendado(true);
    try {
      const novaData = new Date(reagendadoForm.dataHora).toISOString();
      let agId = lead.id_agendamento;
      
      if (agId) {
        await supabase
          .from('agendamentos')
          .update({ 
            data_hora_inicio: novaData, 
            status: 'reagendado', 
            modalidade: reagendadoForm.modalidade 
          })
          .eq('id', agId);
      } else {
        const { data: newAg, error: insertError } = await supabase
          .from('agendamentos')
          .insert({
            lead_id: lead.id,
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

      const { error } = await supabase
        .from('leads')
        .update({ 
          status: 'reagendado', 
          data_agendamento: novaData, 
          modalidade: reagendadoForm.modalidade, 
          id_agendamento: agId 
        })
        .eq('id', lead.id);
        
      if (error) throw error;

      setConfirmReagendado(false);
      await loadAllData();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      console.error(err);
    } finally {
      setSavingReagendado(false);
    }
  };

  const calculateAge = (birthDateStr: string) => {
    if (!birthDateStr) return null;
    try {
      const birthDate = new Date(birthDateStr);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    } catch (e) {
      return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalhes do Lead" className="max-w-5xl">
      {loading ? (
        <div className="py-20 text-center text-sm text-[var(--muted)] flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-4 border-[var(--sage-xlight)] border-t-[var(--sage-dark)] animate-spin" />
          <span>Carregando informações do lead...</span>
        </div>
      ) : lead ? (
        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
          {/* Header e Status */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[var(--sage-xlight)] p-5 border border-[var(--border)] rounded-[12px]">
            <div className="space-y-2">
              <h2 className="font-cormorant text-2xl font-bold text-[var(--ink)]">
                {lead.nome_lead || 'Lead sem nome'}
              </h2>
              {(() => {
                const { data, reativarHoje } = calcularDataReativacao(lead);
                if (!data) return null;
                return (
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                    reativarHoje
                      ? 'bg-green-100 text-green-700 border-green-300'
                      : 'bg-gray-100 text-gray-600 border-gray-200'
                  }`}>
                    <Clock size={11} />
                    Reativar em {format(data, 'dd/MM/yyyy')}
                    {reativarHoje && ' — Hoje!'}
                  </span>
                );
              })()}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full md:w-auto justify-start md:justify-end">
              {lead.whatsapp_lead && (
                <button
                  onClick={() => { onClose(); navigate('/inbox', { state: { lead_id: lead.id } }); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-[8px] transition-colors shrink-0"
                >
                  <MessageCircle size={14} />
                  WhatsApp
                </button>
              )}
              <span className="text-xs font-semibold text-[var(--muted)] uppercase shrink-0">Estágio Atual:</span>
              <select
                value={lead.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={savingStatus}
                className="border border-[var(--border)] rounded-[8px] px-3 py-1.5 text-sm bg-[var(--bg)] text-[var(--ink)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--sage-dark)] cursor-pointer transition-all"
              >
                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          </div>

          {/* Grid de Informações Principais */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Coluna Esquerda - Campos Cadastrais e Observações Manuais */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-[var(--white)] border border-[var(--border)] rounded-[12px] p-5 space-y-4">
                <h3 className="font-semibold text-sm border-b pb-2 flex items-center gap-2">
                  <User size={16} className="text-[var(--sage-dark)]" />
                  Informações de Cadastro
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <span className="text-[10px] text-[var(--muted)] font-bold uppercase block">Nome Completo</span>
                    {editingDetails ? (
                      <Input 
                        value={detailsForm.nome_lead} 
                        onChange={e => setDetailsForm({...detailsForm, nome_lead: e.target.value})} 
                        className="mt-1 h-9 bg-white" 
                      />
                    ) : (
                      <p className="text-sm font-medium mt-1">{lead.nome_lead || 'Não informado'}</p>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] text-[var(--muted)] font-bold uppercase block">WhatsApp / Telefone</span>
                    {editingDetails ? (
                      <Input 
                        value={detailsForm.whatsapp_lead} 
                        onChange={e => setDetailsForm({...detailsForm, whatsapp_lead: e.target.value})} 
                        className="mt-1 h-9 bg-white" 
                      />
                    ) : (
                      <p className="text-sm font-medium mt-1">{lead.whatsapp_lead || 'Não informado'}</p>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] text-[var(--muted)] font-bold uppercase block">E-mail</span>
                    {editingDetails ? (
                      <Input 
                        value={detailsForm.email} 
                        onChange={e => setDetailsForm({...detailsForm, email: e.target.value})} 
                        className="mt-1 h-9 bg-white" 
                        placeholder="exemplo@email.com"
                      />
                    ) : (
                      <p className="text-sm font-medium mt-1">{lead.email || 'Não informado'}</p>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] text-[var(--muted)] font-bold uppercase block">Gênero</span>
                    {editingDetails ? (
                      <select 
                        value={detailsForm.genero} 
                        onChange={e => setDetailsForm({...detailsForm, genero: e.target.value})}
                        className="w-full mt-1 border border-gray-300 rounded-[8px] px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--sage-dark)]"
                      >
                        <option value="">Não informado</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Feminino">Feminino</option>
                        <option value="Outro">Outro</option>
                      </select>
                    ) : (
                      <p className="text-sm font-medium mt-1">{lead.genero || 'Não informado'}</p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-[10px] text-[var(--muted)] font-bold uppercase block">Serviço de Interesse</span>
                    {editingDetails ? (
                      <Input 
                        value={detailsForm.procedimento_interesse} 
                        onChange={e => setDetailsForm({...detailsForm, procedimento_interesse: e.target.value})}
                        className="mt-1 h-9 bg-white"
                      />
                    ) : (
                      <p className="text-sm font-medium mt-1">{lead.procedimento_interesse || 'Não informado'}</p>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  {editingDetails ? (
                    <div className="flex gap-2">
                      <Button onClick={handleUpdateDetails} disabled={savingDetails} className="w-full bg-green-600 hover:bg-green-700">
                        <Check size={16} className="mr-2" /> Salvar Detalhes
                      </Button>
                      <Button variant="secondary" onClick={() => setEditingDetails(false)} className="w-full">
                        <X size={16} className="mr-2" /> Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button variant="secondary" onClick={() => setEditingDetails(true)} className="w-full font-bold">
                      Editar Informações
                    </Button>
                  )}
                </div>
              </div>

              {/* Resumo da Conversa */}
              <div className="bg-[var(--white)] border border-[var(--border)] rounded-[12px] p-5 space-y-4">
                <h3 className="font-semibold text-sm border-b pb-2 flex items-center gap-2">
                  <FileText size={16} className="text-[var(--sage-dark)]" />
                  Resumo da Conversa
                </h3>

                {lead.procedimento_interesse && (
                  <div>
                    <span className="text-[10px] text-[var(--muted)] font-bold uppercase block">Procedimento de Interesse</span>
                    <p className="text-sm font-medium mt-1">{lead.procedimento_interesse}</p>
                  </div>
                )}

                {editingDetails ? (
                  <textarea
                    rows={6}
                    value={detailsForm.observacoes}
                    onChange={e => setDetailsForm({...detailsForm, observacoes: e.target.value})}
                    className="w-full mt-2 border rounded p-2 text-sm bg-white"
                    placeholder="Anote informações pertinentes coletadas no atendimento..."
                  />
                ) : (
                  <p className="text-sm text-[var(--ink)] whitespace-pre-wrap leading-relaxed min-h-[100px] p-3 bg-gray-50 rounded-[8px] border border-gray-100">
                    {lead.observacoes || 'Nenhuma observação interna anotada pela equipe.'}
                  </p>
                )}
              </div>

              {/* Resumo Automático da Conversa */}
              {lead.resumo_conversa && (
                <div className="p-4 border border-[var(--border)] rounded-[12px] bg-white relative">
                  <span className="absolute -top-2 left-3 bg-white px-2 text-[10px] text-[var(--sage-dark)] font-bold uppercase tracking-tight">IA - Resumo Automático</span>
                  <p className="text-sm text-[var(--ink)] italic leading-relaxed pt-1">
                    "{lead.resumo_conversa}"
                  </p>
                </div>
              )}
            </div>

            {/* Coluna Direita - Histórico de Atendimentos & LTV e Jornada */}
            <div className="lg:col-span-5 space-y-6">
              {/* Timeline da Jornada do Cliente */}
              <div className="bg-[var(--white)] border border-[var(--border)] rounded-[12px] p-5">
                <h3 className="font-semibold text-sm border-b pb-2 mb-4">Jornada do Cliente</h3>
                {lead.jornada && Array.isArray(lead.jornada) && lead.jornada.length > 0 ? (
                  <div className="max-h-[250px] overflow-y-auto pr-1 custom-scrollbar py-1">
                    <div className="relative pl-6 space-y-4 border-l-2 border-gray-200 ml-3">
                      {(lead.jornada ?? []).map((item: any, index: number) => {
                        const col = COLUMNS.find(c => c.id === item.status);
                        const displayTitle = col ? col.title : item.status;
                        const formattedTime = format(parseISO(item.timestamp), "dd/MM/yyyy 'às' HH:mm'h'", { locale: ptBR });
                        const isLatest = index === (lead.jornada?.length ?? 0) - 1;
                        
                        return (
                          <div key={index} className="relative group">
                            {/* Pontinho indicador */}
                            <div className={`absolute -left-[31px] top-1 w-3 h-3 rounded-full border-2 transition-all ${
                              isLatest 
                                ? 'bg-[var(--sage-dark)] border-[var(--sage-dark)] scale-110 shadow-sm' 
                                : 'bg-white border-gray-400 group-hover:border-gray-600'
                            }`} />
                            <div>
                              <p className={`text-xs font-semibold ${isLatest ? 'text-[var(--sage-dark)] font-bold' : 'text-[var(--ink)]'}`}>
                                {displayTitle}
                                {item.valor_pago && (
                                  <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">
                                    + {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_pago)}
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-[var(--muted)] mt-0.5">{formattedTime}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted)] italic">Nenhuma transição registrada.</p>
                )}
              </div>

            </div>
          </div>
        </div>
      ) : (
        <div className="py-20 text-center text-sm text-[var(--muted)]">
          Lead não encontrado ou excluído.
        </div>
      )}

      {/* Confirmation Dialogs */}
      {/* 1. Modal Agendamento */}
      <Modal isOpen={confirmAgendado} onClose={() => setConfirmAgendado(false)} title="Criar Agendamento">
        <div className="space-y-4">
          <p className="text-sm text-[var(--ink)]">Defina as informações de agendamento do lead.</p>
          
          <div>
            <label className="block text-sm font-medium mb-1">Data e Hora *</label>
            <input 
              type="datetime-local" 
              value={agendadoForm.dataHora} 
              onChange={e => setAgendadoForm({...agendadoForm, dataHora: e.target.value})}
              className="w-full border rounded p-2 text-sm bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Agenda / Profissional *</label>
            <select 
              value={agendadoForm.agendaId} 
              onChange={e => setAgendadoForm({...agendadoForm, agendaId: e.target.value})}
              className="w-full border rounded p-2 text-sm bg-white"
            >
              <option value="">Selecione uma agenda</option>
              {agendas.map(ag => <option key={ag.id} value={ag.id}>{ag.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Modalidade *</label>
            <select 
              value={agendadoForm.modalidade} 
              onChange={e => setAgendadoForm({...agendadoForm, modalidade: e.target.value})}
              className="w-full border rounded p-2 text-sm bg-white"
            >
              <option value="presencial">Presencial</option>
              <option value="online">Online / Teleconsulta</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Procedimento</label>
            <Input 
              value={agendadoForm.procedimento} 
              onChange={e => setAgendadoForm({...agendadoForm, procedimento: e.target.value})}
              className="h-9"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={confirmAgendadoAction} disabled={savingAgendado} className="w-full bg-[var(--sage-dark)]">
              Agendar Lead
            </Button>
            <Button variant="secondary" onClick={() => setConfirmAgendado(false)} className="w-full">
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* 2. Modal Reagendamento */}
      <Modal isOpen={confirmReagendado} onClose={() => setConfirmReagendado(false)} title="Reagendar Lead">
        <div className="space-y-4">
          <p className="text-sm text-[var(--ink)]">Defina o novo horário de agendamento do lead.</p>
          
          <div>
            <label className="block text-sm font-medium mb-1">Data e Hora *</label>
            <input 
              type="datetime-local" 
              value={reagendadoForm.dataHora} 
              onChange={e => setReagendadoForm({...reagendadoForm, dataHora: e.target.value})}
              className="w-full border rounded p-2 text-sm bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Agenda / Profissional *</label>
            <select 
              value={reagendadoForm.agendaId} 
              onChange={e => setReagendadoForm({...reagendadoForm, agendaId: e.target.value})}
              className="w-full border rounded p-2 text-sm bg-white"
            >
              <option value="">Selecione uma agenda</option>
              {agendas.map(ag => <option key={ag.id} value={ag.id}>{ag.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Modalidade *</label>
            <select 
              value={reagendadoForm.modalidade} 
              onChange={e => setReagendadoForm({...reagendadoForm, modalidade: e.target.value})}
              className="w-full border rounded p-2 text-sm bg-white"
            >
              <option value="presencial">Presencial</option>
              <option value="online">Online / Teleconsulta</option>
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={confirmReagendadoAction} disabled={savingReagendado} className="w-full bg-[var(--sage-dark)]">
              Reagendar Lead
            </Button>
            <Button variant="secondary" onClick={() => setConfirmReagendado(false)} className="w-full">
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* 3. Modal Converteu (Venda) */}
      <Modal isOpen={confirmConverteu} onClose={() => setConfirmConverteu(false)} title="Finalizar Venda / Conversão">
        <div className="space-y-4">
          <div className="p-3 bg-green-50 border border-green-200 rounded-[8px] text-green-800 font-medium text-sm flex items-center gap-2">
            🚀 Parabéns! Preencha os dados do contrato de conversão.
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Serviços Contratados *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2 p-1">
              {availableServicos.map(srv => (
                <label key={srv.id} className="flex items-center gap-2 p-2 border border-[var(--border)] rounded-[8px] hover:bg-[var(--bg)] cursor-pointer transition-colors text-sm">
                  <input 
                    type="checkbox" 
                    checked={converteuForm.servicos.includes(srv.nome)}
                    onChange={e => {
                      if (e.target.checked) {
                        setConverteuForm({ ...converteuForm, servicos: [...converteuForm.servicos, srv.nome] });
                      } else {
                        setConverteuForm({ ...converteuForm, servicos: converteuForm.servicos.filter(s => s !== srv.nome) });
                      }
                    }}
                    className="rounded text-[var(--sage-dark)] focus:ring-[var(--sage-dark)]"
                  />
                  <span>{srv.nome}</span>
                </label>
              ))}
              {availableServicos.length === 0 && (
                <p className="text-xs text-[var(--muted)] italic">Nenhum serviço/procedimento cadastrado.</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Valor do Fechamento (R$) *</label>
            <Input 
              type="text" 
              placeholder="Ex: 500,00" 
              value={converteuForm.valor} 
              onChange={e => setConverteuForm({...converteuForm, valor: e.target.value})}
              icon={<DollarSign className="w-4 h-4"/>}
              className="h-9"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Informações Complementares da Venda</label>
            <textarea 
              rows={3} 
              value={converteuForm.observacao} 
              onChange={e => setConverteuForm({...converteuForm, observacao: e.target.value})}
              className="w-full border rounded p-2 text-sm bg-white"
              placeholder="Ex: Pagamento parcelado, contrato assinado..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={confirmConverteuAction} disabled={savingConverteu} className="w-full bg-green-600 hover:bg-green-700">
              Confirmar Conversão
            </Button>
            <Button variant="secondary" onClick={() => setConfirmConverteu(false)} className="w-full">
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* 4. Modal Não Converteu */}
      <Modal isOpen={confirmNaoConverteu} onClose={() => setConfirmNaoConverteu(false)} title="Lead Não Converteu">
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-[8px] text-rose-800 font-medium text-sm flex items-center gap-2">
            <ShieldAlert size={16} />
            Entenda o motivo do encerramento do atendimento para melhorar seu funil.
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Objeção Principal *</label>
            <select 
              value={naoConverteuForm.objecao} 
              onChange={e => setNaoConverteuForm({...naoConverteuForm, objecao: e.target.value})}
              className="w-full border rounded p-2 text-sm bg-white"
            >
              <option value="">Selecione o motivo</option>
              <option value="Preço / Financeiro">Preço / Financeiro</option>
              <option value="Horário / Agenda">Horário / Agenda</option>
              <option value="Localização">Localização</option>
              <option value="Não respondeu mais">Não respondeu mais</option>
              <option value="Desistiu do procedimento">Desistiu do procedimento</option>
              <option value="Outro">Outro (especificar abaixo)</option>
            </select>
          </div>

          {naoConverteuForm.objecao === 'Outro' && (
            <div>
              <label className="block text-sm font-medium mb-1">Especifique o motivo *</label>
              <Input 
                value={naoConverteuForm.motivo} 
                onChange={e => setNaoConverteuForm({...naoConverteuForm, motivo: e.target.value})}
                className="h-9"
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={confirmNaoConverteuAction} disabled={savingNaoConverteu} className="w-full bg-rose-600 hover:bg-rose-700">
              Confirmar Não Conversão
            </Button>
            <Button variant="secondary" onClick={() => setConfirmNaoConverteu(false)} className="w-full">
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
}
