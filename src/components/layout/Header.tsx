import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare } from 'lucide-react';

const PAGE_TITLES: Record<string, string> = {
  '/crm': 'CRM Kanban',
  '/leads': 'Inbox Leads',
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
  const navigate = useNavigate();
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

      {/* Right: inbox shortcut */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/inbox')}
          className="flex items-center justify-center rounded-[var(--r-xs)] transition-colors hover:bg-[var(--sage-xlight)]"
          style={{
            width: '34px',
            height: '34px',
            border: '1px solid var(--border-md)',
            color: 'var(--muted)',
          }}
          title="Inbox"
        >
          <MessageSquare style={{ width: '17px', height: '17px' }} />
        </button>
      </div>
    </header>
  );
}
