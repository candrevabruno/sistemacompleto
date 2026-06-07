import { useEffect, useRef, useState } from 'react';
import {
  Plus, X, Check, Bot, UserCheck, ChevronDown, Bell, FileText,
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInSeconds } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Agendamento, Conversa, Lead, Tag, Tarefa } from '../../types';

const CRM_STAGES: Record<string, { label: string; color: string }> = {
  iniciou_atendimento:  { label: 'Novo Lead',            color: '#7A9E87' },
  conversando:          { label: 'Conversando',          color: '#6B9EC4' },
  follow_up:            { label: 'Follow-Up',            color: '#3b82f6' },
  agendado:             { label: 'Consulta Agendada',    color: '#10b981' },
  reagendado:           { label: 'Reagendado',           color: '#f59e0b' },
  compareceu:           { label: 'Compareceu',           color: '#16a34a' },
  faltou:               { label: 'Não Compareceu',       color: '#64748b' },
  cancelou_agendamento: { label: 'Cancelou Agendamento', color: '#fb7185' },
  converteu:            { label: 'Converteu',            color: '#7c3aed' },
  nao_converteu:        { label: 'Não Converteu',        color: '#dc2626' },
  abandonou_conversa:   { label: 'Encerrado',            color: '#9ca3af' },
};

const APTO_STATUS: Record<string, { label: string; color: string }> = {
  agendado:   { label: 'Agendado',   color: '#6B9EC4' },
  confirmado: { label: 'Confirmada', color: '#10b981' },
  compareceu: { label: 'Realizada',  color: '#7c3aed' },
  faltou:     { label: 'Faltou',     color: '#64748b' },
  cancelado:  { label: 'Cancelado',  color: '#fb7185' },
  reagendado: { label: 'Reagendado', color: '#f59e0b' },
};

interface Props {
  conversa: Conversa | null;
  onAssumirAtendimento: () => Promise<void>;
  onRetornarParaIA: () => Promise<void>;
}

export function SidePanel({ conversa, onAssumirAtendimento, onRetornarParaIA }: Props) {
  const { user } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [agendamento, setAgendamento] = useState<Agendamento | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [conversaTagIds, setConversaTagIds] = useState<string[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [leadStatus, setLeadStatus] = useState<string | null>(null);
  const [novaTarefa, setNovaTarefa] = useState('');
  const [novaTag, setNovaTag] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [addingTarefa, setAddingTarefa] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [assumindo, setAssumindo] = useState(false);
  const [retornando, setRetornando] = useState(false);
  const [tempoAtendimento, setTempoAtendimento] = useState('');
  const pipelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAllTags();
  }, []);

  useEffect(() => {
    if (!conversa) {
      setConversaTagIds([]);
      setTarefas([]);
      setLeadStatus(null);
      setLead(null);
      setAgendamento(null);
      return;
    }
    loadConversaTags(conversa.id);
    if (conversa.lead_id) {
      loadLead(conversa.lead_id);
      loadTarefas(conversa.lead_id);
    } else {
      setLead(null);
      setTarefas([]);
      setLeadStatus(null);
      setAgendamento(null);
    }
  }, [conversa?.id]);

  // Timer ao vivo quando humano está atendendo
  useEffect(() => {
    if (!conversa?.is_human || !conversa?.handoff_at) {
      setTempoAtendimento('');
      return;
    }
    function tick() {
      if (!conversa?.handoff_at) return;
      const s = differenceInSeconds(new Date(), new Date(conversa.handoff_at));
      const m = Math.floor(s / 60);
      setTempoAtendimento(`${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [conversa?.is_human, conversa?.handoff_at]);

  // Fechar dropdown pipeline ao clicar fora
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (pipelineRef.current && !pipelineRef.current.contains(e.target as Node)) {
        setPipelineOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  async function loadAllTags() {
    const { data } = await supabase.from('tags').select('*').order('nome');
    if (data) setAllTags(data);
  }

  async function loadConversaTags(conversaId: string) {
    const { data } = await supabase
      .from('conversa_tags').select('tag_id').eq('conversa_id', conversaId);
    if (data) setConversaTagIds(data.map(d => d.tag_id));
  }

  async function loadLead(leadId: string) {
    const { data } = await supabase
      .from('leads')
      .select('id, nome_lead, resumo_conversa, status, origem, inicio_atendimento')
      .eq('id', leadId)
      .single();
    if (data) {
      setLead(data);
      setLeadStatus(data.status ?? null);
      const { data: apt } = await supabase
        .from('agendamentos')
        .select('id, procedimento_nome, data_hora_inicio, status, agenda:agendas(nome)')
        .eq('lead_id', leadId)
        .gte('data_hora_inicio', new Date().toISOString())
        .in('status', ['agendado', 'confirmado'])
        .order('data_hora_inicio', { ascending: true })
        .limit(1)
        .maybeSingle();
      setAgendamento(apt);
    }
  }

  async function loadTarefas(leadId: string) {
    const { data } = await supabase
      .from('tarefas').select('*').eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    if (data) setTarefas(data);
  }

  async function toggleTag(tagId: string) {
    if (!conversa) return;
    if (conversaTagIds.includes(tagId)) {
      await supabase.from('conversa_tags').delete()
        .eq('conversa_id', conversa.id).eq('tag_id', tagId);
      setConversaTagIds(prev => prev.filter(id => id !== tagId));
    } else {
      await supabase.from('conversa_tags').insert({ conversa_id: conversa.id, tag_id: tagId });
      setConversaTagIds(prev => [...prev, tagId]);
    }
  }

  async function criarTag() {
    const nome = novaTag.trim();
    if (!nome) return;
    const cores = ['#7A9E87', '#6B9EC4', '#C4856B', '#9E7AC4', '#C4B86B', '#6BC4B8'];
    const cor = cores[Math.floor(Math.random() * cores.length)];
    const { data } = await supabase.from('tags').insert({ nome, cor }).select().single();
    if (data) {
      setAllTags(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
      await toggleTag(data.id);
    }
    setNovaTag('');
    setAddingTag(false);
  }

  async function criarTarefa() {
    const titulo = novaTarefa.trim();
    if (!titulo || !conversa?.lead_id) return;
    const { data } = await supabase
      .from('tarefas').insert({ lead_id: conversa.lead_id, titulo, created_by: user?.id })
      .select().single();
    if (data) setTarefas(prev => [data, ...prev]);
    setNovaTarefa('');
    setAddingTarefa(false);
  }

  async function toggleTarefa(tarefa: Tarefa) {
    await supabase.from('tarefas').update({ concluida: !tarefa.concluida }).eq('id', tarefa.id);
    setTarefas(prev => prev.map(t => t.id === tarefa.id ? { ...t, concluida: !t.concluida } : t));
  }

  async function mudarStatus(novoStatus: string) {
    if (!conversa?.lead_id) return;
    setPipelineOpen(false);
    await supabase.from('leads').update({ status: novoStatus }).eq('id', conversa.lead_id);
    setLeadStatus(novoStatus);
  }

  async function handleAssumir() {
    setAssumindo(true);
    try { await onAssumirAtendimento(); } finally { setAssumindo(false); }
  }

  async function handleRetornar() {
    setRetornando(true);
    try { await onRetornarParaIA(); } finally { setRetornando(false); }
  }

  if (!conversa) {
    return (
      <div className="w-[280px] flex-shrink-0 border-l border-[var(--color-border-card)] flex items-center justify-center p-6 bg-[var(--color-bg-base)]">
        <p className="text-xs text-[var(--color-text-muted)] text-center">
          Selecione uma conversa para ver detalhes
        </p>
      </div>
    );
  }

  const iniciais = conversa.nome_contato
    ? conversa.nome_contato.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
    : conversa.whatsapp_number.slice(-2);

  const proxAcao = tarefas.find(t => !t.concluida);
  const ativosTagIds = conversaTagIds;
  const tagsAtivas = allTags.filter(t => ativosTagIds.includes(t.id));
  const tagsInativas = allTags.filter(t => !ativosTagIds.includes(t.id));

  return (
    <div className="w-[280px] flex-shrink-0 border-l border-[var(--color-border-card)] flex flex-col overflow-y-auto bg-[var(--color-bg-base)]">

      {/* ── 1. PACIENTE ─────────────────────────────────────── */}
      <div className="p-4 border-b border-[var(--color-border-card)]">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Paciente</p>
        <div className="flex gap-3 items-start mb-3">
          <div className="w-9 h-9 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {iniciais}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-main)] leading-tight">
              {conversa.nome_contato || '—'}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{conversa.whatsapp_number}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Origem</p>
            <p className="text-xs font-medium text-[var(--color-text-main)] mt-0.5">{lead?.origem || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Primeiro contato</p>
            <p className="text-xs font-medium text-[var(--color-text-main)] mt-0.5">
              {conversa.created_at
                ? format(new Date(conversa.created_at), 'dd/MM/yyyy', { locale: ptBR })
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. ATENDIMENTO ──────────────────────────────────── */}
      <div className="p-4 border-b border-[var(--color-border-card)]">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Atendimento</p>

        {conversa.is_human ? (
          <>
            {/* Estado: Humano ativo */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-orange-600">Humano ativo</span>
              </div>
              <span className="text-[10px] text-[var(--color-text-muted)] bg-orange-50 border border-orange-200/60 px-2 py-0.5 rounded-full">
                IA pausada
              </span>
            </div>

            <div className="flex gap-2 items-center mb-3">
              <div className="w-7 h-7 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center text-[var(--color-primary)] text-xs font-bold flex-shrink-0">
                {conversa.handoff_by_name?.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'AT'}
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-main)] leading-tight">
                  {conversa.handoff_by_name || 'Atendente'}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)]">Atendente</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-3 mb-3">
              <div>
                <p className="text-[10px] text-[var(--color-text-muted)]">Assumiu às</p>
                <p className="text-xs font-medium text-[var(--color-text-main)] mt-0.5">
                  {conversa.handoff_at
                    ? format(new Date(conversa.handoff_at), 'HH:mm', { locale: ptBR })
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--color-text-muted)]">Tempo em atendimento</p>
                <p className="text-xs font-medium text-[var(--color-text-main)] font-mono mt-0.5">
                  {tempoAtendimento || '—'}
                </p>
              </div>
            </div>

            <button
              onClick={handleRetornar}
              disabled={retornando}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-[8px] border border-[var(--color-border-card)] text-[var(--color-text-main)] hover:bg-[var(--color-bg-card)] disabled:opacity-50 transition-colors"
            >
              <Bot className="w-3.5 h-3.5" />
              {retornando ? 'Retornando...' : 'Retornar para IA'}
            </button>
          </>
        ) : (
          <>
            {/* Estado: IA ativa */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-green-600">IA ativa</span>
              </div>
              <span className="text-[10px] text-[var(--color-text-muted)] bg-green-50 border border-green-200/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Bot className="w-2.5 h-2.5" /> automático
              </span>
            </div>

            {(conversa.ia_ultima_acao || conversa.ia_ultima_interacao_at) && (
              <div className="space-y-1.5 mb-3">
                {conversa.ia_ultima_acao && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">Última ação</span>
                    <span className="font-medium text-[var(--color-text-main)] text-right max-w-[140px] truncate">
                      {conversa.ia_ultima_acao}
                    </span>
                  </div>
                )}
                {conversa.ia_ultima_interacao_at && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">Última interação</span>
                    <span className="font-medium text-[var(--color-text-main)]">
                      {formatDistanceToNow(new Date(conversa.ia_ultima_interacao_at), { locale: ptBR, addSuffix: true })}
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleAssumir}
              disabled={assumindo}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-[8px] bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <UserCheck className="w-3.5 h-3.5" />
              {assumindo ? 'Assumindo...' : 'Assumir atendimento'}
            </button>
          </>
        )}
      </div>

      {/* ── 3. RESUMO DA IA ─────────────────────────────────── */}
      {lead?.resumo_conversa && (
        <div className="p-4 border-b border-[var(--color-border-card)]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Resumo da IA</p>
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {conversa.is_human && conversa.handoff_at
                ? 'gerado antes da transferência'
                : `atualizado ${formatDistanceToNow(new Date(lead.inicio_atendimento), { locale: ptBR, addSuffix: false })} atrás`}
            </span>
          </div>
          {conversa.is_human && conversa.handoff_at && (
            <div className="flex items-center gap-1.5 mb-2 text-[10px] text-amber-600 bg-amber-50 border border-amber-200/60 rounded-[6px] px-2 py-1">
              <span>⚠</span>
              <span>Resumo gerado antes da transferência</span>
            </div>
          )}
          <p className="text-xs text-[var(--color-text-main)] leading-relaxed">{lead.resumo_conversa}</p>
        </div>
      )}

      {/* ── 4. PRÓXIMA CONSULTA ─────────────────────────────── */}
      <div className="p-4 border-b border-[var(--color-border-card)]">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Próxima Consulta</p>
        {agendamento ? (
          <div className="space-y-2 text-xs">
            {agendamento.agenda?.nome && (
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Profissional</span>
                <span className="font-medium text-[var(--color-text-main)]">{agendamento.agenda.nome}</span>
              </div>
            )}
            {agendamento.procedimento_nome && (
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Especialidade</span>
                <span className="font-medium text-[var(--color-text-main)]">{agendamento.procedimento_nome}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Data</span>
              <span className="font-medium text-[var(--color-text-main)]">
                {format(new Date(agendamento.data_hora_inicio), "dd/MM/yyyy '·' HH:mm", { locale: ptBR })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--color-text-muted)]">Status</span>
              {APTO_STATUS[agendamento.status] ? (
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: APTO_STATUS[agendamento.status].color + '22',
                    color: APTO_STATUS[agendamento.status].color,
                  }}
                >
                  {APTO_STATUS[agendamento.status].label}
                </span>
              ) : (
                <span className="font-medium text-[var(--color-text-main)]">{agendamento.status}</span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)]">Nenhuma consulta agendada</p>
        )}
      </div>

      {/* ── 5. PIPELINE ─────────────────────────────────────── */}
      {conversa.lead_id && (
        <div className="p-4 border-b border-[var(--color-border-card)]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Pipeline</p>
          <div ref={pipelineRef} className="relative">
            <button
              onClick={() => setPipelineOpen(o => !o)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-[8px] border border-[var(--color-border-card)] text-xs hover:bg-[var(--color-bg-card)] transition-colors"
            >
              <span className="flex items-center gap-2">
                {leadStatus && CRM_STAGES[leadStatus] ? (
                  <>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CRM_STAGES[leadStatus].color }} />
                    <span className="font-medium" style={{ color: CRM_STAGES[leadStatus].color }}>
                      {CRM_STAGES[leadStatus].label}
                    </span>
                  </>
                ) : (
                  <span className="text-[var(--color-text-muted)]">Selecionar etapa</span>
                )}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform ${pipelineOpen ? 'rotate-180' : ''}`} />
            </button>

            {pipelineOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-bg-base)] border border-[var(--color-border-card)] rounded-[8px] shadow-lg z-50 overflow-hidden max-h-64 overflow-y-auto">
                {Object.entries(CRM_STAGES).map(([key, stage]) => (
                  <button
                    key={key}
                    onClick={() => mudarStatus(key)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--color-bg-card)] transition-colors ${leadStatus === key ? 'bg-[var(--color-bg-card)]' : ''}`}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                    <span className="font-medium" style={{ color: stage.color }}>{stage.label}</span>
                    {leadStatus === key && <Check className="w-3 h-3 ml-auto" style={{ color: stage.color }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 6. TAGS ─────────────────────────────────────────── */}
      <div className="p-4 border-b border-[var(--color-border-card)]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Tags</p>
          <button
            onClick={() => setAddingTag(true)}
            className="flex items-center gap-0.5 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            <Plus className="w-3 h-3" /> Adicionar
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {tagsAtivas.map(tag => (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className="group text-xs px-2 py-0.5 rounded-full font-medium border flex items-center gap-1 transition-all"
              style={{ backgroundColor: tag.cor + '22', color: tag.cor, borderColor: tag.cor + '55' }}
            >
              {tag.nome}
              <X className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
          {tagsInativas.map(tag => (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className="text-xs px-2 py-0.5 rounded-full font-medium border opacity-30 hover:opacity-60 transition-opacity"
              style={{ backgroundColor: tag.cor + '22', color: tag.cor, borderColor: tag.cor + '55' }}
            >
              {tag.nome}
            </button>
          ))}
        </div>

        {addingTag && (
          <div className="flex gap-1 mt-2">
            <input
              autoFocus
              type="text"
              value={novaTag}
              onChange={e => setNovaTag(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') criarTag();
                if (e.key === 'Escape') { setAddingTag(false); setNovaTag(''); }
              }}
              placeholder="Nome da tag..."
              className="flex-1 min-w-0 border border-[var(--color-border-card)] rounded-[6px] px-2 py-1 text-xs bg-[var(--color-bg-base)] text-[var(--color-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            <button onClick={criarTag} className="text-[var(--color-primary)]"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => { setAddingTag(false); setNovaTag(''); }} className="text-[var(--color-text-muted)]"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        {allTags.length === 0 && !addingTag && (
          <p className="text-xs text-[var(--color-text-muted)]">Nenhuma tag. Clique em Adicionar.</p>
        )}
      </div>

      {/* ── 7. PRÓXIMA AÇÃO ─────────────────────────────────── */}
      <div className="p-4 border-b border-[var(--color-border-card)]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Próxima Ação</p>
          {conversa.lead_id && (
            <button
              onClick={() => setAddingTarefa(true)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>

        {addingTarefa && conversa.lead_id && (
          <div className="flex gap-1 mb-2">
            <input
              autoFocus
              type="text"
              value={novaTarefa}
              onChange={e => setNovaTarefa(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') criarTarefa();
                if (e.key === 'Escape') { setAddingTarefa(false); setNovaTarefa(''); }
              }}
              placeholder="Descreva a ação..."
              className="flex-1 min-w-0 border border-[var(--color-border-card)] rounded-[6px] px-2 py-1 text-xs bg-[var(--color-bg-base)] text-[var(--color-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            <button onClick={criarTarefa} className="text-[var(--color-primary)]"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => { setAddingTarefa(false); setNovaTarefa(''); }} className="text-[var(--color-text-muted)]"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {proxAcao ? (
          <div
            onClick={() => toggleTarefa(proxAcao)}
            className="flex items-start gap-2 p-2 rounded-[8px] bg-[var(--color-bg-card)] border border-[var(--color-border-card)] cursor-pointer hover:border-[var(--color-primary)]/40 transition-colors"
          >
            <Bell className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-[var(--color-text-main)] leading-relaxed">{proxAcao.titulo}</p>
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)]">Nenhuma ação programada</p>
        )}
      </div>

      {/* ── 8. FICHA COMPLETA ───────────────────────────────── */}
      <div className="p-4">
        <button
          onClick={() => conversa.lead_id && window.open(`/pacientes?lead=${conversa.lead_id}`, '_blank')}
          disabled={!conversa.lead_id}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-[8px] border border-[var(--color-border-card)] text-[var(--color-text-main)] hover:bg-[var(--color-bg-card)] disabled:opacity-40 transition-colors"
        >
          <FileText className="w-4 h-4" />
          Abrir ficha completa
          <span className="ml-auto text-[var(--color-text-muted)]">›</span>
        </button>
      </div>

    </div>
  );
}
