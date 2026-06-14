import React from 'react';
import { ShieldCheck, Lock } from 'lucide-react';
import { PainelAnotacoes } from './PainelAnotacoes';

interface Props {
  pacienteId: string;
}

export function AnotacoesProfissionalTab({ pacienteId }: Props) {
  return (
    <div style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
        <Lock size={13} style={{ color: 'var(--sage-dark)' }} /> Anotações do profissional — acesso restrito
      </div>

      <div style={{ background: 'var(--rose-light)', borderRadius: 'var(--r-xs)', padding: '9px 13px', fontSize: '12px', color: 'var(--rose-text)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '7px', border: '1px solid rgba(139,68,68,0.2)' }}>
        <ShieldCheck size={14} style={{ flexShrink: 0 }} />
        Visível apenas para Administrador e profissionais autorizados. Membros sem permissão não visualizam esta aba.
      </div>

      <PainelAnotacoes pacienteId={pacienteId} tipo="profissional" />
    </div>
  );
}
