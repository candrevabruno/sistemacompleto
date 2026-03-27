import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useClinic } from '../../contexts/ClinicContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function Header() {
  const location = useLocation();
  const { user } = useAuth();
  const { config } = useClinic();

  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case '/dashboard': return 'Dashboard';
      case '/crm': return 'CRM';
      case '/leads-pacientes': return 'Leads e Pacientes';
      case '/agenda': return 'Agenda';
      case '/configuracoes': return 'Configurações';
      case '/documentacao-api': return 'Documentação da API';
      default: return config?.nome || 'Heroic Leap Health';
    }
  };

  const dataAtual = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });
  const dataCapitalizada = dataAtual.charAt(0).toUpperCase() + dataAtual.slice(1);

  return (
    <header className="flex h-[64px] items-center justify-between border-b border-[var(--color-border-card)] bg-[var(--color-bg-base)] px-6 transition-colors">
      <h1 className="font-cormorant text-2xl font-semibold text-[var(--color-text-main)]">
        {getPageTitle(location.pathname)}
      </h1>
      <div className="flex items-center gap-4 text-[var(--color-text-muted)] text-sm font-medium">
        {dataCapitalizada}
      </div>
    </header>
  );
}
