import React from 'react';
import { useClinic } from '../contexts/ClinicContext';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MessageSquare, Settings, Zap, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Inbox() {
  const { config, loading } = useClinic();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-120px)] items-center justify-center">
        <p className="text-[var(--color-text-muted)] text-sm">Carregando...</p>
      </div>
    );
  }

  const isConfigured = !!(
    (config?.whatsapp_provider === 'meta' && config?.meta_phone_number_id && config?.meta_access_token) ||
    (config?.whatsapp_provider === 'evolution' && config?.evolution_server_url && config?.evolution_api_key)
  );

  const providerLabel = config?.whatsapp_provider === 'evolution' ? 'Evolution API' : 'Meta Cloud API';

  return (
    <div className="flex h-[calc(100vh-110px)] items-center justify-center -m-6 bg-[var(--color-bg-base)]">
      <Card className="max-w-lg w-full mx-6 border border-[var(--color-border-card)] shadow-lg bg-white dark:bg-black/20">
        <CardContent className="flex flex-col items-center text-center p-10 space-y-6">

          <div className={`p-4 rounded-full ${isConfigured ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'bg-amber-100 text-amber-600'}`}>
            <MessageSquare className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-cormorant font-bold text-[var(--color-text-main)]">
              {isConfigured ? 'Inbox WhatsApp' : 'Configure o WhatsApp'}
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              {isConfigured
                ? `Integração via ${providerLabel} configurada. O Inbox bidirecional em tempo real estará disponível em breve (Etapa 2).`
                : 'Para usar o Inbox, primeiro configure as credenciais do WhatsApp em Configurações.'}
            </p>
          </div>

          {isConfigured ? (
            <div className="w-full space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-green-800">Integração ativa</p>
                  <p className="text-xs text-green-700">Provedor: {providerLabel}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100 text-left">
                <Zap className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">Etapa 2 em desenvolvimento</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    O chat bidirecional em tempo real, painel de conversas e alarme sonoro estão sendo construídos.
                  </p>
                </div>
              </div>

              <Button
                variant="secondary"
                onClick={() => navigate('/configuracoes')}
                className="w-full flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Ajustar configurações
              </Button>
            </div>
          ) : (
            <div className="w-full pt-2">
              <Button
                onClick={() => navigate('/configuracoes')}
                className="w-full flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Configurar WhatsApp
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
