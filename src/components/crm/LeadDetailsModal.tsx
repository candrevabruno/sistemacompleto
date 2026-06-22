import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useClinic } from '../../contexts/ClinicContext';
import { Modal } from '../ui/Modal';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  X, MessageCircle, Archive, UserCheck,
  Clock, Target, Save, ChevronRight, MessageSquare, User,
  Pencil, Trash2, Check, ClipboardList, ChevronDown,
} from 'lucide-react';
import { calcularTemperatura, getInitials } from '../../lib/lead-utils';

// ── Pipeline stages — unified with CRM Kanban ─────────────────────────────────
const PIPELINE_STAGES = [
  { id: 'iniciou_atendimento',   title: 'Iniciou' },
  { id: 'conversando',           title: 'Conversando' },
  { id: 'follow_up',             title: 'Follow-Up' },
  { id: 'agendado',              title: 'Agendado' },
  { id: 'reagendado',            title: 'Reagendado' },
  { id: 'faltou',                title: 'Faltou' },
  { id: 'cancelou_agendamento',  title: 'Cancelou Agendamento' },
  { id: 'nao_converteu',         title: 'Não Converteu' },
  { id: 'abandonou_conversa',    title: 'Abandonou' },
];

const ACAO_TIPOS = [
  { key: 'ligar',     label: 'Ligar' },
  { key: 'mensagem',  label: 'Mensagem' },
  { key: 'reagendar', label: 'Reagendar' },
  { key: 'conteudo',  label: 'Conteúdo' },
  { key: 'aguardar',  label: 'Aguardar' },
] as const;

type AcaoTipo = typeof ACAO_TIPOS[number]['key'];

const AUDIT_LABEL: Record<string, string> = {
  lead_convertido:   'Convertido em paciente',
  lead_arquivado:    'Arquivado',
  lead_reativado:    'Reativado',
  lead_faltou:       'Não compareceu (falta)',
  tentativa_contato: 'Tentativa de contato',
};

const ACAO_LABEL: Record<string, string> = {
  ligar:     'Ligação',
  mensagem:  'Mensagem enviada',
  reagendar: 'Reagendamento',
  conteudo:  'Conteúdo enviado',
  aguardar:  'Aguardando',
};

const MOTIVOS_ARQUIVAMENTO = [
  'Não quer mais atendimento',
  'Sem resposta após tentativas',
  'Atende em outro lugar',
  'Valor fora do orçamento',
  'Outro motivo',
];

type TLItem = {
  id: string;
  created_at: string;
  title: string;
  subtitle?: string;
  source: 'audit' | 'acao';
  rawId?: string;  // id real em acoes_lead (para editar/apagar ações manuais)
  obs?: string;    // observação crua (para edição)
};

// ── Temperature ───────────────────────────────────────────────────────────────
function getTemperatureDisplay(lead: any): { label: string; color: string; bg: string } {
  const t = lead.score_temperatura || calcularTemperatura(lead);
  switch (t) {
    case 'quente':     return { label: 'Quente',    color: '#dc2626', bg: 'rgba(220,38,38,0.08)' };
    case 'morno':
    case 'esfriando':  return { label: 'Esfriando', color: '#d97706', bg: 'rgba(217,119,6,0.08)' };
    case 'novo':       return { label: 'Novo',       color: 'var(--sage-dark)', bg: 'var(--sage-xlight)' };
    default:           return { label: 'Frio',       color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  }
}

function diasDesdeContato(lead: any): string {
  const ref = lead.ultima_mensagem || lead.inicio_atendimento;
  if (!ref) return '—';
  const dias = Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Ontem';
  return `${dias} dias atrás`;
}

// ── Style constants ────────────────────────────────────────────────────────────
const labelSt: React.CSSProperties = {
  fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px',
  textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px', display: 'block',
};

const sectionH: React.CSSProperties = {
  fontSize: '10px', fontWeight: 600, letterSpacing: '1px',
  textTransform: 'uppercase', color: 'var(--muted)',
  marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px',
};

const scoreTA: React.CSSProperties = {
  width: '100%', border: '1px solid var(--border-md)', borderRadius: '8px',
  padding: '7px 10px', fontSize: '12.5px', color: 'var(--ink)',
  background: 'var(--white)', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, outline: 'none',
};

const btnGhost: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  background: 'transparent', color: 'var(--muted)',
  border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)',
  padding: '7px 13px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
};

const btnPrimary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  background: 'var(--sage-dark)', color: 'white', border: 'none',
  borderRadius: 'var(--r-xs)', padding: '7px 14px',
  fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
};

// ── Component ─────────────────────────────────────────────────────────────────
export function LeadDetailsModal({
  isOpen, onClose, leadId, onUpdate,
}: {
  isOpen: boolean;
  onClose: () => void;
  leadId: string | null | undefined;
  onUpdate?: () => void;
}) {
  const { user, canEdit } = useAuth();
  const { config } = useClinic();
  const canEditLeads = canEdit('modulo:leads');
  const navigate = useNavigate();

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<TLItem[]>([]);

  // Bloco de contato (editável)
  const [contatoForm, setContatoForm] = useState({ nome: '', nascimento: '', email: '', origem: '' });
  const [savingContato, setSavingContato] = useState(false);

  // Edição/exclusão de itens manuais do histórico
  const [editTlId, setEditTlId] = useState<string | null>(null);
  const [editTlObs, setEditTlObs] = useState('');
  const [editTlData, setEditTlData] = useState('');
  const [confirmDelTl, setConfirmDelTl] = useState<string | null>(null);
  const [busyTl, setBusyTl] = useState(false);

  const [scoreForm, setScoreForm] = useState({ temperatura: '', sonho: '', contexto: '', obstaculo: '', rota: '', gatilho: '' });
  const [savingScore, setSavingScore] = useState(false);

  const [anotacoes, setAnotacoes] = useState('');
  const [savingAnotacoes, setSavingAnotacoes] = useState(false);

  const [acaoTipo, setAcaoTipo] = useState<AcaoTipo | ''>('');
  const [acaoObs, setAcaoObs] = useState('');
  const [acaoData, setAcaoData] = useState('');
  const [savingAcao, setSavingAcao] = useState(false);

  const [showConverter, setShowConverter] = useState(false);
  const [converting, setConverting] = useState(false);

  const [showFaltou, setShowFaltou] = useState(false);
  const [markingFaltou, setMarkingFaltou] = useState(false);

  const [showArchivar, setShowArchivar] = useState(false);
  const [arquivarMotivo, setArquivarMotivo] = useState('');
  const [arquivarObs, setArquivarObs] = useState('');
  const [arquivarLgpd, setArquivarLgpd] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [showApagarLead, setShowApagarLead] = useState(false);
  const [deletingLead, setDeletingLead] = useState(false);

  const [savingStatus, setSavingStatus] = useState(false);

  const [anamneseSubmission, setAnamneseSubmission] = useState<any | null>(null);
  const [anamneseModal, setAnamneseModal] = useState(false);
  const [anamneseExpanded, setAnamneseExpanded] = useState(false);

  const loadData = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const { data: leadData } = await supabase.from('leads').select('*').eq('id', leadId).single();
      if (!leadData) { setLoading(false); return; }
      setLead(leadData);
      setScoreForm({
        temperatura: leadData.score_temperatura || '',
        sonho:       leadData.score_sonho       || '',
        contexto:    leadData.score_contexto    || '',
        obstaculo:   leadData.score_obstaculo   || '',
        rota:        leadData.score_rota        || '',
        gatilho:     leadData.score_gatilho     || '',
      });
      setAnotacoes(leadData.anotacoes_secretaria || '');
      setContatoForm({
        nome:       leadData.nome_lead       || '',
        nascimento: (leadData.data_nascimento || '').slice(0, 10),
        email:      leadData.email           || '',
        origem:     leadData.origem          || '',
      });

      const [{ data: audit }, { data: acoes }] = await Promise.all([
        supabase.from('audit_log').select('id, action, created_at, detalhes').eq('record_id', leadId).order('created_at', { ascending: false }),
        supabase.from('acoes_lead').select('id, tipo, observacao, proximo_passo_em, created_at').eq('lead_id', leadId).order('created_at', { ascending: false }),
      ]);

      const tl: TLItem[] = [
        ...(audit || []).map(a => ({
          id: `a-${a.id}`,
          created_at: a.created_at,
          source: 'audit' as const,
          title: AUDIT_LABEL[a.action] || a.action,
          subtitle: a.detalhes?.observacao || a.detalhes?.motivo || undefined,
        })),
        ...(acoes || []).map(ac => ({
          id: `m-${ac.id}`,
          rawId: ac.id,
          obs: ac.observacao || '',
          created_at: ac.created_at,
          source: 'acao' as const,
          title: ACAO_LABEL[ac.tipo] || ac.tipo,
          subtitle: [
            ac.observacao,
            ac.proximo_passo_em ? `Próx: ${format(parseISO(ac.proximo_passo_em), 'dd/MM HH:mm')}` : null,
          ].filter(Boolean).join(' · ') || undefined,
        })),
      ];
      tl.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setTimeline(tl);

      // Buscar anamnese (form_submissions) mais recente do lead
      const { data: subs } = await supabase
        .from('form_submissions')
        .select('id, dados, resumo_ia, criado_em, created_at, formulario_id, visualizado')
        .eq('lead_id', leadId)
        .order('criado_em', { ascending: false })
        .limit(1);
      setAnamneseSubmission(subs?.[0] ?? null);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (isOpen && leadId) {
      setShowConverter(false);
      setShowFaltou(false);
      setShowArchivar(false);
      setShowApagarLead(false);
      setAcaoTipo('');
      setAcaoObs('');
      setAcaoData('');
      loadData();
    } else {
      setLead(null);
      setTimeline([]);
    }
  }, [isOpen, leadId, loadData]);

  const handleStatusChange = async (newStatus: string) => {
    if (!lead) return;
    setSavingStatus(true);
    await supabase.from('leads').update({ status: newStatus }).eq('id', lead.id);
    setLead((p: any) => ({ ...p, status: newStatus }));
    setSavingStatus(false);
    onUpdate?.();
  };

  const handleSaveScore = async () => {
    if (!lead) return;
    setSavingScore(true);
    await supabase.from('leads').update({
      score_temperatura: scoreForm.temperatura || null,
      score_sonho:       scoreForm.sonho       || null,
      score_contexto:    scoreForm.contexto    || null,
      score_obstaculo:   scoreForm.obstaculo   || null,
      score_rota:        scoreForm.rota        || null,
      score_gatilho:     scoreForm.gatilho     || null,
    }).eq('id', lead.id);
    setSavingScore(false);
    onUpdate?.();
  };

  const handleSaveAnotacoes = async () => {
    if (!lead) return;
    setSavingAnotacoes(true);
    await supabase.from('leads').update({ anotacoes_secretaria: anotacoes || null }).eq('id', lead.id);
    setSavingAnotacoes(false);
  };

  const handleSaveContato = async () => {
    if (!lead) return;
    setSavingContato(true);
    const updates = {
      nome_lead:       contatoForm.nome.trim() || null,
      data_nascimento: contatoForm.nascimento || null,
      email:           contatoForm.email.trim() || null,
      origem:          contatoForm.origem.trim() || null,
    };
    await supabase.from('leads').update(updates).eq('id', lead.id);
    setLead((p: any) => ({ ...p, ...updates }));
    setSavingContato(false);
    onUpdate?.();
  };

  // ── Edição/exclusão de itens MANUAIS do histórico (ações humanas) ─────────────
  // Itens de origem IA/workflow (source 'audit') NÃO podem ser alterados.
  const iniciarEdicaoTl = (item: TLItem) => {
    setEditTlId(item.id);
    setEditTlObs(item.obs || '');
    // datetime-local: yyyy-MM-ddThh:mm
    setEditTlData(format(new Date(item.created_at), "yyyy-MM-dd'T'HH:mm"));
    setConfirmDelTl(null);
  };

  const salvarEdicaoTl = async (item: TLItem) => {
    if (!item.rawId || !user) return;
    setBusyTl(true);
    const novoCreated = editTlData ? new Date(editTlData).toISOString() : item.created_at;
    await supabase.from('acoes_lead').update({
      observacao: editTlObs.trim() || null,
      created_at: novoCreated,
    }).eq('id', item.rawId);
    await supabase.from('audit_log').insert({
      user_id: user.id, action: 'acao_lead_editada', record_id: lead.id,
      detalhes: { acao_id: item.rawId, obs_anterior: item.obs || null, obs_nova: editTlObs.trim() || null, data_anterior: item.created_at, data_nova: novoCreated },
    });
    setBusyTl(false);
    setEditTlId(null);
    await loadData();
  };

  const apagarTl = async (item: TLItem) => {
    if (!item.rawId || !user) return;
    setBusyTl(true);
    await supabase.from('acoes_lead').delete().eq('id', item.rawId);
    await supabase.from('audit_log').insert({
      user_id: user.id, action: 'acao_lead_apagada', record_id: lead.id,
      detalhes: { acao_id: item.rawId, tipo: item.title, obs_anterior: item.obs || null, data: item.created_at },
    });
    setBusyTl(false);
    setConfirmDelTl(null);
    await loadData();
  };

  const handleRegistrarAcao = async () => {
    if (!lead || !acaoTipo) return;
    setSavingAcao(true);
    try {
      await supabase.from('acoes_lead').insert({
        lead_id: lead.id,
        tipo: acaoTipo,
        observacao: acaoObs || null,
        proximo_passo_em: acaoData ? new Date(acaoData).toISOString() : null,
        created_by: user?.id,
      });
      const updates: any = {};
      if (acaoData) updates.proximo_contato = new Date(acaoData).toISOString();
      if (acaoTipo === 'ligar' || acaoTipo === 'mensagem') {
        updates.tentativas = (lead.tentativas || 0) + 1;
      }
      if (Object.keys(updates).length) {
        await supabase.from('leads').update(updates).eq('id', lead.id);
        setLead((p: any) => ({ ...p, ...updates }));
      }
      setAcaoTipo('');
      setAcaoObs('');
      setAcaoData('');
      await loadData();
      onUpdate?.();
    } finally {
      setSavingAcao(false);
    }
  };

  const handleConverter = async () => {
    if (!lead || !user) return;
    setConverting(true);
    try {
      const now = new Date().toISOString();
      await supabase.from('leads').update({ status: 'converteu', converteu_em: now, converteu_por: user.id }).eq('id', lead.id);
      const { data: existing } = await supabase.from('pacientes').select('id').eq('lead_id', lead.id).maybeSingle();
      if (!existing) await supabase.from('pacientes').insert({ lead_id: lead.id });
      await supabase.from('audit_log').insert({
        user_id: user.id, action: 'lead_convertido', record_id: lead.id,
        detalhes: { nome: lead.nome_lead, timestamp: now },
      });
      setShowConverter(false);
      onUpdate?.();
      onClose();
    } finally {
      setConverting(false);
    }
  };

  const handleArchivar = async () => {
    if (!lead || !arquivarMotivo || !user) return;
    setArchiving(true);
    try {
      const now = new Date().toISOString();
      if (arquivarLgpd) {
        await supabase.from('leads').update({ nome_lead: 'REMOVIDO', whatsapp_lead: null, email: null }).eq('id', lead.id);
      }
      await supabase.from('leads').update({
        status: 'arquivado', motivo_arquivamento: arquivarMotivo,
        observacao_arquivamento: arquivarObs || null,
        arquivado_em: now, arquivado_por: user.id, lgpd_exclusao: arquivarLgpd,
      }).eq('id', lead.id);
      await supabase.from('audit_log').insert({
        user_id: user.id, action: 'lead_arquivado', record_id: lead.id,
        detalhes: { motivo: arquivarMotivo, observacao: arquivarObs || null, lgpd: arquivarLgpd, timestamp: now },
      });
      setShowArchivar(false);
      onUpdate?.();
      onClose();
    } finally {
      setArchiving(false);
    }
  };

  const handleFaltou = async () => {
    if (!lead || !user) return;
    setMarkingFaltou(true);
    try {
      const now = new Date().toISOString();
      // Marca o agendamento ativo mais recente como faltou.
      const { data: ags } = await supabase
        .from('agendamentos')
        .select('id')
        .eq('lead_id', lead.id)
        .not('status', 'in', '("cancelado","cancelou_agendamento","faltou","compareceu")')
        .order('data_hora_inicio', { ascending: false })
        .limit(1);
      if (ags && ags.length > 0) {
        await supabase.from('agendamentos').update({ status: 'faltou' }).eq('id', ags[0].id);
      }
      await supabase.from('leads').update({ status: 'faltou' }).eq('id', lead.id);
      await supabase.from('audit_log').insert({
        user_id: user.id, action: 'lead_faltou', record_id: lead.id,
        detalhes: { nome: lead.nome_lead, timestamp: now },
      });
      setShowFaltou(false);
      onUpdate?.();
      onClose();
    } finally {
      setMarkingFaltou(false);
    }
  };

  const handleApagarLead = async () => {
    if (!lead || !user) return;
    setDeletingLead(true);
    try {
      await supabase.rpc('apagar_lead_completo', { p_lead_id: lead.id });
      setShowApagarLead(false);
      onUpdate?.();
      onClose();
    } finally {
      setDeletingLead(false);
    }
  };

  if (!isOpen) return null;

  const temp = lead ? getTemperatureDisplay(lead) : null;
  const tentativas = lead?.tentativas || 0;
  const proximoContato = lead?.proximo_contato;
  const isArquivado = lead?.status === 'arquivado';

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} bare className="max-w-[920px] w-full">
      {loading || !lead ? (
        <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
          {loading ? 'Carregando...' : 'Lead não encontrado.'}
        </div>
      ) : (
        <div style={{ display: 'flex', maxHeight: '90vh', overflow: 'hidden' }}>

          {/* ── LEFT: conteúdo principal ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

            {/* HEADER */}
            <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--champ-light)', color: 'var(--champ-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                    {getInitials(lead.nome_lead)}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <div className="font-display" style={{ fontSize: '22px', fontWeight: 300, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1 }}>
                        {lead.nome_lead || 'Lead sem nome'}
                      </div>
                      {temp && (
                        <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 9px', borderRadius: '20px', background: temp.bg, color: temp.color }}>
                          {temp.label}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {lead.whatsapp_lead && <span>{lead.whatsapp_lead}</span>}
                      {lead.origem && <><span style={{ opacity: 0.4 }}>·</span><span>{lead.origem}</span></>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {lead.whatsapp_lead && (
                    <button onClick={() => { onClose(); navigate('/inbox', { state: { lead_id: lead.id } }); }} style={{ ...btnPrimary, padding: '6px 12px', fontSize: '11.5px' }}>
                      <MessageCircle size={13} /> WhatsApp
                    </button>
                  )}
                  <button onClick={onClose} style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid var(--border-md)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)' }}>
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Estágio + indicadores */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Estágio:</span>
                  <select value={lead.status} onChange={e => handleStatusChange(e.target.value)} disabled={savingStatus || isArquivado}
                    style={{ appearance: 'none', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', padding: '4px 10px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sage-dark)', background: 'var(--sage-xlight)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {isArquivado && <option value="arquivado">Arquivado</option>}
                    {PIPELINE_STAGES.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '14px', fontSize: '11.5px', color: 'var(--muted)', flexWrap: 'wrap' }}>
                  <span><b style={{ color: 'var(--ink)' }}>{diasDesdeContato(lead)}</b> · último contato</span>
                  <span><b style={{ color: 'var(--ink)' }}>{tentativas}×</b> tentativas</span>
                  {proximoContato && (
                    <span style={{ color: new Date(proximoContato) < new Date() ? '#dc2626' : 'var(--muted)' }}>
                      Próx: <b>{format(parseISO(proximoContato), 'dd/MM HH:mm')}</b>
                    </span>
                  )}
                  {lead.data_agendamento && (
                    <span>Agendamento: <b style={{ color: 'var(--ink)' }}>{format(parseISO(lead.data_agendamento), "dd/MM 'às' HH:mm")}</b></span>
                  )}
                </div>
              </div>

              {/* Badge anamnese */}
              {config?.tally_formulario_id && (
                <div style={{ marginTop: '8px' }}>
                  {anamneseSubmission ? (
                    <button
                      onClick={async () => {
                        setAnamneseModal(true);
                        if (anamneseSubmission && !anamneseSubmission.visualizado) {
                          await supabase.from('form_submissions').update({ visualizado: true }).eq('id', anamneseSubmission.id);
                          setAnamneseSubmission((prev: any) => prev ? { ...prev, visualizado: true } : prev);
                        }
                      }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '3px 10px', borderRadius: '999px', border: 'none',
                        background: 'rgba(34,197,94,0.12)', color: '#15803d',
                        fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <ClipboardList size={11} /> Anamnese preenchida
                    </button>
                  ) : (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '3px 10px', borderRadius: '999px',
                      background: 'rgba(148,163,184,0.12)', color: '#64748b',
                      fontSize: '11px', fontWeight: 500,
                    }}>
                      <ClipboardList size={11} /> Anamnese pendente
                    </span>
                  )}
                </div>
              )}

              {/* Placeholder: ação recomendada — ETAPA 4 PARTE 2 */}
              <div id="acao-recomendada-slot" style={{ marginTop: '8px', minHeight: '2px' }} />
            </div>

            {/* BODY SCROLLÁVEL */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

              {/* CONTATO (editável) */}
              <div style={{ marginBottom: '20px' }}>
                <div style={sectionH}>
                  <User size={12} style={{ color: 'var(--sage-dark)' }} />
                  Contato
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={labelSt}>Nome completo</label>
                    <input value={contatoForm.nome} onChange={e => setContatoForm(p => ({ ...p, nome: e.target.value }))}
                      disabled={isArquivado} placeholder="Nome do lead"
                      style={{ width: '100%', border: '1px solid var(--border-md)', borderRadius: '8px', padding: '7px 10px', fontSize: '12.5px', color: 'var(--ink)', background: 'var(--white)', fontFamily: 'inherit', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={labelSt}>Data de nascimento</label>
                    <input type="date" value={contatoForm.nascimento} onChange={e => setContatoForm(p => ({ ...p, nascimento: e.target.value }))}
                      disabled={isArquivado}
                      style={{ width: '100%', border: '1px solid var(--border-md)', borderRadius: '8px', padding: '7px 10px', fontSize: '12.5px', color: 'var(--ink)', background: 'var(--white)', fontFamily: 'inherit', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={labelSt}>Origem</label>
                    <input value={contatoForm.origem} onChange={e => setContatoForm(p => ({ ...p, origem: e.target.value }))}
                      disabled={isArquivado} placeholder="Ex: Instagram, tráfego pago, indicação"
                      style={{ width: '100%', border: '1px solid var(--border-md)', borderRadius: '8px', padding: '7px 10px', fontSize: '12.5px', color: 'var(--ink)', background: 'var(--white)', fontFamily: 'inherit', outline: 'none' }} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={labelSt}>E-mail</label>
                    <input type="email" value={contatoForm.email} onChange={e => setContatoForm(p => ({ ...p, email: e.target.value }))}
                      disabled={isArquivado} placeholder="email@exemplo.com"
                      style={{ width: '100%', border: '1px solid var(--border-md)', borderRadius: '8px', padding: '7px 10px', fontSize: '12.5px', color: 'var(--ink)', background: 'var(--white)', fontFamily: 'inherit', outline: 'none' }} />
                  </div>
                </div>
                {!isArquivado && (
                  <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={handleSaveContato} disabled={savingContato} style={{ ...btnGhost, fontSize: '11.5px', padding: '6px 12px', opacity: savingContato ? 0.7 : 1 }}>
                      <Save size={12} /> {savingContato ? 'Salvando...' : 'Salvar contato'}
                    </button>
                  </div>
                )}
              </div>

              {/* SCORE */}
              <div style={{ marginBottom: '20px' }}>
                <div style={sectionH}>
                  <Target size={12} style={{ color: 'var(--sage-dark)' }} />
                  Score do Lead
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={labelSt}>Temperatura (agente)</label>
                    <select value={scoreForm.temperatura} onChange={e => setScoreForm(p => ({ ...p, temperatura: e.target.value }))}
                      style={{ width: '100%', border: '1px solid var(--border-md)', borderRadius: '8px', padding: '7px 10px', fontSize: '12.5px', color: 'var(--ink)', background: 'var(--white)', fontFamily: 'inherit', outline: 'none' }}>
                      <option value="">— não definido —</option>
                      <option value="quente">Quente</option>
                      <option value="morno">Morno</option>
                      <option value="frio">Frio</option>
                      <option value="novo">Novo</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: 'span 1' }} />
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={labelSt}>Sonho (o que o lead quer alcançar)</label>
                    <textarea rows={2} value={scoreForm.sonho} onChange={e => setScoreForm(p => ({ ...p, sonho: e.target.value }))}
                      placeholder="Ex: Recuperar a autoestima, emagrecer 15 kg..." style={scoreTA} />
                  </div>
                  <div>
                    <label style={labelSt}>Contexto</label>
                    <textarea rows={2} value={scoreForm.contexto} onChange={e => setScoreForm(p => ({ ...p, contexto: e.target.value }))}
                      placeholder="Situação atual do lead..." style={scoreTA} />
                  </div>
                  <div>
                    <label style={labelSt}>Obstáculo</label>
                    <textarea rows={2} value={scoreForm.obstaculo} onChange={e => setScoreForm(p => ({ ...p, obstaculo: e.target.value }))}
                      placeholder="O que impede o lead de avançar..." style={scoreTA} />
                  </div>
                  <div>
                    <label style={labelSt}>Rota</label>
                    <textarea rows={2} value={scoreForm.rota} onChange={e => setScoreForm(p => ({ ...p, rota: e.target.value }))}
                      placeholder="Caminho proposto para resolver..." style={scoreTA} />
                  </div>
                  <div>
                    <label style={labelSt}>Gatilho</label>
                    <textarea rows={2} value={scoreForm.gatilho} onChange={e => setScoreForm(p => ({ ...p, gatilho: e.target.value }))}
                      placeholder="Motivação imediata de compra..." style={scoreTA} />
                  </div>
                </div>
                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={handleSaveScore} disabled={savingScore} style={{ ...btnGhost, fontSize: '11.5px', padding: '6px 12px', opacity: savingScore ? 0.7 : 1 }}>
                    <Save size={12} /> {savingScore ? 'Salvando...' : 'Salvar SCORE'}
                  </button>
                </div>
              </div>

              {/* REGISTRAR AÇÃO */}
              {!isArquivado && (
                <div style={{ marginBottom: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  <div style={sectionH}>
                    <ChevronRight size={12} style={{ color: 'var(--sage-dark)' }} />
                    Registrar Ação
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {ACAO_TIPOS.map(t => (
                      <button key={t.key} onClick={() => setAcaoTipo(prev => prev === t.key ? '' : t.key)}
                        style={{
                          padding: '5px 12px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 500,
                          cursor: 'pointer', fontFamily: 'inherit',
                          background: acaoTipo === t.key ? 'var(--sage-dark)' : 'var(--white)',
                          color: acaoTipo === t.key ? 'white' : 'var(--muted)',
                          border: acaoTipo === t.key ? '1px solid var(--sage-dark)' : '1px solid var(--border-md)',
                        }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {acaoTipo && (
                    <div style={{ padding: '12px', background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={labelSt}>Próximo passo em</label>
                          <input type="datetime-local" value={acaoData} onChange={e => setAcaoData(e.target.value)}
                            style={{ width: '100%', border: '1px solid var(--border-md)', borderRadius: '8px', padding: '7px 10px', fontSize: '12px', color: 'var(--ink)', background: 'var(--white)', fontFamily: 'inherit', outline: 'none' }} />
                        </div>
                        <div>
                          <label style={labelSt}>Observação (opcional)</label>
                          <input value={acaoObs} onChange={e => setAcaoObs(e.target.value)}
                            placeholder="Nota sobre esta ação..."
                            style={{ width: '100%', border: '1px solid var(--border-md)', borderRadius: '8px', padding: '7px 10px', fontSize: '12px', color: 'var(--ink)', background: 'var(--white)', fontFamily: 'inherit', outline: 'none' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={handleRegistrarAcao} disabled={savingAcao}
                          style={{ ...btnPrimary, fontSize: '11.5px', padding: '6px 14px', opacity: savingAcao ? 0.7 : 1 }}>
                          {savingAcao ? 'Registrando...' : 'Registrar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* HISTÓRICO UNIFICADO */}
              <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <div style={sectionH}>
                  <Clock size={12} style={{ color: 'var(--sage-dark)' }} />
                  Histórico unificado
                </div>
                {timeline.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>Nenhuma ação registrada.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {timeline.map((item, idx) => (
                      <div key={item.id} style={{ display: 'flex', gap: '10px', paddingBottom: idx < timeline.length - 1 ? '12px' : 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{ width: '7px', height: '7px', borderRadius: '50%', marginTop: '4px', background: item.source === 'acao' ? 'var(--sage-dark)' : 'var(--border-md)', flexShrink: 0 }} />
                          {idx < timeline.length - 1 && (
                            <div style={{ flex: 1, width: '1px', background: 'var(--border)', marginTop: '4px', minHeight: '18px' }} />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '7px' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', flexWrap: 'wrap', minWidth: 0 }}>
                              <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink)' }}>{item.title}</span>
                              {item.source === 'acao'
                                ? <span style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '1px 6px', borderRadius: '20px', background: 'var(--sage-xlight)', color: 'var(--sage-dark)', flexShrink: 0 }}>Manual</span>
                                : <span style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '1px 6px', borderRadius: '20px', background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)', flexShrink: 0 }}>Agente / sistema</span>}
                            </div>
                            {/* Editar/apagar: só ações manuais + permissão de editar Leads */}
                            {item.source === 'acao' && canEditLeads && editTlId !== item.id && confirmDelTl !== item.id && (
                              <span style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                                <button onClick={() => iniciarEdicaoTl(item)} title="Editar" style={{ padding: '2px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}><Pencil size={12} /></button>
                                <button onClick={() => { setConfirmDelTl(item.id); setEditTlId(null); }} title="Apagar" style={{ padding: '2px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}><Trash2 size={12} /></button>
                              </span>
                            )}
                          </div>

                          {editTlId === item.id ? (
                            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <input value={editTlObs} onChange={e => setEditTlObs(e.target.value)} placeholder="Observação..."
                                style={{ width: '100%', border: '1px solid var(--border-md)', borderRadius: '8px', padding: '6px 9px', fontSize: '12px', color: 'var(--ink)', background: 'var(--white)', fontFamily: 'inherit', outline: 'none' }} />
                              <input type="datetime-local" value={editTlData} onChange={e => setEditTlData(e.target.value)}
                                style={{ width: '100%', border: '1px solid var(--border-md)', borderRadius: '8px', padding: '6px 9px', fontSize: '12px', color: 'var(--ink)', background: 'var(--white)', fontFamily: 'inherit', outline: 'none' }} />
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={() => salvarEdicaoTl(item)} disabled={busyTl} style={{ ...btnPrimary, fontSize: '11px', padding: '5px 11px' }}>
                                  <Check size={12} /> Salvar
                                </button>
                                <button onClick={() => setEditTlId(null)} style={{ ...btnGhost, fontSize: '11px', padding: '5px 11px' }}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {item.subtitle && <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '1px' }}>{item.subtitle}</div>}
                              <div style={{ fontSize: '10.5px', color: 'var(--muted)', marginTop: '2px' }}>
                                {format(new Date(item.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                              </div>
                              {confirmDelTl === item.id && (
                                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--rose-light)', padding: '6px 9px', borderRadius: '8px' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--rose-text)' }}>Apagar esta ação?</span>
                                  <button onClick={() => apagarTl(item)} disabled={busyTl} style={{ fontSize: '11px', fontWeight: 500, padding: '3px 9px', borderRadius: '5px', border: 'none', cursor: 'pointer', background: 'var(--rose-text)', color: 'white', fontFamily: 'inherit' }}>{busyTl ? '...' : 'Apagar'}</button>
                                  <button onClick={() => setConfirmDelTl(null)} style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '5px', border: 'none', cursor: 'pointer', background: 'none', color: 'var(--rose-text)', fontFamily: 'inherit' }}>Cancelar</button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: sidebar ── */}
          <div style={{ width: '256px', flexShrink: 0, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '20px 18px' }}>

            {/* ANOTAÇÕES */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: '20px', minHeight: 0 }}>
              <div style={sectionH}>
                <MessageSquare size={12} style={{ color: 'var(--sage-dark)' }} />
                Anotações
              </div>
              <textarea
                value={anotacoes}
                onChange={e => setAnotacoes(e.target.value)}
                placeholder="Observações rápidas sobre este lead..."
                style={{ ...scoreTA, flex: 1, minHeight: '160px', resize: 'none' }}
              />
              <button onClick={handleSaveAnotacoes} disabled={savingAnotacoes}
                style={{ ...btnGhost, marginTop: '8px', justifyContent: 'center', fontSize: '11.5px', opacity: savingAnotacoes ? 0.7 : 1 }}>
                <Save size={12} /> {savingAnotacoes ? 'Salvando...' : 'Salvar nota'}
              </button>
            </div>

            {/* AÇÕES PRINCIPAIS */}
            {!isArquivado && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {!showConverter && !showFaltou && !showArchivar && !showApagarLead && (
                  <>
                    {/* Compareceu + Faltou lado a lado */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setShowConverter(true)}
                        style={{ ...btnPrimary, justifyContent: 'center', flex: 1, padding: '9px' }}>
                        <UserCheck size={14} /> Compareceu
                      </button>
                      <button onClick={() => setShowFaltou(true)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'rgba(100,116,139,0.08)', color: '#64748b', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 'var(--r-xs)', padding: '9px 14px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flex: 1 }}>
                        <X size={13} /> Faltou
                      </button>
                    </div>
                    <button onClick={() => { setArquivarMotivo(''); setArquivarObs(''); setArquivarLgpd(false); setShowArchivar(true); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'rgba(100,116,139,0.08)', color: '#64748b', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 'var(--r-xs)', padding: '8px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                      <Archive size={13} /> Arquivar Lead
                    </button>
                    {(user?.role === 'admin' || user?.role === 'super_admin') && (
                      <button onClick={() => setShowApagarLead(true)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'rgba(220,38,38,0.06)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 'var(--r-xs)', padding: '8px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                        <Trash2 size={13} /> Apagar Lead
                      </button>
                    )}
                  </>
                )}

                {showConverter && (
                  <div style={{ padding: '12px', background: 'var(--sage-xlight)', borderRadius: '10px', border: '1px solid var(--border-md)' }}>
                    <p style={{ fontSize: '12.5px', color: 'var(--sage-dark)', fontWeight: 500, marginBottom: '6px', lineHeight: 1.4 }}>
                      Registrar comparecimento de <strong>{lead.nome_lead}</strong>?
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px', lineHeight: 1.4 }}>
                      O lead será convertido em paciente. O cadastro pode ser completado depois.
                    </p>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setShowConverter(false)} style={{ ...btnGhost, flex: 1, justifyContent: 'center', padding: '6px', fontSize: '11px' }}>Cancelar</button>
                      <button onClick={handleConverter} disabled={converting} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', padding: '6px', fontSize: '11px', opacity: converting ? 0.7 : 1 }}>
                        {converting ? '...' : 'Confirmar'}
                      </button>
                    </div>
                  </div>
                )}

                {showFaltou && (
                  <div style={{ padding: '12px', background: 'rgba(100,116,139,0.06)', borderRadius: '10px', border: '1px solid rgba(100,116,139,0.2)' }}>
                    <p style={{ fontSize: '12.5px', color: 'var(--ink)', fontWeight: 500, marginBottom: '6px', lineHeight: 1.4 }}>
                      Registrar falta de <strong>{lead.nome_lead}</strong>?
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px', lineHeight: 1.4 }}>
                      O agendamento ativo será marcado como "Faltou" e o episódio fechado como no-show.
                    </p>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setShowFaltou(false)} style={{ ...btnGhost, flex: 1, justifyContent: 'center', padding: '6px', fontSize: '11px' }}>Cancelar</button>
                      <button onClick={handleFaltou} disabled={markingFaltou}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 1, padding: '6px', fontSize: '11px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: markingFaltou ? 'rgba(100,116,139,0.3)' : '#64748b', color: 'white', border: 'none', borderRadius: 'var(--r-xs)', opacity: markingFaltou ? 0.7 : 1 }}>
                        {markingFaltou ? '...' : 'Confirmar'}
                      </button>
                    </div>
                  </div>
                )}

                {showArchivar && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <select value={arquivarMotivo} onChange={e => setArquivarMotivo(e.target.value)}
                      style={{ width: '100%', border: '1px solid var(--border-md)', borderRadius: '8px', padding: '7px 10px', fontSize: '12px', color: 'var(--ink)', background: 'var(--white)', fontFamily: 'inherit', outline: 'none' }}>
                      <option value="">Motivo *</option>
                      {MOTIVOS_ARQUIVAMENTO.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <textarea rows={2} value={arquivarObs} onChange={e => setArquivarObs(e.target.value)}
                      placeholder="Observação (opcional)" style={{ ...scoreTA, resize: 'none' }} />
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '10.5px', color: 'var(--rose-text)', cursor: 'pointer', background: 'var(--rose-light)', padding: '8px', borderRadius: '8px', lineHeight: 1.4 }}>
                      <input type="checkbox" checked={arquivarLgpd} onChange={e => setArquivarLgpd(e.target.checked)} style={{ marginTop: '1px', accentColor: 'var(--rose-text)', flexShrink: 0 } as React.CSSProperties} />
                      Exclusão LGPD (anonimizar dados)
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setShowArchivar(false)} style={{ ...btnGhost, flex: 1, justifyContent: 'center', padding: '6px', fontSize: '11px' }}>Cancelar</button>
                      <button onClick={handleArchivar} disabled={archiving || !arquivarMotivo}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '6px', fontSize: '11px', fontWeight: 500, cursor: arquivarMotivo ? 'pointer' : 'not-allowed', fontFamily: 'inherit', background: arquivarMotivo && !archiving ? '#64748b' : 'rgba(100,116,139,0.3)', color: 'white', border: 'none', borderRadius: 'var(--r-xs)', opacity: archiving ? 0.7 : 1 }}>
                        {archiving ? '...' : 'Arquivar'}
                      </button>
                    </div>
                  </div>
                )}

                {showApagarLead && (
                  <div style={{ padding: '12px', background: 'rgba(220,38,38,0.05)', borderRadius: '10px', border: '1px solid rgba(220,38,38,0.2)' }}>
                    <p style={{ fontSize: '12.5px', color: '#dc2626', fontWeight: 500, marginBottom: '6px', lineHeight: 1.4 }}>
                      Apagar <strong>{lead.nome_lead}</strong> permanentemente?
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px', lineHeight: 1.4 }}>
                      Esta ação é irreversível. O lead e todo o histórico de ações serão removidos.
                    </p>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setShowApagarLead(false)} style={{ ...btnGhost, flex: 1, justifyContent: 'center', padding: '6px', fontSize: '11px' }}>Cancelar</button>
                      <button onClick={handleApagarLead} disabled={deletingLead}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 1, padding: '6px', fontSize: '11px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: deletingLead ? 'rgba(220,38,38,0.3)' : '#dc2626', color: 'white', border: 'none', borderRadius: 'var(--r-xs)', opacity: deletingLead ? 0.7 : 1 }}>
                        {deletingLead ? '...' : 'Apagar definitivo'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </Modal>

    {/* Modal: respostas da anamnese */}
    {anamneseModal && anamneseSubmission && (
      <Modal isOpen={anamneseModal} onClose={() => { setAnamneseModal(false); setAnamneseExpanded(false); }} title="Anamnese preenchida">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Resumo IA */}
          {anamneseSubmission.resumo_ia && (
            <div style={{ padding: '10px 13px', background: 'var(--sage-xlight)', borderRadius: '8px', borderLeft: '3px solid var(--sage-dark)' }}>
              <p style={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--sage-dark)', marginBottom: '5px' }}>Resumo da IA</p>
              <p style={{ fontSize: '12.5px', color: 'var(--ink)', lineHeight: 1.6 }}>{anamneseSubmission.resumo_ia}</p>
            </div>
          )}

          {/* Respostas brutas */}
          <div>
            <button
              onClick={() => setAnamneseExpanded(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit', fontSize: '12px', fontWeight: 500, color: 'var(--muted)' }}
            >
              {anamneseExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              Ver respostas brutas
            </button>
            {anamneseExpanded && (
              <div style={{ marginTop: '8px', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                {Object.entries(anamneseSubmission.dados || {}).map(([k, v]) => (
                  <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '8px', padding: '7px 12px', borderBottom: '1px solid var(--border)', fontSize: '12px' }}>
                    <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{k}</span>
                    <span style={{ color: 'var(--ink)' }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
            Preenchido em {format(parseISO(anamneseSubmission.criado_em || anamneseSubmission.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      </Modal>
    )}
    </>
  );
}
