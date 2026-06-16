// Edge Function: cal-sync
// POST /functions/v1/cal-sync
// ClinicOS → Cal.com. Reflete no Cal.com ações feitas no painel (cancelar/reagendar
// uma reserva que veio do Cal.com). Requer autenticação Supabase + calcom_api_key salva.

import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase-client.ts';

const CAL_BASE = 'https://api.cal.com/v2';
const CAL_VERSION = '2026-02-25';     // bookings (cancel/reschedule)
const CAL_VERSION_OOO = '2024-08-13'; // out-of-office

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

    const { action, calcom_uid, start, end, reason } = await req.json();

    const db = createAdminClient();
    const { data: cfg } = await db.from('clinic_config').select('calcom_api_key').eq('id', 1).single();
    if (!cfg?.calcom_api_key) return json({ error: 'Cal.com API key não configurada' }, 400);

    const auth = `Bearer ${cfg.calcom_api_key}`;
    const headers = { Authorization: auth, 'cal-api-version': CAL_VERSION, 'Content-Type': 'application/json' };

    let res: Response;
    if (action === 'cancel') {
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
        method: 'POST',
        headers: { Authorization: auth, 'cal-api-version': CAL_VERSION_OOO, 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, end, reason: 'unspecified', notes: reason || 'Bloqueado pela clínica' }),
      });
    } else {
      return json({ error: 'action inválida' }, 400);
    }

    const text = await res.text();
    if (!res.ok) {
      console.error('cal-sync error:', res.status, text.slice(0, 300));
      return json({ error: `Cal.com ${res.status}: ${text.slice(0, 300)}` }, 502);
    }
    return json({ success: true, calcom: JSON.parse(text || '{}') });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('cal-sync fatal:', msg);
    return json({ error: msg }, 500);
  }
});
