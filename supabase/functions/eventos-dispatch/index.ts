// Edge Function: eventos-dispatch
// POST /functions/v1/eventos-dispatch
// ETAPA 6C — Módulo Eventos. Encaminha ações ao n8n server-side (evita CORS e esconde URLs):
//   action 'aniversario' → dispara a lista de aniversariantes ao WF de aniversário (n8n).
//   action 'upgrade'     → notifica a Heroic Leap via Resend (e-mail direto) ou fallback n8n webhook.
// Requer autenticação Supabase. URLs ficam em clinic_config.
// Para Resend: defina RESEND_API_KEY em Supabase Secrets.
//   supabase secrets set RESEND_API_KEY=re_xxxx

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

    const { action, pacientes, mensagem, solicitante, recurso } = await req.json();
    const db = createAdminClient();
    const { data: cfg } = await db.from('clinic_config')
      .select('nome, aniversario_webhook_url, upgrade_webhook_url, whatsapp_provider')
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
      if (!res.ok) return json({ error: `n8n ${res.status}: ${text.slice(0, 300)}` }, 502);
      return json({ success: true, total: lista.length });
    }

    if (action === 'upgrade') {
      const recursoLabel = recurso || 'módulo';
      const clinicaNome = cfg?.nome || 'Clínica sem nome';
      const solicitanteNome = solicitante || 'não informado';
      const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      let notificado = false;

      // Tenta Resend primeiro (e-mail direto, sem n8n)
      const resendKey = Deno.env.get('RESEND_API_KEY');
      if (resendKey) {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'ClinicOS <onboarding@resend.dev>',
              to: ['heroicleapoficial@gmail.com'],
              subject: `[ClinicOS] Solicitação de upgrade: ${recursoLabel} — ${clinicaNome}`,
              html: `
                <h2>Solicitação de upgrade — ClinicOS</h2>
                <table style="font-size:14px;line-height:1.6">
                  <tr><td><strong>Clínica:</strong></td><td>${clinicaNome}</td></tr>
                  <tr><td><strong>Recurso:</strong></td><td>${recursoLabel}</td></tr>
                  <tr><td><strong>Solicitante:</strong></td><td>${solicitanteNome}</td></tr>
                  <tr><td><strong>Data/hora:</strong></td><td>${agora}</td></tr>
                </table>
                <p style="color:#666;font-size:12px;margin-top:20px">Enviado automaticamente pelo ClinicOS.</p>
              `,
            }),
          });
          notificado = res.ok;
        } catch (_) { notificado = false; }
      }

      // Fallback: n8n webhook (se Resend não configurado ou falhou)
      if (!notificado && cfg?.upgrade_webhook_url) {
        try {
          const res = await fetch(cfg.upgrade_webhook_url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: 'upgrade', recurso: recursoLabel, clinica: clinicaNome,
              solicitante: solicitanteNome, solicitado_em: new Date().toISOString(),
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
