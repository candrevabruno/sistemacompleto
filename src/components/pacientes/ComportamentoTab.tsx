import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { Loader2, CalendarCheck, CalendarOff, CalendarClock, X, Timeline } from 'lucide-react';

interface Props {
  leadId: string;
  pacienteId: string;
}

const EVENTO_CONFIG: Record<string, { label: string; dotColor: string }> = {
  agendado:              { label: 'Agendou',    dotColor: '#60A5FA' },
  confirmado:            { label: 'Confirmou',  dotColor: '#3b82f6' },
  compareceu:            { label: 'Compareceu', dotColor: 'var(--sage-dark)' },
  faltou:                { label: 'Faltou',     dotColor: '#f97316' },
  cancelado:             { label: 'Cancelou',   dotColor: '#ef4444' },
  cancelou_agendamento:  { label: 'Cancelou',   dotColor: '#ef4444' },
  reagendado:            { label: 'Remarcou',   dotColor: 'var(--champ)' },
};

export function ComportamentoTab({ leadId, pacienteId }: Props) {
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [totalGasto, setTotalGasto] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leadId || !pacienteId) return;
    carregarDados();
  }, [leadId, pacienteId]);

  const carregarDados = async () => {
    setLoading(true);
    const [{ data: ags }, { data: procs }] = await Promise.all([
      supabase.from('agendamentos').select('*, agendas(nome)').eq('lead_id', leadId).order('data_hora_inicio', { ascending: false }),
      supabase.from('procedimentos_paciente').select('valor').eq('paciente_id', pacienteId),
    ]);
    if (ags) setAgendamentos(ags);
    if (procs) setTotalGasto(procs.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0));
    setLoading(false);
  };

  const contar = (status: string) => agendamentos.filter(a => a.status === status).length;
  const totalAgendamentos = agendamentos.length;
  const totalFaltou = contar('faltou');
  const totalRemarcou = contar('reagendado');
  const totalCancelou = contar('cancelado') + contar('cancelou_agendamento');
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const ticketMedio = totalAgendamentos > 0 ? totalGasto / Math.max(agendamentos.filter(a => a.status === 'compareceu').length, 1) : 0;

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
          { label: 'Agendamentos',  value: totalAgendamentos, iconBg: 'var(--sage-xlight)', iconColor: 'var(--sage-dark)', icon: <CalendarCheck size={15} /> },
          { label: 'Faltas (no-show)', value: totalFaltou,   iconBg: 'var(--rose-light)',  iconColor: 'var(--rose-text)', icon: <CalendarOff size={15} /> },
          { label: 'Remarcações',   value: totalRemarcou,    iconBg: 'var(--champ-light)', iconColor: 'var(--champ-text)', icon: <CalendarClock size={15} /> },
          { label: 'Cancelamentos', value: totalCancelou,    iconBg: '#EFF6FF',            iconColor: '#1D4ED8', icon: <X size={15} /> },
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
            {agendamentos.filter(a => a.status === 'compareceu').length} consultas realizadas
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

      {/* Linha do Tempo */}
      <div style={{ marginBottom: '0' }}>
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
                  {/* Dot + line */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.dotColor, marginTop: '4px', flexShrink: 0 }} />
                    {!isLast && <div style={{ width: '1px', background: 'var(--border)', flex: 1, minHeight: '24px', margin: '3px 0' }} />}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, paddingBottom: isLast ? 0 : '14px' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink)' }}>
                      {cfg.label}
                      {ag.procedimento_nome ? ` — ${ag.procedimento_nome}` : ''}
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
