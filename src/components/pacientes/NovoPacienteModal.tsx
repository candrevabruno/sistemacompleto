import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, UserPlus, AlertTriangle, CheckCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (leadId: string) => void;
}

// Origem do cadastro manual — canal real ou marcação genérica.
// NÃO entra no funil de leads (cadastro_manual=true), logo não conta como conversão.
const ORIGEM_OPTS = [
  { value: 'cadastro_manual', label: 'Cadastro manual' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'presencial', label: 'Presencial' },
];

async function buscarViaCep(cep: string) {
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

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', border: '1px solid var(--border-md)',
  borderRadius: 'var(--r-xs)', fontSize: '12.5px', color: 'var(--ink)',
  fontFamily: 'inherit', background: 'var(--white)', outline: 'none', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase',
  color: 'var(--muted)', display: 'block', marginBottom: '5px',
};
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 14px' };
const sectionTitle: React.CSSProperties = {
  fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase',
  color: 'var(--muted)', marginBottom: '10px', marginTop: '18px',
  paddingBottom: '6px', borderBottom: '1px solid var(--border)',
};

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export function NovoPacienteModal({ isOpen, onClose, onSuccess }: Props) {
  const { user } = useAuth();

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [dataNasc, setDataNasc] = useState('');
  const [origem, setOrigem] = useState('cadastro_manual');

  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);

  const [tipo, setTipo] = useState<'particular' | 'convenio'>('particular');
  const [convenioNome, setConvenioNome] = useState('');
  const [convenioNumero, setConvenioNumero] = useState('');

  const [cpf, setCpf] = useState('');
  const [nfNome, setNfNome] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [duplicado, setDuplicado] = useState<{ nome: string } | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const onCepBlur = async () => {
    if (cep.replace(/\D/g, '').length !== 8) return;
    setBuscandoCep(true);
    const r = await buscarViaCep(cep);
    setBuscandoCep(false);
    if (r) { setRua(r.rua || rua); setBairro(r.bairro || bairro); setCidade(r.cidade || cidade); setEstado(r.estado || estado); }
  };

  const telDigits = telefone.replace(/\D/g, '');

  const criar = async (ignorarDuplicado = false) => {
    setErro(null);
    if (!nome.trim()) { setErro('Nome é obrigatório.'); return; }
    if (telDigits.length < 10) { setErro('Telefone/WhatsApp inválido (mínimo 10 dígitos).'); return; }
    if (!user) { setErro('Sessão expirada.'); return; }

    setSalvando(true);

    // Dedup por telefone (a não ser que o usuário já tenha confirmado).
    if (!ignorarDuplicado) {
      const { data: existente } = await supabase
        .from('leads')
        .select('id, nome_lead')
        .or(`whatsapp_lead.eq.${telDigits},whatsapp_lead.ilike.%${telDigits}%`)
        .limit(1)
        .maybeSingle();
      if (existente) {
        setDuplicado({ nome: existente.nome_lead || 'sem nome' });
        setSalvando(false);
        return;
      }
    }

    try {
      // Lead marcado como cadastro_manual → fora do funil/conversão.
      const { data: lead, error: leadErr } = await supabase
        .from('leads')
        .insert({
          nome_lead: nome.trim(),
          whatsapp_lead: telDigits,
          email: email || null,
          data_nascimento: dataNasc || null,
          status: 'converteu',
          converteu_em: new Date().toISOString(),
          converteu_por: user.id,
          cadastro_manual: true,
          origem,
        })
        .select('id')
        .single();
      if (leadErr || !lead) throw leadErr || new Error('Falha ao criar lead');

      const temEndereco = rua || cidade || cep;
      await supabase.from('pacientes').insert({
        lead_id: lead.id,
        tipo,
        possui_convenio: tipo === 'convenio',
        convenio_nome: tipo === 'convenio' ? (convenioNome || null) : null,
        convenio_numero: tipo === 'convenio' ? (convenioNumero || null) : null,
        cpf: cpf || null,
        nf_documento: cpf || null,
        nf_nome: nfNome || null,
        como_conheceu: origem === 'indicacao' ? 'indicacao' : null,
        origem_detalhe: origem,
        endereco: temEndereco ? { rua, numero, complemento, bairro, cidade, estado, cep } : null,
      });

      setSucesso(true);
      setSalvando(false);
      setTimeout(() => onSuccess(lead.id), 1200);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao cadastrar paciente.');
      setSalvando(false);
    }
  };

  const btnPrimary: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 18px', fontSize: '12.5px',
    fontWeight: 600, background: 'var(--sage-dark)', color: 'white', border: 'none',
    borderRadius: 'var(--r-xs)', cursor: 'pointer', fontFamily: 'inherit',
  };
  const btnGhost: React.CSSProperties = {
    padding: '7px 14px', fontSize: '12.5px', fontWeight: 500, background: 'transparent',
    color: 'var(--muted)', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)',
    cursor: 'pointer', fontFamily: 'inherit',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adicionar paciente"
      className="max-w-xl mx-4"
      footer={
        sucesso ? (
          <button onClick={onClose} style={btnPrimary}>Fechar</button>
        ) : duplicado ? (
          <>
            <button onClick={() => setDuplicado(null)} style={btnGhost}>Voltar</button>
            <button onClick={() => { setDuplicado(null); criar(true); }} style={{ ...btnPrimary, background: 'var(--champ-text)' }}>
              Cadastrar mesmo assim
            </button>
          </>
        ) : (
          <>
            <button onClick={onClose} style={btnGhost} disabled={salvando}>Cancelar</button>
            <button onClick={() => criar(false)} style={{ ...btnPrimary, opacity: salvando ? 0.6 : 1 }} disabled={salvando}>
              {salvando ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
              Cadastrar paciente
            </button>
          </>
        )
      }
    >
      {sucesso ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '16px 0', textAlign: 'center' }}>
          <CheckCircle size={40} style={{ color: 'var(--sage-dark)' }} />
          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>Paciente cadastrado!</p>
          <p style={{ fontSize: '12px', color: 'var(--muted)' }}>Ele já aparece na lista de pacientes.</p>
        </div>
      ) : duplicado ? (
        <div style={{ display: 'flex', gap: '12px', padding: '8px 0' }}>
          <AlertTriangle size={22} style={{ color: 'var(--champ-text)', flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
              Já existe um cadastro com esse telefone
            </p>
            <p style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.5 }}>
              O número <strong>{telDigits}</strong> já pertence a <strong>{duplicado.nome}</strong>.
              Cadastrar de novo cria um paciente duplicado. Confirme apenas se tiver certeza de que são pessoas diferentes.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
          {erro && (
            <p style={{ fontSize: '12px', color: 'var(--rose-text)', background: 'var(--rose-light)', padding: '8px 11px', borderRadius: 'var(--r-xs)', marginBottom: '12px' }}>
              {erro}
            </p>
          )}

          {/* Dados básicos */}
          <div style={grid2}>
            <Field label="Nome completo *" full>
              <input value={nome} onChange={e => setNome(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Telefone / WhatsApp *">
              <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="5511999990000" style={inputStyle} />
            </Field>
            <Field label="E-mail">
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inputStyle} />
            </Field>
            <Field label="Data de nascimento">
              <input value={dataNasc} onChange={e => setDataNasc(e.target.value)} type="date" style={inputStyle} />
            </Field>
            <Field label="Origem">
              <select value={origem} onChange={e => setOrigem(e.target.value)} style={inputStyle}>
                {ORIGEM_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>

          {/* Endereço */}
          <div style={sectionTitle}>Endereço</div>
          <div style={grid2}>
            <Field label={buscandoCep ? 'CEP (buscando...)' : 'CEP'}>
              <input value={cep} onChange={e => setCep(e.target.value)} onBlur={onCepBlur} placeholder="00000-000" style={inputStyle} />
            </Field>
            <Field label="Rua">
              <input value={rua} onChange={e => setRua(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Número">
              <input value={numero} onChange={e => setNumero(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Complemento">
              <input value={complemento} onChange={e => setComplemento(e.target.value)} style={inputStyle} />
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

          {/* Financeiro */}
          <div style={sectionTitle}>Financeiro</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {(['particular', 'convenio'] as const).map(t => (
              <div
                key={t}
                onClick={() => setTipo(t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
                  borderRadius: 'var(--r-xs)', cursor: 'pointer', fontSize: '12.5px', userSelect: 'none',
                  border: `1px solid ${tipo === t ? 'var(--sage)' : 'var(--border-md)'}`,
                  color: tipo === t ? 'var(--sage-dark)' : 'var(--muted)',
                  background: tipo === t ? 'var(--sage-xlight)' : 'transparent',
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', border: '2px solid currentColor', background: tipo === t ? 'var(--sage-dark)' : 'transparent', flexShrink: 0 }} />
                {t === 'particular' ? 'Particular' : 'Convênio'}
              </div>
            ))}
          </div>
          {tipo === 'convenio' && (
            <div style={grid2}>
              <Field label="Nome do convênio">
                <input value={convenioNome} onChange={e => setConvenioNome(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Número da carteirinha">
                <input value={convenioNumero} onChange={e => setConvenioNumero(e.target.value)} style={inputStyle} />
              </Field>
            </div>
          )}

          {/* Nota fiscal */}
          <div style={sectionTitle}>Nota Fiscal</div>
          <div style={grid2}>
            <Field label="CPF / CNPJ">
              <input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" style={inputStyle} />
            </Field>
            <Field label="Nome para nota fiscal">
              <input value={nfNome} onChange={e => setNfNome(e.target.value)} style={inputStyle} />
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}
