import React, { useEffect, useRef, useState } from 'react';
import { Send, Loader2, User, MessageSquare, FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Conversa, Mensagem } from '../../types';

function renderConteudo(m: Mensagem, isOut: boolean) {
  switch (m.tipo) {
    case 'audio':
      return m.media_url ? (
        <audio
          controls
          src={m.media_url}
          preload="metadata"
          style={{ minWidth: '240px', width: '240px', display: 'block' }}
        />
      ) : (
        <p className="text-sm opacity-70">🎤 [Áudio — indisponível]</p>
      );
    case 'image':
      return m.media_url ? (
        <img src={m.media_url} alt="imagem" className="max-w-[240px] rounded-lg" />
      ) : (
        <p className="italic text-sm opacity-70">[Imagem indisponível]</p>
      );
    case 'video':
      return m.media_url ? (
        <video controls src={m.media_url} className="max-w-[240px] rounded-lg" />
      ) : (
        <p className="italic text-sm opacity-70">[Vídeo indisponível]</p>
      );
    case 'document':
      return m.media_url ? (
        <a
          href={m.media_url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 text-sm underline ${isOut ? 'text-white' : 'text-[var(--color-primary)]'}`}
        >
          <FileText className="w-4 h-4 flex-shrink-0" />
          <span>{m.conteudo || 'Documento'}</span>
          <Download className="w-3.5 h-3.5 flex-shrink-0" />
        </a>
      ) : (
        <p className="italic text-sm opacity-70">[Documento indisponível]</p>
      );
    default:
      return <p className="whitespace-pre-wrap break-words">{m.conteudo}</p>;
  }
}

interface Props {
  conversa: Conversa | null;
  mensagens: Mensagem[];
  loadingMensagens: boolean;
  onEnviar: (texto: string) => Promise<void>;
  enviando: boolean;
}

export function ChatWindow({ conversa, mensagens, loadingMensagens, onEnviar, enviando }: Props) {
  const [texto, setTexto] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  // Reset input when conversation changes
  useEffect(() => {
    setTexto('');
  }, [conversa?.id]);

  async function handleSend() {
    const t = texto.trim();
    if (!t || enviando) return;
    setTexto('');
    await onEnviar(t);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!conversa) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--color-bg-base)]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-[var(--color-primary)] opacity-50" />
          </div>
          <p className="text-[var(--color-text-muted)] text-sm">Selecione uma conversa para começar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-card)] bg-[var(--color-bg-base)] flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-semibold text-sm uppercase flex-shrink-0">
          {conversa.nome_contato ? (
            conversa.nome_contato.charAt(0)
          ) : (
            <User className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text-main)] truncate">
            {conversa.nome_contato || conversa.whatsapp_number}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">{conversa.whatsapp_number}</p>
        </div>
        {conversa.is_human && (
          <span className="flex-shrink-0 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium border border-orange-200">
            Atendimento humano
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[var(--color-bg-base)]">
        {loadingMensagens ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-[var(--color-text-muted)]">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          mensagens.map(m => (
            <div key={m.id} className={`flex ${m.direcao === 'saida' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`${m.tipo === 'audio' ? 'w-[260px]' : 'max-w-[70%]'} px-3 py-2 rounded-2xl text-sm ${
                  m.direcao === 'saida'
                    ? 'bg-[var(--color-primary)] text-white rounded-br-sm'
                    : 'bg-white dark:bg-white/10 text-[var(--color-text-main)] border border-[var(--color-border-card)] rounded-bl-sm shadow-sm'
                }`}
              >
                {renderConteudo(m, m.direcao === 'saida')}
                <p
                  className={`text-[10px] mt-1 text-right ${
                    m.direcao === 'saida' ? 'text-white/70' : 'text-[var(--color-text-muted)]'
                  }`}
                >
                  {format(new Date(m.created_at), 'HH:mm', { locale: ptBR })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-[var(--color-border-card)] bg-[var(--color-bg-base)] flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escreva uma mensagem... (Enter para enviar)"
            rows={1}
            className="flex-1 border border-[var(--color-border-card)] rounded-[8px] px-3 py-2 text-sm bg-[var(--color-bg-base)] text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none max-h-32 overflow-y-auto"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={handleSend}
            disabled={!texto.trim() || enviando}
            className="flex-shrink-0 w-10 h-10 rounded-[8px] bg-[var(--color-primary)] text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {enviando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}
