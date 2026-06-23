import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Loader2, Stethoscope, Plus, History, Pencil, Trash2, X,
  FlaskConical, AlertTriangle, Clock,
} from 'lucide-react';

interface Props {
  pacienteId: string;
}

interface Material {
  id: string;
  procedimento_id: string;
  nome: string;
  descricao: string | null;
  lote: string | null;
  validade: string | null;
  quantidade: string | null;
  criado_em: string;
}

const emptyMatForm = () => ({ nome: '', descricao: '', lote: '', validade: '', quantidade: '' });

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

function validadeBadge(validade: string | null) {
  if (!validade) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const val = parseISO(validade);
  const diff = differenceInDays(val, hoje);
  if (diff < 0) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9.5px', fontWeight: 600, padding: '1px 6px', borderRadius: '10px', background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
        <AlertTriangle size={9} /> Vencido
      </span>
    );
  }
  if (diff <= 30) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9.5px', fontWeight: 600, padding: '1px 6px', borderRadius: '10px', background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>
        <Clock size={9} /> Vence em breve
      </span>
    );
  }
  return null;
}

export function ProcedimentosTab({ pacienteId }: Props) {
  const { user, canEdit } = useAuth();
  const podeEditar = canEdit('paciente_tab:procedimentos');

  const [servicos, setServicos] = useState<any[]>([]);
  const [procedimentos, setProcedimentos] = useState<any[]>([]);
  const [materiais, setMateriais] = useState<Record<string, Material[]>>({});
  const [loading, setLoading] = useState(true);

  // Form: procedimento
  const [adicionando, setAdicionando] = useState(false);
  const [servicoId, setServicoId] = useState('');
  const [valor, setValor] = useState('');
  const [descontoTipo, setDescontoTipo] = useState<'valor' | 'porcentagem'>('valor');
  const [descontoValor, setDescontoValor] = useState('');
  const [anotacao, setAnotacao] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // Form: material
  const [addingMatFor, setAddingMatFor] = useState<string | null>(null); // procedimento_id
  const [editMat, setEditMat] = useState<Material | null>(null);
  const [matForm, setMatForm] = useState(emptyMatForm());
  const [savingMat, setSavingMat] = useState(false);
  const [confirmDelMat, setConfirmDelMat] = useState<string | null>(null);

  useEffect(() => {
    if (!pacienteId) return;
    carregarDados();
  }, [pacienteId]);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    const [{ data: svcs }, { data: procs }] = await Promise.all([
      supabase.from('servicos').select('id, nome, valor').order('nome'),
      supabase.from('procedimentos_paciente').select('*').eq('paciente_id', pacienteId).order('created_at', { ascending: false }),
    ]);
    if (svcs) setServicos(svcs);
    const lista = procs || [];
    setProcedimentos(lista);

    if (lista.length > 0) {
      const ids = lista.map((p: any) => p.id);
      const { data: mats } = await supabase
        .from('materiais_procedimento')
        .select('*')
        .in('procedimento_id', ids)
        .order('criado_em', { ascending: true });
      const grouped: Record<string, Material[]> = {};
      (mats || []).forEach((m: Material) => {
        if (!grouped[m.procedimento_id]) grouped[m.procedimento_id] = [];
        grouped[m.procedimento_id].push(m);
      });
      setMateriais(grouped);
    }

    setLoading(false);
  }, [pacienteId]);

  // ── Procedimento CRUD ─────────────────────────────────────────────────────────

  const onServicoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setServicoId(id);
    const svc = servicos.find(s => s.id === id);
    setValor(svc?.valor != null ? String(svc.valor) : '');
  };

  const calcValorLiquido = () => {
    const v = parseFloat(valor.replace(',', '.')) || 0;
    const d = parseFloat(descontoValor.replace(',', '.')) || 0;
    if (!descontoValor || d === 0) return v;
    return descontoTipo === 'porcentagem' ? v * (1 - d / 100) : Math.max(0, v - d);
  };

  const limparFormProc = () => {
    setServicoId(''); setValor(''); setDescontoValor(''); setAnotacao(''); setEditId(null);
  };

  const salvarProc = async () => {
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
    limparFormProc();
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
    if (editId === id) limparFormProc();
    setConfirmDel(null);
    carregarDados();
  };

  // ── Material CRUD ─────────────────────────────────────────────────────────────

  const abrirAddMat = (procId: string) => {
    setEditMat(null);
    setMatForm(emptyMatForm());
    setAddingMatFor(procId);
    setConfirmDelMat(null);
  };

  const abrirEditMat = (m: Material) => {
    setEditMat(m);
    setMatForm({
      nome: m.nome,
      descricao: m.descricao || '',
      lote: m.lote || '',
      validade: m.validade || '',
      quantidade: m.quantidade || '',
    });
    setAddingMatFor(m.procedimento_id);
    setConfirmDelMat(null);
  };

  const cancelarFormMat = () => {
    setAddingMatFor(null);
    setEditMat(null);
    setMatForm(emptyMatForm());
  };

  const salvarMaterial = async (procId: string) => {
    if (!matForm.nome.trim() || !user) return;
    setSavingMat(true);
    const payload = {
      procedimento_id: procId,
      nome: matForm.nome.trim(),
      descricao: matForm.descricao.trim() || null,
      lote: matForm.lote.trim() || null,
      validade: matForm.validade || null,
      quantidade: matForm.quantidade.trim() || null,
    };
    if (editMat) {
      await supabase.from('materiais_procedimento').update(payload).eq('id', editMat.id);
    } else {
      await supabase.from('materiais_procedimento').insert({ ...payload, criado_por: user.id });
    }
    cancelarFormMat();
    setSavingMat(false);
    carregarDados();
  };

  const apagarMaterial = async (m: Material) => {
    await supabase.from('materiais_procedimento').delete().eq('id', m.id);
    await supabase.from('audit_log').insert({
      acao: 'material_apagado',
      tabela: 'materiais_procedimento',
      registro_id: m.id,
      realizado_por: user?.id ?? null,
      detalhes: {
        procedimento_id: m.procedimento_id,
        nome: m.nome,
        lote: m.lote,
        validade: m.validade,
        quantidade: m.quantidade,
      },
    });
    setConfirmDelMat(null);
    carregarDados();
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const valorLiquidoPreview = calcValorLiquido();

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

        {/* ── Coluna Esquerda: Formulário de procedimento ── */}
        <div>
          <div style={sectionHeaderStyle}>
            <Plus size={13} style={{ color: 'var(--sage-dark)' }} />
            {editId ? 'Editar procedimento' : 'Adicionar procedimento'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Serviço</label>
              <select value={servicoId} onChange={onServicoChange} style={inputStyle} disabled={!podeEditar}>
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
                type="number" step="0.01" min="0"
                value={valor} onChange={e => setValor(e.target.value)}
                placeholder="0,00" style={inputStyle} disabled={!podeEditar}
              />
            </div>

            <div>
              <label style={labelStyle}>Desconto (opcional)</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ display: 'flex', borderRadius: 'var(--r-xs)', border: '1px solid var(--border-md)', overflow: 'hidden', flexShrink: 0 }}>
                  {(['valor', 'porcentagem'] as const).map(t => (
                    <button key={t} onClick={() => setDescontoTipo(t)} disabled={!podeEditar}
                      style={{ padding: '7px 10px', fontSize: '11px', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', border: 'none', background: descontoTipo === t ? 'var(--sage-dark)' : 'transparent', color: descontoTipo === t ? 'white' : 'var(--muted)', transition: 'background 0.12s' }}>
                      {t === 'valor' ? 'R$' : '%'}
                    </button>
                  ))}
                </div>
                <input
                  type="number" step="0.01" min="0"
                  value={descontoValor} onChange={e => setDescontoValor(e.target.value)}
                  placeholder={descontoTipo === 'porcentagem' ? 'Ex: 10' : 'Ex: 50,00'}
                  style={{ ...inputStyle, flex: 1 }} disabled={!podeEditar}
                />
              </div>
              {valor && descontoValor && parseFloat(descontoValor) > 0 && (
                <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--sage-dark)', fontWeight: 500 }}>
                  Valor líquido: {fmtBRL(valorLiquidoPreview)}
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>Anotação (opcional)</label>
              <textarea
                value={anotacao} onChange={e => setAnotacao(e.target.value)}
                placeholder="Descreva o procedimento realizado..."
                rows={3} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} disabled={!podeEditar}
              />
            </div>

            {podeEditar && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={salvarProc} disabled={!servicoId || !valor || adicionando}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--sage-dark)', color: 'white', border: 'none', borderRadius: 'var(--r-xs)', padding: '8px 14px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: (!servicoId || !valor || adicionando) ? 0.4 : 1 }}>
                  {adicionando ? <Loader2 size={13} className="animate-spin" /> : editId ? <Pencil size={13} /> : <Plus size={13} />}
                  {editId ? 'Salvar alterações' : 'Adicionar'}
                </button>
                {editId && (
                  <button onClick={limparFormProc}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '11px', color: 'var(--muted)' }}>
                    <X size={13} /> cancelar edição
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Coluna Direita: Histórico ── */}
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
                const matsList = materiais[p.id] || [];
                const showMatForm = addingMatFor === p.id;

                return (
                  <div key={p.id} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', padding: '10px 13px' }}>
                    {/* Cabeçalho do procedimento */}
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
                            <div style={{ fontSize: '10.5px', color: 'var(--muted)', textDecoration: 'line-through' }}>{fmtBRL(v)}</div>
                            <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--sage-dark)' }}>{fmtBRL(liquido)}</div>
                            <div style={{ fontSize: '9.5px', color: 'var(--champ-text)', background: 'var(--champ-light)', padding: '1px 6px', borderRadius: '10px', marginTop: '2px' }}>
                              {p.desconto_tipo === 'porcentagem' ? `${d}% off` : `- ${fmtBRL(d)}`}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--sage-dark)' }}>{fmtBRL(v)}</div>
                        )}
                      </div>
                    </div>

                    {/* Ações do procedimento */}
                    {podeEditar && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '7px' }}>
                        {confirmDel === p.id ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--rose-text)' }}>Apagar este procedimento?</span>
                            <button onClick={() => apagarProc(p.id)} style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '5px', border: 'none', cursor: 'pointer', background: 'var(--rose-light)', color: 'var(--rose-text)', fontFamily: 'inherit' }}>Sim</button>
                            <button onClick={() => setConfirmDel(null)} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '5px', border: 'none', cursor: 'pointer', background: 'none', color: 'var(--muted)', fontFamily: 'inherit' }}>Não</button>
                          </span>
                        ) : (
                          <>
                            <button onClick={() => editarProc(p)} title="Editar procedimento" style={{ padding: '3px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}><Pencil size={13} /></button>
                            <button onClick={() => setConfirmDel(p.id)} title="Apagar procedimento" style={{ padding: '3px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}><Trash2 size={13} /></button>
                          </>
                        )}
                      </div>
                    )}

                    {/* ── Materiais utilizados ── */}
                    <div style={{ marginTop: '10px', borderTop: '1px dashed var(--border)', paddingTop: '9px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: matsList.length > 0 ? '8px' : '0' }}>
                        <FlaskConical size={11} style={{ color: 'var(--muted)' }} />
                        <span style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'var(--muted)' }}>
                          Materiais utilizados
                        </span>
                        {matsList.length > 0 && (
                          <span style={{ fontSize: '9px', fontWeight: 600, padding: '1px 5px', borderRadius: '10px', background: 'var(--sage-xlight)', color: 'var(--sage-dark)' }}>
                            {matsList.length}
                          </span>
                        )}
                      </div>

                      {/* Lista de materiais */}
                      {matsList.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '8px' }}>
                          {matsList.map(m => {
                            const badge = validadeBadge(m.validade);
                            const isConfirmDel = confirmDelMat === m.id;
                            const isEditing = editMat?.id === m.id && showMatForm;

                            return (
                              <div key={m.id} style={{ background: isEditing ? 'var(--sage-xlight)' : 'var(--bg)', border: `1px solid ${isEditing ? 'var(--sage-light)' : 'var(--border)'}`, borderRadius: '6px', padding: '7px 10px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--ink)' }}>{m.nome}</span>
                                      {badge}
                                    </div>
                                    {m.descricao && (
                                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{m.descricao}</div>
                                    )}
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '3px' }}>
                                      {m.lote && (
                                        <span style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
                                          Lote: <b style={{ color: 'var(--ink)' }}>{m.lote}</b>
                                        </span>
                                      )}
                                      {m.validade && (
                                        <span style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
                                          Val: <b style={{ color: 'var(--ink)' }}>{format(parseISO(m.validade), 'dd/MM/yyyy')}</b>
                                        </span>
                                      )}
                                      {m.quantidade && (
                                        <span style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
                                          Qtd: <b style={{ color: 'var(--ink)' }}>{m.quantidade}</b>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {podeEditar && !isConfirmDel && (
                                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                                      <button onClick={() => abrirEditMat(m)} title="Editar material" style={{ padding: '3px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}><Pencil size={12} /></button>
                                      <button onClick={() => setConfirmDelMat(m.id)} title="Apagar material" style={{ padding: '3px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}><Trash2 size={12} /></button>
                                    </div>
                                  )}
                                </div>
                                {isConfirmDel && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--rose-text)', flex: 1 }}>Remover este material?</span>
                                    <button onClick={() => apagarMaterial(m)} style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '5px', border: 'none', cursor: 'pointer', background: 'var(--rose-light)', color: 'var(--rose-text)', fontFamily: 'inherit' }}>Sim</button>
                                    <button onClick={() => setConfirmDelMat(null)} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '5px', border: 'none', cursor: 'pointer', background: 'none', color: 'var(--muted)', fontFamily: 'inherit' }}>Não</button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Formulário inline de material */}
                      {showMatForm && (
                        <div style={{ background: 'var(--sage-xlight)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 12px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--sage-dark)' }}>
                            {editMat ? 'Editar material' : 'Novo material'}
                          </div>

                          {/* Nome — obrigatório */}
                          <div>
                            <label style={labelStyle}>Nome do produto/material *</label>
                            <input
                              autoFocus
                              value={matForm.nome}
                              onChange={e => setMatForm(f => ({ ...f, nome: e.target.value }))}
                              placeholder="Ex: Botox®, Ácido Hialurônico, Cânula 25G"
                              style={inputStyle}
                            />
                          </div>

                          {/* Descrição */}
                          <div>
                            <label style={labelStyle}>Descrição (opcional)</label>
                            <input
                              value={matForm.descricao}
                              onChange={e => setMatForm(f => ({ ...f, descricao: e.target.value.slice(0, 100) }))}
                              placeholder="Ex: Unidade 50UI, 1ml densidade média"
                              style={inputStyle}
                            />
                          </div>

                          {/* Lote + Validade */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                              <label style={labelStyle}>Lote (opcional)</label>
                              <input
                                value={matForm.lote}
                                onChange={e => setMatForm(f => ({ ...f, lote: e.target.value }))}
                                placeholder="Ex: ABC123456"
                                style={inputStyle}
                              />
                            </div>
                            <div>
                              <label style={labelStyle}>Validade (opcional)</label>
                              <input
                                type="date"
                                value={matForm.validade}
                                onChange={e => setMatForm(f => ({ ...f, validade: e.target.value }))}
                                style={inputStyle}
                              />
                            </div>
                          </div>

                          {/* Quantidade */}
                          <div>
                            <label style={labelStyle}>Quantidade utilizada (opcional)</label>
                            <input
                              value={matForm.quantidade}
                              onChange={e => setMatForm(f => ({ ...f, quantidade: e.target.value }))}
                              placeholder="Ex: 20 UI, 1 ml, 2 unidades"
                              style={inputStyle}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '7px' }}>
                            <button
                              onClick={() => salvarMaterial(p.id)}
                              disabled={!matForm.nome.trim() || savingMat}
                              style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--sage-dark)', color: 'white', border: 'none', borderRadius: 'var(--r-xs)', padding: '7px 12px', fontSize: '11.5px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: (!matForm.nome.trim() || savingMat) ? 0.4 : 1 }}>
                              {savingMat ? <Loader2 size={12} className="animate-spin" /> : null}
                              {editMat ? 'Salvar alterações' : 'Salvar material'}
                            </button>
                            <button
                              onClick={cancelarFormMat}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '11px', color: 'var(--muted)' }}>
                              <X size={12} /> Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Botão + Adicionar material */}
                      {podeEditar && !showMatForm && (
                        <button
                          onClick={() => abrirAddMat(p.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 500, color: 'var(--sage-dark)', background: 'none', border: '1px dashed var(--border-md)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', marginTop: matsList.length > 0 ? '0' : '4px' }}>
                          <Plus size={11} /> Adicionar material
                        </button>
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
