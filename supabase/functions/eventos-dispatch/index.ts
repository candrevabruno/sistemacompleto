// Edge Function: eventos-dispatch
// POST /functions/v1/eventos-dispatch
// ETAPA 6C — Módulo Eventos. Encaminha ações ao n8n server-side (evita CORS e esconde URLs):
//   action 'aniversario' → dispara a lista de aniversariantes + mensagem ao WF de aniversário.
//   action 'upgrade'     → notifica a Heroic Leap que a clínica pediu para liberar o módulo.
// Requer autenticação Supabase. URLs ficam em clinic_config.

import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase-client.ts';

function parseJwt(token: string): Record<string, unknown> {
  const b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(b));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    try { if (parseJwt(auth.slice(7)).role !== 'authenticated') return json({ error: 'Unauthorized' }, 401); }
    catch { return json({ error: 'Unauthorized' }, 401); }

    const { action, mensagem, pacientes, solicitante, recurso } = await req.json();
    const db = createAdminClient();
    const { data: cfg } = await db.from('clinic_config')
      .select('nome, aniversario_webhook_url, upgrade_webhook_url, whatsapp_provider')
      .eq('id', 1).single();

    if (action === 'aniversario') {
      const lista = Array.isArray(pacientes) ? pacientes : [];
      if (lista.length === 0) return json({ error: 'Nenhum aniversariante na lista.' }, 400);
      if (!cfg?.aniversario_webhook_url) return json({ error: 'Webhook de aniversário não configurado (Configurações → Eventos).' }, 400);
      const res = await fetch(cfg.aniversario_webhook_url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'aniversario', clinica: cfg.nome || null,
          mensagem: mensagem || '', total: lista.length,
          pacientes: lista, enviado_em: new Date().toISOString(),
        }),
      });
      const text = await res.text();
      if (!res.ok) return json({ error: `n8n ${res.status}: ${text.slice(0, 300)}` }, 502);
      return json({ success: true, total: lista.length });
    }

    if (action === 'upgrade') {
      // Notifica a Heroic Leap (best-effort). Se não houver webhook, registra mesmo assim.
      let notificado = false;
      if (cfg?.upgrade_webhook_url) {
        try {
          const res = await fetch(cfg.upgrade_webhook_url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: 'upgrade', recurso: recurso || 'eventos', clinica: cfg.nome || null,
              solicitante: solicitante || null, solicitado_em: new Date().toISOString(),
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
    return json({ error: msg }, 500);
  }
});
