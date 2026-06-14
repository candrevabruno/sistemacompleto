import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, CalendarCheck, Stethoscope, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  leadId: string;
}

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  compareceu:           { label: 'Compareceu', bg: 'var(--sage-xlight)',  color: 'var(--sage-dark)'  },
  confirmado:           { label: 'Confirmado',  bg: 'var(--sage-xlight)',  color: 'var(--sage-dark)'  },
  agendado:             { label: 'Agendado',    bg: 'var(--champ-light)', color: 'var(--champ-text)' },
  reagendado:           { label: 'Reagendado',  bg: 'var(--champ-light)', color: 'var(--champ-text)' },
  faltou:               { label: 'Faltou',      bg: 'var(--rose-light)',  color: 'var(--rose-text)'  },
  cancelado:            { label: 'Cancelado',   bg: 'var(--rose-light)',  color: 'var(--rose-text)'  },
  cancelou_agendamento: { label: 'Cancelado',   bg: 'var(--rose-light)',  color: 'var(--rose-text)'  },
};

interface Episodio {
  key: string;
  vigente: any;
  historico: any[]; // reagendamentos anteriores (mais recente -> mais antigo)
}

export function ConsultasTab({ leadId }: Props) {
  const [episodios, setEpisodios] = useState<Episodio[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('agendamentos')
        .select('*, agendas(nome, cor)')
        .eq('lead_id', leadId)
        .order('data_hora_inicio', { ascending: false });

      // Agrupa por episódio (item 1: reagendamento não duplica a lista).
      const grupos = new Map<string, any[]>();
      (data || []).forEach(ag => {
        const k = ag.episodio_id || `solo-${ag.id}`;
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k)!.push(ag);
      });

      const eps: Episodio[] = Array.from(grupos.entries()).map(([key, ags]) => {
        // Vigente = registro com a data mais recente (a marcação atual do episódio).
        const ordenados = [...ags].sort((a, b) =>
          new Date(b.data_hora_inicio || 0).getTime() - new Date(a.data_hora_inicio || 0).getTime());
        return { key, vigente: ordenados[0], historico: ordenados.slice(1) };
      });

      // Episódios ordenados pela data vigente, mais recente primeiro.
      eps.sort((a, b) =>
        new Date(b.vigente.data_hora_inicio || 0).getTime() - new Date(a.vigente.data_hora_inicio || 0).getTime());

      setEpisodios(eps);
      setLoading(false);
    }
    load();
  }, [leadId]);

  const toggle = (key: string) => {
    setExpandido(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--muted)' }} />
      </div>
    );
  }

  if (episodios.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '52px 24px', gap: '10px', textAlign: 'center' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--sage-xlight)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CalendarCheck size={18} style={{ color: 'var(--sage-dark)' }} />
        </div>
        <p className="font-display" style={{ fontSize: '17px', fontStyle: 'italic', fontWeight: 300, color: 'var(--muted)' }}>
          Nenhuma consulta registrada
        </p>
        <p style={{ fontSize: '12px', color: 'var(--muted)', opacity: 0.7 }}>O histórico de consultas e agendamentos aparecerá aqui</p>
      </div>
    );
  }

  const fmtBRL = (v: number | null | undefined) =>
    v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

  const fmtData = (iso: string | null) =>
    iso ? format(parseISO(iso), "dd MMM yyyy '·' HH'h'mm", { locale: ptBR }) : '—';

  return (
    <div style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
        <Stethoscope size={13} style={{ color: 'var(--sage-dark)' }} /> Histórico de consultas
      </div>

      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Data', 'Profissional', 'Serviço', 'Status', 'Valor'].map(h => (
                <th key={h} style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--muted)', padding: '8px 14px', textAlign: 'left', borderBottom: '1px solid var(--border)', background: 'var(--bg)', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {episodios.map((ep, index) => {
              const ag = ep.vigente;
              const badge = STATUS_BADGE[ag.status] || STATUS_BADGE.agendado;
              const isLast = index === episodios.length - 1 && !expandido.has(ep.key);
              const temHistorico = ep.historico.length > 0;
              const aberto = expandido.has(ep.key);
              const tdStyle: React.CSSProperties = { padding: '11px 14px', borderBottom: isLast ? 'none' : '1px solid var(--border)' };

              return (
                <React.Fragment key={ep.key}>
                  <tr>
                    <td style={{ ...tdStyle, fontSize: '12.5px', color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {temHistorico ? (
                          <button
                            onClick={() => toggle(ep.key)}
                            title={`${ep.historico.length} reagendamento(s)`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--champ-text)', fontFamily: 'inherit', padding: 0 }}
                          >
                            {aberto ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </button>
                        ) : <span style={{ width: 13, display: 'inline-block' }} />}
                        {fmtData(ag.data_hora_inicio)}
                      </span>
                      {temHistorico && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '6px', fontSize: '9.5px', fontWeight: 600, color: 'var(--champ-text)', background: 'var(--champ-light)', padding: '1px 6px', borderRadius: '10px' }}>
                          <RotateCcw size={9} /> {ep.historico.length}x
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, fontSize: '12px', color: 'var(--muted)' }}>
                      {ag.agendas?.nome ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          {ag.agendas.cor && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: ag.agendas.cor, flexShrink: 0 }} />}
                          {ag.agendas.nome}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ ...tdStyle, fontSize: '12.5px', color: 'var(--ink)' }}>{ag.procedimento_nome || '—'}</td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 500, background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: '12.5px', fontWeight: 500, color: ag.valor_cobrado ? 'var(--sage-dark)' : 'var(--muted)' }}>
                      {fmtBRL(ag.valor_cobrado)}
                    </td>
                  </tr>

                  {/* Histórico de reagendamentos do episódio */}
                  {aberto && ep.historico.map((h, hi) => {
                    const hb = STATUS_BADGE[h.status] || STATUS_BADGE.reagendado;
                    const hLast = index === episodios.length - 1 && hi === ep.historico.length - 1;
                    const htd: React.CSSProperties = { padding: '8px 14px', borderBottom: hLast ? 'none' : '1px solid var(--border)', background: 'var(--bg)' };
                    return (
                      <tr key={h.id}>
                        <td style={{ ...htd, fontSize: '11.5px', color: 'var(--muted)', whiteSpace: 'nowrap', paddingLeft: '33px' }}>
                          <span style={{ opacity: 0.85 }}>↳ {fmtData(h.data_hora_inicio)}</span>
                        </td>
                        <td style={{ ...htd, fontSize: '11px', color: 'var(--muted)' }}>{h.agendas?.nome || '—'}</td>
                        <td style={{ ...htd, fontSize: '11.5px', color: 'var(--muted)' }}>{h.procedimento_nome || '—'}</td>
                        <td style={htd}>
                          <span style={{ display: 'inline-flex', padding: '1px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 500, background: hb.bg, color: hb.color, opacity: 0.85 }}>
                            {hb.label}
                          </span>
                        </td>
                        <td style={{ ...htd, fontSize: '11.5px', color: 'var(--muted)' }}>{fmtBRL(h.valor_cobrado)}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
        Cada linha é um episódio de atendimento. Reagendamentos ficam agrupados — clique no <ChevronRight size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> para ver o histórico.
      </p>
    </div>
  );
}
