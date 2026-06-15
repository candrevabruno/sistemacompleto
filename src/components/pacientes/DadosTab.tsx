import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { Copy, Loader2, Check, CalendarDays, Bot, AlertCircle, User, MapPin, CreditCard, FileText, Clock, StickyNote, Gift, Phone, LifeBuoy, MessageCircle } from 'lucide-react';
import { PainelAnotacoes } from './PainelAnotacoes';

// Aniversário: compara dia/mês da data de nascimento com hoje (grátis para todos).
function isAniversarioHoje(dataNasc: string | null | undefined): boolean {
  if (!dataNasc) return false;
  const p = dataNasc.slice(0, 10).split('-');
  if (p.length < 3) return false;
  const hoje = new Date();
  return Number(p[1]) === hoje.getMonth() + 1 && Number(p[2]) === hoje.getDate();
}

// Idade calculada a partir da data de nascimento (não há coluna no banco).
function calcularIdade(dataNasc: string | null | undefined): number | null {
  if (!dataNasc) return null;
  const p = dataNasc.slice(0, 10).split('-');
  if (p.length < 3) return null;
  const nasc = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  if (isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade >= 0 && idade < 130 ? idade : null;
}

// ViaCEP — auto-preenche endereço (sem credencial/custo).
async function buscarViaCep(cep: string): Promise<{ rua: string; bairro: string; cidade: string; estado: string } | null> {
  const limpo = cep.replace(/\D/g, '');
  if (limpo.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
    if (!res.ok) return null;
    const d = await res.json();
    if (d.erro) return null;
    return { rua: d.logradouro || '', bairro: d.bairro || '', cidade: d.localidade || '', estado: d.uf || '' };
  } catch {
    return null;
  }
}

interface Props {
  lead: any;
  pacienteId: string | null;
  proximaConsulta?: any | null;
}

const COMO_CONHECEU_OPTS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'google', label: 'Google' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'site', label: 'Site' },
  { value: 'profissional_saude', label: 'Profissional de saúde' },
  { value: 'convenio', label: 'Convênio' },
  { value: 'evento', label: 'Evento' },
  { value: 'outro', label: 'Outro' },
];

const SEXO_OPTS = [
  { value: 'feminino', label: 'Feminino' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'outro', label: 'Outro' },
  { value: 'nao_informar', label: 'Prefiro não informar' },
];

const ESTADO_CIVIL_OPTS = [
  { value: 'solteiro', label: 'Solteiro(a)' },
  { value: 'casado', label: 'Casado(a)' },
  { value: 'divorciado', label: 'Divorciado(a)' },
  { value: 'viuvo', label: 'Viúvo(a)' },
  { value: 'uniao_estavel', label: 'União estável' },
];

const CANAIS_OPTS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'ligacao', label: 'Ligação' },
  { value: 'email', label: 'E-mail' },
];

const STATUS_PROXIMO: Record<string, { label: string; color: string; bg: string }> = {
  confirmado: { label: 'Confirmou',  color: '#065F46', bg: 'rgba(16,185,129,0.1)' },
  reagendado: { label: 'Reagendou',  color: '#92400E', bg: 'rgba(245,158,11,0.1)'  },
  cancelado:  { label: 'Cancelou',   color: '#991B1B', bg: 'rgba(220,38,38,0.1)'   },
  agendado:   { label: 'Agendado',   color: 'var(--sage-dark)', bg: 'var(--sage-xlight)' },
};

// ── Shared style constants ────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 11px',
  border: '1px solid var(--border-md)',
  borderRadius: 'var(--r-xs)',
  fontSize: '12.5px',
  color: 'var(--ink)',
  fontFamily: 'inherit',
  background: 'var(--white)',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: '9.5px',
  fontWeight: 600,
  letterSpacing: '0.8px',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  display: 'block',
  marginBottom: '5px',
};

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '7px',
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  marginBottom: '14px',
  paddingBottom: '8px',
  borderBottom: '1px solid var(--border)',
};

const grid3: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '12px 16px',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SaveButton({ salvando, saved, onClick }: { salvando: boolean; saved: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={salvando}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '7px 16px',
        fontSize: '12px',
        fontWeight: 600,
        borderRadius: 'var(--r-xs)',
        border: 'none',
        cursor: salvando ? 'default' : 'pointer',
        fontFamily: 'inherit',
        color: '#fff',
        background: saved ? 'rgba(16,185,129,0.85)' : 'var(--sage-dark)',
        opacity: salvando ? 0.6 : 1,
        transition: 'background 0.2s',
      }}
    >
      {salvando ? (
        <Loader2 style={{ width: '13px', height: '13px' }} className="animate-spin" />
      ) : saved ? (
        <Check style={{ width: '13px', height: '13px' }} />
      ) : null}
      {saved ? 'Salvo!' : 'Salvar'}
    </button>
  );
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={sectionHeaderStyle}>
      <span style={{ color: 'var(--sage-dark)', display: 'flex', alignItems: 'center', fontSize: '13px' }}>
        {icon}
      </span>
      {label}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DadosTab({ lead, pacienteId, proximaConsulta: proximaConsultaProp }: Props) {
  // ── Dados pessoais (leads) ─────────────────────────────────────
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [dataNasc, setDataNasc] = useState('');
  const [comoConheceu, setComoConheceu] = useState('');
  const [indicadoPor, setIndicadoPor] = useState('');

  // ── Dados pessoais extra (pacientes) ───────────────────────────
  const [nomeSocial, setNomeSocial] = useState('');
  const [cpf, setCpf] = useState('');
  const [sexo, setSexo] = useState('');
  const [estadoCivil, setEstadoCivil] = useState('');
  const [profissao, setProfissao] = useState('');
  const [nacionalidade, setNacionalidade] = useState('');

  // ── Contato (pacientes) ────────────────────────────────────────
  const [celularWhatsapp, setCelularWhatsapp] = useState(true);
  const [telefoneSecundario, setTelefoneSecundario] = useState('');

  // ── Contato de emergência (pacientes) ──────────────────────────
  const [emergNome, setEmergNome] = useState('');
  const [emergParentesco, setEmergParentesco] = useState('');
  const [emergTelefone, setEmergTelefone] = useState('');

  // ── Preferências de comunicação (pacientes) ────────────────────
  const [canais, setCanais] = useState<string[]>([]);
  const [melhorHorario, setMelhorHorario] = useState('');

  // ── Endereço (pacientes) ───────────────────────────────────────
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [cep, setCep] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);

  // ── Financeiro (pacientes) ─────────────────────────────────────
  const [tipo, setTipo] = useState<'particular' | 'convenio'>('particular');
  const [convenioNome, setConvenioNome] = useState('');
  const [convenioNumero, setConvenioNumero] = useState('');
  const [convenioValidade, setConvenioValidade] = useState('');
  const [convenioPlano, setConvenioPlano] = useState('');
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
  const proximaConsulta = proximaConsultaProp ?? null;
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
      setRua(end.rua || ''); setNumero(end.numero || ''); setComplemento(end.complemento || '');
      setBairro(end.bairro || ''); setCidade(end.cidade || ''); setEstado(end.estado || ''); setCep(end.cep || '');
      setComoConheceu(pac.como_conheceu || '');
      setIndicadoPor(pac.indicado_por || '');
      setNomeSocial(pac.nome_social || '');
      setCpf(pac.cpf || '');
      setSexo(pac.sexo || '');
      setEstadoCivil(pac.estado_civil || '');
      setProfissao(pac.profissao || '');
      setNacionalidade(pac.nacionalidade || '');
      setCelularWhatsapp(pac.celular_whatsapp ?? true);
      setTelefoneSecundario(pac.telefone_secundario || '');
      setEmergNome(pac.contato_emergencia_nome || '');
      setEmergParentesco(pac.contato_emergencia_parentesco || '');
      setEmergTelefone(pac.contato_emergencia_telefone || '');
      setCanais(Array.isArray(pac.preferencia_canais) ? pac.preferencia_canais : []);
      setMelhorHorario(pac.melhor_horario_contato || '');
      setTipo(pac.tipo || 'particular');
      setConvenioNome(pac.convenio_nome || '');
      setConvenioNumero(pac.convenio_numero || '');
      setConvenioValidade(pac.convenio_validade || '');
      setConvenioPlano(pac.convenio_plano || '');
      setPrefPagamento(pac.preferencia_pagamento || '');
      setNfDocumento(pac.nf_documento || '');
      setNfNome(pac.nf_nome || '');
      const nfe = pac.nf_endereco || {};
      setNfRua(nfe.rua || ''); setNfNumero(nfe.numero || ''); setNfBairro(nfe.bairro || '');
      setNfCidade(nfe.cidade || ''); setNfEstado(nfe.estado || ''); setNfCep(nfe.cep || '');
      setResumoIA(pac.ultimo_resumo_conversa || '');
      setResumoIAAt(pac.ultimo_resumo_at || null);
    }

    setLoadingPac(false);
  };

  // Auto-preenche endereço pelo CEP (ViaCEP).
  const onCepBlur = async () => {
    if (cep.replace(/\D/g, '').length !== 8) return;
    setBuscandoCep(true);
    const r = await buscarViaCep(cep);
    setBuscandoCep(false);
    if (r) {
      setRua(r.rua || rua); setBairro(r.bairro || bairro);
      setCidade(r.cidade || cidade); setEstado(r.estado || estado);
    }
  };

  const toggleCanal = (value: string) => {
    setCanais(prev => prev.includes(value) ? prev.filter(c => c !== value) : [...prev, value]);
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
        endereco: { rua, numero, complemento, bairro, cidade, estado, cep },
        como_conheceu: comoConheceu || null,
        indicado_por: comoConheceu === 'indicacao' ? (indicadoPor || null) : null,
        nome_social: nomeSocial || null,
        cpf: cpf || null,
        sexo: sexo || null,
        estado_civil: estadoCivil || null,
        profissao: profissao || null,
        nacionalidade: nacionalidade || null,
        celular_whatsapp: celularWhatsapp,
        telefone_secundario: telefoneSecundario || null,
        contato_emergencia_nome: emergNome || null,
        contato_emergencia_parentesco: emergParentesco || null,
        contato_emergencia_telefone: emergTelefone || null,
        preferencia_canais: canais,
        melhor_horario_contato: melhorHorario || null,
      }).eq('id', pacienteId);
    }
    setSalvandoPessoal(false); flash(setSavedPessoal);
  };

  const salvarFinanceiro = async () => {
    if (!pacienteId) return;
    setSalvandoFinanceiro(true);
    const ehConvenio = tipo === 'convenio';
    await supabase.from('pacientes').update({
      tipo,
      possui_convenio: ehConvenio,
      convenio_nome: ehConvenio ? (convenioNome || null) : null,
      convenio_numero: ehConvenio ? (convenioNumero || null) : null,
      convenio_validade: ehConvenio ? (convenioValidade || null) : null,
      convenio_plano: ehConvenio ? (convenioPlano || null) : null,
      preferencia_pagamento: !ehConvenio ? (prefPagamento || null) : null,
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

  if (!pacienteId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', gap: '8px', color: 'var(--muted)' }}>
        <Loader2 size={16} className="animate-spin" />
        <span style={{ fontSize: '13px' }}>Carregando...</span>
      </div>
    );
  }

  const pcStatus = proximaConsulta ? STATUS_PROXIMO[proximaConsulta.status] || STATUS_PROXIMO.agendado : null;

  // ── Shared field wrapper ──
  const Field = ({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={style}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );

  // ── Save bar ──
  const SaveBar = ({ salvando, saved, onSave }: { salvando: boolean; saved: boolean; onSave: () => void }) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: '16px',
        paddingTop: '14px',
        borderTop: '1px solid var(--border)',
      }}
    >
      <SaveButton salvando={salvando} saved={saved} onClick={onSave} />
    </div>
  );

  return (
    <div style={{ padding: '20px 22px' }}>

      {/* ── 1. Dados pessoais + contato + endereço + emergência + preferências ── */}
      <div style={{ marginBottom: '22px' }}>
        <SectionHeader icon={<User size={13} />} label="Dados Pessoais" />

        <div style={grid3}>
          <Field label="Nome completo" style={{ gridColumn: '1 / span 2' }}>
            <input value={nome} onChange={e => setNome(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Nome social (opcional)">
            <input value={nomeSocial} onChange={e => setNomeSocial(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="CPF">
            <input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" style={inputStyle} />
          </Field>
          <Field label={isAniversarioHoje(dataNasc) ? '🎁 Data de nascimento' : 'Data de nascimento'}>
            <input
              value={dataNasc}
              onChange={e => setDataNasc(e.target.value)}
              type="date"
              style={isAniversarioHoje(dataNasc)
                ? { ...inputStyle, background: 'var(--champ-light)', border: '1px solid var(--champ-text)', color: 'var(--champ-text)', fontWeight: 600 }
                : inputStyle}
            />
            {isAniversarioHoje(dataNasc) && (
              <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', fontWeight: 600, color: 'var(--champ-text)', background: 'var(--champ-light)', padding: '3px 9px', borderRadius: '20px' }}>
                <Gift size={11} /> Aniversário é hoje!
              </div>
            )}
          </Field>
          <Field label="Idade">
            <input
              value={calcularIdade(dataNasc) !== null ? `${calcularIdade(dataNasc)} anos` : '—'}
              readOnly
              style={{ ...inputStyle, opacity: 0.6, cursor: 'default' }}
            />
          </Field>

          <Field label="Sexo">
            <select value={sexo} onChange={e => setSexo(e.target.value)} style={inputStyle}>
              <option value="">Selecionar...</option>
              {SEXO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Estado civil">
            <select value={estadoCivil} onChange={e => setEstadoCivil(e.target.value)} style={inputStyle}>
              <option value="">Selecionar...</option>
              {ESTADO_CIVIL_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Profissão">
            <input value={profissao} onChange={e => setProfissao(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Nacionalidade">
            <input value={nacionalidade} onChange={e => setNacionalidade(e.target.value)} placeholder="Brasileira" style={inputStyle} />
          </Field>
        </div>

        {/* Sub-seção contato */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ ...sectionHeaderStyle, marginBottom: '12px' }}>
            <span style={{ color: 'var(--sage-dark)', display: 'flex', alignItems: 'center', fontSize: '13px' }}><Phone size={13} /></span>
            Contato
          </div>
          <div style={grid3}>
            <Field label="Celular principal">
              <input value={telefone} readOnly style={{ ...inputStyle, opacity: 0.6, cursor: 'default' }} />
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11.5px', color: 'var(--ink)', cursor: 'pointer' }}>
                <input type="checkbox" checked={celularWhatsapp} onChange={e => setCelularWhatsapp(e.target.checked)} />
                É WhatsApp?
              </label>
            </Field>
            <Field label="Telefone secundário">
              <input value={telefoneSecundario} onChange={e => setTelefoneSecundario(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="E-mail">
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inputStyle} />
            </Field>
            <Field label="Como conheceu a clínica">
              <select value={comoConheceu} onChange={e => setComoConheceu(e.target.value)} style={inputStyle}>
                <option value="">Selecionar...</option>
                {COMO_CONHECEU_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            {comoConheceu === 'indicacao' && (
              <Field label="Quem indicou?" style={{ gridColumn: '2 / span 2' }}>
                <input value={indicadoPor} onChange={e => setIndicadoPor(e.target.value)} placeholder="Nome de quem indicou" style={inputStyle} />
              </Field>
            )}
          </div>
        </div>

        {/* Sub-seção endereço */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ ...sectionHeaderStyle, marginBottom: '12px' }}>
            <span style={{ color: 'var(--sage-dark)', display: 'flex', alignItems: 'center', fontSize: '13px' }}><MapPin size={13} /></span>
            Endereço
          </div>
          <div style={grid3}>
            <Field label={buscandoCep ? 'CEP (buscando...)' : 'CEP'}>
              <input value={cep} onChange={e => setCep(e.target.value)} onBlur={onCepBlur} placeholder="00000-000" style={inputStyle} />
            </Field>
            <Field label="Rua" style={{ gridColumn: '2 / span 2' }}>
              <input value={rua} onChange={e => setRua(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Número">
              <input value={numero} onChange={e => setNumero(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Complemento" style={{ gridColumn: '2 / span 2' }}>
              <input value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Apto, bloco, referência..." style={inputStyle} />
            </Field>
            <Field label="Bairro">
              <input value={bairro} onChange={e => setBairro(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Cidade">
              <input value={cidade} onChange={e => setCidade(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Estado (UF)">
              <input value={estado} onChange={e => setEstado(e.target.value)} maxLength={2} placeholder="SP" style={inputStyle} />
            </Field>
          </div>
        </div>

        {/* Sub-seção contato de emergência */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ ...sectionHeaderStyle, marginBottom: '12px' }}>
            <span style={{ color: 'var(--sage-dark)', display: 'flex', alignItems: 'center', fontSize: '13px' }}><LifeBuoy size={13} /></span>
            Contato de Emergência
          </div>
          <div style={grid3}>
            <Field label="Nome">
              <input value={emergNome} onChange={e => setEmergNome(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Grau de parentesco">
              <input value={emergParentesco} onChange={e => setEmergParentesco(e.target.value)} placeholder="Mãe, cônjuge..." style={inputStyle} />
            </Field>
            <Field label="Telefone">
              <input value={emergTelefone} onChange={e => setEmergTelefone(e.target.value)} style={inputStyle} />
            </Field>
          </div>
        </div>

        {/* Sub-seção preferências de comunicação */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ ...sectionHeaderStyle, marginBottom: '12px' }}>
            <span style={{ color: 'var(--sage-dark)', display: 'flex', alignItems: 'center', fontSize: '13px' }}><MessageCircle size={13} /></span>
            Preferências de Comunicação
          </div>
          <div style={grid3}>
            <div style={{ gridColumn: '1 / span 2' }}>
              <label style={labelStyle}>Canais preferidos</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {CANAIS_OPTS.map(o => {
                  const ativo = canais.includes(o.value);
                  return (
                    <div
                      key={o.value}
                      onClick={() => toggleCanal(o.value)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
                        borderRadius: 'var(--r-xs)', cursor: 'pointer', fontSize: '12.5px', userSelect: 'none',
                        border: `1px solid ${ativo ? 'var(--sage)' : 'var(--border-md)'}`,
                        color: ativo ? 'var(--sage-dark)' : 'var(--muted)',
                        background: ativo ? 'var(--sage-xlight)' : 'transparent',
                      }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '2px', border: '2px solid currentColor', background: ativo ? 'var(--sage-dark)' : 'transparent', flexShrink: 0 }} />
                      {o.label}
                    </div>
                  );
                })}
              </div>
            </div>
            <Field label="Melhor horário para contato">
              <input value={melhorHorario} onChange={e => setMelhorHorario(e.target.value)} placeholder="Ex: manhã, após 18h..." style={inputStyle} />
            </Field>
          </div>
        </div>

        <SaveBar salvando={salvandoPessoal} saved={savedPessoal} onSave={salvarPessoal} />
      </div>

      {/* ── 2. Financeiro ── */}
      <div style={{ marginBottom: '22px' }}>
        <SectionHeader icon={<CreditCard size={13} />} label="Financeiro" />

        {/* Toggle Particular / Convênio */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {(['particular', 'convenio'] as const).map(t => (
            <div
              key={t}
              onClick={() => setTipo(t)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: 'var(--r-xs)',
                border: `1px solid ${tipo === t ? 'var(--sage)' : 'var(--border-md)'}`,
                cursor: 'pointer',
                fontSize: '12.5px',
                color: tipo === t ? 'var(--sage-dark)' : 'var(--muted)',
                background: tipo === t ? 'var(--sage-xlight)' : 'transparent',
                userSelect: 'none',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  border: '2px solid currentColor',
                  background: tipo === t ? 'var(--sage-dark)' : 'transparent',
                  flexShrink: 0,
                }}
              />
              {t === 'particular' ? 'Particular' : 'Convênio'}
            </div>
          ))}
        </div>

        <div style={grid3}>
          {tipo === 'convenio' ? (
            <>
              <Field label="Nome do convênio">
                <input value={convenioNome} onChange={e => setConvenioNome(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Número da carteirinha">
                <input value={convenioNumero} onChange={e => setConvenioNumero(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Plano">
                <input value={convenioPlano} onChange={e => setConvenioPlano(e.target.value)} placeholder="Ex: Enfermaria, Apartamento..." style={inputStyle} />
              </Field>
              <Field label="Validade da carteirinha">
                <input value={convenioValidade} onChange={e => setConvenioValidade(e.target.value)} type="date" style={inputStyle} />
              </Field>
            </>
          ) : (
            <Field label="Forma de pagamento preferida">
              <input
                value={prefPagamento}
                onChange={e => setPrefPagamento(e.target.value)}
                placeholder="Ex: Cartão de crédito, PIX..."
                style={inputStyle}
              />
            </Field>
          )}
        </div>

        <SaveBar salvando={salvandoFinanceiro} saved={savedFinanceiro} onSave={salvarFinanceiro} />
      </div>

      {/* ── 3. Dados para Nota Fiscal ── */}
      <div style={{ marginBottom: '22px' }}>
        <SectionHeader icon={<FileText size={13} />} label="Dados para Nota Fiscal" />

        <div style={grid3}>
          <Field label="CPF / CNPJ">
            <input value={nfDocumento} onChange={e => setNfDocumento(e.target.value)} placeholder="000.000.000-00" style={inputStyle} />
          </Field>
          <Field label="Razão social / Nome para nota fiscal" style={{ gridColumn: '2 / span 2' }}>
            <input value={nfNome} onChange={e => setNfNome(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase' as const, color: 'var(--muted)' }}>
              Endereço de cobrança
            </span>
            <button
              onClick={copiarEnderecoParaNF}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 600,
                padding: '5px 10px',
                borderRadius: 'var(--r-xs)',
                border: 'none',
                background: 'var(--sage-xlight)',
                color: 'var(--sage-dark)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Copy style={{ width: '11px', height: '11px' }} />
              Copiar do endereço pessoal
            </button>
          </div>
          <div style={grid3}>
            <Field label="Rua" style={{ gridColumn: '1 / span 2' }}>
              <input value={nfRua} onChange={e => setNfRua(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Número">
              <input value={nfNumero} onChange={e => setNfNumero(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Bairro">
              <input value={nfBairro} onChange={e => setNfBairro(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Cidade">
              <input value={nfCidade} onChange={e => setNfCidade(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Estado (UF)">
              <input value={nfEstado} onChange={e => setNfEstado(e.target.value)} maxLength={2} style={inputStyle} />
            </Field>
            <Field label="CEP">
              <input value={nfCep} onChange={e => setNfCep(e.target.value)} style={inputStyle} />
            </Field>
          </div>
        </div>

        <SaveBar salvando={salvandoNF} saved={savedNF} onSave={salvarNF} />
      </div>

      {/* ── 4. Próxima Consulta ── */}
      <div style={{ marginBottom: '22px' }}>
        <SectionHeader icon={<Clock size={13} />} label="Próxima Consulta" />

        {loadingPac ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Loader2 style={{ width: '15px', height: '15px', color: 'var(--muted)' }} className="animate-spin" />
            <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>Carregando...</span>
          </div>
        ) : proximaConsulta ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '14px 16px',
              borderRadius: 'var(--r-sm)',
              background: 'var(--sage-xlight)',
              border: '1px solid var(--border)',
            }}
          >
            {/* Day avatar */}
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'var(--sage-dark)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CalendarDays style={{ width: '18px', height: '18px' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {pcStatus && (
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    color: 'var(--sage-dark)',
                    marginBottom: '3px',
                  }}
                >
                  {pcStatus.label}
                </div>
              )}
              <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink)' }}>
                {format(parseISO(proximaConsulta.data_hora_inicio), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </div>
              {(proximaConsulta.agendas?.nome || proximaConsulta.procedimento_nome) && (
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                  {proximaConsulta.agendas?.nome}
                  {proximaConsulta.agendas?.nome && proximaConsulta.procedimento_nome ? ' · ' : ''}
                  {proximaConsulta.procedimento_nome}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle style={{ width: '15px', height: '15px', color: 'var(--muted)', flexShrink: 0 }} />
            <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>Nenhuma consulta agendada</span>
          </div>
        )}
      </div>

      {/* ── 5. Resumo da Última Conversa (IA) ── */}
      <div style={{ marginBottom: '22px' }}>
        <SectionHeader icon={<Bot size={13} />} label="Resumo da Última Conversa" />

        <div
          style={{
            background: 'var(--champ-light)',
            border: '1px solid var(--champ)',
            borderRadius: 'var(--r-sm)',
            padding: '13px 15px',
          }}
        >
          {/* Header caixa IA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
            <Bot style={{ width: '13px', height: '13px', color: 'var(--champ-text)', flexShrink: 0 }} />
            <span
              style={{
                fontSize: '9.5px',
                fontWeight: 600,
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                color: 'var(--champ-text)',
              }}
            >
              Gerado por IA
            </span>
          </div>

          {resumoIA ? (
            <>
              <p
                style={{
                  fontSize: '12.5px',
                  color: 'var(--ink)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                }}
              >
                {resumoIA}
              </p>
              {resumoIAAt && (
                <p style={{ fontSize: '10.5px', color: 'var(--muted)', marginTop: '8px' }}>
                  {format(new Date(resumoIAAt), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </>
          ) : (
            <p style={{ fontSize: '12.5px', color: 'var(--muted)', fontStyle: 'italic' }}>
              Nenhuma conversa registrada ainda.
            </p>
          )}
        </div>
      </div>

      {/* ── 6. Anotações Gerais ── */}
      <div style={{ marginBottom: '22px' }}>
        <SectionHeader icon={<StickyNote size={13} />} label="Anotações Gerais" />

        {pacienteId ? (
          <PainelAnotacoes pacienteId={pacienteId} tipo="geral" />
        ) : (
          <p style={{ fontSize: '12.5px', color: 'var(--muted)' }}>Carregando...</p>
        )}
      </div>

    </div>
  );
}
