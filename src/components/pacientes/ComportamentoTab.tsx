import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { Loader2, CalendarCheck, CalendarOff, CalendarClock, X, TrendingDown, Star, ThumbsUp, BarChart2 } from 'lucide-react';

interface Props {
  leadId: string;
  pacienteId: string;
}

const EVENTO_CONFIG: Record<string, { label: string; dotColor: string }> = {
  agendado:             { label: 'Agendou',    dotColor: '#60A5FA' },
  confirmado:           { label: 'Confirmou',  dotColor: '#3b82f6' },
  compareceu:           { label: 'Compareceu', dotColor: 'var(--sage-dark)' },
  faltou:               { label: 'Faltou',     dotColor: '#f97316' },
  cancelado:            { label: 'Cancelou',   dotColor: '#ef4444' },
  cancelou_agendamento: { label: 'Cancelou',   dotColor: '#ef4444' },
  reagendado:           { label: 'Remarcou',   dotColor: 'var(--champ-text)' },
};

const SCORES = [
  { key: 'score_sonho',       label: 'Sonho' },
  { key: 'score_contexto',    label: 'Contexto' },
  { key: 'score_obstaculo',   label: 'Obstáculo' },
  { key: 'score_rota',        label: 'Rota' },
  { key: 'score_gatilho',     label: 'Gatilho' },
  { key: 'score_perfil',      label: 'Perfil' },
  { key: 'score_trilha',      label: 'Trilha' },
  { key: 'score_temperatura', label: 'Temperatura' },
];

// ── RFM helpers ──────────────────────────────────────────────────────────────

function rfmRecency(daysSinceLast: number | null): number {
  if (daysSinceLast === null) return 1;
  if (daysSinceLast <= 30) return 5;
  if (daysSinceLast <= 60) return 4;
  if (daysSinceLast <= 90) return 3;
  if (daysSinceLast <= 180) return 2;
  return 1;
}
function rfmFrequency(visits: number): number {
  if (visits >= 5) return 5;
  if (visits === 4) return 4;
  if (visits === 3) return 3;
  if (visits === 2) return 2;
  if (visits === 1) return 1;
  return 0;
}
function rfmMonetary(total: number): number {
  if (total >= 5000) return 5;
  if (total >= 2000) return 4;
  if (total >= 1000) return 3;
  if (total >= 500) return 2;
  if (total > 0) return 1;
  return 0;
}
function rfmSegmento(r: number, f: number): { label: string; bg: string; color: string } {
  if (r >= 4 && f >= 4) return { label: 'Campeão',    bg: 'var(--sage-xlight)',  color: 'var(--sage-dark)'  };
  if (r >= 3 && f >= 3) return { label: 'Fiel',       bg: 'var(--sage-xlight)',  color: 'var(--sage-dark)'  };
  if (r >= 4 && f <= 2) return { label: 'Potencial',  bg: 'var(--champ-light)', color: 'var(--champ-text)' };
  if (r <= 2 && f >= 3) return { label: 'Em risco',   bg: 'var(--rose-light)',  color: 'var(--rose-text)'  };
  return                       { label: 'Adormecido', bg: 'var(--border)',       color: 'var(--muted)'      };
}

// ─────────────────────────────────────────────────────────────────────────────

export function ComportamentoTab({ leadId, pacienteId }: Props) {
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [totalGasto, setTotalGasto] = useState(0);
  const [leadData, setLeadData] = useState<any>(null);
  const [npsData, setNpsData] = useState<any>(null);
  const [csatData, setCsatData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leadId || !pacienteId) return;
    carregarDados();
  }, [leadId, pacienteId]);

  const carregarDados = async () => {
    setLoading(true);
    const [{ data: ags }, { data: procs }, { data: lead }, { data: nps }, { data: csat }] = await Promise.all([
      supabase
        .from('agendamentos')
        .select('*, agendas(nome)')
        .eq('lead_id', leadId)
        .order('data_hora_inicio', { ascending: false }),
      supabase
        .from('procedimentos_paciente')
        .select('valor')
        .eq('paciente_id', pacienteId),
      supabase
        .from('leads')
        .select('score_sonho, score_contexto, score_obstaculo, score_rota, score_gatilho, score_perfil, score_trilha, score_temperatura, canal_preferido')
        .eq('id', leadId)
        .single(),
      supabase
        .from('nps_respostas')
        .select('score, comentario, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('csat_respostas')
        .select('score, comentario, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (ags) setAgendamentos(ags);
    if (procs) setTotalGasto(procs.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0));
    if (lead) setLeadData(lead);
    setNpsData(nps ?? null);
    setCsatData(csat ?? null);
    setLoading(false);
  };

  const contar = (status: string) => agendamentos.filter(a => a.status === status).length;
  const totalAgendamentos = agendamentos.length;
  const totalFaltou = contar('faltou');
  const totalRemarcou = contar('reagendado');
  const totalCancelou = contar('cancelado') + contar('cancelou_agendamento');
  const totalCompareceu = contar('compareceu');
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const ticketMedio = totalCompareceu > 0 ? totalGasto / totalCompareceu : 0;

  const taxaInstabilidade = totalAgendamentos > 0
    ? Math.round((totalRemarcou / totalAgendamentos) * 100)
    : 0;

  const compareceuOrdenados = [...agendamentos]
    .filter(a => a.status === 'compareceu')
    .sort((a, b) => new Date(a.data_hora_inicio).getTime() - new Date(b.data_hora_inicio).getTime());

  let tempoMedioStr = '—';
  if (compareceuOrdenados.length >= 2) {
    const diffs: number[] = [];
    for (let i = 0; i < compareceuOrdenados.length - 1; i++) {
      const d1 = new Date(compareceuOrdenados[i].data_hora_inicio).getTime();
      const d2 = new Date(compareceuOrdenados[i + 1].data_hora_inicio).getTime();
      diffs.push(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
    }
    const media = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    tempoMedioStr = `${Math.round(media)} dias`;
  }

  const hasScores = leadData && SCORES.some(s => leadData[s.key] != null);

  // RFM
  const ultimaConsulta = compareceuOrdenados.length > 0
    ? compareceuOrdenados[compareceuOrdenados.length - 1]
    : null;
  const diasDesdeUltima = ultimaConsulta
    ? Math.floor((Date.now() - new Date(ultimaConsulta.data_hora_inicio).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const rScore = rfmRecency(diasDesdeUltima);
  const fScore = rfmFrequency(totalCompareceu);
  const mScore = rfmMonetary(totalGasto);
  const segmento = rfmSegmento(rScore, fScore);

  // NPS
  const npsScore: number | null = npsData?.score ?? null;
  const npsLabel = npsScore === null ? null : npsScore >= 9 ? 'Promotor' : npsScore >= 7 ? 'Neutro' : 'Detrator';
  const npsCor = npsScore === null ? null : npsScore >= 9 ? { bg: 'var(--sage-xlight)', color: 'var(--sage-dark)' } : npsScore >= 7 ? { bg: 'var(--champ-light)', color: 'var(--champ-text)' } : { bg: 'var(--rose-light)', color: 'var(--rose-text)' };

  // CSAT (1-5 → full stars)
  const csatScore: number | null = csatData?.score ?? null;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--muted)' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        {[
          { label: 'Agendamentos',     value: totalAgendamentos, iconBg: 'var(--sage-xlight)', iconColor: 'var(--sage-dark)',  icon: <CalendarCheck size={15} /> },
          { label: 'Faltas (no-show)', value: totalFaltou,       iconBg: 'var(--rose-light)',  iconColor: 'var(--rose-text)', icon: <CalendarOff size={15} /> },
          { label: 'Remarcações',      value: totalRemarcou,     iconBg: 'var(--champ-light)', iconColor: 'var(--champ-text)', icon: <CalendarClock size={15} /> },
          { label: 'Cancelamentos',    value: totalCancelou,     iconBg: 'var(--rose-light)',  iconColor: 'var(--rose-text)', icon: <X size={15} /> },
        ].map(({ label, value, iconBg, iconColor, icon }) => (
          <div key={label} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '13px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
              {icon}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500 }}>{label}</div>
            <div className="font-display" style={{ fontSize: '24px', fontWeight: 300, color: 'var(--ink)', lineHeight: 1, marginTop: '2px' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Métricas avançadas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '13px' }}>
          <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500, marginBottom: '4px' }}>
            Taxa de instabilidade
          </div>
          <div className="font-display" style={{ fontSize: '24px', fontWeight: 300, lineHeight: 1, color: taxaInstabilidade > 30 ? 'var(--rose-text)' : 'var(--ink)' }}>
            {taxaInstabilidade}%
          </div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px' }}>reagendamentos / total</div>
        </div>
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '13px' }}>
          <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500, marginBottom: '4px' }}>
            Tempo médio entre consultas
          </div>
          <div className="font-display" style={{ fontSize: '22px', fontWeight: 300, color: 'var(--ink)', lineHeight: 1 }}>
            {tempoMedioStr}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px' }}>{compareceuOrdenados.length} consultas realizadas</div>
        </div>
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '13px' }}>
          <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500, marginBottom: '4px' }}>
            Canal preferido
          </div>
          <div style={{ fontSize: '14px', fontWeight: 500, color: leadData?.canal_preferido ? 'var(--ink)' : 'var(--muted)', lineHeight: 1, marginTop: '6px' }}>
            {leadData?.canal_preferido || '—'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px' }}>canal de comunicação</div>
        </div>
      </div>

      {/* Ticket Card */}
      <div style={{ background: 'var(--sage-dark)', borderRadius: 'var(--r-sm)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
            Ticket total na clínica
          </div>
          <div className="font-display" style={{ fontSize: '28px', fontWeight: 300, color: 'white', letterSpacing: '-0.5px' }}>
            {fmtBRL(totalGasto)}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
            {totalCompareceu} consulta{totalCompareceu !== 1 ? 's' : ''} realizada{totalCompareceu !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Ticket médio
          </div>
          <div className="font-display" style={{ fontSize: '20px', color: 'white', fontWeight: 300 }}>
            {fmtBRL(ticketMedio)}
          </div>
        </div>
      </div>

      {/* NPS / CSAT / RFM */}
      {(npsScore !== null || csatScore !== null || totalCompareceu > 0) && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
            <BarChart2 size={13} style={{ color: 'var(--sage-dark)' }} /> NPS · CSAT · RFM
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>

            {/* NPS */}
            <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <ThumbsUp size={12} style={{ color: 'var(--muted)' }} />
                <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--muted)' }}>NPS</span>
              </div>
              {npsScore !== null && npsCor ? (
                <>
                  <div className="font-display" style={{ fontSize: '28px', fontWeight: 300, color: 'var(--ink)', lineHeight: 1 }}>{npsScore}</div>
                  <span style={{ display: 'inline-flex', marginTop: '5px', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 600, background: npsCor.bg, color: npsCor.color }}>{npsLabel}</span>
                </>
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>Aguardando resposta</span>
              )}
            </div>

            {/* CSAT */}
            <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <Star size={12} style={{ color: 'var(--muted)' }} />
                <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--muted)' }}>CSAT</span>
              </div>
              {csatScore !== null ? (
                <>
                  <div style={{ display: 'flex', gap: '2px', marginBottom: '3px' }}>
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} size={16} style={{ color: n <= csatScore ? 'var(--champ-text)' : 'var(--border-md)', fill: n <= csatScore ? 'var(--champ-text)' : 'transparent' }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{csatScore}/5</span>
                </>
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>Aguardando resposta</span>
              )}
            </div>

            {/* RFM */}
            <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <BarChart2 size={12} style={{ color: 'var(--muted)' }} />
                <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--muted)' }}>RFM</span>
              </div>
              <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: segmento.bg, color: segmento.color, marginBottom: '6px' }}>
                {segmento.label}
              </span>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                {[{ l: 'R', v: rScore }, { l: 'F', v: fScore }, { l: 'M', v: mScore }].map(({ l, v }) => (
                  <div key={l} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: 'var(--muted)', fontWeight: 600 }}>{l}</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Método SCORE */}
      {hasScores && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
            <TrendingDown size={13} style={{ color: 'var(--sage-dark)' }} /> Método SCORE — perfil do lead
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {SCORES.map(({ key, label }) => {
              const val = leadData?.[key];
              if (val == null) return null;
              const pct = Math.min(100, Math.max(0, (val / 10) * 100));
              return (
                <div key={key} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', padding: '10px 12px' }}>
                  <div style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>{label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--sage-dark)', borderRadius: '2px' }} />
                    </div>
                    <span className="font-display" style={{ fontSize: '14px', fontWeight: 300, color: 'var(--ink)', flexShrink: 0 }}>{val}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Linha do Tempo */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
          <CalendarCheck size={13} style={{ color: 'var(--sage-dark)' }} /> Linha do tempo
        </div>

        {agendamentos.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', gap: '10px', textAlign: 'center' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--sage-xlight)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CalendarCheck size={16} style={{ color: 'var(--sage)' }} />
            </div>
            <p style={{ fontSize: '12px', color: 'var(--muted)' }}>Nenhum evento registrado ainda</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {agendamentos.map((ag, idx) => {
              const cfg = EVENTO_CONFIG[ag.status] || EVENTO_CONFIG.agendado;
              const data = ag.data_hora_inicio
                ? format(parseISO(ag.data_hora_inicio), "dd/MM/yyyy '·' HH'h'mm", { locale: ptBR })
                : '—';
              const isLast = idx === agendamentos.length - 1;
              return (
                <div key={ag.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.dotColor, marginTop: '4px', flexShrink: 0 }} />
                    {!isLast && <div style={{ width: '1px', background: 'var(--border)', flex: 1, minHeight: '24px', margin: '3px 0' }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: isLast ? 0 : '14px' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink)' }}>
                      {cfg.label}{ag.procedimento_nome ? ` — ${ag.procedimento_nome}` : ''}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>{data}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
