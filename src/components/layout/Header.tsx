import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bell, MessageSquare } from 'lucide-react';

const PAGE_TITLES: Record<string, string> = {
  '/crm': 'CRM Kanban',
  '/leads': 'Leads',
  '/pacientes': 'Pacientes',
  '/inbox': 'Inbox',
  '/central-agendamentos': 'Agenda',
  '/equipe': 'Equipe',
  '/configuracoes': 'Configurações',
};

function getSaudacao(nome: string | undefined | null) {
  const h = new Date().getHours();
  const s = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiro = nome?.split(' ')[0];
  return primeiro ? `${s}, ${primeiro}` : s;
}

export function Header() {
  const location = useLocation();
  const { user } = useAuth();

  const isDashboard = location.pathname === '/dashboard';
  const pageTitle = PAGE_TITLES[location.pathname];

  const dataAtual = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });
  const dataCapitalizada = dataAtual.charAt(0).toUpperCase() + dataAtual.slice(1);

  return (
    <header
      className="flex h-[58px] flex-shrink-0 items-center justify-between px-7"
      style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)' }}
    >
      {/* Left: greeting (dashboard) or breadcrumb (other pages) */}
      {isDashboard ? (
        <div>
          <div
            className="text-[11px] font-normal"
            style={{ color: 'var(--muted)', letterSpacing: '0.2px' }}
          >
            {dataCapitalizada}
          </div>
          <div
            className="font-display leading-none mt-[2px]"
            style={{
              fontSize: '20px',
              fontWeight: 300,
              fontStyle: 'italic',
              color: 'var(--ink)',
              letterSpacing: '-0.3px',
            }}
          >
            {getSaudacao(user?.nome || user?.email)}
          </div>
        </div>
      ) : (
        <div
          className="text-[13px]"
          style={{ color: 'var(--muted)', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}
        >
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontStyle: 'normal',
              fontWeight: 500,
              color: 'var(--ink)',
              fontSize: '14px',
            }}
          >
            {pageTitle || 'Heroic Leap'}
          </span>
          {' — '}
          {dataCapitalizada}
        </div>
      )}

      {/* Right: action buttons */}
      <div className="flex items-center gap-2">
        <button
          className="relative flex items-center justify-center rounded-[var(--r-xs)] transition-colors hover:bg-[var(--sage-xlight)]"
          style={{
            width: '34px',
            height: '34px',
            border: '1px solid var(--border-md)',
            color: 'var(--muted)',
          }}
          title="Notificações"
        >
          <Bell style={{ width: '17px', height: '17px' }} />
          <span
            className="absolute rounded-full"
            style={{
              top: '7px',
              right: '7px',
              width: '5px',
              height: '5px',
              background: 'var(--sage-dark)',
              border: '1.5px solid var(--white)',
            }}
          />
        </button>
        <button
          className="flex items-center justify-center rounded-[var(--r-xs)] transition-colors hover:bg-[var(--sage-xlight)]"
          style={{
            width: '34px',
            height: '34px',
            border: '1px solid var(--border-md)',
            color: 'var(--muted)',
          }}
          title="Mensagens"
        >
          <MessageSquare style={{ width: '17px', height: '17px' }} />
        </button>
      </div>
    </header>
  );
}
