import { useEffect, useState } from 'react';
import { Plus, X, Check, Phone, User, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Conversa, Tag, Tarefa } from '../../types';

const CRM_STAGES: Record<string, { label: string; color: string }> = {
  iniciou_atendimento:    { label: 'Iniciou',               color: '#7A9E87' },
  conversando:            { label: 'Conversando',           color: '#6B9EC4' },
  follow_up:              { label: 'Follow-Up',             color: '#3b82f6' },
  agendado:               { label: 'Agendado',              color: '#10b981' },
  reagendado:             { label: 'Reagendado',            color: '#f59e0b' },
  faltou:                 { label: 'Faltou',                color: '#64748b' },
  cancelou_agendamento:   { label: 'Cancelou Agendamento',  color: '#fb7185' },
  converteu:              { label: 'Converteu (Venda)',      color: '#16a34a' },
  nao_converteu:          { label: 'Não Converteu',         color: '#dc2626' },
  abandonou_conversa:     { label: 'Abandonou',             color: '#9ca3af' },
};

interface Props {
  conversa: Conversa | null;
}

export function SidePanel({ conversa }: Props) {
  const { user } = useAuth();
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [conversaTagIds, setConversaTagIds] = useState<string[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [novaTarefa, setNovaTarefa] = useState('');
  const [novaTag, setNovaTag] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [addingTarefa, setAddingTarefa] = useState(false);
  const [leadStatus, setLeadStatus] = useState<string | null>(null);

  useEffect(() => {
    loadAllTags();
  }, []);

  useEffect(() => {
    if (!conversa) {
      setConversaTagIds([]);
      setTarefas([]);
      setLeadStatus(null);
      return;
    }
    loadConversaTags(conversa.id);
    if (conversa.lead_id) {
      loadTarefas(conversa.lead_id);
      loadLeadStatus(conversa.lead_id);
    } else {
      setTarefas([]);
      setLeadStatus(null);
    }
  }, [conversa?.id]);

  async function loadAllTags() {
    const { data } = await supabase.from('tags').select('*').order('nome');
    if (data) setAllTags(data);
  }

  async function loadConversaTags(conversaId: string) {
    const { data } = await supabase
      .from('conversa_tags')
      .select('tag_id')
      .eq('conversa_id', conversaId);
    if (data) setConversaTagIds(data.map(d => d.tag_id));
  }

  async function loadLeadStatus(leadId: string) {
    const { data } = await supabase
      .from('leads')
      .select('status')
      .eq('id', leadId)
      .single();
    setLeadStatus(data?.status ?? null);
  }

  async function loadTarefas(leadId: string) {
    const { data } = await supabase
      .from('tarefas')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    if (data) setTarefas(data);
  }

  async function toggleTag(tagId: string) {
    if (!conversa) return;
    if (conversaTagIds.includes(tagId)) {
      await supabase
        .from('conversa_tags')
        .delete()
        .eq('conversa_id', conversa.id)
        .eq('tag_id', tagId);
      setConversaTagIds(prev => prev.filter(id => id !== tagId));
    } else {
      await supabase
        .from('conversa_tags')
        .insert({ conversa_id: conversa.id, tag_id: tagId });
      setConversaTagIds(prev => [...prev, tagId]);
    }
  }

  async function criarTag() {
    const nome = novaTag.trim();
    if (!nome) return;
    const cores = ['#7A9E87', '#6B9EC4', '#C4856B', '#9E7AC4', '#C4B86B', '#6BC4B8'];
    const cor = cores[Math.floor(Math.random() * cores.length)];
    const { data } = await supabase
      .from('tags')
      .insert({ nome, cor })
      .select()
      .single();
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
      .from('tarefas')
      .insert({ lead_id: conversa.lead_id, titulo, created_by: user?.id })
      .select()
      .single();
    if (data) setTarefas(prev => [data, ...prev]);
    setNovaTarefa('');
    setAddingTarefa(false);
  }

  async function toggleTarefa(tarefa: Tarefa) {
    await supabase
      .from('tarefas')
      .update({ concluida: !tarefa.concluida })
      .eq('id', tarefa.id);
    setTarefas(prev =>
      prev.map(t => (t.id === tarefa.id ? { ...t, concluida: !t.concluida } : t))
    );
  }

  return (
    <div className="w-[260px] flex-shrink-0 border-l border-[var(--color-border-card)] flex flex-col overflow-y-auto bg-[var(--color-bg-base)]">
      {!conversa ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-xs text-[var(--color-text-muted)] text-center">
            Selecione uma conversa para ver detalhes
          </p>
        </div>
      ) : (
        <>
          {/* Contato */}
          <div className="p-4 border-b border-[var(--color-border-card)]">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
              Contato
            </h3>
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-main)] mb-1.5">
              <User className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
              <span className="truncate">{conversa.nome_contato || '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-main)]">
              <Phone className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
              <span className="truncate">{conversa.whatsapp_number}</span>
            </div>
          </div>

          {/* Pipeline CRM */}
          {leadStatus && CRM_STAGES[leadStatus] && (
            <div className="p-4 border-b border-[var(--color-border-card)]">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Pipeline CRM
              </h3>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: CRM_STAGES[leadStatus].color }} />
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: CRM_STAGES[leadStatus].color + '22',
                    color: CRM_STAGES[leadStatus].color,
                  }}
                >
                  {CRM_STAGES[leadStatus].label}
                </span>
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="p-4 border-b border-[var(--color-border-card)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Tags
              </h3>
              <button
                onClick={() => setAddingTag(true)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {allTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium transition-all border ${
                    conversaTagIds.includes(tag.id)
                      ? 'opacity-100 shadow-sm'
                      : 'opacity-30 hover:opacity-60'
                  }`}
                  style={{
                    backgroundColor: tag.cor + '22',
                    color: tag.cor,
                    borderColor: tag.cor + '55',
                  }}
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
                <button onClick={criarTag} className="text-[var(--color-primary)] flex-shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { setAddingTag(false); setNovaTag(''); }}
                  className="text-[var(--color-text-muted)] flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {allTags.length === 0 && !addingTag && (
              <p className="text-xs text-[var(--color-text-muted)]">
                Nenhuma tag criada. Clique em + para adicionar.
              </p>
            )}
          </div>

          {/* Tarefas */}
          {conversa.lead_id && (
            <div className="p-4 flex-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Tarefas
                </h3>
                <button
                  onClick={() => setAddingTarefa(true)}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {addingTarefa && (
                <div className="flex gap-1 mb-3">
                  <input
                    autoFocus
                    type="text"
                    value={novaTarefa}
                    onChange={e => setNovaTarefa(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') criarTarefa();
                      if (e.key === 'Escape') { setAddingTarefa(false); setNovaTarefa(''); }
                    }}
                    placeholder="Nova tarefa..."
                    className="flex-1 min-w-0 border border-[var(--color-border-card)] rounded-[6px] px-2 py-1 text-xs bg-[var(--color-bg-base)] text-[var(--color-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                  />
                  <button onClick={criarTarefa} className="text-[var(--color-primary)] flex-shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { setAddingTarefa(false); setNovaTarefa(''); }}
                    className="text-[var(--color-text-muted)] flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {tarefas.map(t => (
                  <div key={t.id} className="flex items-start gap-2">
                    <button
                      onClick={() => toggleTarefa(t)}
                      className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                        t.concluida
                          ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                          : 'border-[var(--color-border-card)] hover:border-[var(--color-primary)]'
                      }`}
                    >
                      {t.concluida && <Check className="w-2.5 h-2.5" />}
                    </button>
                    <span
                      className={`text-xs leading-5 break-words ${
                        t.concluida
                          ? 'line-through text-[var(--color-text-muted)]'
                          : 'text-[var(--color-text-main)]'
                      }`}
                    >
                      {t.titulo}
                    </span>
                  </div>
                ))}
                {tarefas.length === 0 && !addingTarefa && (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Nenhuma tarefa. Clique em + para adicionar.
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
