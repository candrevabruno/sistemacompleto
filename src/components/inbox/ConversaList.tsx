import React from 'react';
import { MessageSquare, User, Trash2, Search } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Conversa } from '../../types';

const AVATAR_COLORS = [
  { bg: 'var(--sage-xlight)', color: 'var(--sage-dark)' },
  { bg: 'var(--champ-light)', color: 'var(--champ-text)' },
  { bg: 'var(--rose-light)', color: 'var(--rose-text)' },
  { bg: '#E8EEF5', color: '#3D5A80' },
  { bg: '#F0EDF5', color: '#614080' },
];

function getAvatarColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

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
  const today = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });
  const todayCapitalized = today.charAt(0).toUpperCase() + today.slice(1);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--white)', borderRight: '1px solid var(--border)' }}>

      {/* ── Header ── */}
      <div className="px-4 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <h2
          className="font-display leading-none"
          style={{ fontSize: '22px', fontStyle: 'italic', fontWeight: 300, color: 'var(--ink)', letterSpacing: '-0.2px' }}
        >
          Inbox
        </h2>
        <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>{todayCapitalized}</p>

        {/* Pill tabs */}
        <div className="flex gap-1.5 mt-3">
          <button
            onClick={() => onTabChange('todas')}
            className="px-3 py-1 text-xs font-medium rounded-full transition-all"
            style={activeTab === 'todas'
              ? { background: 'var(--sage-dark)', color: '#fff' }
              : { background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }
            }
          >
            Todas
          </button>
          <button
            onClick={() => onTabChange('humano')}
            className="px-3 py-1 text-xs font-medium rounded-full transition-all flex items-center gap-1.5"
            style={activeTab === 'humano'
              ? { background: 'var(--sage-dark)', color: '#fff' }
              : { background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }
            }
          >
            Humano
            {totalNaoLidasHumano > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none"
                style={activeTab === 'humano'
                  ? { background: 'rgba(255,255,255,0.3)', color: '#fff' }
                  : { background: 'var(--sage-dark)', color: '#fff' }
                }
              >
                {totalNaoLidasHumano > 99 ? '99+' : totalNaoLidasHumano}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="px-3 py-2.5 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--muted)' }} />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full rounded-[8px] pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-2"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--ink)',
            }}
          />
        </div>
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>Carregando...</div>
        ) : conversas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-3">
            <MessageSquare className="w-8 h-8 opacity-25" style={{ color: 'var(--muted)' }} />
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {activeTab === 'humano'
                ? 'Nenhuma conversa aguardando atendimento humano'
                : search
                ? 'Nenhuma conversa encontrada'
                : 'Nenhuma conversa ainda'}
            </p>
          </div>
        ) : (
          conversas.map(c => {
            const nameStr = c.nome_contato || c.whatsapp_number;
            const av = getAvatarColor(nameStr);
            const isSelected = conversaSelecionada?.id === c.id;

            return (
              <div
                key={c.id}
                className="group flex items-stretch cursor-pointer transition-colors"
                style={{
                  borderBottom: '1px solid var(--border)',
                  background: isSelected ? 'var(--sage-xlight)' : undefined,
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = ''; }}
              >
                <button
                  onClick={() => onSelect(c)}
                  className="flex-1 text-left px-3 py-3 flex gap-2.5 min-w-0"
                >
                  <div
                    className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs uppercase"
                    style={{ background: av.bg, color: av.color }}
                  >
                    {c.nome_contato ? c.nome_contato.charAt(0) : <User className="w-3.5 h-3.5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[13px] font-medium truncate flex-1" style={{ color: 'var(--ink)' }}>
                        {c.nome_contato || c.whatsapp_number}
                      </span>
                      {c.ultima_mensagem_at && (
                        <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--muted)' }}>
                          {formatDistanceToNow(new Date(c.ultima_mensagem_at), { locale: ptBR, addSuffix: false })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5 gap-1">
                      <p className="text-[11px] truncate flex-1" style={{ color: 'var(--muted)' }}>
                        {c.ultima_mensagem || 'Sem mensagens'}
                      </p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {c.is_human && (
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-orange-400" />
                        )}
                        {c.nao_lidas > 0 && (
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none min-w-[16px] text-center"
                            style={{ background: 'var(--sage-dark)', color: '#fff' }}
                          >
                            {c.nao_lidas > 99 ? '99+' : c.nao_lidas}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={e => { e.stopPropagation(); onExcluir(c.id); }}
                  className="flex-shrink-0 flex items-center px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--muted)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                  title="Arquivar conversa"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
