import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { NavLink } from 'react-router-dom';
import { useClinic } from '../../contexts/ClinicContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Kanban,
  Users,
  UserCheck,
  Calendar,
  CalendarCheck,
  Settings,
  Code,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';

export function Sidebar() {
  const { config } = useClinic();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/crm', label: 'CRM', icon: Kanban },
    { to: '/leads', label: 'Leads', icon: Users },
    { to: '/clientes', label: 'Clientes', icon: UserCheck },
    { to: '/agenda', label: 'Agenda', icon: Calendar },
    { to: '/central-agendamentos', label: 'Agendamentos', icon: CalendarCheck },
    ...(user?.role === 'admin' ? [{ to: '/configuracoes', label: 'Configurações', icon: Settings }] : []),
    { to: '/documentacao-api', label: 'Doc. API', icon: Code },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[var(--color-bg-sidebar)] text-white/70 transition-colors">
      <div className="flex flex-col items-center justify-center py-8">
        {config?.logo_url ? (
          <img
            src={config.logo_url}
            alt="Sua Logo"
            className="mb-4 max-h-[80px] object-contain"
          />
        ) : (
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-primary)] text-3xl font-bold text-white uppercase">
            {config?.nome?.substring(0, 2).toUpperCase() || 'HL'}
          </div>
        )}
        <h2 className="font-cormorant text-center text-[18px] font-semibold text-[var(--color-primary)]">
          {config?.nome || 'Heroic Leap'}
        </h2>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'group flex items-center rounded-[8px] px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--color-primary-light)] border-l-[3px] border-transparent',
                  isActive
                    ? 'border-[var(--color-primary)] bg-[var(--color-sidebar-active)] text-[var(--color-primary)]'
                    : 'text-white/50 hover:text-[var(--color-primary)]'
              )
            }
          >
            <link.icon className="mr-3 h-[18px] w-[18px] flex-shrink-0" />
            <span className="truncate">{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[var(--color-border-card)] p-4">
        <div className="flex items-center mb-4">
          <Avatar size="sm" fallback={user?.email?.[0]} />
          <div className="ml-3 truncate text-sm font-medium text-white/80">
            {user?.email}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={signOut}
            className="flex items-center text-sm font-medium text-white/40 hover:text-[var(--color-primary)] transition-colors"
          >
            <LogOut className="mr-2 h-[18px] w-[18px]" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 w-full h-16 bg-[var(--color-bg-base)] border-b border-[var(--color-border-card)] z-30 flex items-center px-4">
        <button onClick={() => setMobileOpen(true)} className="text-[var(--color-text-main)]">
          <Menu className="h-6 w-6" />
        </button>
      </div>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[240px] transform bg-[var(--color-bg-sidebar)] transition-transform duration-300 ease-in-out md:static md:translate-x-0 border-r border-[var(--color-border-card)]",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="md:hidden absolute top-4 right-4">
          <button onClick={() => setMobileOpen(false)} className="text-[var(--color-text-muted)]">
            <X className="h-6 w-6" />
          </button>
        </div>
        {sidebarContent}
      </div>
    </>
  );
}
