import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  User, Calendar, DollarSign, Clock, FileText, Check, X,
  ShieldAlert, MessageCircle,
} from 'lucide-react';
import { calcularDataReativacao } from '../../lib/lead-utils';
import type { LeadDetalhes } from '../../types';

const COLUMNS = [
  { id: 'iniciou_atendimento', title: 'Iniciou' },
  { id: 'conversando',         title: 'Conversando' },
  { id: 'follow_up',           title: 'Follow-Up' },
  { id: 'agendado',            title: 'Agendado' },
  { id: 'reagendado',          title: 'Reagendado' },
  { id: 'faltou',              title: 'Faltou' },
  { id: 'cancelou_agendamento', title: 'Cancelou Agendamento' },
  { id: 'converteu',           title: 'Converteu (Venda)' },
  { id: 'nao_converteu',       title: 'Não Converteu' },
  { id: 'abandonou_conversa',  title: 'Abandonou' },
];

// ── Shared style tokens ──────────────────────────────────────────────────────

const sectionTitle: React.CSSProperties = {
  fontSize: '10px', fontWeight: 600, letterSpacing: '1px',
  textTransform: 'uppercase', color: 'var(--muted)',
  marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '7px',
};

const fieldLabel: React.CSSProperties = {
  fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px',
  textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '3px',
};

const formLabel: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: 600,
  letterSpacing: '0.8px', textTransform: 'uppercase',
  color: 'var(--muted)', marginBottom: '5px',
};

const btnGhost: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  background: 'transparent', color: 'var(--muted)',
  border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)',
  padding: '7px 13px', fontSize: '12px', fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit',
};

const btnPrimary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  background: 'var(--sage-dark)', color: 'white', border: 'none',
  borderRadius: 'var(--r-xs)', padding: '7px 14px',
  fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
};

const btnDanger: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  background: '#dc2626', color: 'white', border: 'none',
  borderRadius: 'var(--r-xs)', padding: '7px 14px',
  fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
};

// ── Component ────────────────────────────────────────────────────────────────

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

  const [savingStatus, setSavingStatus] = useState(false);

  const [detailsForm, setDetailsForm] = useState({
    genero: '', data_nascimento: '', observacoes: '',
    nome_lead: '', procedimento_interesse: '',
    whatsapp_lead: '', email: '', cpf: '',
  });
  const [savingDetails, setSavingDetails] = useState(false);

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
      const { data: leadData, error: leadError } = await supabase
        .from('leads').select('*').eq('id', leadId).single();
      if (leadError) throw leadError;
      setLead(leadData);
      setDetailsForm({
        genero: leadData.genero || '',
        data_nascimento: leadData.data_nascimento || '',
        observacoes: leadData.observacoes || '',
        nome_lead: leadData.nome_lead || '',
        procedimento_interesse: leadData.procedimento_interesse || '',
        whatsapp_lead: leadData.whatsapp_lead || '',
        email: leadData.email || '',
        cpf: leadData.cpf || '',
      });
      const { data: apptData } = await supabase
        .from('agendamentos').select('*, agendas(nome, cor)')
        .eq('lead_id', leadId).order('data_hora_inicio', { ascending: false });
      setAppointments(apptData || []);
      const { data: agendasData } = await supabase.from('agendas').select('id, nome, cor').eq('ativo', true);
      setAgendas(agendasData || []);
      const { data: servicosData } = await supabase.from('servicos').select('*').order('nome');
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
      const { error } = await supabase.from('leads').update({
        nome_lead: detailsForm.nome_lead,
        genero: detailsForm.genero || null,
        data_nascimento: detailsForm.data_nascimento || null,
        procedimento_interesse: detailsForm.procedimento_interesse || null,
        observacoes: detailsForm.observacoes || null,
        whatsapp_lead: detailsForm.whatsapp_lead,
        email: detailsForm.email || null,
        cpf: detailsForm.cpf || null,
      }).eq('id', lead.id);
      if (error) throw error;
      await loadAllData();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      alert(`Erro ao salvar: ${err.message}`);
    } finally {
      setSavingDetails(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!lead) return;
    if (newStatus === 'nao_converteu') { setNaoConverteuForm({ objecao: '', motivo: '' }); setConfirmNaoConverteu(true); return; }
    if (newStatus === 'converteu') { setConverteuForm({ servicos: [], valor: '', observacao: '' }); setConfirmConverteu(true); return; }
    if (newStatus === 'agendado') { setAgendadoForm({ dataHora: '', procedimento: lead.procedimento_interesse || '', agendaId: agendas[0]?.id || '', modalidade: 'presencial' }); setConfirmAgendado(true); return; }
    if (newStatus === 'reagendado') { setReagendadoForm({ dataHora: '', agendaId: lead.agenda_id || agendas[0]?.id || '', modalidade: lead.modalidade || 'presencial' }); setConfirmReagendado(true); return; }
    setSavingStatus(true);
    try {
      const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', lead.id);
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
      const { data: agendamento, error: agError } = await supabase.from('agendamentos').insert({
        lead_id: lead.id, agenda_id: agendadoForm.agendaId || null,
        procedimento_nome: agendadoForm.procedimento || lead.procedimento_interesse || null,
        nome_lead: lead.nome_lead || null, whatsapp_lead: lead.whatsapp_lead || null,
        data_hora_inicio: new Date(agendadoForm.dataHora).toISOString(),
        modalidade: agendadoForm.modalidade, status: 'agendado',
      }).select().single();
      if (agError) throw agError;
      const { error: updateError } = await supabase.from('leads').update({
        status: 'agendado', data_agendamento: new Date(agendadoForm.dataHora).toISOString(),
        agendamento_criado_em: new Date().toISOString(),
        id_agendamento: agendamento.id, modalidade: agendadoForm.modalidade,
      }).eq('id', lead.id);
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
      const { error } = await supabase.from('leads').update({
        status: 'converteu',
        valor_pago: parseFloat(converteuForm.valor.replace(',', '.')),
        servicos_contratados: converteuForm.servicos,
        observacoes: converteuForm.observacao
          ? `${lead.observacoes || ''}\nInformações Complementares: ${converteuForm.observacao}`
          : lead.observacoes,
      }).eq('id', lead.id);
      if (error) throw error;
      if (lead.id_agendamento) {
        await supabase.from('agendamentos').update({
          status: 'compareceu',
          valor_pago: parseFloat(converteuForm.valor.replace(',', '.')),
        }).eq('id', lead.id_agendamento);
      }
      const { data: existingClient } = await supabase.from('clientes').select('id').eq('lead_id', lead.id).maybeSingle();
      if (!existingClient) {
        await supabase.from('clientes').insert({ lead_id: lead.id, data_primeira_visita: new Date().toISOString(), valor_pago: parseFloat(converteuForm.valor.replace(',', '.')) });
      } else {
        const { data: currentClient } = await supabase.from('clientes').select('valor_pago').eq('lead_id', lead.id).single();
        const currentLTV = parseFloat(currentClient?.valor_pago || '0');
        await supabase.from('clientes').update({ valor_pago: currentLTV + parseFloat(converteuForm.valor.replace(',', '.')) }).eq('lead_id', lead.id);
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
      const { error } = await supabase.from('leads').update({
        status: 'nao_converteu',
        objecao: naoConverteuForm.objecao,
        motivo_perda: naoConverteuForm.objecao === 'Outro' ? naoConverteuForm.motivo : null,
      }).eq('id', lead.id);
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
        await supabase.from('agendamentos').update({ data_hora_inicio: novaData, status: 'reagendado', modalidade: reagendadoForm.modalidade }).eq('id', agId);
      } else {
        const { data: newAg, error: insertError } = await supabase.from('agendamentos').insert({
          lead_id: lead.id, agenda_id: reagendadoForm.agendaId || null,
          procedimento_nome: lead.procedimento_interesse || 'Consulta Inicial',
          nome_lead: lead.nome_lead || 'Lead sem nome',
          whatsapp_lead: lead.whatsapp_lead || '',
          data_hora_inicio: novaData, status: 'reagendado', modalidade: reagendadoForm.modalidade,
        }).select().single();
        if (insertError) throw insertError;
        agId = newAg.id;
      }
      const { error } = await supabase.from('leads').update({ status: 'reagendado', data_agendamento: novaData, modalidade: reagendadoForm.modalidade, id_agendamento: agId }).eq('id', lead.id);
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

  // ── Field helper ─────────────────────────────────────────────────────────────

  const renderField = (
    label: string,
    value: string | null | undefined,
    fullWidth: boolean,
    editInput?: React.ReactNode
  ) => (
    <div style={{
      gridColumn: fullWidth ? '1 / -1' : undefined,
      paddingBottom: '10px', marginBottom: '2px',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={fieldLabel}>{label}</div>
      {editInput ?? (
        <div style={{
          fontSize: '13px', fontWeight: 400,
          color: value ? 'var(--ink)' : 'var(--muted)',
          fontStyle: value ? 'normal' : 'italic',
        }}>
          {value || 'Não informado'}
        </div>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <Modal isOpen={isOpen} onClose={onClose} bare className="max-w-[680px]">

      {loading ? (
        <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div className="w-8 h-8 rounded-full border-4 border-[var(--sage-xlight)] border-t-[var(--sage-dark)] animate-spin" />
          <span style={{ fontSize: '13px' }}>Carregando informações do lead...</span>
        </div>
      ) : lead ? (
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

          {/* ── HEADER ── */}
          <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
                Detalhes do Lead
              </div>
              <div className="font-display" style={{ fontSize: '26px', fontWeight: 300, fontStyle: 'italic', color: 'var(--ink)', letterSpacing: '-0.4px', lineHeight: 1 }}>
                {lead.nome_lead || 'Lead sem nome'}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid var(--border-md)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)', flexShrink: 0, marginTop: '2px' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* ── STATUS BAR ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 500 }}>Estágio:</span>

            <select
              value={lead.status}
              onChange={e => handleStatusChange(e.target.value)}
              disabled={savingStatus}
              style={{
                appearance: 'none', background: 'var(--sage-xlight)',
                border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)',
                padding: '5px 28px 5px 10px', fontSize: '12px', fontWeight: 500,
                color: 'var(--sage-dark)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>

            {(() => {
              const { data: rDate, reativarHoje } = calcularDataReativacao(lead);
              if (!rDate) return null;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 500, padding: '4px 10px', borderRadius: '20px', color: reativarHoje ? 'var(--sage-dark)' : 'var(--champ-text)', background: reativarHoje ? 'var(--sage-xlight)' : 'var(--champ-light)' }}>
                  <Clock size={12} />
                  {reativarHoje ? 'Reativar hoje!' : `Reativar em ${format(rDate, 'dd/MM/yyyy')}`}
                </div>
              );
            })()}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '7px', flexShrink: 0 }}>
              <button
                onClick={() => {
                  setAgendadoForm({ dataHora: '', procedimento: lead.procedimento_interesse || '', agendaId: agendas[0]?.id || '', modalidade: 'presencial' });
                  setConfirmAgendado(true);
                }}
                style={btnGhost}
              >
                <Calendar size={14} /> Agendar
              </button>
              {lead.whatsapp_lead && (
                <button
                  onClick={() => { onClose(); navigate('/inbox', { state: { lead_id: lead.id } }); }}
                  style={btnPrimary}
                >
                  <MessageCircle size={14} /> WhatsApp
                </button>
              )}
            </div>
          </div>

          {/* ── BODY (2 cols) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, overflow: 'hidden', minHeight: 0 }}>

            {/* LEFT: cadastro */}
            <div style={{ padding: '18px 24px', borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
              <div style={sectionTitle}>
                <User size={13} style={{ color: 'var(--sage-dark)' }} />
                Informações de cadastro
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                {renderField('Nome completo', lead.nome_lead, true,
                  <Input value={detailsForm.nome_lead} onChange={e => setDetailsForm({ ...detailsForm, nome_lead: e.target.value })} className="mt-1 h-8 text-sm bg-white" />
                )}
                {renderField('WhatsApp', lead.whatsapp_lead, false,
                  <Input value={detailsForm.whatsapp_lead} onChange={e => setDetailsForm({ ...detailsForm, whatsapp_lead: e.target.value })} className="mt-1 h-8 text-sm bg-white" />
                )}
                {renderField('E-mail', lead.email, false,
                  <Input value={detailsForm.email} onChange={e => setDetailsForm({ ...detailsForm, email: e.target.value })} className="mt-1 h-8 text-sm bg-white" />
                )}
                {renderField('Gênero', lead.genero, false,
                  <select value={detailsForm.genero} onChange={e => setDetailsForm({ ...detailsForm, genero: e.target.value })} className="w-full mt-1 border border-[var(--border-md)] rounded-[8px] px-2 py-1 text-sm bg-white focus:outline-none">
                    <option value="">Não informado</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Outro">Outro</option>
                  </select>
                )}
                {renderField('Serviço de interesse', lead.procedimento_interesse, true,
                  <Input value={detailsForm.procedimento_interesse} onChange={e => setDetailsForm({ ...detailsForm, procedimento_interesse: e.target.value })} className="mt-1 h-8 text-sm bg-white" />
                )}
                {renderField('Origem', lead.origem, false)}
                {renderField('1º Contato', lead.inicio_atendimento ? format(parseISO(lead.inicio_atendimento), 'dd/MM/yyyy', { locale: ptBR }) : null, false)}
              </div>

              {/* Observações */}
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                <div style={fieldLabel}>Observações</div>
                <textarea
                  rows={4}
                  value={detailsForm.observacoes}
                  onChange={e => setDetailsForm({ ...detailsForm, observacoes: e.target.value })}
                  style={{ width: '100%', border: '1px solid var(--border-md)', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: 'var(--ink)', background: 'white', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, marginTop: '4px' }}
                  placeholder="Anote informações pertinentes..."
                />
              </div>

              {/* IA / Resumo da conversa */}
              {lead.resumo_conversa && (
                <div style={{ marginTop: '12px', background: 'var(--champ-light)', border: '1px solid var(--champ)', borderRadius: 'var(--r-xs)', padding: '10px 12px', display: 'flex', gap: '9px', alignItems: 'flex-start' }}>
                  <FileText size={15} style={{ color: 'var(--champ-text)', flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--champ-text)', marginBottom: '2px' }}>Resumo da Conversa (IA)</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--champ-text)', lineHeight: 1.5, fontStyle: 'italic' }}>"{lead.resumo_conversa}"</div>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: jornada + agendamentos */}
            <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>

              <div>
                <div style={sectionTitle}>
                  <Clock size={13} style={{ color: 'var(--sage-dark)' }} />
                  Jornada do cliente
                </div>

                {lead.jornada && lead.jornada.length > 0 ? (
                  <div>
                    {lead.jornada.map((item, index) => {
                      const col = COLUMNS.find(c => c.id === item.status);
                      const displayTitle = col ? col.title : item.status;
                      const formattedTime = (() => {
                        try { return format(parseISO(item.timestamp), "dd/MM/yyyy 'às' HH:mm'h'", { locale: ptBR }); }
                        catch { return item.timestamp; }
                      })();
                      const isLatest = index === lead.jornada!.length - 1;

                      return (
                        <div key={index} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{
                              width: '9px', height: '9px', borderRadius: '50%', flexShrink: 0, marginTop: '3px',
                              background: isLatest ? 'var(--champ)' : 'var(--sage-dark)',
                              border: isLatest ? '2px solid var(--champ-text)' : 'none',
                            }} />
                            {!isLatest && (
                              <div style={{ flex: 1, width: '1px', background: 'var(--border)', margin: '3px auto 0', minHeight: '32px' }} />
                            )}
                          </div>
                          <div style={{ flex: 1, paddingBottom: isLatest ? 0 : '10px' }}>
                            <div style={{ fontSize: '12.5px', fontWeight: isLatest ? 600 : 500, color: isLatest ? 'var(--champ-text)' : 'var(--ink)' }}>
                              {displayTitle}
                              {item.valor_pago ? (
                                <span style={{ marginLeft: '6px', fontSize: '10px', padding: '2px 6px', background: 'var(--sage-xlight)', color: 'var(--sage-dark)', borderRadius: '10px' }}>
                                  + {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_pago)}
                                </span>
                              ) : null}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>{formattedTime}</div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 500, padding: '2px 8px', borderRadius: '20px', marginTop: '4px', background: isLatest ? 'var(--champ-light)' : 'var(--sage-xlight)', color: isLatest ? 'var(--champ-text)' : 'var(--sage-dark)' }}>
                              {isLatest ? '! Atual' : '✓ Concluído'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>Nenhuma transição registrada.</p>
                )}
              </div>

              {appointments.length > 0 && (
                <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                  <div style={sectionTitle}>
                    <Calendar size={13} style={{ color: 'var(--sage-dark)' }} />
                    Agendamentos
                  </div>
                  {appointments.slice(0, 3).map((appt: any) => (
                    <div key={appt.id} style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: '8px', marginBottom: '6px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--ink)' }}>{appt.procedimento_nome || 'Consulta'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                        {appt.data_hora_inicio ? format(parseISO(appt.data_hora_inicio), "dd/MM 'às' HH:mm'h'", { locale: ptBR }) : '—'}
                        {appt.agendas?.nome ? ` · ${appt.agendas.nome}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>

          {/* ── FOOTER ── */}
          <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg)', flexShrink: 0 }}>
            <button onClick={onClose} style={btnGhost}>
              <X size={13} /> Cancelar
            </button>
            <div style={{ marginLeft: 'auto' }}>
              <button onClick={handleUpdateDetails} disabled={savingDetails} style={{ ...btnPrimary, opacity: savingDetails ? 0.7 : 1 }}>
                <Check size={13} /> Salvar alterações
              </button>
            </div>
          </div>

        </div>
      ) : (
        <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
          Lead não encontrado ou excluído.
        </div>
      )}

      {/* ── SUB-MODALS ─────────────────────────────────────────────────────────── */}

      {/* 1. Criar Agendamento */}
      <Modal isOpen={confirmAgendado} onClose={() => setConfirmAgendado(false)} title="Criar Agendamento">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '10px 12px', background: 'var(--sage-xlight)', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', fontSize: '12px', fontWeight: 500, color: 'var(--sage-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={14} /> Defina os detalhes do agendamento
          </div>

          <div>
            <label style={formLabel}>Data e Hora *</label>
            <input type="datetime-local" value={agendadoForm.dataHora} onChange={e => setAgendadoForm({ ...agendadoForm, dataHora: e.target.value })} className="w-full rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--sage-dark)]" style={{ border: '1px solid var(--border-md)', background: 'var(--bg)' }} />
          </div>

          <div>
            <label style={formLabel}>Agenda / Profissional</label>
            <select value={agendadoForm.agendaId} onChange={e => setAgendadoForm({ ...agendadoForm, agendaId: e.target.value })} className="w-full rounded-[8px] px-3 py-2 text-sm focus:outline-none" style={{ border: '1px solid var(--border-md)', background: 'var(--bg)' }}>
              <option value="">Selecione uma agenda</option>
              {agendas.map(ag => <option key={ag.id} value={ag.id}>{ag.nome}</option>)}
            </select>
          </div>

          <div>
            <label style={formLabel}>Modalidade</label>
            <select value={agendadoForm.modalidade} onChange={e => setAgendadoForm({ ...agendadoForm, modalidade: e.target.value })} className="w-full rounded-[8px] px-3 py-2 text-sm focus:outline-none" style={{ border: '1px solid var(--border-md)', background: 'var(--bg)' }}>
              <option value="presencial">Presencial</option>
              <option value="online">Online / Teleconsulta</option>
            </select>
          </div>

          <div>
            <label style={formLabel}>Procedimento</label>
            <Input value={agendadoForm.procedimento} onChange={e => setAgendadoForm({ ...agendadoForm, procedimento: e.target.value })} className="h-9" />
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button onClick={() => setConfirmAgendado(false)} style={btnGhost}>Cancelar</button>
            <button onClick={confirmAgendadoAction} disabled={savingAgendado} style={{ ...btnPrimary, opacity: savingAgendado ? 0.7 : 1 }}>
              <Calendar size={13} /> Agendar
            </button>
          </div>
        </div>
      </Modal>

      {/* 2. Reagendar */}
      <Modal isOpen={confirmReagendado} onClose={() => setConfirmReagendado(false)} title="Reagendar Lead">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '10px 12px', background: 'var(--champ-light)', border: '1px solid var(--champ)', borderRadius: 'var(--r-xs)', fontSize: '12px', fontWeight: 500, color: 'var(--champ-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={14} /> Defina o novo horário do agendamento
          </div>

          <div>
            <label style={formLabel}>Nova Data e Hora *</label>
            <input type="datetime-local" value={reagendadoForm.dataHora} onChange={e => setReagendadoForm({ ...reagendadoForm, dataHora: e.target.value })} className="w-full rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--sage-dark)]" style={{ border: '1px solid var(--border-md)', background: 'var(--bg)' }} />
          </div>

          <div>
            <label style={formLabel}>Agenda / Profissional</label>
            <select value={reagendadoForm.agendaId} onChange={e => setReagendadoForm({ ...reagendadoForm, agendaId: e.target.value })} className="w-full rounded-[8px] px-3 py-2 text-sm focus:outline-none" style={{ border: '1px solid var(--border-md)', background: 'var(--bg)' }}>
              <option value="">Selecione uma agenda</option>
              {agendas.map(ag => <option key={ag.id} value={ag.id}>{ag.nome}</option>)}
            </select>
          </div>

          <div>
            <label style={formLabel}>Modalidade</label>
            <select value={reagendadoForm.modalidade} onChange={e => setReagendadoForm({ ...reagendadoForm, modalidade: e.target.value })} className="w-full rounded-[8px] px-3 py-2 text-sm focus:outline-none" style={{ border: '1px solid var(--border-md)', background: 'var(--bg)' }}>
              <option value="presencial">Presencial</option>
              <option value="online">Online / Teleconsulta</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button onClick={() => setConfirmReagendado(false)} style={btnGhost}>Cancelar</button>
            <button onClick={confirmReagendadoAction} disabled={savingReagendado} style={{ ...btnPrimary, opacity: savingReagendado ? 0.7 : 1 }}>
              <Check size={13} /> Reagendar
            </button>
          </div>
        </div>
      </Modal>

      {/* 3. Finalizar Venda */}
      <Modal isOpen={confirmConverteu} onClose={() => setConfirmConverteu(false)} title="Finalizar Venda">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '10px 12px', background: 'var(--sage-xlight)', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', fontSize: '12px', fontWeight: 500, color: 'var(--sage-dark)' }}>
            🚀 Parabéns! Preencha os dados da conversão.
          </div>

          <div>
            <label style={formLabel}>Serviços Contratados *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', maxHeight: '180px', overflowY: 'auto', padding: '2px' }}>
              {availableServicos.map(srv => (
                <label key={srv.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', background: converteuForm.servicos.includes(srv.nome) ? 'var(--sage-xlight)' : 'transparent', transition: 'background 0.15s' }}>
                  <input type="checkbox" checked={converteuForm.servicos.includes(srv.nome)} onChange={e => {
                    if (e.target.checked) setConverteuForm({ ...converteuForm, servicos: [...converteuForm.servicos, srv.nome] });
                    else setConverteuForm({ ...converteuForm, servicos: converteuForm.servicos.filter(s => s !== srv.nome) });
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
            <label style={formLabel}>Valor do Fechamento (R$) *</label>
            <Input type="text" placeholder="Ex: 500,00" value={converteuForm.valor} onChange={e => setConverteuForm({ ...converteuForm, valor: e.target.value })} icon={<DollarSign className="w-4 h-4" />} className="h-9" />
          </div>

          <div>
            <label style={formLabel}>Informações Complementares</label>
            <textarea rows={3} value={converteuForm.observacao} onChange={e => setConverteuForm({ ...converteuForm, observacao: e.target.value })} style={{ width: '100%', border: '1px solid var(--border-md)', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', background: 'var(--bg)', fontFamily: 'inherit', resize: 'vertical' }} placeholder="Ex: Pagamento parcelado, contrato assinado..." />
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button onClick={() => setConfirmConverteu(false)} style={btnGhost}>Cancelar</button>
            <button onClick={confirmConverteuAction} disabled={savingConverteu || !converteuForm.valor || converteuForm.servicos.length === 0} style={{ ...btnPrimary, opacity: (savingConverteu || !converteuForm.valor || converteuForm.servicos.length === 0) ? 0.7 : 1 }}>
              <Check size={13} /> Confirmar Conversão
            </button>
          </div>
        </div>
      </Modal>

      {/* 4. Não Converteu */}
      <Modal isOpen={confirmNaoConverteu} onClose={() => setConfirmNaoConverteu(false)} title="Lead Não Converteu">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '10px 12px', background: 'var(--rose-light)', border: '1px solid rgba(139,68,68,0.2)', borderRadius: 'var(--r-xs)', fontSize: '12px', fontWeight: 500, color: 'var(--rose-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={14} /> Entenda o motivo para melhorar seu funil.
          </div>

          <div>
            <label style={formLabel}>Objeção Principal *</label>
            <select value={naoConverteuForm.objecao} onChange={e => setNaoConverteuForm({ ...naoConverteuForm, objecao: e.target.value })} className="w-full rounded-[8px] px-3 py-2 text-sm focus:outline-none" style={{ border: '1px solid var(--border-md)', background: 'var(--bg)' }}>
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
              <label style={formLabel}>Especifique o motivo *</label>
              <Input value={naoConverteuForm.motivo} onChange={e => setNaoConverteuForm({ ...naoConverteuForm, motivo: e.target.value })} className="h-9" placeholder="Descreva o motivo..." />
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button onClick={() => setConfirmNaoConverteu(false)} style={btnGhost}>Cancelar</button>
            <button onClick={confirmNaoConverteuAction} disabled={savingNaoConverteu || !naoConverteuForm.objecao} style={{ ...btnDanger, opacity: (savingNaoConverteu || !naoConverteuForm.objecao) ? 0.7 : 1 }}>
              <Check size={13} /> Confirmar
            </button>
          </div>
        </div>
      </Modal>

    </Modal>
  );
}
