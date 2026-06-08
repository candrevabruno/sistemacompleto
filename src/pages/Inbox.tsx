import { useEffect, useRef, useState } from 'react';
import { useVisibilityRefresh } from '../hooks/useVisibilityRefresh';
import { supabase } from '../lib/supabase';
import { useClinic } from '../contexts/ClinicContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Settings, MessageSquare } from 'lucide-react';
import type { Conversa, Mensagem } from '../types';
import { ConversaList } from '../components/inbox/ConversaList';
import { ChatWindow } from '../components/inbox/ChatWindow';
import { SidePanel } from '../components/inbox/SidePanel';

function playNotificationBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // AudioContext not available
  }
}

// Alerta distinto quando IA transfere para humano: 3 bipes urgentes
function playHumanHandoffAlert() {
  try {
    const ctx = new AudioContext();
    const beep = (startTime: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.5, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
      osc.start(startTime);
      osc.stop(startTime + 0.25);
    };
    beep(ctx.currentTime, 660);
    beep(ctx.currentTime + 0.3, 880);
    beep(ctx.currentTime + 0.6, 1100);
    // Notificação do browser se permitida
    if (Notification.permission === 'granted') {
      new Notification('Atendimento humano solicitado', {
        body: 'Um cliente precisa de atendimento humano no Inbox.',
        icon: '/favicon.ico',
      });
    }
  } catch {
    // AudioContext not available
  }
}

export function Inbox() {
  const { config, loading: configLoading } = useClinic();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaSelecionada, setConversaSelecionada] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loadingConversas, setLoadingConversas] = useState(true);
  const [loadingMensagens, setLoadingMensagens] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [activeTab, setActiveTab] = useState<'todas' | 'humano'>('todas');
  const [search, setSearch] = useState('');

  // Refs to avoid stale closures in Realtime handlers
  const conversaSelecionadaRef = useRef<Conversa | null>(null);
  conversaSelecionadaRef.current = conversaSelecionada;

  const activeTabRef = useRef<'todas' | 'humano'>('todas');
  activeTabRef.current = activeTab;

  // Tracks IDs of messages we inserted ourselves to avoid Realtime duplicates
  const localMsgIds = useRef(new Set<string>());

  const isConfigured =
    (config?.whatsapp_provider === 'meta' &&
      !!config?.meta_phone_number_id &&
      !!config?.meta_access_token) ||
    (config?.whatsapp_provider === 'evolution' &&
      !!config?.evolution_server_url &&
      !!config?.evolution_api_key);

  // ── Load conversations ──────────────────────────────────────────
  useEffect(() => {
    loadConversas();
  }, []);

  // Auto-select conversation when navigating from lead modal (WhatsApp button)
  const autoSelectDone = useRef(false);
  useEffect(() => {
    if (loadingConversas || !conversas.length || autoSelectDone.current) return;
    const leadId = (location.state as { lead_id?: string } | null)?.lead_id;
    if (!leadId) return;
    autoSelectDone.current = true;
    const conversa = conversas.find(c => c.lead_id === leadId);
    if (conversa) setConversaSelecionada(conversa);
  }, [loadingConversas, conversas]);

  async function loadConversas() {
    setLoadingConversas(true);
    const { data } = await supabase
      .from('conversas')
      .select('*')
      .neq('status', 'arquivada')
      .order('ultima_mensagem_at', { ascending: false, nullsFirst: false });
    if (data) setConversas(data);
    setLoadingConversas(false);
  }

  // ── Realtime: conversas ─────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('inbox-conversas')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversas' },
        payload => {
          if (payload.eventType === 'INSERT') {
            const nova = payload.new as Conversa;
            setConversas(prev => [nova, ...prev]);
            if (nova.is_human && activeTabRef.current === 'humano') {
              playNotificationBeep();
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Conversa;
            if (updated.status === 'arquivada') {
              setConversas(prev => prev.filter(c => c.id !== updated.id));
              if (conversaSelecionadaRef.current?.id === updated.id) {
                setConversaSelecionada(null);
                setMensagens([]);
              }
            } else {
              setConversas(prev => {
                const anterior = prev.find(c => c.id === updated.id);
                // Alerta quando IA transfere para humano
                if (anterior && !anterior.is_human && updated.is_human) {
                  playHumanHandoffAlert();
                }
                return prev.map(c => (c.id === updated.id ? updated : c));
              });
              if (conversaSelecionadaRef.current?.id === updated.id) {
                setConversaSelecionada(updated);
              }
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Realtime: mensagens ─────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('inbox-mensagens')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens' },
        payload => {
          const nova = payload.new as Mensagem;

          // Skip messages we inserted ourselves (already in local state)
          if (localMsgIds.current.has(nova.id)) {
            localMsgIds.current.delete(nova.id);
            return;
          }

          if (nova.conversa_id === conversaSelecionadaRef.current?.id) {
            // Active conversation: append message
            setMensagens(prev => [...prev, nova]);
          } else {
            // Other conversation: bump unread counter and preview
            setConversas(prev =>
              prev.map(c => {
                if (c.id !== nova.conversa_id) return c;
                const updated = {
                  ...c,
                  nao_lidas: c.nao_lidas + 1,
                  ultima_mensagem: nova.conteudo,
                  ultima_mensagem_at: nova.created_at,
                };
                if (c.is_human && nova.direcao === 'entrada') {
                  playNotificationBeep();
                }
                return updated;
              })
            );
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Recarrega conversas ao voltar ao tab ou reconectar rede
  useVisibilityRefresh(loadConversas);

  // ── Select conversation ─────────────────────────────────────────
  async function selecionarConversa(conversa: Conversa) {
    setConversaSelecionada(conversa);
    setLoadingMensagens(true);
    setMensagens([]);

    try {
      const { data, error } = await supabase
        .from('mensagens')
        .select('*')
        .eq('conversa_id', conversa.id)
        .order('created_at', { ascending: true });

      if (error) console.error('Erro ao carregar mensagens:', error);
      if (data) setMensagens(data);
    } catch (err) {
      console.error('Falha ao buscar mensagens:', err);
    } finally {
      setLoadingMensagens(false);
    }

    // Mark conversation as read
    if (conversa.nao_lidas > 0) {
      await supabase
        .from('conversas')
        .update({ nao_lidas: 0 })
        .eq('id', conversa.id);
      setConversas(prev =>
        prev.map(c => (c.id === conversa.id ? { ...c, nao_lidas: 0 } : c))
      );
    }
  }

  // ── Send message ────────────────────────────────────────────────
  async function enviarMensagem(texto: string) {
    if (!conversaSelecionada || !config) return;
    setEnviando(true);

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          phone: conversaSelecionada.whatsapp_number,
          message: texto,
          conversa_id: conversaSelecionada.id,
          type: 'text',
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro ao enviar mensagem');

      if (data.mensagem?.id) {
        localMsgIds.current.add(data.mensagem.id);
        setMensagens(prev => [...prev, data.mensagem]);
      }

      const now = new Date().toISOString();
      setConversas(prev =>
        prev.map(c =>
          c.id === conversaSelecionada.id
            ? { ...c, ultima_mensagem: texto, ultima_mensagem_at: now }
            : c
        )
      );
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    } finally {
      setEnviando(false);
    }
  }

  // ── Send audio ──────────────────────────────────────────────────
  async function enviarAudio(dataUrl: string) {
    if (!conversaSelecionada) return;
    setEnviando(true);

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          phone: conversaSelecionada.whatsapp_number,
          conversa_id: conversaSelecionada.id,
          type: 'audio',
          mediaUrl: dataUrl,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro ao enviar áudio');

      if (data.mensagem?.id) {
        localMsgIds.current.add(data.mensagem.id);
        setMensagens(prev => [...prev, data.mensagem]);
      }

      const now = new Date().toISOString();
      setConversas(prev =>
        prev.map(c =>
          c.id === conversaSelecionada.id
            ? { ...c, ultima_mensagem: '[Áudio]', ultima_mensagem_at: now }
            : c
        )
      );
    } catch (err) {
      console.error('Erro ao enviar áudio:', err);
    } finally {
      setEnviando(false);
    }
  }

  // ── Send file (image / video / document) ───────────────────────
  async function enviarArquivo(file: File) {
    if (!conversaSelecionada) return;
    setEnviando(true);
    try {
      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `conversas/${conversaSelecionada.id}/${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('inbox-media')
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage.from('inbox-media').getPublicUrl(uploadData.path);
      const publicUrl = urlData.publicUrl;

      const mediaType = file.type.startsWith('image/') ? 'image'
        : file.type.startsWith('video/') ? 'video'
        : 'document';

      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          phone: conversaSelecionada.whatsapp_number,
          conversa_id: conversaSelecionada.id,
          type: mediaType,
          mediaUrl: publicUrl,
          message: file.name,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro ao enviar arquivo');

      if (data.mensagem?.id) {
        localMsgIds.current.add(data.mensagem.id);
        setMensagens(prev => [...prev, data.mensagem]);
      }

      const previewText = mediaType === 'image' ? '[Imagem]'
        : mediaType === 'video' ? '[Vídeo]'
        : `[📎 ${file.name}]`;
      const now = new Date().toISOString();
      setConversas(prev =>
        prev.map(c =>
          c.id === conversaSelecionada.id
            ? { ...c, ultima_mensagem: previewText, ultima_mensagem_at: now }
            : c
        )
      );
    } catch (err) {
      console.error('Erro ao enviar arquivo:', err);
    } finally {
      setEnviando(false);
    }
  }

  // ── Handoff IA ↔ Humano ────────────────────────────────────────
  async function assumirAtendimento() {
    if (!conversaSelecionada || !user) return;
    const displayName = user.nome || user.email?.split('@')[0] || 'Atendente';
    const now = new Date().toISOString();

    await supabase.from('conversas').update({
      is_human: true,
      assigned_to: user.id,
      handoff_at: now,
      handoff_by: user.id,
      handoff_by_name: displayName,
    }).eq('id', conversaSelecionada.id);

    const { data: msg } = await supabase.from('mensagens').insert({
      conversa_id: conversaSelecionada.id,
      conteudo: `${displayName} assumiu o atendimento`,
      tipo: 'sistema',
      direcao: 'saida',
      status: 'enviado',
    }).select().single();

    if (msg?.id) {
      localMsgIds.current.add(msg.id);
      setMensagens(prev => [...prev, msg]);
    }

    const updated = { ...conversaSelecionada, is_human: true, handoff_at: now, handoff_by: user.id, handoff_by_name: displayName, assigned_to: user.id };
    setConversaSelecionada(updated);
    setConversas(prev => prev.map(c => c.id === conversaSelecionada.id ? updated : c));
  }

  async function retornarParaIA() {
    if (!conversaSelecionada || !user) return;
    const displayName = user.nome || user.email?.split('@')[0] || 'Atendente';

    await supabase.from('conversas').update({
      is_human: false,
      assigned_to: null,
      handoff_at: null,
      handoff_by: null,
      handoff_by_name: null,
    }).eq('id', conversaSelecionada.id);

    const { data: msg } = await supabase.from('mensagens').insert({
      conversa_id: conversaSelecionada.id,
      conteudo: `${displayName} devolveu o atendimento para a IA`,
      tipo: 'sistema',
      direcao: 'saida',
      status: 'enviado',
    }).select().single();

    if (msg?.id) {
      localMsgIds.current.add(msg.id);
      setMensagens(prev => [...prev, msg]);
    }

    const updated = { ...conversaSelecionada, is_human: false, handoff_at: null, handoff_by: null, handoff_by_name: null, assigned_to: null };
    setConversaSelecionada(updated);
    setConversas(prev => prev.map(c => c.id === conversaSelecionada.id ? updated : c));
  }

  // ── Delete conversation ─────────────────────────────────────────
  async function excluirConversa(conversaId: string) {
    await supabase.from('conversas').update({ status: 'arquivada' }).eq('id', conversaId);
    setConversas(prev => prev.filter(c => c.id !== conversaId));
    if (conversaSelecionada?.id === conversaId) {
      setConversaSelecionada(null);
      setMensagens([]);
    }
  }

  // ── Derived state ───────────────────────────────────────────────
  const conversasFiltradas = conversas
    .filter(c => (activeTab === 'humano' ? c.is_human : true))
    .filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.nome_contato?.toLowerCase().includes(q) ||
        c.whatsapp_number.includes(q)
      );
    });

  const totalNaoLidasHumano = conversas
    .filter(c => c.is_human)
    .reduce((sum, c) => sum + c.nao_lidas, 0);

  // ── Not configured state ────────────────────────────────────────
  if (!configLoading && !isConfigured) {
    return (
      <div className="flex h-[calc(100vh-110px)] items-center justify-center -m-6 bg-[var(--bg)]">
        <div className="flex flex-col items-center text-center p-10 max-w-sm gap-6">
          <div className="p-4 rounded-full bg-amber-100 text-amber-600">
            <MessageSquare className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-cormorant font-bold text-[var(--ink)]">
              Configure o WhatsApp
            </h3>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              Para usar o Inbox, configure as credenciais do WhatsApp em Configurações.
            </p>
          </div>
          <Button
            onClick={() => navigate('/configuracoes')}
            className="flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Configurar WhatsApp
          </Button>
        </div>
      </div>
    );
  }

  // ── Main inbox layout ───────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-110px)] -m-6 overflow-hidden bg-[var(--bg)]">
      {/* Lista de conversas */}
      <div className="w-[300px] flex-shrink-0 flex flex-col">
        <ConversaList
          conversas={conversasFiltradas}
          conversaSelecionada={conversaSelecionada}
          onSelect={selecionarConversa}
          onExcluir={excluirConversa}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          search={search}
          onSearchChange={setSearch}
          loading={loadingConversas}
          totalNaoLidasHumano={totalNaoLidasHumano}
        />
      </div>

      {/* Janela de chat */}
      <ChatWindow
        conversa={conversaSelecionada}
        mensagens={mensagens}
        loadingMensagens={loadingMensagens}
        onEnviar={enviarMensagem}
        onEnviarAudio={enviarAudio}
        onEnviarArquivo={enviarArquivo}
        enviando={enviando}
      />

      {/* Painel lateral */}
      <SidePanel
        conversa={conversaSelecionada}
        onAssumirAtendimento={assumirAtendimento}
        onRetornarParaIA={retornarParaIA}
      />
    </div>
  );
}
