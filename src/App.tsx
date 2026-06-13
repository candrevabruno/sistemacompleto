import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ClinicProvider } from './contexts/ClinicContext';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CRM } from './pages/CRM';
import { CentralAgendamentos } from './pages/CentralAgendamentos';
import { LeadsClientes } from './pages/LeadsClientes';
import { Configuracoes } from './pages/Configuracoes';
import { Inbox } from './pages/Inbox';
import { Pacientes } from './pages/Pacientes';
import { Equipe } from './pages/Equipe';
import { AceitarConvite } from './pages/AceitarConvite';
import { PERM_ITEMS } from './lib/permissions';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Gateia uma rota por permissão. Sem acesso → manda para o 1º módulo permitido.
const PermRoute = ({ perm, children }: { perm: string; children: React.ReactNode }) => {
  const { can } = useAuth();
  if (can(perm)) return <>{children}</>;
  const landing = PERM_ITEMS.find(i => i.route && can(i.key));
  if (landing?.route) return <Navigate to={landing.route} replace />;
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-24 gap-2">
      <p className="font-display" style={{ fontSize: 22, fontStyle: 'italic', color: 'var(--ink)' }}>
        Sem acesso a este módulo
      </p>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        Fale com o administrador da clínica para liberar o acesso.
      </p>
    </div>
  );
};

export function App() {
  return (
    <ClinicProvider>
        <AuthProvider>
          <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/convite" element={<AceitarConvite />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
                <Route path="/dashboard" element={<PermRoute perm="modulo:dashboard"><Dashboard /></PermRoute>} />
                <Route path="/crm" element={<PermRoute perm="modulo:crm"><CRM /></PermRoute>} />
                <Route path="/leads" element={<PermRoute perm="modulo:leads"><LeadsClientes key="leads" mode="leads" /></PermRoute>} />
                <Route path="/clientes" element={<PermRoute perm="modulo:leads"><LeadsClientes key="clientes" mode="clientes" /></PermRoute>} />
                <Route path="/central-agendamentos" element={<PermRoute perm="modulo:agenda"><CentralAgendamentos /></PermRoute>} />
                <Route path="/inbox" element={<PermRoute perm="modulo:inbox"><Inbox /></PermRoute>} />
                <Route path="/pacientes" element={<PermRoute perm="modulo:pacientes"><Pacientes /></PermRoute>} />
                <Route path="/equipe" element={<PermRoute perm="modulo:equipe"><Equipe /></PermRoute>} />
                <Route path="/configuracoes" element={<PermRoute perm="modulo:configuracoes"><Configuracoes /></PermRoute>} />
              </Route>
            </Routes>
        </AuthProvider>
      </ClinicProvider>
  );
}
