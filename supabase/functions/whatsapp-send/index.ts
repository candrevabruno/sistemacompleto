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
    const { phone, message, conversa_id, type = 'text' } = await req.json();
    if (!phone || !message) return json({ error: 'phone e message são obrigatórios' }, 400);

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
      const result = await whatsapp.sendText(phone, message);
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
      });
      return json({ error: msg }, 500);
    }

    // ── Salvar mensagem no banco ──────────────────────────────────
    let mensagem: Record<string, unknown> | null = null;
    if (conversa_id) {
      const { data: msg } = await db
        .from('mensagens')
        .insert({
          conversa_id,
          conteudo: message,
          tipo: type,
          direcao: 'saida',
          status: 'enviado',
          whatsapp_message_id: whatsappMsgId ?? null,
        })
        .select()
        .single();

      if (msg) {
        mensagem = msg;
        // Atualizar preview da conversa
        await db
          .from('conversas')
          .update({ ultima_mensagem: message, ultima_mensagem_at: new Date().toISOString() })
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
