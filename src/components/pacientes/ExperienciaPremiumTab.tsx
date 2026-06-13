import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { Loader2, Lock, Star, ChevronDown, ChevronRight, ClipboardList, Sparkles } from 'lucide-react';
import { ResumoConsultaSection } from './ResumoConsultaSection';

interface Props {
  pacienteId: string;
  leadId?: string;
  nomePaciente?: string;
}

type SubTab = 'pre' | 'pos';

interface TallyResposta {
  id: string;
  conteudo: object;
  resumo_ia: string | null;
  created_at: string;
}

// Número WhatsApp da Heroic Leap para solicitar upgrade
const HEROIC_LEAP_WHATSAPP = '5511999999999';
const UPGRADE_MSG = encodeURIComponent('Olá! Gostaria de solicitar acesso à Experiência Premium no sistema da clínica.');

function LockedState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '52px 32px', gap: '16px', textAlign: 'center' }}>
      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--champ-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Star size={24} style={{ color: 'var(--champ-text)' }} />
      </div>
      <div>
        <p className="font-display" style={{ fontSize: '20px', fontStyle: 'italic', fontWeight: 300, color: 'var(--ink)', marginBottom: '6px' }}>
          Experiência Premium
        </p>
        <p style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '280px' }}>
          Pré-consulta via Tally, resumo gerado por IA e envio automatizado para o paciente.
          Recurso disponível no plano Premium da Heroic Leap.
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: 'var(--r-xs)', background: 'var(--border)', borderLeft: '3px solid var(--champ-text)' }}>
        <Lock size={12} style={{ color: 'var(--champ-text)', flexShrink: 0 }} />
        <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
          Liberado pela Heroic Leap · Controlado pelo admin da clínica
        </span>
      </div>
      <a
        href={`https://wa.me/${HEROIC_LEAP_WHATSAPP}?text=${UPGRADE_MSG}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          background: 'var(--sage-dark)', color: 'white',
          padding: '9px 18px', borderRadius: 'var(--r-xs)',
          fontSize: '13px', fontWeight: 600, textDecoration: 'none', fontFamily: 'inherit',
        }}
      >
        <Sparkles size={14} />
        Solicitar acesso Premium
      </a>
    </div>
  );
}

function RespostaCard({ resposta }: { resposta: TallyResposta }) {
  const [expandido, setExpandido] = useState(false);
  const campos = Object.entries(resposta.conteudo || {});

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', overflow: 'hidden' }}>
      {/* Header clicável */}
      <button
        onClick={() => setExpandido(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
      >
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--ink)' }}>
          Formulário de pré-consulta
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
            {format(new Date(resposta.created_at), "dd/MM/yyyy '·' HH:mm", { locale: ptBR })}
          </span>
          {expandido
            ? <ChevronDown size={14} style={{ color: 'var(--muted)' }} />
            : <ChevronRight size={14} style={{ color: 'var(--muted)' }} />}
        </div>
      </button>

      {/* Campos colapsáveis */}
      {expandido && campos.length > 0 && (
        <div style={{ padding: '0 14px 12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {campos.map(([key, val]) => (
              <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '8px', fontSize: '12px' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{key}</span>
                <span style={{ color: 'var(--ink)' }}>{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resumo IA */}
      {resposta.resumo_ia && (
        <div style={{ margin: '0 14px 12px', padding: '9px 12px', background: 'var(--sage-xlight)', borderRadius: 'var(--r-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--sage-dark)', marginBottom: '5px' }}>
            <Sparkles size={11} />
            Resumo gerado pela IA
          </div>
          <p style={{ fontSize: '12px', color: 'var(--ink)', lineHeight: 1.6 }}>{resposta.resumo_ia}</p>
        </div>
      )}
    </div>
  );
}

export function ExperienciaPremiumTab({ pacienteId, leadId, nomePaciente }: Props) {
  const [premiumEnabled, setPremiumEnabled] = useState<boolean | null>(null);
  const [subTab, setSubTab] = useState<SubTab>('pre');
  const [respostas, setRespostas] = useState<TallyResposta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pacienteId) return;
    carregarDados();
  }, [pacienteId]);

  const carregarDados = async () => {
    setLoading(true);
    const [{ data: config }, { data: resp }] = await Promise.all([
      supabase.from('clinic_config').select('premium_enabled').single(),
      supabase
        .from('tally_respostas')
        .select('id, conteudo, resumo_ia, created_at')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false }),
    ]);
    setPremiumEnabled(config?.premium_enabled ?? false);
    if (resp) setRespostas(resp);
    setLoading(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--muted)' }} />
      </div>
    );
  }

  if (!premiumEnabled) return <LockedState />;

  return (
    <div style={{ padding: '20px 22px' }}>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
        {([
          { id: 'pre' as SubTab, label: 'Pré-consulta' },
          { id: 'pos' as SubTab, label: 'Pós-consulta' },
        ]).map(st => (
          <button
            key={st.id}
            onClick={() => setSubTab(st.id)}
            style={{
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight: subTab === st.id ? 600 : 400,
              color: subTab === st.id ? 'var(--sage-dark)' : 'var(--muted)',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${subTab === st.id ? 'var(--sage-dark)' : 'transparent'}`,
              marginBottom: '-1px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {st.label}
          </button>
        ))}
      </div>

      {subTab === 'pre' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
            <ClipboardList size={13} style={{ color: 'var(--sage-dark)' }} /> Formulários recebidos via Tally
          </div>
          {respostas.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px', gap: '10px', textAlign: 'center' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--champ-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClipboardList size={18} style={{ color: 'var(--champ-text)' }} />
              </div>
              <p className="font-display" style={{ fontSize: '16px', fontStyle: 'italic', fontWeight: 300, color: 'var(--muted)' }}>
                Nenhum formulário recebido ainda
              </p>
              <p style={{ fontSize: '11.5px', color: 'var(--muted)', opacity: 0.8 }}>
                Os formulários preenchidos pelo paciente via Tally aparecerão aqui
              </p>
            </div>
          ) : (
            respostas.map(r => <RespostaCard key={r.id} resposta={r} />)
          )}
        </div>
      )}

      {subTab === 'pos' && (
        <ResumoConsultaSection
          pacienteId={pacienteId}
          leadId={leadId}
          nomePaciente={nomePaciente}
        />
      )}
    </div>
  );
}
