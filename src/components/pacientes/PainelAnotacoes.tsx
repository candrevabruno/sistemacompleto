import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Check, PenLine, History } from 'lucide-react';
import { HistoricoModal, type HistItem } from './HistoricoModal';

interface Props {
  pacienteId: string;
  tipo: 'geral' | 'profissional';
}

export function PainelAnotacoes({ pacienteId, tipo }: Props) {
  const { user } = useAuth();
  const [anotacoes, setAnotacoes] = useState<HistItem[]>([]);
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [showHist, setShowHist] = useState(false);

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

  // Cada save vira SEMPRE um item novo (nunca sobrescreve).
  const salvar = async () => {
    if (!texto.trim() || !user) return;
    setSalvando(true);
    await supabase.from('anotacoes_paciente').insert({
      paciente_id: pacienteId,
      autor_id: user.id,
      autor_nome: user.nome || user.email || 'Usuário',
      tipo,
      conteudo: texto.trim(),
    });
    setTexto('');
    setSalvando(false);
    carregarAnotacoes();
  };

  // Log de auditoria só para anotações do profissional (peso clínico/legal).
  const registrarAudit = async (action: string, detalhes: Record<string, unknown>) => {
    if (tipo !== 'profissional' || !user) return;
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action,
      record_id: pacienteId,
      detalhes,
    });
  };

  const onEditar = async (id: string, conteudo: string) => {
    const anterior = anotacoes.find(a => a.id === id)?.conteudo ?? null;
    await supabase.from('anotacoes_paciente').update({
      conteudo,
      editado_em: new Date().toISOString(),
      editado_por: user?.id,
    }).eq('id', id);
    await registrarAudit('anotacao_profissional_editada', { anotacao_id: id, valor_anterior: anterior, valor_novo: conteudo });
    await carregarAnotacoes();
  };

  const onApagar = async (id: string) => {
    const anterior = anotacoes.find(a => a.id === id)?.conteudo ?? null;
    await supabase.from('anotacoes_paciente').delete().eq('id', id);
    await registrarAudit('anotacao_profissional_apagada', { anotacao_id: id, valor_anterior: anterior });
    await carregarAnotacoes();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
      {/* Esquerda — nova anotação */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)' }}>
          Nova anotação
        </span>
        <textarea
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
          Salvar anotação
        </button>
      </div>

      {/* Direita — registros recentes + ver histórico */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)' }}>
            Registros ({anotacoes.length})
          </span>
          {anotacoes.length > 0 && (
            <button
              onClick={() => setShowHist(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 500, color: 'var(--sage-dark)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <History size={13} /> Ver histórico
            </button>
          )}
        </div>

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
            <div
              key={a.id}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', padding: '10px 12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--ink)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {a.conteudo}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '5px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <span>{a.autor_nome}</span>
                <span style={{ textAlign: 'right' }}>
                  {format(new Date(a.created_at), "dd/MM/yyyy '·' HH:mm", { locale: ptBR })}
                  {a.editado_em && <span style={{ display: 'block', fontSize: '9px', opacity: 0.7 }}>editado</span>}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <HistoricoModal
        open={showHist}
        onClose={() => setShowHist(false)}
        titulo={tipo === 'profissional' ? 'Histórico — Anotações do profissional' : 'Histórico de anotações'}
        itens={anotacoes}
        onEditar={onEditar}
        onApagar={onApagar}
      />
    </div>
  );
}
