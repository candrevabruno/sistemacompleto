import React from 'react';
import { useLocation } from 'react-router-dom';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../contexts/AuthContext';
import { useClinic } from '../../contexts/ClinicContext';

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
      default: return config?.nome || 'Sistema Médico';
    }
  };

  return (
    <header className="flex h-[64px] items-center justify-between border-b border-[var(--color-border-card)] bg-[var(--color-bg-base)] px-6 transition-colors">
      <h1 className="font-cormorant text-2xl font-semibold text-[var(--color-text-main)]">
        {getPageTitle(location.pathname)}
      </h1>
      <div className="flex items-center gap-4">
        <Avatar src={null} fallback={user?.email?.[0]} />
      </div>
    </header>
  );
}
