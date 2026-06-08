import React from 'react';
import { PainelAnotacoes } from './PainelAnotacoes';

interface Props {
  pacienteId: string;
}

export function AnotacoesProfissionalTab({ pacienteId }: Props) {
  return (
    <div className="p-5">
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--white)] shadow-[0_1px_4px_rgba(4,52,44,0.06)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: 'var(--sage-dark)' }}>
              Anotações do Profissional
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
              Visível apenas para administradores e profissionais
            </p>
          </div>
          <span className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
            style={{ background: 'rgba(15,110,86,0.1)', color: 'var(--sage-dark)' }}>
            Restrito
          </span>
        </div>
        <div className="p-5">
          <PainelAnotacoes pacienteId={pacienteId} tipo="profissional" />
        </div>
      </div>
    </div>
  );
}
