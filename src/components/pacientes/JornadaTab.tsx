import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
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

const STATUS_COLOR: Record<string, { dot: string; badge: string }> = {
  agendado: { dot: 'bg-blue-400', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  compareceu: { dot: 'bg-green-500', badge: 'bg-green-50 text-green-700 border-green-200' },
  cancelado: { dot: 'bg-red-400', badge: 'bg-red-50 text-red-700 border-red-200' },
  reagendado: { dot: 'bg-yellow-400', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  faltou: { dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  cancelou_agendamento: { dot: 'bg-red-400', badge: 'bg-red-50 text-red-700 border-red-200' },
  nao_converteu: { dot: 'bg-gray-400', badge: 'bg-gray-50 text-gray-600 border-gray-200' },
};

export function JornadaTab({ leadId }: Props) {
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('agendamentos')
        .select('*, agendas(nome, cor)')
        .eq('lead_id', leadId)
        .order('data_hora_inicio', { ascending: true });
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
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-[var(--color-text-muted)]">Nenhum agendamento registrado</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[19px] top-4 bottom-4 w-px bg-[var(--color-border-card)]" />

        <div className="space-y-6">
          {agendamentos.map((ag, index) => {
            const colors = STATUS_COLOR[ag.status] || STATUS_COLOR.agendado;
            const label = STATUS_LABEL[ag.status] || ag.status;
            const consultaNum = index + 1;
            const suffix = consultaNum === 1 ? 'ª' : consultaNum === 2 ? 'ª' : 'ª';

            return (
              <div key={ag.id} className="flex gap-4 relative">
                {/* Dot */}
                <div
                  className={`w-[38px] h-[38px] rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold z-10 ${colors.dot}`}
                >
                  {consultaNum}
                </div>

                {/* Content */}
                <div className="flex-1 bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-[10px] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text-main)]">
                        {consultaNum}{suffix} Consulta
                        {ag.procedimento_nome && (
                          <span className="font-normal text-[var(--color-text-muted)]">
                            {' '}— {ag.procedimento_nome}
                          </span>
                        )}
                      </p>
                      {ag.data_hora_inicio && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          {format(parseISO(ag.data_hora_inicio), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}
                      {ag.agendas?.nome && (
                        <div className="flex items-center gap-1.5 mt-1">
                          {ag.agendas.cor && (
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: ag.agendas.cor }}
                            />
                          )}
                          <p className="text-xs text-[var(--color-text-muted)]">{ag.agendas.nome}</p>
                        </div>
                      )}
                      {ag.modalidade && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5 capitalize">
                          {ag.modalidade}
                        </p>
                      )}
                    </div>
                    <span
                      className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${colors.badge}`}
                    >
                      {label}
                    </span>
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
