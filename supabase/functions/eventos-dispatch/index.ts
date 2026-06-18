// Edge Function: eventos-dispatch
// POST /functions/v1/eventos-dispatch
// ETAPA 6C — Módulo Eventos.
//   action 'aniversario'       → envia lista ao WF de aniversário do n8n (browser → edge → n8n).
//   action 'upgrade'           → notifica Heroic Leap via webhook n8n (que envia e-mail pelo Gmail).
//   action 'registrar_disparo' → chamado pelo n8n após enviar as mensagens; salva status no banco.
//
// Auth:
//   - Ações 'aniversario' e 'upgrade': requer Bearer JWT Supabase (usuário autenticado).
//   - Ação 'registrar_disparo': aceita JWT OU header X-Dispatch-Secret (para chamadas server-side do n8n).
//     Configure: supabase secrets set DISPATCH_SECRET=<string-aleatoria-longa>
//     No n8n: HTTP Request → Header "X-Dispatch-Secret: <valor>"

import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase-client.ts';
import { logIntegracao } from '../_shared/log.ts';

function parseJwt(token: string): Record<string, unknown> {
  const b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(b));
}

function isValidJwt(auth: string | null): boolean {
  if (!auth?.startsWith('Bearer ')) return false;
  try { return parseJwt(auth.slice(7)).role === 'authenticated'; }
  catch { return false; }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const auth = req.headers.get('Authorization');
    const dispatchSecret = req.headers.get('X-Dispatch-Secret');
    const envSecret = Deno.env.get('DISPATCH_SECRET');

    const body = await req.json();
    const { action, pacientes, mensagem, solicitante, recurso, total } = body;

    // Ação registrar_disparo: aceita JWT ou secret header (para chamada server-side do n8n)
    if (action === 'registrar_disparo') {
      const okJwt = isValidJwt(auth);
      const okSecret = envSecret && dispatchSecret === envSecret;
      if (!okJwt && !okSecret) return json({ error: 'Unauthorized' }, 401);

      const db = createAdminClient();
      const agora = new Date();
      const mes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
      const payload = { mes, enviado_em: agora.toISOString(), total: total ?? null };
      const { error } = await db.from('clinic_config')
        .update({ aniversario_last_dispatch: payload })
        .eq('id', 1);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, ...payload });
    }

    // Demais ações: JWT obrigatório
    if (!isValidJwt(auth)) return json({ error: 'Unauthorized' }, 401);

    const db = createAdminClient();
    const { data: cfg } = await db.from('clinic_config')
      .select('nome, aniversario_webhook_url, upgrade_webhook_url')
      .eq('id', 1).single();

    if (action === 'aniversario') {
      const lista = Array.isArray(pacientes) ? pacientes : [];
      if (lista.length === 0) return json({ error: 'Nenhum aniversariante na lista.' }, 400);
      if (!cfg?.aniversario_webhook_url) return json({ error: 'Webhook de aniversário não configurado (Configurações → Webhooks).' }, 400);
      const res = await fetch(cfg.aniversario_webhook_url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'aniversario', clinica: cfg.nome || null,
          mensagem: mensagem || '', total: lista.length,
          pacientes: lista, enviado_em: new Date().toISOString(),
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        await logIntegracao('n8n_eventos', 'error', 'eventos-dispatch', `n8n ${res.status}: ${text.slice(0, 200)}`, { status: res.status });
        return json({ error: `n8n ${res.status}: ${text.slice(0, 300)}` }, 502);
      }
      await logIntegracao('n8n_eventos', 'info', 'eventos-dispatch', `Aniversário disparado: ${lista.length} contato(s)`);
      return json({ success: true, total: lista.length });
    }

    if (action === 'upgrade') {
      // Notifica Heroic Leap via n8n webhook (n8n envia e-mail pelo Gmail).
      let notificado = false;
      if (cfg?.upgrade_webhook_url) {
        try {
          const res = await fetch(cfg.upgrade_webhook_url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: 'upgrade', recurso: recurso || 'módulo',
              clinica: cfg.nome || null, solicitante: solicitante || null,
              solicitado_em: new Date().toISOString(),
            }),
          });
          notificado = res.ok;
        } catch (_) { notificado = false; }
      }
      return json({ success: true, notificado });
    }

    return json({ error: 'action inválida' }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('eventos-dispatch erro:', msg);
    await logIntegracao('n8n_eventos', 'error', 'eventos-dispatch', msg);
    return json({ error: msg }, 500);
  }
});
