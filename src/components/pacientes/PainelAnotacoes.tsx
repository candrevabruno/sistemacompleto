import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Check, PenLine } from 'lucide-react';

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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
      {/* Esquerda — formulário */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)' }}>
            {editandoId ? 'Editar anotação' : 'Nova anotação'}
          </span>
          {editandoId && (
            <button onClick={cancelarEdicao} style={{ fontSize: '10px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
              cancelar edição
            </button>
          )}
        </div>
        <textarea
          ref={textareaRef}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder={tipo === 'profissional' ? 'Anotação clínica privada...' : 'Digite uma nova anotação...'}
          rows={5}
          style={{ padding: '10px 12px', border: '1px solid var(--border-md)', borderRadius: 'var(--r-sm)', fontSize: '12.5px', color: 'var(--ink)', fontFamily: 'inherit', resize: 'none', outline: 'none', background: 'var(--white)', lineHeight: 1.5 }}
        />
        <button
          onClick={salvar}
          disabled={!texto.trim() || salvando}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--sage-dark)', color: 'white', border: 'none', borderRadius: 'var(--r-xs)', padding: '7px 13px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start', opacity: (!texto.trim() || salvando) ? 0.5 : 1 }}>
          {salvando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {editandoId ? 'Salvar alterações' : 'Salvar anotação'}
        </button>
      </div>

      {/* Direita — lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--muted)' }} />
          </div>
        ) : anotacoes.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--sage-xlight)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PenLine size={16} style={{ color: 'var(--sage)' }} />
            </div>
            <p style={{ fontSize: '12px', color: 'var(--muted)' }}>Nenhuma anotação ainda</p>
          </div>
        ) : anotacoes.map(a => (
          <button
            key={a.id}
            onClick={() => editarAnotacao(a)}
            style={{ background: 'var(--bg)', border: `1px solid ${editandoId === a.id ? 'var(--sage-dark)' : 'var(--border)'}`, borderRadius: 'var(--r-xs)', padding: '10px 12px', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit' }}>
            <div style={{ fontSize: '12px', color: 'var(--ink)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {a.conteudo}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '5px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <span>{a.autor_nome}</span>
              <span style={{ textAlign: 'right' }}>
                {format(new Date(a.created_at), "dd/MM/yyyy '·' HH:mm", { locale: ptBR })}
                {a.editado_em && (
                  <span style={{ display: 'block', fontSize: '9px', opacity: 0.7 }}>
                    editado {format(new Date(a.editado_em), 'dd/MM HH:mm', { locale: ptBR })}
                  </span>
                )}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
