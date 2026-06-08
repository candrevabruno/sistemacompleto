import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, CalendarCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  leadId: string;
}

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
        .eq('status', 'compareceu')
        .order('data_hora_inicio', { ascending: true });
      if (data) setConsultas(data);
      setLoading(false);
    }
    load();
  }, [leadId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--muted)]" />
      </div>
    );
  }

  if (consultas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3">
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--sage-xlight)' }}>
          <CalendarCheck className="w-5 h-5" style={{ color: 'var(--sage)' }} />
        </div>
        <p className="text-sm text-[var(--muted)]">Nenhuma consulta realizada ainda</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-3">
      {consultas.map((ag, index) => {
        const numero = index + 1;
        const tipo = numero === 1 ? 'Primeira Consulta' : 'Retorno';
        const tipoBg = numero === 1 ? 'rgba(15,110,86,0.1)' : 'rgba(59,130,246,0.1)';
        const tipoColor = numero === 1 ? 'var(--sage-dark)' : '#2563EB';

        return (
          <div key={ag.id}
            className="flex items-center gap-4 p-4 rounded-[12px] border border-[var(--border)] bg-[var(--white)] shadow-[0_1px_4px_rgba(4,52,44,0.05)]">

            {/* Número */}
            <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'var(--sage-xlight)' }}>
              <span className="text-[13px] font-bold" style={{ color: 'var(--sage-dark)' }}>{numero}</span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
                {ag.procedimento_nome || 'Consulta'}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {ag.data_hora_inicio && (
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    {format(parseISO(ag.data_hora_inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
                {ag.agendas?.nome && (
                  <>
                    <span style={{ color: 'var(--muted)' }}>·</span>
                    <div className="flex items-center gap-1">
                      {ag.agendas.cor && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ag.agendas.cor }} />
                      )}
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{ag.agendas.nome}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Tipo */}
            <span className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: tipoBg, color: tipoColor }}>
              {tipo}
            </span>
          </div>
        );
      })}
    </div>
  );
}
