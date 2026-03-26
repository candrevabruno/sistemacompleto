import React from 'react';
import { Construction } from 'lucide-react';

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-[var(--color-text-muted)]">
      <Construction className="mb-4 h-16 w-16 opacity-50" />
      <h2 className="font-cormorant text-3xl font-semibold text-[var(--color-text-main)] mb-2">
        {title}
      </h2>
      <p>Esta página encontra-se em construção.</p>
    </div>
  );
}

export const Dashboard = () => <PlaceholderPage title="Dashboard" />;
export const CRM = () => <PlaceholderPage title="CRM de Leads" />;
export const LeadsPacientes = () => <PlaceholderPage title="Gestão de Leads e Pacientes" />;
export const Agenda = () => <PlaceholderPage title="Agenda de Consultas" />;
export const DocumentacaoAPI = () => <PlaceholderPage title="Documentação da API" />;
