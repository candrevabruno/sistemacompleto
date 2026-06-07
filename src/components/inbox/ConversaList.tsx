import { MessageSquare, User, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Conversa } from '../../types';

interface Props {
  conversas: Conversa[];
  conversaSelecionada: Conversa | null;
  onSelect: (c: Conversa) => void;
  onExcluir: (id: string) => void;
  activeTab: 'todas' | 'humano';
  onTabChange: (tab: 'todas' | 'humano') => void;
  search: string;
  onSearchChange: (v: string) => void;
  loading: boolean;
  totalNaoLidasHumano: number;
}

export function ConversaList({
  conversas,
  conversaSelecionada,
  onSelect,
  onExcluir,
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  loading,
  totalNaoLidasHumano,
}: Props) {
  return (
    <div className="flex flex-col h-full border-r border-[var(--color-border-card)]">
      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border-card)] px-3 pt-3 gap-1">
        <button
          onClick={() => onTabChange('todas')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'todas'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => onTabChange('humano')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-2 ${
            activeTab === 'humano'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
          }`}
        >
          Humano
          {totalNaoLidasHumano > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
              {totalNaoLidasHumano > 99 ? '99+' : totalNaoLidasHumano}
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="p-3">
        <input
          type="text"
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full border border-[var(--color-border-card)] rounded-[8px] px-3 py-2 text-sm bg-[var(--color-bg-base)] text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-sm text-[var(--color-text-muted)]">Carregando...</div>
        ) : conversas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-3">
            <MessageSquare className="w-8 h-8 text-[var(--color-text-muted)] opacity-30" />
            <p className="text-sm text-[var(--color-text-muted)]">
              {activeTab === 'humano'
                ? 'Nenhuma conversa aguardando atendimento humano'
                : search
                ? 'Nenhuma conversa encontrada'
                : 'Nenhuma conversa ainda'}
            </p>
          </div>
        ) : (
          conversas.map(c => (
            <div
              key={c.id}
              className={`group border-b border-[var(--color-border-card)]/40 flex items-stretch hover:bg-[var(--color-primary-light)] transition-colors cursor-pointer ${
                conversaSelecionada?.id === c.id ? 'bg-[var(--color-primary-light)]' : ''
              }`}
            >
              {/* Área clicável principal */}
              <button
                onClick={() => onSelect(c)}
                className="flex-1 text-left px-4 py-3 flex gap-3 min-w-0"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-semibold text-sm uppercase">
                  {c.nome_contato ? c.nome_contato.charAt(0) : <User className="w-4 h-4" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-[var(--color-text-main)] truncate flex-1">
                      {c.nome_contato || c.whatsapp_number}
                    </span>
                    {c.ultima_mensagem_at && (
                      <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0">
                        {formatDistanceToNow(new Date(c.ultima_mensagem_at), { locale: ptBR, addSuffix: false })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5 gap-1">
                    <p className="text-xs text-[var(--color-text-muted)] truncate flex-1">
                      {c.ultima_mensagem || 'Sem mensagens'}
                    </p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {c.is_human && (
                        <span className="w-2 h-2 rounded-full bg-orange-400" title="Aguardando atendimento humano" />
                      )}
                      {c.nao_lidas > 0 && (
                        <span className="bg-[var(--color-primary)] text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                          {c.nao_lidas > 99 ? '99+' : c.nao_lidas}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>

              {/* Botão arquivar — visível ao lado, fica vermelho no hover do row */}
              <button
                onClick={e => { e.stopPropagation(); onExcluir(c.id); }}
                className="flex-shrink-0 flex items-center px-2 text-[var(--color-text-muted)]/30 group-hover:text-[var(--color-text-muted)]/70 hover:!text-red-500 transition-colors"
                title="Arquivar conversa"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
