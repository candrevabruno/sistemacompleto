import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { Loader2, Calendar, XCircle, RotateCcw, CheckCircle2, DollarSign } from 'lucide-react';

interface Props {
  leadId: string;
  pacienteId: string;
}

const EVENTO_CONFIG: Record<string, { label: string; dotColor: string; iconColor: string }> = {
  agendado:   { label: 'Agendou',    dotColor: '#3b82f6', iconColor: '#2563eb' },
  confirmado: { label: 'Confirmou',  dotColor: '#10b981', iconColor: '#059669' },
  compareceu: { label: 'Compareceu', dotColor: '#0F6E56', iconColor: '#0F6E56' },
  faltou:     { label: 'Faltou',     dotColor: '#f97316', iconColor: '#ea580c' },
  cancelado:  { label: 'Cancelou',   dotColor: '#ef4444', iconColor: '#dc2626' },
  reagendado: { label: 'Remarcou',   dotColor: '#f59e0b', iconColor: '#d97706' },
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
      supabase.from('agendamentos').select('*, agendas(nome)').eq('lead_id', leadId).order('data_hora_inicio', { ascending: true }),
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--muted)]" />
      </div>
    );
  }

  const kpis = [
    { label: 'Agendamentos',    value: totalAgendamentos, icon: <Calendar className="w-4 h-4" />, color: '#2563eb', bg: 'rgba(59,130,246,0.1)' },
    { label: 'Faltas',          value: totalFaltou,        icon: <XCircle className="w-4 h-4" />, color: '#ea580c', bg: 'rgba(249,115,22,0.1)' },
    { label: 'Remarcações',     value: totalRemarcou,      icon: <RotateCcw className="w-4 h-4" />, color: '#d97706', bg: 'rgba(245,158,11,0.1)' },
    { label: 'Cancelamentos',   value: totalCancelou,      icon: <XCircle className="w-4 h-4" />, color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
  ];

  return (
    <div className="p-5 space-y-5">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label}
            className="rounded-[12px] border border-[var(--border)] bg-[var(--white)] shadow-[0_1px_4px_rgba(4,52,44,0.06)] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-[1px]" style={{ color: 'var(--muted)' }}>{k.label}</p>
              <span className="p-1.5 rounded-[7px]" style={{ background: k.bg, color: k.color }}>{k.icon}</span>
            </div>
            <span className="text-[28px] font-bold leading-none" style={{ color: k.color }}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* ── Ticket Total ── */}
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--white)] shadow-[0_1px_4px_rgba(4,52,44,0.06)] p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-[12px] flex items-center justify-center flex-shrink-0" style={{ background: 'var(--sage-xlight)' }}>
          <DollarSign className="w-6 h-6" style={{ color: 'var(--sage-dark)' }} />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[1px]" style={{ color: 'var(--muted)' }}>Ticket total na clínica</p>
          <p className="text-[28px] font-bold leading-none mt-1" style={{ color: 'var(--sage-dark)' }}>{fmtBRL(totalGasto)}</p>
        </div>
      </div>

      {/* ── Linha do Tempo ── */}
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--white)] shadow-[0_1px_4px_rgba(4,52,44,0.06)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <p className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: 'var(--sage-dark)' }}>Linha do Tempo</p>
        </div>

        {agendamentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 gap-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--sage-xlight)' }}>
              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--sage)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Nenhum evento registrado ainda</p>
          </div>
        ) : (
          <div className="p-5 relative">
            {/* Linha vertical */}
            <div className="absolute left-[28px] top-5 bottom-5 w-px" style={{ background: 'var(--border)' }} />

            <div className="space-y-5">
              {agendamentos.map((ag) => {
                const cfg = EVENTO_CONFIG[ag.status] || EVENTO_CONFIG.agendado;
                const data = ag.data_hora_inicio
                  ? format(parseISO(ag.data_hora_inicio), "dd 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
                  : '—';

                return (
                  <div key={ag.id} className="flex gap-4 relative items-start">
                    {/* Dot */}
                    <div className="w-[22px] h-[22px] rounded-full flex-shrink-0 z-10 mt-1 flex items-center justify-center border-2 border-white"
                      style={{ background: cfg.dotColor, boxShadow: `0 0 0 2px var(--border)` }} />

                    {/* Content */}
                    <div className="flex-1 rounded-[10px] border border-[var(--border)] bg-[var(--bg)] px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                            {cfg.label}
                          </p>
                          {ag.procedimento_nome && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{ag.procedimento_nome}</p>
                          )}
                          {ag.agendas?.nome && (
                            <p className="text-xs" style={{ color: 'var(--muted)' }}>{ag.agendas.nome}</p>
                          )}
                        </div>
                        <p className="text-[11px] flex-shrink-0 mt-0.5" style={{ color: 'var(--muted)' }}>{data}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
