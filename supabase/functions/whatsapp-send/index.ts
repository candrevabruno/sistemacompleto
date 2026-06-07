// Edge Function: whatsapp-send
// POST /functions/v1/whatsapp-send
// Envia mensagem via Evolution API ou Meta Cloud API
// Requer autenticação Supabase (Bearer token)

import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient, createUserClient } from '../_shared/supabase-client.ts';
import { WhatsAppService } from '../_shared/whatsapp.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    // ── Auth ─────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const userClient = createUserClient(authHeader);
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // ── Input ────────────────────────────────────────────────────
    const { phone, message, conversa_id, type = 'text', mediaUrl } = await req.json();
    if (!phone) return json({ error: 'phone é obrigatório' }, 400);
    if (type !== 'audio' && !message) return json({ error: 'message é obrigatório' }, 400);
    if (type === 'audio' && !mediaUrl) return json({ error: 'mediaUrl é obrigatório para áudio' }, 400);

    const db = createAdminClient();

    // ── Config ───────────────────────────────────────────────────
    const { data: config, error: cfgErr } = await db
      .from('clinic_config')
      .select(
        'whatsapp_provider, evolution_server_url, evolution_api_key, evolution_instance_name, meta_phone_number_id, meta_access_token',
      )
      .eq('id', 1)
      .single();

    if (cfgErr || !config?.whatsapp_provider) {
      return json({ error: 'WhatsApp não configurado em Configurações' }, 400);
    }

    // ── Send ─────────────────────────────────────────────────────
    const whatsapp = new WhatsAppService(config);
    let whatsappMsgId: string | undefined;

    try {
      let result: { whatsapp_message_id?: string };
      if (type === 'audio') {
        // mediaUrl vem como data URL (data:audio/webm;base64,...)
        const base64 = (mediaUrl as string).replace(/^data:[^;]+;base64,/, '');
        result = await whatsapp.sendAudio(phone, base64);
      } else {
        result = await whatsapp.sendText(phone, message);
      }
      whatsappMsgId = result.whatsapp_message_id;
    } catch (sendErr) {
      const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      console.error('whatsapp-send error:', msg);
      await db.from('whatsapp_logs').insert({
        provider: config.whatsapp_provider,
        direction: 'outbound',
        phone,
        message_type: type,
        payload: { message },
        status: 'error',
        error_message: msg,
      }).catch(() => {});
      return json({ error: msg }, 500);
    }

    // ── Salvar mensagem no banco ──────────────────────────────────
    const previewText = type === 'audio' ? '[Áudio]' : message;
    let mensagem: Record<string, unknown> | null = null;
    if (conversa_id) {
      const { data: msg } = await db
        .from('mensagens')
        .insert({
          conversa_id,
          conteudo: previewText,
          tipo: type,
          direcao: 'saida',
          status: 'enviado',
          whatsapp_message_id: whatsappMsgId ?? null,
          media_url: type === 'audio' ? (mediaUrl as string) : null,
        })
        .select()
        .single();

      if (msg) {
        mensagem = msg;
        await db
          .from('conversas')
          .update({ ultima_mensagem: previewText, ultima_mensagem_at: new Date().toISOString() })
          .eq('id', conversa_id);
      }
    }

    // ── Log ──────────────────────────────────────────────────────
    await db.from('whatsapp_logs').insert({
      provider: config.whatsapp_provider,
      direction: 'outbound',
      phone,
      message_type: type,
      payload: { message, whatsapp_message_id: whatsappMsgId },
      status: 'success',
    });

    return json({ success: true, whatsapp_message_id: whatsappMsgId, mensagem });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('whatsapp-send fatal:', msg);
    return json({ error: msg }, 500);
  }
});
