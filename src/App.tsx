import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ClinicProvider } from './contexts/ClinicContext';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CRM } from './pages/CRM';
import { Agenda } from './pages/Agenda';
import { CentralAgendamentos } from './pages/CentralAgendamentos';
import { LeadsPacientes } from './pages/LeadsPacientes';
import { DocumentacaoAPI } from './pages/DocumentacaoAPI';
import { Configuracoes } from './pages/Configuracoes';

const PrivateRoute = ({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export function App() {
  return (
    <ClinicProvider>
        <AuthProvider>
          <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/crm" element={<CRM />} />
                <Route path="/leads-pacientes" element={<LeadsPacientes />} />
                <Route path="/agenda" element={<Agenda />} />
                <Route path="/central-agendamentos" element={<CentralAgendamentos />} />
                <Route path="/documentacao-api" element={<DocumentacaoAPI />} />
                <Route 
                  path="/configuracoes" 
                  element={
                    <PrivateRoute adminOnly>
                      <Configuracoes />
                    </PrivateRoute>
                  } 
                />
              </Route>
            </Routes>
        </AuthProvider>
      </ClinicProvider>
  );
}
