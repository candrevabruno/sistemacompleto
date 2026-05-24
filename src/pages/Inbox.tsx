import React from 'react';
import { useClinic } from '../contexts/ClinicContext';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MessageSquare, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Inbox() {
  const { config, loading } = useClinic();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-120px)] items-center justify-center">
        <p className="text-[var(--color-text-muted)] text-sm">Carregando Inbox...</p>
      </div>
    );
  }

  const rawUrl = config?.chatwoot_url;

  // Ajusta a URL para focar estritamente no Inbox
  // Se a URL contiver '/dashboard', e não contiver '?embed=true', podemos adicionar query parameters para esconder elementos do Chatwoot.
  // Chatwoot aceita query parameters no iframe para customização se estiver configurado.
  // Mas de forma geral, apenas renderizar a URL limpa já funciona super bem.
  const getEmbeddableUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      // Opcional: Adicionar query parameters úteis do Chatwoot se for uma rota de dashboard
      // ex: app.chatwoot.com/app/accounts/1/dashboard?embed=true
      if (!parsed.searchParams.has('embed')) {
        parsed.searchParams.set('embed', 'true');
      }
      return parsed.toString();
    } catch {
      return url;
    }
  };

  const iframeUrl = rawUrl ? getEmbeddableUrl(rawUrl) : '';

  return (
    <div className="h-[calc(100vh-110px)] -m-6 flex flex-col bg-[var(--color-bg-base)]">
      {rawUrl ? (
        <div className="relative flex-1 w-full h-full overflow-hidden">
          {/* Botão flutuante discreto para reconfigurar no canto superior direito */}
          <button
            onClick={() => navigate('/configuracoes')}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/80 dark:bg-black/50 border border-[var(--color-border-card)] shadow-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-white dark:hover:bg-black transition-all"
            title="Configurar URL do Chatwoot"
          >
            <Settings className="w-4 h-4" />
          </button>
          
          <iframe
            src={iframeUrl}
            className="w-full h-full border-none bg-white dark:bg-transparent"
            allow="camera; microphone; clipboard-write; clipboard-read"
            title="Chatwoot Inbox"
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md w-full border border-[var(--color-border-card)] shadow-lg bg-white dark:bg-black/20">
            <CardContent className="flex flex-col items-center text-center p-8 space-y-6">
              <div className="p-4 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] animate-pulse">
                <MessageSquare className="w-10 h-10" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-cormorant font-bold text-[var(--color-text-main)]">
                  Inbox do Chatwoot não configurado
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  Para visualizar e responder às suas mensagens do WhatsApp diretamente por aqui, você precisa cadastrar a URL da sua Caixa de Entrada do Chatwoot.
                </p>
              </div>

              <div className="w-full pt-2">
                <Button 
                  onClick={() => navigate('/configuracoes')} 
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Ir para Configurações
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
