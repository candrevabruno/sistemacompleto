import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Save, PenLine } from 'lucide-react';

interface Props {
  pacienteId: string;
  tipo: 'geral' | 'profissional';
}

interface Anotacao {
  id: string;
  conteudo: string;
  autor_nome: string;
  editado_em: string | null;
  created_at: string;
}

const cardCls = 'rounded-[12px] border border-[var(--border)] bg-[var(--white)] shadow-[0_1px_4px_rgba(4,52,44,0.06)]';
const labelCls = 'text-[10px] font-semibold uppercase tracking-[1px] text-[var(--muted)] block mb-1.5';
const inputStyle = {
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--ink)',
} as React.CSSProperties;

export function PainelAnotacoes({ pacienteId, tipo }: Props) {
  const { user } = useAuth();
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([]);
  const [texto, setTexto] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!pacienteId) return;
    carregarAnotacoes();
  }, [pacienteId, tipo]);

  const carregarAnotacoes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('anotacoes_paciente')
      .select('id, conteudo, autor_nome, editado_em, created_at')
      .eq('paciente_id', pacienteId)
      .eq('tipo', tipo)
      .order('created_at', { ascending: false });
    if (data) setAnotacoes(data);
    setLoading(false);
  };

  const salvar = async () => {
    if (!texto.trim() || !user) return;
    setSalvando(true);

    if (editandoId) {
      await supabase
        .from('anotacoes_paciente')
        .update({
          conteudo: texto.trim(),
          editado_em: new Date().toISOString(),
          editado_por: user.id,
        })
        .eq('id', editandoId);
    } else {
      await supabase
        .from('anotacoes_paciente')
        .insert({
          paciente_id: pacienteId,
          autor_id: user.id,
          autor_nome: user.nome || user.email || 'Usuário',
          tipo,
          conteudo: texto.trim(),
        });
    }

    setTexto('');
    setEditandoId(null);
    setSalvando(false);
    carregarAnotacoes();
  };

  const editarAnotacao = (a: Anotacao) => {
    setTexto(a.conteudo);
    setEditandoId(a.id);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const cancelarEdicao = () => {
    setTexto('');
    setEditandoId(null);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Coluna esquerda — Formulário */}
      <div className={cardCls + ' p-4 flex flex-col gap-3'}>
        <div className="flex items-center justify-between">
          <label className={labelCls + ' mb-0'}>
            {editandoId ? 'Editar anotação' : 'Nova anotação'}
          </label>
          {editandoId && (
            <button onClick={cancelarEdicao} className="text-[10px] text-[var(--muted)] hover:text-[var(--ink)] underline">
              cancelar edição
            </button>
          )}
        </div>
        <textarea
          ref={textareaRef}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Digite uma anotação..."
          rows={6}
          className="w-full text-sm rounded-[8px] px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[var(--sage-dark)]"
          style={inputStyle}
        />
        <button
          onClick={salvar}
          disabled={!texto.trim() || salvando}
          className="flex items-center justify-center gap-1.5 py-2 rounded-[8px] text-sm font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
          style={{ background: 'var(--sage-dark)' }}
        >
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {editandoId ? 'Salvar alterações' : 'Salvar anotação'}
        </button>
      </div>

      {/* Coluna direita — Lista */}
      <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--muted)]" />
          </div>
        ) : anotacoes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--sage-xlight)' }}>
              <PenLine className="w-4 h-4" style={{ color: 'var(--sage)' }} />
            </div>
            <p className="text-sm text-[var(--muted)]">Nenhuma anotação ainda</p>
          </div>
        ) : anotacoes.map(a => (
          <button
            key={a.id}
            onClick={() => editarAnotacao(a)}
            className={cardCls + ' p-3 text-left w-full hover:border-[var(--sage)] transition-colors group'}
            style={editandoId === a.id ? { borderColor: 'var(--sage-dark)' } : {}}
          >
            <p className="text-[13px] text-[var(--ink)] whitespace-pre-wrap line-clamp-4 mb-2">
              {a.conteudo}
            </p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-[var(--muted)] font-medium">{a.autor_nome}</span>
              <div className="text-right">
                <span className="text-[10px] text-[var(--muted)]">
                  {format(new Date(a.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                </span>
                {a.editado_em && (
                  <span className="block text-[9px] text-[var(--muted)] opacity-70">
                    editado {format(new Date(a.editado_em), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
