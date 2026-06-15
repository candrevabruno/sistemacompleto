import React, { useEffect, useRef, useState } from 'react';
import { Send, Loader2, User, MessageSquare, FileText, Download, Mic, Square, Paperclip, UserCheck, MoreVertical, Trash2, Ban, AlertTriangle, X } from 'lucide-react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Conversa, Mensagem } from '../../types';

// Janela do WhatsApp para "apagar para todos" (~2 dias).
const JANELA_MS = 48 * 60 * 60 * 1000;
function dentroDaJanela(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < JANELA_MS;
}

// Rótulo do separador de data, no estilo do WhatsApp.
function labelData(d: Date): string {
  if (isToday(d)) return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  return format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

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
          className={`flex items-center gap-2 text-sm underline ${isOut ? 'text-white' : 'text-[var(--sage-dark)]'}`}
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

// Menu de ações por mensagem (apagar). Aparece no hover da linha.
function MsgMenu({ open, onToggle, podeTodos, align, onTodos, onLocal }: {
  open: boolean;
  onToggle: () => void;
  podeTodos: boolean;
  align: 'left' | 'right';
  onTodos: () => void;
  onLocal: () => void;
}) {
  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={onToggle}
        className={`w-7 h-7 rounded-full flex items-center justify-center text-[var(--muted)] hover:bg-[var(--white)] hover:text-[var(--ink)] transition-opacity ${open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        title="Opções da mensagem"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={onToggle} />
          <div className={`absolute z-20 top-8 ${align === 'right' ? 'right-0' : 'left-0'} w-52 bg-white rounded-[8px] border border-[var(--border)] shadow-lg py-1 text-sm`}>
            {podeTodos && (
              <button
                onClick={onTodos}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 flex-shrink-0" />
                Apagar para todos
              </button>
            )}
            <button
              onClick={onLocal}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-[var(--ink)] hover:bg-[var(--bg)]"
            >
              <Ban className="w-4 h-4 flex-shrink-0" />
              Apagar só aqui
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface Props {
  conversa: Conversa | null;
  mensagens: Mensagem[];
  loadingMensagens: boolean;
  onEnviar: (texto: string) => Promise<void>;
  onEnviarAudio: (dataUrl: string) => Promise<void>;
  onEnviarArquivo: (file: File) => Promise<void>;
  onApagarMensagem: (mensagemId: string, scope: 'todos' | 'local') => Promise<void>;
  podeApagar: boolean;
  enviando: boolean;
}

export function ChatWindow({ conversa, mensagens, loadingMensagens, onEnviar, onEnviarAudio, onEnviarArquivo, onApagarMensagem, podeApagar, enviando }: Props) {
  const [texto, setTexto] = useState('');
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ msg: Mensagem; scope: 'todos' | 'local' } | null>(null);
  const [apagando, setApagando] = useState(false);
  const [erroApagar, setErroApagar] = useState<string | null>(null);

  async function confirmarApagar() {
    if (!confirm) return;
    setApagando(true);
    setErroApagar(null);
    try {
      await onApagarMensagem(confirm.msg.id, confirm.scope);
      setConfirm(null);
    } catch (err) {
      setErroApagar(err instanceof Error ? err.message : 'Erro ao apagar mensagem');
    } finally {
      setApagando(false);
    }
  }
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  // Reset input when conversation changes
  useEffect(() => {
    setTexto('');
    stopRecording();
  }, [conversa?.id]);

  // Cleanup on unmount
  useEffect(() => () => stopRecording(), []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => { if (reader.result) onEnviarAudio(reader.result as string); };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setGravando(true);
      setSegundos(0);
      timerRef.current = setInterval(() => setSegundos(s => s + 1), 1000);
    } catch {
      alert('Permissão de microfone negada.');
    }
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
    setGravando(false);
    setSegundos(0);
  }

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
      <div className="flex-1 flex items-center justify-center bg-[var(--bg)]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--sage-dark)]/10 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-[var(--sage-dark)] opacity-50" />
          </div>
          <p className="text-[var(--muted)] text-sm">Selecione uma conversa para começar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg)] flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-[var(--sage-dark)] flex items-center justify-center text-white font-semibold text-sm uppercase flex-shrink-0">
          {conversa.nome_contato ? (
            conversa.nome_contato.charAt(0)
          ) : (
            <User className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--ink)] truncate">
            {conversa.nome_contato || conversa.whatsapp_number}
          </p>
          <p className="text-xs text-[var(--muted)]">{conversa.whatsapp_number}</p>
        </div>
        {conversa.is_human && (
          <span className="flex-shrink-0 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium border border-orange-200">
            Atendimento humano
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[var(--bg)]">
        {loadingMensagens ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--muted)]" />
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-[var(--muted)]">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          mensagens.map((m, idx) => {
            const prev = idx > 0 ? mensagens[idx - 1] : null;
            const mostrarData = !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at));
            const sep = mostrarData ? (
              <div className="flex justify-center my-3">
                <span className="px-3 py-1 bg-[var(--white)] rounded-full border border-[var(--border)] text-[10px] font-medium text-[var(--muted)] shadow-sm">
                  {labelData(new Date(m.created_at))}
                </span>
              </div>
            ) : null;

            if (m.tipo === 'sistema') {
              return (
                <React.Fragment key={m.id}>
                  {sep}
                  <div className="flex justify-center my-1">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-[var(--white)] rounded-full border border-[var(--border)] text-[10px] text-[var(--muted)]">
                      <UserCheck className="w-3 h-3 flex-shrink-0" />
                      <span>{m.conteudo}</span>
                      <span>·</span>
                      <span>{format(new Date(m.created_at), 'HH:mm', { locale: ptBR })}</span>
                    </div>
                  </div>
                </React.Fragment>
              );
            }
            const isOut = m.direcao === 'saida';
            const apagadaContato = !!m.apagada_pelo_contato;
            const podeTodos = podeApagar && isOut && !!m.whatsapp_message_id && !m.apagada_para_todos && dentroDaJanela(m.created_at) && !apagadaContato;
            const temMenu = podeApagar && !apagadaContato;
            return (
              <React.Fragment key={m.id}>
                {sep}
                <div className={`group flex items-center gap-1 ${isOut ? 'justify-end' : 'justify-start'}`}>
                {/* Botão de menu à esquerda para mensagens de saída */}
                {temMenu && isOut && (
                  <MsgMenu
                    open={menuId === m.id}
                    onToggle={() => setMenuId(menuId === m.id ? null : m.id)}
                    podeTodos={podeTodos}
                    align="right"
                    onTodos={() => { setMenuId(null); setConfirm({ msg: m, scope: 'todos' }); }}
                    onLocal={() => { setMenuId(null); setConfirm({ msg: m, scope: 'local' }); }}
                  />
                )}
                <div
                  className={`${m.tipo === 'audio' ? 'w-[260px]' : 'max-w-[70%]'} px-3 py-2 rounded-2xl text-sm ${
                    isOut
                      ? 'bg-[var(--sage-dark)] text-white rounded-br-sm'
                      : 'bg-white dark:bg-white/10 text-[var(--ink)] border border-[var(--border)] rounded-bl-sm shadow-sm'
                  } ${apagadaContato ? 'opacity-60' : ''}`}
                >
                  {apagadaContato && (
                    <span className={`flex items-center gap-1 text-[10px] font-medium mb-0.5 ${isOut ? 'text-white/80' : 'text-[var(--muted)]'}`}>
                      <Ban className="w-3 h-3 flex-shrink-0" />
                      apagada pelo paciente
                    </span>
                  )}
                  <div className={apagadaContato ? 'line-through opacity-80' : ''}>
                    {renderConteudo(m, isOut)}
                  </div>
                  <p
                    className={`text-[10px] mt-1 text-right ${
                      isOut ? 'text-white/70' : 'text-[var(--muted)]'
                    }`}
                  >
                    {format(new Date(m.created_at), 'HH:mm', { locale: ptBR })}
                  </p>
                </div>
                {/* Botão de menu à direita para mensagens de entrada */}
                {temMenu && !isOut && (
                  <MsgMenu
                    open={menuId === m.id}
                    onToggle={() => setMenuId(menuId === m.id ? null : m.id)}
                    podeTodos={false}
                    align="left"
                    onTodos={() => {}}
                    onLocal={() => { setMenuId(null); setConfirm({ msg: m, scope: 'local' }); }}
                  />
                )}
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg)] flex-shrink-0">
        {/* File input oculto */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) { onEnviarArquivo(file); e.target.value = ''; }
          }}
        />
        {gravando ? (
          /* ── Modo gravação ── */
          <div className="flex gap-2 items-center">
            <div className="flex-1 flex items-center gap-3 px-3 py-2 rounded-[8px] border border-red-400/60 bg-red-50/10">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm text-[var(--ink)] font-medium">
                Gravando {String(Math.floor(segundos / 60)).padStart(2, '0')}:{String(segundos % 60).padStart(2, '0')}
              </span>
            </div>
            <button
              onClick={stopRecording}
              className="flex-shrink-0 w-10 h-10 rounded-[8px] bg-red-500 text-white flex items-center justify-center hover:opacity-90 transition-opacity"
              title="Parar e enviar"
            >
              <Square className="w-4 h-4 fill-white" />
            </button>
          </div>
        ) : (
          /* ── Modo texto ── */
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escreva uma mensagem... (Enter para enviar)"
              rows={1}
              className="flex-1 border border-[var(--border)] rounded-[8px] px-3 py-2 text-sm bg-[var(--bg)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--sage-dark)] resize-none max-h-32 overflow-y-auto"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            {/* Botões de mídia — só quando não há texto */}
            {!texto.trim() && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={enviando}
                  className="flex-shrink-0 w-10 h-10 rounded-[8px] border border-[var(--border)] text-[var(--muted)] flex items-center justify-center hover:text-[var(--sage-dark)] hover:border-[var(--sage-dark)] disabled:opacity-40 transition-colors"
                  title="Enviar arquivo"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  onClick={startRecording}
                  disabled={enviando}
                  className="flex-shrink-0 w-10 h-10 rounded-[8px] border border-[var(--border)] text-[var(--muted)] flex items-center justify-center hover:text-[var(--sage-dark)] hover:border-[var(--sage-dark)] disabled:opacity-40 transition-colors"
                  title="Gravar áudio"
                >
                  <Mic className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={handleSend}
              disabled={!texto.trim() || enviando}
              className="flex-shrink-0 w-10 h-10 rounded-[8px] bg-[var(--sage-dark)] text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {enviando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        )}
        {!gravando && (
          <p className="text-[10px] text-[var(--muted)] mt-1.5">
            Enter para enviar · Shift+Enter para nova linha
          </p>
        )}
      </div>

      {/* Modal de confirmação de apagamento */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !apagando && setConfirm(null)}>
          <div className="bg-white rounded-[12px] shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className={`p-2 rounded-full flex-shrink-0 ${confirm.scope === 'todos' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-cormorant font-bold text-[var(--ink)]">
                  {confirm.scope === 'todos' ? 'Apagar para todos?' : 'Apagar só aqui?'}
                </h3>
                <p className="text-sm text-[var(--muted)] mt-1 leading-relaxed">
                  {confirm.scope === 'todos'
                    ? 'A mensagem será apagada também no WhatsApp do paciente. Esta ação não pode ser desfeita.'
                    : 'A mensagem some apenas do Inbox da clínica — ela permanece no celular do paciente. O registro é mantido para fins de auditoria/LGPD.'}
                </p>
              </div>
              <button onClick={() => !apagando && setConfirm(null)} className="text-[var(--muted)] hover:text-[var(--ink)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            {erroApagar && (
              <p className="text-xs text-red-600 bg-red-50 rounded-[6px] px-3 py-2 mb-3">{erroApagar}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirm(null)}
                disabled={apagando}
                className="px-4 py-2 rounded-[8px] text-sm border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--bg)] disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarApagar}
                disabled={apagando}
                className={`px-4 py-2 rounded-[8px] text-sm text-white flex items-center gap-2 disabled:opacity-40 ${confirm.scope === 'todos' ? 'bg-red-600 hover:bg-red-700' : 'bg-[var(--sage-dark)] hover:opacity-90'}`}
              >
                {apagando && <Loader2 className="w-4 h-4 animate-spin" />}
                {confirm.scope === 'todos' ? 'Apagar para todos' : 'Apagar só aqui'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
