import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Stethoscope, Plus, History } from 'lucide-react';

interface Props {
  pacienteId: string;
}

const labelStyle: React.CSSProperties = {
  fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px',
  textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: '5px',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', border: '1px solid var(--border-md)',
  borderRadius: 'var(--r-xs)', fontSize: '12.5px', color: 'var(--ink)',
  fontFamily: 'inherit', background: 'var(--white)', outline: 'none',
};
const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '7px',
  fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase',
  color: 'var(--muted)', marginBottom: '14px', paddingBottom: '8px',
  borderBottom: '1px solid var(--border)',
};

export function ProcedimentosTab({ pacienteId }: Props) {
  const { user } = useAuth();
  const [servicos, setServicos] = useState<any[]>([]);
  const [procedimentos, setProcedimentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adicionando, setAdicionando] = useState(false);

  const [servicoId, setServicoId] = useState('');
  const [valor, setValor] = useState('');

  useEffect(() => {
    if (!pacienteId) return;
    carregarDados();
  }, [pacienteId]);

  const carregarDados = async () => {
    setLoading(true);
    const [{ data: svcs }, { data: procs }] = await Promise.all([
      supabase.from('servicos').select('id, nome, valor').order('nome'),
      supabase.from('procedimentos_paciente').select('*').eq('paciente_id', pacienteId).order('created_at', { ascending: false }),
    ]);
    if (svcs) setServicos(svcs);
    if (procs) setProcedimentos(procs);
    setLoading(false);
  };

  const onServicoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setServicoId(id);
    const svc = servicos.find(s => s.id === id);
    if (svc?.valor != null) setValor(String(svc.valor));
    else setValor('');
  };

  const adicionar = async () => {
    if (!servicoId || !valor || !user) return;
    setAdicionando(true);
    const svc = servicos.find(s => s.id === servicoId);
    await supabase.from('procedimentos_paciente').insert({
      paciente_id: pacienteId,
      servico_id: servicoId,
      nome_servico: svc?.nome || '',
      valor: parseFloat(valor.replace(',', '.')) || 0,
      adicionado_por: user.id,
      adicionado_por_nome: user.nome || user.email || 'Usuário',
    });
    setServicoId('');
    setValor('');
    setAdicionando(false);
    carregarDados();
  };

  const total = procedimentos.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--muted)' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 22px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Coluna Esquerda — Formulário */}
        <div>
          <div style={sectionHeaderStyle}>
            <Plus size={13} style={{ color: 'var(--sage-dark)' }} /> Adicionar procedimento
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Serviço</label>
              <select value={servicoId} onChange={onServicoChange} style={inputStyle}>
                <option value="">Selecionar serviço...</option>
                {servicos.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nome}{s.valor != null ? ` — ${fmtBRL(parseFloat(s.valor))}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Valor (editável)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={valor}
                onChange={e => setValor(e.target.value)}
                placeholder="0,00"
                style={inputStyle}
              />
            </div>

            <button
              onClick={adicionar}
              disabled={!servicoId || !valor || adicionando}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start',
                background: 'var(--sage-dark)', color: 'white', border: 'none',
                borderRadius: 'var(--r-xs)', padding: '8px 14px',
                fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                opacity: (!servicoId || !valor || adicionando) ? 0.4 : 1,
              }}
            >
              {adicionando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Adicionar
            </button>
          </div>
        </div>

        {/* Coluna Direita — Histórico */}
        <div>
          <div style={sectionHeaderStyle}>
            <History size={13} style={{ color: 'var(--sage-dark)' }} /> Histórico
          </div>

          {procedimentos.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', gap: '10px', textAlign: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--sage-xlight)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Stethoscope size={16} style={{ color: 'var(--sage)' }} />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)' }}>Nenhum procedimento adicionado</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {procedimentos.map(p => (
                <div key={p.id} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', padding: '10px 13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink)' }}>{p.nome_servico}</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--muted)', marginTop: '2px' }}>
                      {format(new Date(p.created_at), 'dd/MM/yyyy', { locale: ptBR })} · {p.adicionado_por_nome}
                    </div>
                  </div>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--sage-dark)', flexShrink: 0 }}>
                    {fmtBRL(parseFloat(p.valor))}
                  </span>
                </div>
              ))}

              {/* Total */}
              <div style={{ background: 'var(--sage-dark)', borderRadius: 'var(--r-xs)', padding: '10px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Total gasto
                </span>
                <span className="font-display" style={{ fontSize: '20px', fontWeight: 300, color: 'white' }}>
                  {fmtBRL(total)}
                </span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
