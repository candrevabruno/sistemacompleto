import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Stethoscope, Plus } from 'lucide-react';

interface Props {
  pacienteId: string;
}

const labelCls = 'text-[10px] font-semibold uppercase tracking-[1px] text-[var(--muted)] block mb-1.5';
const inputCls = 'w-full rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--sage-dark)]';
const inputStyle: React.CSSProperties = { border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)' };

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
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--muted)]" />
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Coluna Esquerda — Formulário */}
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--white)] shadow-[0_1px_4px_rgba(4,52,44,0.06)] p-5 flex flex-col gap-4">
          <p className="text-[11px] font-bold uppercase tracking-[1.2px] flex items-center gap-2" style={{ color: 'var(--sage-dark)' }}>
            <span className="w-1.5 h-4 rounded-full inline-block" style={{ background: 'var(--sage-dark)' }} />
            Adicionar Procedimento
          </p>

          <div>
            <label className={labelCls}>Serviço</label>
            <select value={servicoId} onChange={onServicoChange} className={inputCls} style={inputStyle}>
              <option value="">Selecionar serviço...</option>
              {servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder="0,00"
              className={inputCls}
              style={inputStyle}
            />
          </div>

          <button
            onClick={adicionar}
            disabled={!servicoId || !valor || adicionando}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-[8px] text-sm font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90 mt-auto"
            style={{ background: 'var(--sage-dark)' }}>
            {adicionando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Adicionar procedimento
          </button>
        </div>

        {/* Coluna Direita — Histórico */}
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--white)] shadow-[0_1px_4px_rgba(4,52,44,0.06)] flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <p className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: 'var(--sage-dark)' }}>
              Histórico de Procedimentos
            </p>
          </div>

          {procedimentos.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 p-8 gap-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--sage-xlight)' }}>
                <Stethoscope className="w-4 h-4" style={{ color: 'var(--sage)' }} />
              </div>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Nenhum procedimento adicionado</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
                {procedimentos.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--sage-xlight)] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{p.nome_servico}</p>
                      <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                        {p.adicionado_por_nome} · {format(new Date(p.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <span className="text-sm font-semibold flex-shrink-0" style={{ color: 'var(--sage-dark)' }}>
                      {fmtBRL(parseFloat(p.valor))}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-between"
                style={{ background: 'var(--sage-xlight)' }}>
                <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>Total acumulado</span>
                <span className="text-[18px] font-bold" style={{ color: 'var(--sage-dark)' }}>{fmtBRL(total)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
