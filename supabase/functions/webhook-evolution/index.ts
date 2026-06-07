// Edge Function: webhook-evolution
// POST /functions/v1/webhook-evolution
// Recebe eventos da Evolution API e salva mensagens no Supabase
// Endpoint público — configure esta URL no painel da Evolution API

import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase-client.ts';

// Extrai número de telefone do remoteJid (ex: "5511999999999@s.whatsapp.net" → "5511999999999")
function extractPhone(remoteJid: string): string | null {
  if (!remoteJid) return null;
  if (remoteJid.includes('@g.us')) return null; // pula mensagens de grupo
  return remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '');
}

// Extrai texto e tipo da mensagem dependendo do messageType
function extractMessage(data: Record<string, unknown>): { content: string; type: string; mediaUrl?: string } {
  const msg = (data.message ?? {}) as Record<string, unknown>;
  const messageType = data.messageType as string;

  switch (messageType) {
    case 'conversation':
      return { content: (msg.conversation as string) || '', type: 'text' };
    case 'extendedTextMessage': {
      const ext = (msg.extendedTextMessage ?? {}) as Record<string, unknown>;
      return { content: (ext.text as string) || '', type: 'text' };
    }
    case 'imageMessage': {
      const img = (msg.imageMessage ?? {}) as Record<string, unknown>;
      return { content: (img.caption as string) || '[Imagem]', type: 'image', mediaUrl: img.url as string };
    }
    case 'audioMessage': {
      const aud = (msg.audioMessage ?? {}) as Record<string, unknown>;
      return { content: '[Áudio]', type: 'audio', mediaUrl: aud.url as string };
    }
    case 'documentMessage': {
      const doc = (msg.documentMessage ?? {}) as Record<string, unknown>;
      return { content: (doc.fileName as string) || '[Documento]', type: 'document', mediaUrl: doc.url as string };
    }
    case 'videoMessage': {
      const vid = (msg.videoMessage ?? {}) as Record<string, unknown>;
      return { content: (vid.caption as string) || '[Vídeo]', type: 'video', mediaUrl: vid.url as string };
    }
    default:
      return { content: '[Mensagem não suportada]', type: 'text' };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const ok = () => new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  try {
    const payload = await req.json();
    const event = payload.event as string;

    // Apenas processa mensagens recebidas/enviadas
    if (event !== 'messages.upsert') return ok();

    const data = payload.data as Record<string, unknown>;
    const key = (data.key ?? {}) as Record<string, unknown>;
    const remoteJid = key.remoteJid as string;
    const fromMe = key.fromMe as boolean;
    const evolutionMsgId = key.id as string;
    const pushName = (data.pushName as string) || null;

    const phone = extractPhone(remoteJid);
    if (!phone) return ok(); // pula grupos

    const { content, type, mediaUrl } = extractMessage(data);
    if (!content) return ok();

    const db = createAdminClient();

    // ── Deduplicação: mensagens que enviamos já foram salvas pelo whatsapp-send ──
    if (fromMe && evolutionMsgId) {
      const { data: existing } = await db
        .from('mensagens')
        .select('id')
        .eq('whatsapp_message_id', evolutionMsgId)
        .limit(1)
        .single();
      if (existing) return ok(); // já salva, ignorar
    }

    // ── Buscar ou criar conversa ─────────────────────────────────
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
      // Tentar vincular ao lead pelo número
      const { data: lead } = await db
        .from('leads')
        .select('id, nome')
        .or(`whatsapp.eq.${phone},whatsapp.ilike.%${phone}%`)
        .limit(1)
        .single();

      const { data: novaConversa, error: cErr } = await db
        .from('conversas')
        .insert({
          whatsapp_number: phone,
          nome_contato: pushName || lead?.nome || phone,
          provider: 'evolution',
          status: 'aberta',
          is_human: false,
          nao_lidas: 0,
          lead_id: lead?.id ?? null,
        })
        .select('id')
        .single();

      if (cErr || !novaConversa) {
        console.error('Erro ao criar conversa:', cErr);
        return ok();
      }
      conversaId = novaConversa.id;
    }

    // ── Inserir mensagem ─────────────────────────────────────────
    const timestamp = data.messageTimestamp
      ? new Date((data.messageTimestamp as number) * 1000).toISOString()
      : new Date().toISOString();

    await db.from('mensagens').insert({
      conversa_id: conversaId,
      conteudo: content,
      tipo: type,
      direcao: fromMe ? 'saida' : 'entrada',
      status: 'entregue',
      whatsapp_message_id: evolutionMsgId || null,
      media_url: mediaUrl ?? null,
      lida: false,
      created_at: timestamp,
    });

    // ── Atualizar conversa ───────────────────────────────────────
    const updateData: Record<string, unknown> = {
      ultima_mensagem: content,
      ultima_mensagem_at: timestamp,
      updated_at: new Date().toISOString(),
    };
    if (!fromMe) {
      // Incrementa não lidas apenas para mensagens recebidas
      const naoLidas = (existingConversa?.nao_lidas ?? 0) + 1;
      updateData.nao_lidas = naoLidas;
    }
    await db.from('conversas').update(updateData).eq('id', conversaId);

    // ── Log ──────────────────────────────────────────────────────
    await db.from('whatsapp_logs').insert({
      provider: 'evolution',
      direction: fromMe ? 'outbound' : 'inbound',
      phone,
      message_type: type,
      payload: data,
      status: 'success',
    });

    return ok();
  } catch (err) {
    console.error('webhook-evolution error:', err);
    // Sempre retorna 200 para a Evolution API não re-tentar
    return new Response(JSON.stringify({ received: true, error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
