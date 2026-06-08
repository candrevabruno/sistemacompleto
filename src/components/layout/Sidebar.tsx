import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { NavLink } from 'react-router-dom';
import { useClinic } from '../../contexts/ClinicContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  CalendarCheck,
  Users,
  ClipboardList,
  Kanban,
  MessageSquare,
  UsersRound,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    label: 'Visão Geral',
    links: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/central-agendamentos', label: 'Agenda', icon: CalendarCheck },
    ],
  },
  {
    label: 'Pacientes',
    links: [
      { to: '/leads', label: 'Leads', icon: Users },
      { to: '/pacientes', label: 'Pacientes', icon: ClipboardList },
      { to: '/crm', label: 'CRM Kanban', icon: Kanban },
      { to: '/inbox', label: 'Inbox', icon: MessageSquare },
    ],
  },
];

const ADMIN_SECTION = {
  label: 'Sistema',
  links: [
    { to: '/equipe', label: 'Equipe', icon: UsersRound },
    { to: '/configuracoes', label: 'Configurações', icon: Settings },
  ],
};

function getIniciais(nome: string | null | undefined): string {
  if (!nome) return '?';
  return nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function getRoleLabel(role: string | undefined): string {
  switch (role) {
    case 'admin': return 'Administrador';
    case 'profissional': return 'Profissional';
    case 'atendente': return 'Atendente';
    default: return 'Usuário';
  }
}

function GemIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
      <path d="M9 2.5L3 7l6 8.5L15 7 9 2.5z" stroke="white" strokeWidth="1.2" strokeLinejoin="round" fill="none" opacity="0.5"/>
      <path d="M9 2.5L6 7h6L9 2.5z" fill="white" opacity="0.7"/>
      <path d="M6 7L9 15.5 3 7h3z" fill="white" opacity="0.35"/>
      <path d="M12 7L9 15.5l6-8.5h-3z" fill="white" opacity="0.25"/>
    </svg>
  );
}

export function Sidebar() {
  const { config } = useClinic();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sections = user?.role === 'admin'
    ? [...NAV_SECTIONS, ADMIN_SECTION]
    : NAV_SECTIONS;

  const userIniciais = getIniciais(user?.nome || user?.email);
  const userRole = getRoleLabel(user?.role);

  const sidebarContent = (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ background: 'var(--white)', borderRight: '1px solid var(--border)' }}
    >
      {/* Logo */}
      <div
        className="px-5 py-7 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-[10px]">
          <div
            className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ background: 'var(--sage-dark)' }}
          >
            {config?.logo_url
              ? <img src={config.logo_url} alt="Logo" className="w-full h-full object-cover" />
              : <GemIcon />}
          </div>
          <div className="min-w-0">
            <div
              className="font-display leading-tight truncate"
              style={{
                fontSize: '19px',
                fontWeight: 400,
                fontStyle: 'italic',
                color: 'var(--ink)',
                letterSpacing: '-0.2px',
              }}
            >
              {config?.nome || 'Heroic Leap'}
            </div>
            <div
              className="text-[10px] uppercase tracking-[1.4px] mt-[2px] font-medium truncate"
              style={{ color: 'var(--muted)' }}
            >
              ClinicOS
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.label}>
            <div
              className="text-[9.5px] font-semibold uppercase tracking-[1.3px] px-[10px] pb-[5px] pt-[14px]"
              style={{ color: 'var(--muted)', opacity: 0.6 }}
            >
              {section.label}
            </div>
            {section.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-[9px] px-3 py-[9px] rounded-[var(--r-xs)] text-[13px] font-normal transition-all duration-100 cursor-pointer',
                    isActive ? 'font-medium' : '',
                  )
                }
                style={({ isActive }) =>
                  isActive
                    ? { background: 'var(--sage-xlight)', color: 'var(--sage-dark)' }
                    : { color: 'var(--muted)' }
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        className="absolute left-0 rounded-r-[3px]"
                        style={{
                          top: '20%',
                          height: '60%',
                          width: '3px',
                          background: 'var(--sage-dark)',
                        }}
                      />
                    )}
                    <link.icon
                      className="flex-shrink-0"
                      style={{
                        width: '16px',
                        height: '16px',
                        color: isActive ? 'var(--sage-dark)' : 'var(--muted)',
                      }}
                    />
                    <span className="truncate">{link.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer — user card */}
      <div
        className="flex-shrink-0 p-4"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div
          className="flex items-center gap-[10px] px-3 py-[10px] rounded-[var(--r-xs)]"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
        >
          <div
            className="w-[30px] h-[30px] rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-semibold"
            style={{ background: 'var(--sage-light)', color: 'var(--sage-dark)' }}
          >
            {userIniciais}
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-[12px] font-medium leading-tight truncate"
              style={{ color: 'var(--ink)' }}
            >
              {user?.nome || user?.email || 'Usuário'}
            </div>
            <div className="text-[10.5px] truncate" style={{ color: 'var(--muted)' }}>
              {userRole}
            </div>
          </div>
          <button
            onClick={signOut}
            title="Sair"
            className="flex-shrink-0 p-1 rounded transition-colors hover:opacity-70"
            style={{ color: 'var(--muted)' }}
          >
            <LogOut style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile topbar */}
      <div
        className="md:hidden fixed top-0 left-0 w-full h-16 z-30 flex items-center px-4"
        style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)' }}
      >
        <button onClick={() => setMobileOpen(true)} style={{ color: 'var(--ink)' }}>
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden',
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar container */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[216px] transform transition-transform duration-300 ease-in-out md:static md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="md:hidden absolute top-4 right-4 z-10">
          <button onClick={() => setMobileOpen(false)} style={{ color: 'var(--muted)' }}>
            <X className="h-6 w-6" />
          </button>
        </div>
        {sidebarContent}
      </div>
    </>
  );
}
