import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, CalendarCheck, Stethoscope } from 'lucide-react';
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

export function ConsultasTab({ leadId }: Props) {
  const [consultas, setConsultas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('agendamentos')
        .select('*, agendas(nome, cor)')
        .eq('lead_id', leadId)
        .order('data_hora_inicio', { ascending: false });
      if (data) setConsultas(data);
      setLoading(false);
    }
    load();
  }, [leadId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--muted)' }} />
      </div>
    );
  }

  if (consultas.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '52px 24px', gap: '10px', textAlign: 'center' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--sage-xlight)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CalendarCheck size={18} style={{ color: 'var(--sage-dark)' }} />
        </div>
        <p className="font-display" style={{ fontSize: '17px', fontStyle: 'italic', fontWeight: 300, color: 'var(--muted)' }}>
          Nenhum agendamento ainda
        </p>
        <p style={{ fontSize: '12px', color: 'var(--muted)', opacity: 0.7 }}>O histórico de consultas e agendamentos aparecerá aqui</p>
      </div>
    );
  }

  const fmtBRL = (v: number | null | undefined) =>
    v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

  return (
    <div style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
        <Stethoscope size={13} style={{ color: 'var(--sage-dark)' }} /> Histórico de agendamentos
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
            {consultas.map((ag, index) => {
              const badge = STATUS_BADGE[ag.status] || STATUS_BADGE.agendado;
              const isLast = index === consultas.length - 1;
              const tdStyle: React.CSSProperties = {
                padding: '11px 14px',
                borderBottom: isLast ? 'none' : '1px solid var(--border)',
              };

              return (
                <tr key={ag.id}>
                  <td style={{ ...tdStyle, fontSize: '12.5px', color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                    {ag.data_hora_inicio
                      ? format(parseISO(ag.data_hora_inicio), "dd MMM yyyy '·' HH'h'mm", { locale: ptBR })
                      : '—'}
                  </td>
                  <td style={{ ...tdStyle, fontSize: '12px', color: 'var(--muted)' }}>
                    {ag.agendas?.nome
                      ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          {ag.agendas.cor && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: ag.agendas.cor, flexShrink: 0 }} />}
                          {ag.agendas.nome}
                        </span>
                      )
                      : '—'}
                  </td>
                  <td style={{ ...tdStyle, fontSize: '12.5px', color: 'var(--ink)' }}>
                    {ag.procedimento_nome || '—'}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 500, background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontSize: '12.5px', fontWeight: 500, color: ag.valor_cobrado ? 'var(--sage-dark)' : 'var(--muted)' }}>
                    {fmtBRL(ag.valor_cobrado)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
