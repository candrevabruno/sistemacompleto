import React, { useState, useEffect } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { Loader2, Lock, Star, ChevronDown, ChevronRight, ClipboardList, Sparkles, Crown, CalendarCheck, FileText, MessageSquare, RotateCcw } from 'lucide-react';
import { ResumoConsultaSection } from './ResumoConsultaSection';

interface Props {
  pacienteId: string;
  leadId?: string;
  nomePaciente?: string;
}

type SubTab = 'pre' | 'pos' | 'jornada';

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

// ── Jornada Premium ───────────────────────────────────────────────────────────

interface JItem {
  tipo: 'consulta' | 'tally' | 'resumo' | 'csat' | 'nps' | 'reativacao';
  data: string;
  label: string;
  sublabel?: string;
  score?: number;
  scoreMax?: number;
  status?: string; // para consultas
}

const TIPO_CONFIG: Record<JItem['tipo'], { icon: React.ReactNode; cor: string; badge: string }> = {
  consulta:   { icon: <CalendarCheck size={13} />,  cor: 'var(--sage-dark)',  badge: 'var(--sage-xlight)' },
  tally:      { icon: <ClipboardList size={13} />,  cor: 'var(--sage)',       badge: 'var(--sage-xlight)' },
  resumo:     { icon: <FileText size={13} />,       cor: '#6366F1',           badge: '#EEF2FF' },
  csat:       { icon: <Star size={13} />,           cor: 'var(--champ-text)', badge: 'var(--champ-light)' },
  nps:        { icon: <MessageSquare size={13} />,  cor: '#7C3AED',           badge: '#F3E8FF' },
  reativacao: { icon: <RotateCcw size={13} />,      cor: '#0369A1',           badge: '#E0F2FE' },
};

function JornadaPremiumTab({ pacienteId, leadId }: { pacienteId: string; leadId?: string }) {
  const [itens, setItens] = useState<JItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pacienteId) return;
    carregarJornada();
  }, [pacienteId, leadId]);

  const carregarJornada = async () => {
    setLoading(true);
    const todas: JItem[] = [];

    const [agRes, tallyRes, resumoRes, csatRes, npsRes, reativRes] = await Promise.all([
      leadId
        ? supabase.from('agendamentos').select('id,data_hora_inicio,status,procedimento_nome').eq('lead_id', leadId).order('data_hora_inicio')
        : Promise.resolve({ data: [] }),
      supabase.from('tally_respostas').select('id,created_at').eq('paciente_id', pacienteId).order('created_at'),
      supabase.from('anotacoes_paciente').select('id,created_at,autor_nome').eq('paciente_id', pacienteId).eq('tipo', 'resumo_consulta').order('created_at'),
      leadId
        ? supabase.from('csat_respostas').select('id,score,created_at').eq('lead_id', leadId).order('created_at')
        : supabase.from('csat_respostas').select('id,score,created_at').eq('paciente_id', pacienteId).order('created_at'),
      leadId
        ? supabase.from('nps_respostas').select('id,score,created_at').eq('lead_id', leadId).order('created_at')
        : supabase.from('nps_respostas').select('id,score,created_at').eq('paciente_id', pacienteId).order('created_at'),
      leadId
        ? supabase.from('integration_log').select('id,mensagem,criado_em').eq('servico', 'n8n_intake').ilike('mensagem', `%Reativação%`).ilike('mensagem', `%${leadId}%`).order('criado_em')
        : Promise.resolve({ data: [] }),
    ]);

    (agRes.data || []).forEach((a: any) => {
      const STATUS_PT: Record<string, string> = { agendado: 'Agendada', compareceu: 'Compareceu', cancelado: 'Cancelada', reagendado: 'Reagendada', faltou: 'Faltou' };
      todas.push({ tipo: 'consulta', data: a.data_hora_inicio, label: a.procedimento_nome || 'Consulta', sublabel: STATUS_PT[a.status] || a.status, status: a.status });
    });
    (tallyRes.data || []).forEach((r: any) => {
      todas.push({ tipo: 'tally', data: r.created_at, label: 'Anamnese preenchida', sublabel: 'Formulário Tally recebido' });
    });
    (resumoRes.data || []).forEach((r: any) => {
      todas.push({ tipo: 'resumo', data: r.created_at, label: 'Resumo da consulta', sublabel: r.autor_nome ? `Por ${r.autor_nome}` : undefined });
    });
    (csatRes.data || []).forEach((r: any) => {
      const tipo = r.score >= 4 ? 'promotor' : r.score >= 3 ? 'neutro' : 'detrator';
      todas.push({ tipo: 'csat', data: r.created_at, label: `CSAT: ${r.score}/5`, sublabel: tipo === 'promotor' ? '😊 Satisfeito' : tipo === 'neutro' ? '😐 Neutro' : '😞 Insatisfeito', score: r.score, scoreMax: 5 });
    });
    (npsRes.data || []).forEach((r: any) => {
      const tipo = r.score >= 9 ? 'promotor' : r.score >= 7 ? 'neutro' : 'detrator';
      todas.push({ tipo: 'nps', data: r.created_at, label: `NPS: ${r.score}/10`, sublabel: tipo === 'promotor' ? '⭐ Promotor' : tipo === 'neutro' ? '😐 Neutro' : '👎 Detrator', score: r.score, scoreMax: 10 });
    });
    (reativRes.data || []).forEach((r: any) => {
      const aceita = r.mensagem?.includes('aceita');
      todas.push({ tipo: 'reativacao', data: r.criado_em, label: aceita ? 'Reativação aceita' : 'Tentativa de reativação', sublabel: 'Fluxo pós-consulta (60d / 180d)' });
    });

    todas.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
    setItens(todas);
    setLoading(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
      <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--muted)' }} />
    </div>
  );

  if (itens.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', gap: '10px', textAlign: 'center' }}>
      <Crown size={32} style={{ color: 'var(--champ-text)', opacity: 0.4 }} />
      <p className="font-display" style={{ fontSize: '16px', fontStyle: 'italic', fontWeight: 300, color: 'var(--muted)' }}>
        Nenhum evento registrado ainda
      </p>
      <p style={{ fontSize: '11.5px', color: 'var(--muted)', opacity: 0.7 }}>
        A jornada aparece conforme as consultas e fluxos pós-consulta forem sendo realizados
      </p>
    </div>
  );

  return (
    <div style={{ padding: '20px 22px' }}>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: '15px', top: '4px', bottom: '4px', width: '1px', background: 'var(--border)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {itens.map((item, idx) => {
            const cfg = TIPO_CONFIG[item.tipo];
            const isConsulta = item.tipo === 'consulta';
            return (
              <div key={idx} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', position: 'relative' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: cfg.badge, color: cfg.cor, zIndex: 1, border: `1.5px solid ${cfg.cor}22` }}>
                  {cfg.icon}
                </div>
                <div style={{ flex: 1, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', borderLeft: `3px solid ${cfg.cor}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div>
                      <p style={{ fontSize: '12.5px', fontWeight: 600, color: isConsulta ? cfg.cor : 'var(--ink)' }}>{item.label}</p>
                      {item.sublabel && <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{item.sublabel}</p>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
                        {format(parseISO(item.data), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                      <p style={{ fontSize: '10px', color: 'var(--muted)', opacity: 0.7 }}>
                        {format(parseISO(item.data), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
          { id: 'jornada' as SubTab, label: 'Jornada Premium', crown: true },
        ]).map(st => (
          <button
            key={st.id}
            onClick={() => setSubTab(st.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
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
            {'crown' in st && st.crown && <Crown size={11} style={{ color: 'var(--champ-text)', opacity: 0.8 }} />}
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

      {subTab === 'jornada' && (
        <JornadaPremiumTab pacienteId={pacienteId} leadId={leadId} />
      )}
    </div>
  );
}
