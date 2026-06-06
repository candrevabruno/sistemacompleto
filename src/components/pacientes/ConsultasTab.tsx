import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, CalendarCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  leadId: string;
}

const STATUS_LABEL: Record<string, string> = {
  agendado: 'Agendada',
  compareceu: 'Compareceu',
  cancelado: 'Cancelada',
  reagendado: 'Reagendada',
  faltou: 'Faltou',
  cancelou_agendamento: 'Cancelou',
  nao_converteu: 'Não converteu',
};

const STATUS_COLOR: Record<string, string> = {
  agendado: 'bg-blue-50 text-blue-700 border-blue-200',
  compareceu: 'bg-green-50 text-green-700 border-green-200',
  cancelado: 'bg-red-50 text-red-700 border-red-200',
  reagendado: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  faltou: 'bg-orange-50 text-orange-700 border-orange-200',
  cancelou_agendamento: 'bg-red-50 text-red-700 border-red-200',
  nao_converteu: 'bg-gray-50 text-gray-600 border-gray-200',
};

export function ConsultasTab({ leadId }: Props) {
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('agendamentos')
        .select('*, agendas(nome, cor)')
        .eq('lead_id', leadId)
        .order('data_hora_inicio', { ascending: false });
      if (data) setAgendamentos(data);
      setLoading(false);
    }
    load();
  }, [leadId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  if (agendamentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3">
        <CalendarCheck className="w-8 h-8 text-[var(--color-text-muted)] opacity-30" />
        <p className="text-sm text-[var(--color-text-muted)]">Nenhuma consulta registrada</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-3">
      {agendamentos.map((ag, index) => {
        const consultaNum = agendamentos.length - index;
        const statusClass = STATUS_COLOR[ag.status] || STATUS_COLOR.agendado;
        const statusLabel = STATUS_LABEL[ag.status] || ag.status;

        return (
          <div
            key={ag.id}
            className="flex items-center gap-4 p-4 border border-[var(--color-border-card)] rounded-[10px] bg-[var(--color-bg-card)]"
          >
            {/* Number */}
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
              <span className="text-sm font-bold text-[var(--color-primary)]">{consultaNum}</span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text-main)] truncate">
                {ag.procedimento_nome || 'Consulta'}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {ag.data_hora_inicio && (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {format(parseISO(ag.data_hora_inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
                {ag.agendas?.nome && (
                  <>
                    <span className="text-[var(--color-text-muted)]">·</span>
                    <div className="flex items-center gap-1">
                      {ag.agendas.cor && (
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: ag.agendas.cor }}
                        />
                      )}
                      <p className="text-xs text-[var(--color-text-muted)]">{ag.agendas.nome}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Status */}
            <span className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${statusClass}`}>
              {statusLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}
