import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useClinic } from '../contexts/ClinicContext';
import { useNavigate } from 'react-router-dom';
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

export function Inbox() {
  const { config, loading: configLoading } = useClinic();
  const navigate = useNavigate();

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

  async function loadConversas() {
    setLoadingConversas(true);
    const { data } = await supabase
      .from('conversas')
      .select('*')
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
            setConversas(prev =>
              prev.map(c => (c.id === updated.id ? updated : c))
            );
            if (conversaSelecionadaRef.current?.id === updated.id) {
              setConversaSelecionada(updated);
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

  // ── Select conversation ─────────────────────────────────────────
  async function selecionarConversa(conversa: Conversa) {
    setConversaSelecionada(conversa);
    setLoadingMensagens(true);
    setMensagens([]);

    const { data } = await supabase
      .from('mensagens')
      .select('*')
      .eq('conversa_id', conversa.id)
      .order('created_at', { ascending: true });

    if (data) setMensagens(data);
    setLoadingMensagens(false);

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
      // Send via WhatsApp provider
      if (
        config.whatsapp_provider === 'meta' &&
        config.meta_phone_number_id &&
        config.meta_access_token
      ) {
        await fetch(
          `https://graph.facebook.com/v19.0/${config.meta_phone_number_id}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.meta_access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: conversaSelecionada.whatsapp_number,
              type: 'text',
              text: { body: texto },
            }),
          }
        );
      } else if (
        config.whatsapp_provider === 'evolution' &&
        config.evolution_server_url &&
        config.evolution_api_key
      ) {
        await fetch(
          `${config.evolution_server_url}/message/sendText/${config.evolution_instance_name}`,
          {
            method: 'POST',
            headers: {
              apikey: config.evolution_api_key,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              number: conversaSelecionada.whatsapp_number,
              options: { delay: 1200 },
              textMessage: { text: texto },
            }),
          }
        );
      }

      // Persist in database
      const { data: novaMsg } = await supabase
        .from('mensagens')
        .insert({
          conversa_id: conversaSelecionada.id,
          conteudo: texto,
          tipo: 'text',
          direcao: 'saida',
          status: 'enviado',
        })
        .select()
        .single();

      if (novaMsg) {
        // Mark as local so Realtime handler skips the duplicate
        localMsgIds.current.add(novaMsg.id);
        setMensagens(prev => [...prev, novaMsg]);
      }

      // Update conversation preview
      const now = new Date().toISOString();
      await supabase
        .from('conversas')
        .update({ ultima_mensagem: texto, ultima_mensagem_at: now })
        .eq('id', conversaSelecionada.id);

      setConversas(prev =>
        prev.map(c =>
          c.id === conversaSelecionada.id
            ? { ...c, ultima_mensagem: texto, ultima_mensagem_at: now }
            : c
        )
      );
    } finally {
      setEnviando(false);
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
      <div className="flex h-[calc(100vh-110px)] items-center justify-center -m-6 bg-[var(--color-bg-base)]">
        <div className="flex flex-col items-center text-center p-10 max-w-sm gap-6">
          <div className="p-4 rounded-full bg-amber-100 text-amber-600">
            <MessageSquare className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-cormorant font-bold text-[var(--color-text-main)]">
              Configure o WhatsApp
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
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
    <div className="flex h-[calc(100vh-110px)] -m-6 overflow-hidden bg-[var(--color-bg-base)]">
      {/* Lista de conversas */}
      <div className="w-[300px] flex-shrink-0 flex flex-col">
        <ConversaList
          conversas={conversasFiltradas}
          conversaSelecionada={conversaSelecionada}
          onSelect={selecionarConversa}
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
        enviando={enviando}
      />

      {/* Painel lateral */}
      <SidePanel conversa={conversaSelecionada} />
    </div>
  );
}
