// Edge Function: cal-sync
// POST /functions/v1/cal-sync
// ClinicOS → Cal.com. Reflete no Cal.com as ações feitas no painel:
//   create     → cria a reserva no Cal.com (agendamento manual)
//   cancel     → cancela a reserva
//   reschedule → reagenda (gera novo uid)
//   block      → cria Out-of-Office (bloqueio/férias)
//   unblock    → remove o Out-of-Office (desbloquear)
// Requer autenticação Supabase + calcom_api_key salva em clinic_config.

import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase-client.ts';

const CAL_BASE = 'https://api.cal.com/v2';
const CAL_VERSION = '2026-02-25';     // bookings (create/cancel/reschedule)
const CAL_VERSION_OOO = '2024-08-13'; // out-of-office (create/delete)
const TZ_PADRAO = 'America/Sao_Paulo';

function parseJwt(token: string): Record<string, unknown> {
  const b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(b));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const reqAuth = req.headers.get('Authorization');
    if (!reqAuth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    try { if (parseJwt(reqAuth.slice(7)).role !== 'authenticated') return json({ error: 'Unauthorized' }, 401); }
    catch { return json({ error: 'Unauthorized' }, 401); }

    const { action, calcom_uid, start, end, reason, eventTypeId, attendee, timeZone, ooo_id } = await req.json();

    const db = createAdminClient();
    const { data: cfg } = await db.from('clinic_config').select('calcom_api_key').eq('id', 1).single();
    if (!cfg?.calcom_api_key) return json({ error: 'Cal.com API key não configurada' }, 400);

    const apiAuth = `Bearer ${cfg.calcom_api_key}`;
    const headers = { Authorization: apiAuth, 'cal-api-version': CAL_VERSION, 'Content-Type': 'application/json' };
    const headersOoo = { Authorization: apiAuth, 'cal-api-version': CAL_VERSION_OOO, 'Content-Type': 'application/json' };

    let res: Response;
    if (action === 'create') {
      if (!eventTypeId) return json({ error: 'eventTypeId obrigatório' }, 400);
      if (!start) return json({ error: 'start obrigatório' }, 400);
      const att: Record<string, unknown> = {
        name: attendee?.name || 'Paciente',
        email: attendee?.email || `agendamento.${Date.now()}@sememail.local`,
        timeZone: attendee?.timeZone || timeZone || TZ_PADRAO,
        language: attendee?.language || 'pt',
      };
      if (attendee?.phoneNumber) att.phoneNumber = attendee.phoneNumber;
      res = await fetch(`${CAL_BASE}/bookings`, {
        method: 'POST', headers,
        body: JSON.stringify({ start, eventTypeId: Number(eventTypeId), attendee: att }),
      });
    } else if (action === 'cancel') {
      if (!calcom_uid) return json({ error: 'calcom_uid obrigatório' }, 400);
      res = await fetch(`${CAL_BASE}/bookings/${calcom_uid}/cancel`, {
        method: 'POST', headers, body: JSON.stringify({ cancellationReason: reason || 'Cancelado pela clínica' }),
      });
    } else if (action === 'reschedule') {
      if (!calcom_uid) return json({ error: 'calcom_uid obrigatório' }, 400);
      if (!start) return json({ error: 'start obrigatório' }, 400);
      res = await fetch(`${CAL_BASE}/bookings/${calcom_uid}/reschedule`, {
        method: 'POST', headers, body: JSON.stringify({ start, reschedulingReason: reason || 'Reagendado pela clínica' }),
      });
    } else if (action === 'block') {
      // Out-of-Office: bloqueia a disponibilidade do profissional no Cal.com.
      if (!start || !end) return json({ error: 'start e end obrigatórios' }, 400);
      res = await fetch(`${CAL_BASE}/out-of-office`, {
        method: 'POST', headers: headersOoo,
        body: JSON.stringify({ start, end, reason: 'unspecified', notes: reason || 'Bloqueado pela clínica' }),
      });
    } else if (action === 'unblock') {
      // Remove o Out-of-Office (desbloquear).
      if (!ooo_id) return json({ error: 'ooo_id obrigatório' }, 400);
      res = await fetch(`${CAL_BASE}/out-of-office/${ooo_id}`, { method: 'DELETE', headers: headersOoo });
    } else {
      return json({ error: 'action inválida' }, 400);
    }

    const text = await res.text();
    if (!res.ok) {
      console.error('cal-sync error:', action, res.status, text.slice(0, 400));
      return json({ error: `Cal.com ${res.status}: ${text.slice(0, 400)}` }, 502);
    }
    return json({ success: true, calcom: JSON.parse(text || '{}') });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('cal-sync fatal:', msg);
    return json({ error: msg }, 500);
  }
});
