import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Stethoscope, Plus, History, Pencil, Trash2, X } from 'lucide-react';

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
  const [descontoTipo, setDescontoTipo] = useState<'valor' | 'porcentagem'>('valor');
  const [descontoValor, setDescontoValor] = useState('');
  const [anotacao, setAnotacao] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

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

  const calcValorLiquido = () => {
    const v = parseFloat(valor.replace(',', '.')) || 0;
    const d = parseFloat(descontoValor.replace(',', '.')) || 0;
    if (!descontoValor || d === 0) return v;
    return descontoTipo === 'porcentagem' ? v * (1 - d / 100) : Math.max(0, v - d);
  };

  const limparForm = () => {
    setServicoId(''); setValor(''); setDescontoValor(''); setAnotacao(''); setEditId(null);
  };

  const adicionar = async () => {
    if (!servicoId || !valor || !user) return;
    setAdicionando(true);
    const svc = servicos.find(s => s.id === servicoId);
    const d = parseFloat(descontoValor.replace(',', '.')) || 0;
    const payload = {
      servico_id: servicoId,
      nome_servico: svc?.nome || '',
      valor: parseFloat(valor.replace(',', '.')) || 0,
      desconto_tipo: d > 0 ? descontoTipo : null,
      desconto_valor: d > 0 ? d : null,
      anotacao: anotacao.trim() || null,
    };
    if (editId) {
      await supabase.from('procedimentos_paciente').update(payload).eq('id', editId);
    } else {
      await supabase.from('procedimentos_paciente').insert({
        ...payload,
        paciente_id: pacienteId,
        adicionado_por: user.id,
        adicionado_por_nome: user.nome || user.email || 'Usuário',
      });
    }
    limparForm();
    setAdicionando(false);
    carregarDados();
  };

  const editarProc = (p: any) => {
    setEditId(p.id);
    setServicoId(p.servico_id || '');
    setValor(p.valor != null ? String(p.valor) : '');
    setDescontoTipo(p.desconto_tipo === 'porcentagem' ? 'porcentagem' : 'valor');
    setDescontoValor(p.desconto_valor != null ? String(p.desconto_valor) : '');
    setAnotacao(p.anotacao || '');
    setConfirmDel(null);
  };

  const apagarProc = async (id: string) => {
    await supabase.from('procedimentos_paciente').delete().eq('id', id);
    if (editId === id) limparForm();
    setConfirmDel(null);
    carregarDados();
  };

  const valorLiquidoPreview = calcValorLiquido();
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const totalLiquido = procedimentos.reduce((acc, p) => {
    const v = parseFloat(p.valor) || 0;
    const d = parseFloat(p.desconto_valor) || 0;
    if (!d) return acc + v;
    return acc + (p.desconto_tipo === 'porcentagem' ? v * (1 - d / 100) : Math.max(0, v - d));
  }, 0);

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

            {/* Desconto */}
            <div>
              <label style={labelStyle}>Desconto (opcional)</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {/* Toggle tipo */}
                <div style={{ display: 'flex', borderRadius: 'var(--r-xs)', border: '1px solid var(--border-md)', overflow: 'hidden', flexShrink: 0 }}>
                  {(['valor', 'porcentagem'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setDescontoTipo(t)}
                      style={{
                        padding: '7px 10px',
                        fontSize: '11px',
                        fontWeight: 500,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        border: 'none',
                        background: descontoTipo === t ? 'var(--sage-dark)' : 'transparent',
                        color: descontoTipo === t ? 'white' : 'var(--muted)',
                        transition: 'background 0.12s',
                      }}
                    >
                      {t === 'valor' ? 'R$' : '%'}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={descontoValor}
                  onChange={e => setDescontoValor(e.target.value)}
                  placeholder={descontoTipo === 'porcentagem' ? 'Ex: 10' : 'Ex: 50,00'}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
              {/* Preview do valor líquido */}
              {valor && descontoValor && parseFloat(descontoValor) > 0 && (
                <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--sage-dark)', fontWeight: 500 }}>
                  Valor líquido: {fmtBRL(valorLiquidoPreview)}
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>Anotação (opcional)</label>
              <textarea
                value={anotacao}
                onChange={e => setAnotacao(e.target.value)}
                placeholder="Descreva o procedimento realizado..."
                rows={3}
                style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={adicionar}
                disabled={!servicoId || !valor || adicionando}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'var(--sage-dark)', color: 'white', border: 'none',
                  borderRadius: 'var(--r-xs)', padding: '8px 14px',
                  fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  opacity: (!servicoId || !valor || adicionando) ? 0.4 : 1,
                }}
              >
                {adicionando ? <Loader2 size={13} className="animate-spin" /> : editId ? <Pencil size={13} /> : <Plus size={13} />}
                {editId ? 'Salvar alterações' : 'Adicionar'}
              </button>
              {editId && (
                <button
                  onClick={limparForm}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '11px', color: 'var(--muted)' }}
                >
                  <X size={13} /> cancelar edição
                </button>
              )}
            </div>
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
                <Stethoscope size={16} style={{ color: 'var(--sage-dark)' }} />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)' }}>Nenhum procedimento adicionado</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {procedimentos.map(p => {
                const v = parseFloat(p.valor) || 0;
                const d = parseFloat(p.desconto_valor) || 0;
                const liquido = d > 0
                  ? (p.desconto_tipo === 'porcentagem' ? v * (1 - d / 100) : Math.max(0, v - d))
                  : v;
                const temDesconto = d > 0;

                return (
                  <div key={p.id} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', padding: '10px 13px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink)' }}>{p.nome_servico}</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--muted)', marginTop: '2px' }}>
                          {format(new Date(p.created_at), 'dd/MM/yyyy', { locale: ptBR })} · {p.adicionado_por_nome}
                        </div>
                        {p.anotacao && (
                          <div style={{ fontSize: '11.5px', color: 'var(--ink)', marginTop: '5px', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: '5px' }}>
                            {p.anotacao}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {temDesconto ? (
                          <>
                            <div style={{ fontSize: '10.5px', color: 'var(--muted)', textDecoration: 'line-through' }}>
                              {fmtBRL(v)}
                            </div>
                            <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--sage-dark)' }}>
                              {fmtBRL(liquido)}
                            </div>
                            <div style={{ fontSize: '9.5px', color: 'var(--champ-text)', background: 'var(--champ-light)', padding: '1px 6px', borderRadius: '10px', marginTop: '2px' }}>
                              {p.desconto_tipo === 'porcentagem' ? `${d}% off` : `- ${fmtBRL(d)}`}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--sage-dark)' }}>
                            {fmtBRL(v)}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Ações: editar / apagar */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '7px' }}>
                      {confirmDel === p.id ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--rose-text)' }}>Apagar este procedimento?</span>
                          <button onClick={() => apagarProc(p.id)} style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '5px', border: 'none', cursor: 'pointer', background: 'var(--rose-light)', color: 'var(--rose-text)', fontFamily: 'inherit' }}>Sim</button>
                          <button onClick={() => setConfirmDel(null)} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '5px', border: 'none', cursor: 'pointer', background: 'none', color: 'var(--muted)', fontFamily: 'inherit' }}>Não</button>
                        </span>
                      ) : (
                        <>
                          <button onClick={() => editarProc(p)} title="Editar" style={{ padding: '3px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}><Pencil size={13} /></button>
                          <button onClick={() => setConfirmDel(p.id)} title="Apagar" style={{ padding: '3px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}><Trash2 size={13} /></button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Total */}
              <div style={{ background: 'var(--sage-dark)', borderRadius: 'var(--r-xs)', padding: '10px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Total líquido
                </span>
                <span className="font-display" style={{ fontSize: '20px', fontWeight: 300, color: 'white' }}>
                  {fmtBRL(totalLiquido)}
                </span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
