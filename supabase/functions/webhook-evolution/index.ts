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

    // ── Regra 1: paciente apagou a mensagem no WhatsApp ──────────────
    // NÃO deletamos o registro: marcamos como apagada_pelo_contato.
    // O "apagar para todos" do contato chega de forma diferente entre builds:
    //   • 'messages.delete'  → sempre é apagamento
    //   • 'messages.update'  → só quando há sinal de revoke (status/stub/protocolMessage)
    if (event === 'messages.delete' || event === 'messages.update') {
      // Log de diagnóstico do payload bruto (visível em Edge Functions → Logs).
      console.log(`[apagar] event=${event} payload=`, JSON.stringify(payload.data).slice(0, 800));

      const raw = payload.data as unknown;
      const items = Array.isArray(raw) ? raw : [raw];
      const db = createAdminClient();
      let marcou = 0;

      for (const itemRaw of items) {
        const it = (itemRaw ?? {}) as Record<string, unknown>;
        const k = (it.key ?? it) as Record<string, unknown>;
        const msgId =
          (k.id as string) || (it.id as string) ||
          (it.keyId as string) || (it.messageId as string);
        if (!msgId) continue;

        // Em messages.update precisamos confirmar que é revoke (não um simples
        // update de status entregue/lido).
        if (event === 'messages.update') {
          const status = String((it.status as string) || '').toUpperCase();
          const stub = String((it.messageStubType as string | number) ?? '').toUpperCase();
          const upd = (it.update ?? {}) as Record<string, unknown>;
          const msgNode = (it.message ?? upd.message) as Record<string, unknown> | null;
          const proto = ((msgNode?.protocolMessage ?? {}) as Record<string, unknown>);
          const ehRevoke =
            status === 'DELETED' || status === 'REVOKED' ||
            stub.includes('REVOKE') ||
            proto.type === 'REVOKE' || proto.type === 0 ||
            ('message' in upd && upd.message === null);
          if (!ehRevoke) continue;
        }

        const { data: upd, error } = await db
          .from('mensagens')
          .update({ apagada_pelo_contato: true })
          .eq('whatsapp_message_id', msgId)
          .select('id');
        if (!error && upd && upd.length > 0) marcou += upd.length;

        await db.from('whatsapp_logs').insert({
          provider: 'evolution',
          direction: 'inbound',
          phone: extractPhone((k.remoteJid as string) || '') ?? '',
          message_type: 'delete',
          payload: it,
          status: upd && upd.length > 0 ? 'success' : 'no_match',
        });
      }
      console.log(`[apagar] mensagens marcadas: ${marcou}`);
      return ok();
    }

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

    // Regra 1 (variante): revoke chega como upsert com protocolMessage REVOKE.
    const msgObj = (data.message ?? {}) as Record<string, unknown>;
    const proto = (msgObj.protocolMessage ?? {}) as Record<string, unknown>;
    if (proto.type === 'REVOKE' || proto.type === 0) {
      const revokedKey = (proto.key ?? {}) as Record<string, unknown>;
      const revokedId = (revokedKey.id as string) || evolutionMsgId;
      if (revokedId) {
        const db = createAdminClient();
        await db
          .from('mensagens')
          .update({ apagada_pelo_contato: true })
          .eq('whatsapp_message_id', revokedId);
      }
      return ok();
    }

    const { content, type, mediaUrl: rawMediaUrl } = extractMessage(data);
    if (!content) return ok();

    const db = createAdminClient();

    // ── Para mensagens de mídia, buscar o base64 da Evolution API ──
    let mediaUrl: string | null = rawMediaUrl ?? null;
    if (['audio', 'image', 'video', 'document'].includes(type) && !fromMe) {
      // Tenta 1: base64 embutido no payload (quando webhook_base64=true na instância)
      const msg = (data.message ?? {}) as Record<string, unknown>;
      const mediaMsg = (msg[`${data.messageType}`] ?? {}) as Record<string, unknown>;
      const inlineBase64 = mediaMsg.base64 as string | undefined;
      const inlineMime = (mediaMsg.mimetype as string | undefined) ?? 'audio/ogg';
      if (inlineBase64) {
        mediaUrl = `data:${inlineMime};base64,${inlineBase64}`;
        console.log('media: base64 inline encontrado');
      } else {
        // Tenta 2: chamar endpoint da Evolution API para obter base64
        try {
          const { data: cfg } = await db
            .from('clinic_config')
            .select('evolution_server_url, evolution_api_key, evolution_instance_name')
            .eq('id', 1)
            .single();

          if (cfg?.evolution_server_url && cfg?.evolution_api_key) {
            const baseUrl = (cfg.evolution_server_url as string).replace(/\/+$/, '');
            const instance = cfg.evolution_instance_name as string;
            const apiKey = cfg.evolution_api_key as string;

            // Tenta /chat/ (Evolution API v2) e /message/ (v1) como fallback
            const endpoints = [
              `${baseUrl}/chat/getBase64FromMediaMessage/${instance}`,
              `${baseUrl}/message/getBase64FromMediaMessage/${instance}`,
            ];
            for (const endpoint of endpoints) {
              const mediaRes = await fetch(endpoint, {
                method: 'POST',
                headers: { apikey: apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: { key, message: data.message },
                  convertToMp4: false,
                }),
              });
              console.log(`media fetch [${endpoint.split('/').slice(-2).join('/')}]:`, mediaRes.status);
              if (mediaRes.status === 404) continue; // tenta próximo endpoint
              if (mediaRes.ok) {
                const mediaData = await mediaRes.json();
                console.log('media fetch keys:', Object.keys(mediaData));
                const b64 = mediaData.base64 ?? mediaData.data;
                const mime = mediaData.mimetype ?? inlineMime;
                if (b64) { mediaUrl = `data:${mime};base64,${b64}`; break; }
              } else {
                const errText = await mediaRes.text();
                console.error('media fetch error:', mediaRes.status, errText.slice(0, 200));
                break;
              }
            }
          }
        } catch (mediaErr) {
          console.error('Erro ao buscar mídia:', mediaErr);
        }
      }
    }

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
      .select('id, nao_lidas, lead_id')
      .eq('whatsapp_number', phone)
      .eq('status', 'aberta')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Para fromMe=true (mensagem enviada por nós), pushName é o nome da conta conectada,
    // não o nome do contato. Só usar pushName para mensagens recebidas do contato.
    const contactName = !fromMe ? pushName : null;

    if (existingConversa) {
      conversaId = existingConversa.id;

      // Se conversa existente não tem lead vinculado, tenta encontrar e vincular agora
      if (!existingConversa.lead_id) {
        const { data: lead } = await db
          .from('leads')
          .select('id, nome_lead')
          .or(`whatsapp_lead.eq.${phone},whatsapp_lead.ilike.%${phone}%`)
          .limit(1)
          .single();
        if (lead) {
          await db
            .from('conversas')
            .update({ lead_id: lead.id, nome_contato: contactName || lead.nome_lead })
            .eq('id', conversaId);
        } else if (contactName) {
          // Atualiza nome se chegou pushName e ainda não temos nome
          await db
            .from('conversas')
            .update({ nome_contato: contactName })
            .eq('id', conversaId);
        }
      }
    } else {
      // Tentar vincular ao lead existente pelo número
      let { data: lead } = await db
        .from('leads')
        .select('id, nome_lead')
        .or(`whatsapp_lead.eq.${phone},whatsapp_lead.ilike.%${phone}%`)
        .limit(1)
        .single();

      // ── Verificar se é um paciente retornando ─────────────────
      let tipoContato = 'novo';
      if (lead) {
        const { data: leadStatus } = await db
          .from('leads')
          .select('status')
          .eq('id', lead.id)
          .single();

        if (leadStatus?.status === 'converteu') {
          tipoContato = 'retorno';
          console.log(`Paciente retornando — lead_id: ${lead.id}, phone: ${phone}`);
        }
      }

      // Se não existe lead, criar automaticamente para entrar no CRM
      if (!lead && !fromMe) {
        const { data: novoLead } = await db
          .from('leads')
          .insert({
            whatsapp_lead: phone,
            nome_lead: contactName || null,
            status: 'iniciou_atendimento',
          })
          .select('id, nome_lead')
          .single();
        lead = novoLead;
      }

      const { data: novaConversa, error: cErr } = await db
        .from('conversas')
        .insert({
          whatsapp_number: phone,
          nome_contato: contactName || lead?.nome_lead || phone,
          provider: 'evolution',
          status: 'aberta',
          is_human: false,
          nao_lidas: 0,
          lead_id: lead?.id ?? null,
          tipo_contato: tipoContato,
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
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ received: true, error: msg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
