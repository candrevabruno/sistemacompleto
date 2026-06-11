// Edge Function: webhook-meta
// GET  /functions/v1/webhook-meta  → verificação do webhook Meta
// POST /functions/v1/webhook-meta  → recebe mensagens da Meta Cloud API
// Endpoint público

import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase-client.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── GET: verificação de token (Meta exige) ────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode !== 'subscribe' || !token) {
      return new Response('Forbidden', { status: 403 });
    }

    // Verificar token contra o salvo no banco
    const db = createAdminClient();
    const { data: config } = await db
      .from('clinic_config')
      .select('meta_webhook_verify_token')
      .eq('id', 1)
      .single();

    if (!config?.meta_webhook_verify_token || token !== config.meta_webhook_verify_token) {
      return new Response('Forbidden', { status: 403 });
    }

    return new Response(challenge ?? '', { status: 200 });
  }

  // ── POST: receber mensagens ───────────────────────────────────
  // Meta exige resposta 200 imediata — processar de forma assíncrona
  const processAsync = async () => {
    try {
      const payload = await req.json();
      if (payload.object !== 'whatsapp_business_account') return;

      const db = createAdminClient();
      const entries = payload.entry ?? [];

      for (const entry of entries) {
        const changes = entry.changes ?? [];
        for (const change of changes) {
          if (change.field !== 'messages') continue;
          const value = change.value ?? {};
          const messages = value.messages ?? [];
          const contacts = value.contacts ?? [];

          for (const msg of messages) {
            const phone = msg.from as string;
            const metaMsgId = msg.id as string;
            const timestamp = msg.timestamp
              ? new Date((parseInt(msg.timestamp) as number) * 1000).toISOString()
              : new Date().toISOString();

            // Extrair nome do contato
            const contact = contacts.find((c: Record<string, unknown>) => c.wa_id === phone);
            const pushName = (contact?.profile as Record<string, unknown>)?.name as string || null;

            // Extrair conteúdo
            let content = '';
            let type = 'text';
            let mediaUrl: string | undefined;

            if (msg.type === 'text') {
              content = msg.text?.body ?? '';
            } else if (msg.type === 'image') {
              content = msg.image?.caption || '[Imagem]';
              type = 'image';
            } else if (msg.type === 'audio') {
              content = '[Áudio]';
              type = 'audio';
            } else if (msg.type === 'document') {
              content = msg.document?.filename || '[Documento]';
              type = 'document';
            } else if (msg.type === 'video') {
              content = msg.video?.caption || '[Vídeo]';
              type = 'video';
            } else {
              content = '[Mensagem não suportada]';
            }

            if (!content) continue;

            // Deduplicação
            const { data: existing } = await db
              .from('mensagens')
              .select('id')
              .eq('whatsapp_message_id', metaMsgId)
              .limit(1)
              .single();
            if (existing) continue;

            // Buscar ou criar conversa
            let conversaId: string;
            const { data: existingConversa } = await db
              .from('conversas')
              .select('id, nao_lidas')
              .eq('whatsapp_number', phone)
              .eq('status', 'aberta')
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (existingConversa) {
              conversaId = existingConversa.id;
            } else {
              const { data: lead } = await db
                .from('leads')
                .select('id, nome_lead')
                .or(`whatsapp_lead.eq.${phone},whatsapp_lead.ilike.%${phone}%`)
                .limit(1)
                .single();

              const { data: novaConversa } = await db
                .from('conversas')
                .insert({
                  whatsapp_number: phone,
                  nome_contato: pushName || lead?.nome_lead || phone,
                  provider: 'meta',
                  status: 'aberta',
                  is_human: false,
                  nao_lidas: 0,
                  lead_id: lead?.id ?? null,
                })
                .select('id')
                .single();

              if (!novaConversa) continue;
              conversaId = novaConversa.id;
            }

            // Inserir mensagem
            await db.from('mensagens').insert({
              conversa_id: conversaId,
              conteudo: content,
              tipo: type,
              direcao: 'entrada',
              status: 'entregue',
              whatsapp_message_id: metaMsgId,
              media_url: mediaUrl ?? null,
              lida: false,
              created_at: timestamp,
            });

            // Atualizar conversa
            await db.from('conversas').update({
              ultima_mensagem: content,
              ultima_mensagem_at: timestamp,
              nao_lidas: (existingConversa?.nao_lidas ?? 0) + 1,
              updated_at: new Date().toISOString(),
            }).eq('id', conversaId);

            // Log
            await db.from('whatsapp_logs').insert({
              provider: 'meta',
              direction: 'inbound',
              phone,
              message_type: type,
              payload: msg,
              status: 'success',
            });
          }
        }
      }
    } catch (err) {
      console.error('webhook-meta process error:', err);
    }
  };

  // Responde 200 imediatamente (requisito Meta) e processa em background
  processAsync();
  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
