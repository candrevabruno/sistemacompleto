// Edge Function: whatsapp-delete
// POST /functions/v1/whatsapp-delete
// Apaga uma mensagem do Inbox respeitando as regras do WhatsApp:
//   • scope='todos' → apaga para todos via Evolution (só mensagem NOSSA, dentro da janela)
//   • scope='local' → some apenas do Inbox da clínica (qualquer mensagem)
// Em ambos os casos o registro permanece no banco (LGPD) e é logado em audit_log.
// Requer autenticação Supabase (Bearer token).

import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase-client.ts';
import { WhatsAppService } from '../_shared/whatsapp.ts';

// Janela do WhatsApp para "apagar para todos" (~2 dias). Usamos folga de segurança.
const JANELA_MS = 48 * 60 * 60 * 1000;

function parseJwtPayload(token: string): Record<string, unknown> {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

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
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    let userId: string | null = null;
    try {
      const payload = parseJwtPayload(authHeader.slice(7));
      if (payload.role !== 'authenticated') return json({ error: 'Unauthorized' }, 401);
      userId = (payload.sub as string) ?? null;
    } catch {
      return json({ error: 'Unauthorized' }, 401);
    }

    // ── Input ────────────────────────────────────────────────────
    const { mensagem_id, scope } = await req.json();
    if (!mensagem_id) return json({ error: 'mensagem_id é obrigatório' }, 400);
    if (scope !== 'todos' && scope !== 'local') return json({ error: 'scope inválido' }, 400);

    const db = createAdminClient();

    // ── Carrega a mensagem + a conversa (para o número) ───────────
    const { data: msg, error: msgErr } = await db
      .from('mensagens')
      .select('id, conversa_id, direcao, tipo, whatsapp_message_id, created_at, conversas:conversa_id(whatsapp_number)')
      .eq('id', mensagem_id)
      .single();
    if (msgErr || !msg) return json({ error: 'Mensagem não encontrada' }, 404);

    const phone = (msg.conversas as { whatsapp_number?: string } | null)?.whatsapp_number ?? null;
    const dentroJanela = Date.now() - new Date(msg.created_at as string).getTime() < JANELA_MS;
    const ehNossa = msg.direcao === 'saida' && msg.tipo !== 'sistema';

    let apagadaParaTodos = false;

    // ── Regra 2: apagar para todos (só nossa + dentro da janela) ──
    if (scope === 'todos') {
      if (!ehNossa) return json({ error: 'Só é possível apagar para todos uma mensagem enviada pela clínica.' }, 422);
      if (!dentroJanela) return json({ error: 'Fora da janela do WhatsApp — só é possível apagar localmente.' }, 422);
      if (!phone || !msg.whatsapp_message_id) return json({ error: 'Mensagem sem referência no WhatsApp.' }, 422);

      const { data: config, error: cfgErr } = await db
        .from('clinic_config')
        .select('whatsapp_provider, evolution_server_url, evolution_api_key, evolution_instance_name, meta_phone_number_id, meta_access_token')
        .eq('id', 1)
        .single();
      if (cfgErr || !config?.whatsapp_provider) return json({ error: 'WhatsApp não configurado' }, 400);

      try {
        const whatsapp = new WhatsAppService(config);
        await whatsapp.deleteForEveryone(phone, msg.whatsapp_message_id as string);
        apagadaParaTodos = true;
      } catch (sendErr) {
        const m = sendErr instanceof Error ? sendErr.message : String(sendErr);
        console.error('whatsapp-delete (todos) error:', m);
        return json({ error: `Falha ao apagar no WhatsApp: ${m}` }, 502);
      }
    }

    // ── Marca o registro (nunca deleta de fato — LGPD) ───────────
    const now = new Date().toISOString();
    await db
      .from('mensagens')
      .update({
        oculta_local: true,
        apagada_para_todos: apagadaParaTodos,
        apagada_por: userId,
        apagada_at: now,
      })
      .eq('id', mensagem_id);

    // ── Auditoria ────────────────────────────────────────────────
    await db.from('audit_log').insert({
      user_id: userId,
      action: scope === 'todos' ? 'mensagem_apagada_para_todos' : 'mensagem_oculta_local',
      record_id: mensagem_id,
      detalhes: {
        conversa_id: msg.conversa_id,
        scope,
        apagada_para_todos: apagadaParaTodos,
        dentro_janela: dentroJanela,
        direcao: msg.direcao,
        when: now,
      },
    });

    return json({ success: true, apagada_para_todos: apagadaParaTodos });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error('whatsapp-delete fatal:', m);
    return json({ error: m }, 500);
  }
});
