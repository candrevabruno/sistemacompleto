import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { Copy, Loader2, Check, CalendarDays, Bot, AlertCircle } from 'lucide-react';
import { PainelAnotacoes } from './PainelAnotacoes';

interface Props {
  lead: any;
  pacienteId: string | null;
}

const cardCls = 'rounded-[12px] border border-[var(--border)] bg-[var(--white)] shadow-[0_1px_4px_rgba(4,52,44,0.06)] p-5';
const labelCls = 'text-[10px] font-semibold uppercase tracking-[1px] text-[var(--muted)] block mb-1.5';
const inputCls = 'w-full rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--sage-dark)]';
const inputStyle: React.CSSProperties = { border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)' };
const gridCls = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';

const COMO_CONHECEU_OPTS = [
  { value: 'indicacao', label: 'Indicação' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'google', label: 'Google' },
  { value: 'outro', label: 'Outro' },
];

const STATUS_PROXIMO: Record<string, { label: string; color: string; bg: string }> = {
  confirmado: { label: 'Confirmou',  color: '#065F46', bg: 'rgba(16,185,129,0.1)' },
  reagendado: { label: 'Reagendou',  color: '#92400E', bg: 'rgba(245,158,11,0.1)'  },
  cancelado:  { label: 'Cancelou',   color: '#991B1B', bg: 'rgba(220,38,38,0.1)'   },
  agendado:   { label: 'Agendado',   color: 'var(--sage-dark)', bg: 'var(--sage-xlight)'        },
};

function SaveButton({ salvando, saved, onClick }: { salvando: boolean; saved: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={salvando}
      className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-[8px] text-white disabled:opacity-50 transition-all"
      style={{ background: saved ? 'rgba(16,185,129,0.85)' : 'var(--sage-dark)' }}>
      {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
      {saved ? 'Salvo!' : 'Salvar'}
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[1.2px] mb-4 flex items-center gap-2" style={{ color: 'var(--sage-dark)' }}>
      <span className="w-1.5 h-4 rounded-full inline-block" style={{ background: 'var(--sage-dark)' }} />
      {children}
    </p>
  );
}

export function DadosTab({ lead, pacienteId }: Props) {
  // ── Dados pessoais (leads) ─────────────────────────────────────
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [dataNasc, setDataNasc] = useState('');
  const [comoConheceu, setComoConheceu] = useState('');
  const [indicadoPorId, setIndicadoPorId] = useState('');
  const [indicadoPorBusca, setIndicadoPorBusca] = useState('');
  const [sugestoes, setSugestoes] = useState<any[]>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);

  // ── Endereço (pacientes) ───────────────────────────────────────
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [cep, setCep] = useState('');

  // ── Financeiro (pacientes) ─────────────────────────────────────
  const [tipo, setTipo] = useState<'particular' | 'convenio'>('particular');
  const [convenioNome, setConvenioNome] = useState('');
  const [convenioNumero, setConvenioNumero] = useState('');
  const [prefPagamento, setPrefPagamento] = useState('');

  // ── Nota Fiscal (pacientes) ────────────────────────────────────
  const [nfDocumento, setNfDocumento] = useState('');
  const [nfNome, setNfNome] = useState('');
  const [nfRua, setNfRua] = useState('');
  const [nfNumero, setNfNumero] = useState('');
  const [nfBairro, setNfBairro] = useState('');
  const [nfCidade, setNfCidade] = useState('');
  const [nfEstado, setNfEstado] = useState('');
  const [nfCep, setNfCep] = useState('');

  // ── Próxima consulta + Resumo IA ───────────────────────────────
  const [proximaConsulta, setProximaConsulta] = useState<any | null>(null);
  const [resumoIA, setResumoIA] = useState('');
  const [resumoIAAt, setResumoIAAt] = useState<string | null>(null);
  const [loadingPac, setLoadingPac] = useState(false);

  // ── Estados de salvamento ──────────────────────────────────────
  const [salvandoPessoal, setSalvandoPessoal] = useState(false);
  const [savedPessoal, setSavedPessoal] = useState(false);
  const [salvandoFinanceiro, setSalvandoFinanceiro] = useState(false);
  const [savedFinanceiro, setSavedFinanceiro] = useState(false);
  const [salvandoNF, setSalvandoNF] = useState(false);
  const [savedNF, setSavedNF] = useState(false);

  useEffect(() => {
    if (!lead) return;
    setNome(lead.nome_lead || '');
    setTelefone(lead.whatsapp_lead || '');
    setEmail(lead.email || '');
    setDataNasc(lead.data_nascimento || '');
    if (pacienteId) carregarPaciente();
  }, [lead?.id, pacienteId]);

  const carregarPaciente = async () => {
    if (!pacienteId) return;
    setLoadingPac(true);

    const { data: pac } = await supabase
      .from('pacientes').select('*').eq('id', pacienteId).single();

    if (pac) {
      const end = pac.endereco || {};
      setRua(end.rua || ''); setNumero(end.numero || ''); setBairro(end.bairro || '');
      setCidade(end.cidade || ''); setEstado(end.estado || ''); setCep(end.cep || '');
      setComoConheceu(pac.como_conheceu || '');
      setIndicadoPorId(pac.indicado_por_lead_id || '');
      setTipo(pac.tipo || 'particular');
      setConvenioNome(pac.convenio_nome || '');
      setConvenioNumero(pac.convenio_numero || '');
      setPrefPagamento(pac.preferencia_pagamento || '');
      setNfDocumento(pac.nf_documento || '');
      setNfNome(pac.nf_nome || '');
      const nfe = pac.nf_endereco || {};
      setNfRua(nfe.rua || ''); setNfNumero(nfe.numero || ''); setNfBairro(nfe.bairro || '');
      setNfCidade(nfe.cidade || ''); setNfEstado(nfe.estado || ''); setNfCep(nfe.cep || '');
      setResumoIA(pac.ultimo_resumo_conversa || '');
      setResumoIAAt(pac.ultimo_resumo_at || null);

      if (pac.indicado_por_lead_id) {
        const { data: ind } = await supabase
          .from('leads').select('nome_lead').eq('id', pac.indicado_por_lead_id).single();
        if (ind) setIndicadoPorBusca(ind.nome_lead || '');
      }
    }

    const { data: ag } = await supabase
      .from('agendamentos')
      .select('*, agendas(nome)')
      .eq('lead_id', lead.id)
      .gte('data_hora_inicio', new Date().toISOString())
      .not('status', 'in', '("cancelado","faltou")')
      .order('data_hora_inicio', { ascending: true })
      .limit(1)
      .maybeSingle();
    setProximaConsulta(ag || null);

    setLoadingPac(false);
  };

  const buscarIndicadoPor = async (q: string) => {
    setIndicadoPorBusca(q);
    setIndicadoPorId('');
    if (q.length < 2) { setSugestoes([]); return; }
    const { data } = await supabase
      .from('leads').select('id, nome_lead').ilike('nome_lead', `%${q}%`).neq('id', lead.id).limit(6);
    setSugestoes(data || []);
    setMostrarSugestoes(true);
  };

  const selecionarIndicador = (s: any) => {
    setIndicadoPorId(s.id);
    setIndicadoPorBusca(s.nome_lead);
    setSugestoes([]);
    setMostrarSugestoes(false);
  };

  const copiarEnderecoParaNF = () => {
    setNfRua(rua); setNfNumero(numero); setNfBairro(bairro);
    setNfCidade(cidade); setNfEstado(estado); setNfCep(cep);
  };

  const flash = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const salvarPessoal = async () => {
    setSalvandoPessoal(true);
    await supabase.from('leads').update({
      nome_lead: nome, email: email || null, data_nascimento: dataNasc || null,
    }).eq('id', lead.id);
    if (pacienteId) {
      await supabase.from('pacientes').update({
        endereco: { rua, numero, bairro, cidade, estado, cep },
        como_conheceu: comoConheceu || null,
        indicado_por_lead_id: indicadoPorId || null,
      }).eq('id', pacienteId);
    }
    setSalvandoPessoal(false); flash(setSavedPessoal);
  };

  const salvarFinanceiro = async () => {
    if (!pacienteId) return;
    setSalvandoFinanceiro(true);
    await supabase.from('pacientes').update({
      tipo,
      convenio_nome: tipo === 'convenio' ? convenioNome : null,
      convenio_numero: tipo === 'convenio' ? convenioNumero : null,
      preferencia_pagamento: tipo === 'particular' ? prefPagamento : null,
    }).eq('id', pacienteId);
    setSalvandoFinanceiro(false); flash(setSavedFinanceiro);
  };

  const salvarNF = async () => {
    if (!pacienteId) return;
    setSalvandoNF(true);
    await supabase.from('pacientes').update({
      nf_documento: nfDocumento || null,
      nf_nome: nfNome || null,
      nf_endereco: (nfRua || nfCidade) ? { rua: nfRua, numero: nfNumero, bairro: nfBairro, cidade: nfCidade, estado: nfEstado, cep: nfCep } : null,
    }).eq('id', pacienteId);
    setSalvandoNF(false); flash(setSavedNF);
  };

  const pcStatus = proximaConsulta ? STATUS_PROXIMO[proximaConsulta.status] || STATUS_PROXIMO.agendado : null;

  return (
    <div className="p-5 space-y-5">

      {/* ── 1. Informações Pessoais + Endereço ── */}
      <div className={cardCls}>
        <SectionTitle>Informações Pessoais</SectionTitle>
        <div className={gridCls}>
          <div>
            <label className={labelCls}>Nome completo</label>
            <input value={nome} onChange={e => setNome(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls}>Telefone / WhatsApp</label>
            <input value={telefone} readOnly className={inputCls + ' opacity-60 cursor-default'} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls}>E-mail</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls}>Data de nascimento</label>
            <input value={dataNasc} onChange={e => setDataNasc(e.target.value)} type="date" className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls}>Como nos conheceu</label>
            <select value={comoConheceu} onChange={e => setComoConheceu(e.target.value)} className={inputCls} style={inputStyle}>
              <option value="">Selecionar...</option>
              {COMO_CONHECEU_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {comoConheceu === 'indicacao' && (
            <div className="relative">
              <label className={labelCls}>Indicado por</label>
              <input value={indicadoPorBusca} onChange={e => buscarIndicadoPor(e.target.value)}
                onFocus={() => sugestoes.length > 0 && setMostrarSugestoes(true)}
                onBlur={() => setTimeout(() => setMostrarSugestoes(false), 150)}
                placeholder="Buscar paciente..." className={inputCls} style={inputStyle} />
              {mostrarSugestoes && sugestoes.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-[8px] border border-[var(--border)] bg-[var(--white)] shadow-lg overflow-hidden">
                  {sugestoes.map(s => (
                    <button key={s.id} onMouseDown={() => selecionarIndicador(s)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--sage-xlight)] transition-colors" style={{ color: 'var(--ink)' }}>
                      {s.nome_lead}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Endereço */}
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <p className="text-[10px] font-semibold uppercase tracking-[1px] text-[var(--muted)] mb-3">Endereço</p>
          <div className={gridCls}>
            <div className="sm:col-span-2">
              <label className={labelCls}>Rua</label>
              <input value={rua} onChange={e => setRua(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls}>Número</label>
              <input value={numero} onChange={e => setNumero(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls}>Bairro</label>
              <input value={bairro} onChange={e => setBairro(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls}>Cidade</label>
              <input value={cidade} onChange={e => setCidade(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls}>Estado (UF)</label>
              <input value={estado} onChange={e => setEstado(e.target.value)} maxLength={2} placeholder="SP" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls}>CEP</label>
              <input value={cep} onChange={e => setCep(e.target.value)} placeholder="00000-000" className={inputCls} style={inputStyle} />
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-4 pt-4 border-t border-[var(--border)]">
          <SaveButton salvando={salvandoPessoal} saved={savedPessoal} onClick={salvarPessoal} />
        </div>
      </div>

      {/* ── 2. Financeiro ── */}
      <div className={cardCls}>
        <SectionTitle>Financeiro</SectionTitle>
        <div className="flex gap-2 mb-5">
          {(['particular', 'convenio'] as const).map(t => (
            <button key={t} onClick={() => setTipo(t)}
              className="px-4 py-2 text-sm font-semibold rounded-[8px] transition-all"
              style={tipo === t
                ? { background: 'var(--sage-dark)', color: '#fff' }
                : { background: 'var(--sage-xlight)', color: 'var(--ink)', border: '1px solid var(--border)' }}>
              {t === 'particular' ? 'Particular' : 'Convênio'}
            </button>
          ))}
        </div>
        <div className={gridCls}>
          {tipo === 'convenio' ? (
            <>
              <div>
                <label className={labelCls}>Nome do convênio</label>
                <input value={convenioNome} onChange={e => setConvenioNome(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls}>Número da carteirinha</label>
                <input value={convenioNumero} onChange={e => setConvenioNumero(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
            </>
          ) : (
            <div>
              <label className={labelCls}>Forma de pagamento preferida</label>
              <input value={prefPagamento} onChange={e => setPrefPagamento(e.target.value)}
                placeholder="Ex: Cartão de crédito, PIX..." className={inputCls} style={inputStyle} />
            </div>
          )}
        </div>
        <div className="flex justify-end mt-4 pt-4 border-t border-[var(--border)]">
          <SaveButton salvando={salvandoFinanceiro} saved={savedFinanceiro} onClick={salvarFinanceiro} />
        </div>
      </div>

      {/* ── 3. Dados para Nota Fiscal ── */}
      <div className={cardCls}>
        <SectionTitle>Dados para Nota Fiscal</SectionTitle>
        <div className={gridCls}>
          <div>
            <label className={labelCls}>CPF / CNPJ</label>
            <input value={nfDocumento} onChange={e => setNfDocumento(e.target.value)} placeholder="000.000.000-00" className={inputCls} style={inputStyle} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Razão social / Nome para nota fiscal</label>
            <input value={nfNome} onChange={e => setNfNome(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[1px]" style={{ color: 'var(--muted)' }}>Endereço de cobrança</p>
            <button onClick={copiarEnderecoParaNF}
              className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-[6px]"
              style={{ background: 'var(--sage-xlight)', color: 'var(--sage-dark)' }}>
              <Copy className="w-3 h-3" /> Copiar do endereço pessoal
            </button>
          </div>
          <div className={gridCls}>
            <div className="sm:col-span-2">
              <label className={labelCls}>Rua</label>
              <input value={nfRua} onChange={e => setNfRua(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
            <div><label className={labelCls}>Número</label><input value={nfNumero} onChange={e => setNfNumero(e.target.value)} className={inputCls} style={inputStyle} /></div>
            <div><label className={labelCls}>Bairro</label><input value={nfBairro} onChange={e => setNfBairro(e.target.value)} className={inputCls} style={inputStyle} /></div>
            <div><label className={labelCls}>Cidade</label><input value={nfCidade} onChange={e => setNfCidade(e.target.value)} className={inputCls} style={inputStyle} /></div>
            <div><label className={labelCls}>Estado (UF)</label><input value={nfEstado} onChange={e => setNfEstado(e.target.value)} maxLength={2} className={inputCls} style={inputStyle} /></div>
            <div><label className={labelCls}>CEP</label><input value={nfCep} onChange={e => setNfCep(e.target.value)} className={inputCls} style={inputStyle} /></div>
          </div>
        </div>
        <div className="flex justify-end mt-4 pt-4 border-t border-[var(--border)]">
          <SaveButton salvando={salvandoNF} saved={savedNF} onClick={salvarNF} />
        </div>
      </div>

      {/* ── 4. Próxima Consulta ── */}
      <div className={cardCls}>
        <SectionTitle>Próxima Consulta</SectionTitle>
        {loadingPac ? (
          <div className="flex items-center gap-2 py-1"><Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--muted)' }} />
            <span className="text-sm" style={{ color: 'var(--muted)' }}>Carregando...</span></div>
        ) : proximaConsulta ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-[10px]" style={{ background: 'var(--sage-xlight)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: 'var(--sage-dark)' }}>
                <CalendarDays className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  {format(parseISO(proximaConsulta.data_hora_inicio), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </p>
                {proximaConsulta.agendas?.nome && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{proximaConsulta.agendas.nome}</p>
                )}
                {proximaConsulta.procedimento_nome && (
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{proximaConsulta.procedimento_nome}</p>
                )}
              </div>
            </div>
            {pcStatus && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0"
                style={{ background: pcStatus.bg, color: pcStatus.color }}>
                {pcStatus.label}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--muted)' }} />
            <span className="text-sm" style={{ color: 'var(--muted)' }}>Nenhuma consulta agendada</span>
          </div>
        )}
      </div>

      {/* ── 5. Resumo da Última Conversa (IA) ── */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-[8px] flex items-center justify-center" style={{ background: 'var(--sage-xlight)' }}>
            <Bot className="w-4 h-4" style={{ color: 'var(--sage-dark)' }} />
          </div>
          <SectionTitle>Resumo da Última Conversa</SectionTitle>
          {resumoIAAt && (
            <span className="text-[10px] ml-auto flex-shrink-0" style={{ color: 'var(--muted)' }}>
              {format(new Date(resumoIAAt), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
            </span>
          )}
        </div>
        {resumoIA ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap p-3 rounded-[8px]" style={{ background: 'var(--sage-xlight)', color: 'var(--ink)' }}>
            {resumoIA}
          </p>
        ) : (
          <p className="text-sm italic" style={{ color: 'var(--muted)' }}>Nenhuma conversa registrada ainda.</p>
        )}
      </div>

      {/* ── 6. Anotações Gerais ── */}
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--white)] shadow-[0_1px_4px_rgba(4,52,44,0.06)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <SectionTitle>Anotações Gerais</SectionTitle>
        </div>
        <div className="p-5">
          {pacienteId
            ? <PainelAnotacoes pacienteId={pacienteId} tipo="geral" />
            : <p className="text-sm" style={{ color: 'var(--muted)' }}>Carregando...</p>
          }
        </div>
      </div>

    </div>
  );
}
