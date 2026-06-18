// Edge Function: intake
// POST /functions/v1/intake
// ETAPA 7 — recepção de dados gravados pelo n8n (server-side) nos fluxos LGPD e pós-consulta.
//   action 'consentimento' → grava consentimento LGPD no paciente (Parte 1).
//   action 'csat' | 'nps' | 'reativacao' → registra respostas pós-consulta (Parte 4 — placeholders).
//
// Auth: aceita Bearer JWT Supabase OU header X-Dispatch-Secret == DISPATCH_SECRET
//   (mesmo padrão de eventos-dispatch — permite chamada server-side do n8n sem sessão de usuário).
//   Configure: supabase secrets set DISPATCH_SECRET=<string-aleatoria-longa>
//   No n8n: HTTP Request → Header "X-Dispatch-Secret: <valor>"

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

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Localiza o paciente por lead_id, cpf (via hash) ou telefone do lead.
async function resolverPaciente(
  db: ReturnType<typeof createAdminClient>,
  body: Record<string, unknown>,
): Promise<{ pacienteId: string | null; leadId: string | null }> {
  const leadId = (body.lead_id as string) || null;
  const pacienteId = (body.paciente_id as string) || null;

  if (pacienteId) {
    const { data } = await db.from('pacientes').select('id, lead_id').eq('id', pacienteId).maybeSingle();
    if (data) return { pacienteId: data.id, leadId: data.lead_id };
  }
  if (leadId) {
    const { data } = await db.from('pacientes').select('id, lead_id').eq('lead_id', leadId).maybeSingle();
    return { pacienteId: data?.id ?? null, leadId };
  }
  if (body.cpf) {
    const hash = await sha256Hex(String(body.cpf).replace(/\D/g, ''));
    const { data } = await db.from('pacientes').select('id, lead_id').eq('cpf_hash', hash).maybeSingle();
    if (data) return { pacienteId: data.id, leadId: data.lead_id };
  }
  if (body.telefone) {
    const tel = String(body.telefone).replace(/\D/g, '');
    const { data: lead } = await db.from('leads').select('id').ilike('whatsapp_lead', `%${tel}%`).maybeSingle();
    if (lead) {
      const { data: pac } = await db.from('pacientes').select('id').eq('lead_id', lead.id).maybeSingle();
      return { pacienteId: pac?.id ?? null, leadId: lead.id };
    }
  }
  return { pacienteId, leadId };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const auth = req.headers.get('Authorization');
    const dispatchSecret = req.headers.get('X-Dispatch-Secret');
    const envSecret = Deno.env.get('DISPATCH_SECRET');

    const okJwt = isValidJwt(auth);
    const okSecret = envSecret && dispatchSecret === envSecret;
    if (!okJwt && !okSecret) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const { action } = body;
    const db = createAdminClient();

    if (action === 'consentimento') {
      const { pacienteId } = await resolverPaciente(db, body);
      if (!pacienteId) return json({ error: 'Paciente não encontrado (informe lead_id, paciente_id, cpf ou telefone).' }, 404);
      const origem = ['tally', 'whatsapp', 'manual'].includes(body.origem) ? body.origem : 'whatsapp';
      const { error } = await db.from('pacientes').update({
        consentimento_dado_em: body.dado_em || new Date().toISOString(),
        consentimento_origem: origem,
        consentimento_texto: body.texto || null,
        consentimento_revogado_em: null,
      }).eq('id', pacienteId);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, paciente_id: pacienteId, origem });
    }

    // ── Parte 4: CSAT (2d pós-consulta) ──────────────────────────────────────
    if (action === 'csat') {
      const { pacienteId, leadId } = await resolverPaciente(db, body);
      if (!leadId && !pacienteId) return json({ error: 'Paciente não encontrado.' }, 404);
      const score = Number(body.score);
      if (!score || score < 1 || score > 5) return json({ error: 'score inválido (1–5).' }, 400);
      const { error } = await db.from('csat_respostas').insert({
        lead_id: leadId, paciente_id: pacienteId,
        score, comentario: body.comentario || null,
        canal: body.canal || 'whatsapp',
      });
      if (error) return json({ error: error.message }, 500);
      await logIntegracao('n8n_intake', 'info', 'intake', `CSAT recebido: ${score}/5`);
      return json({ success: true, action: 'csat', score });
    }

    // ── Parte 4: NPS (45d pós-consulta) ───────────────────────────────────────
    if (action === 'nps') {
      const { pacienteId, leadId } = await resolverPaciente(db, body);
      if (!leadId && !pacienteId) return json({ error: 'Paciente não encontrado.' }, 404);
      const score = Number(body.score);
      if (score === undefined || score < 0 || score > 10) return json({ error: 'score inválido (0–10).' }, 400);
      const { error } = await db.from('nps_respostas').insert({
        lead_id: leadId, paciente_id: pacienteId,
        score, comentario: body.comentario || null,
        canal: body.canal || 'whatsapp',
      });
      if (error) return json({ error: error.message }, 500);
      const tipo = score >= 9 ? 'promotor' : score >= 7 ? 'neutro' : 'detrator';
      await logIntegracao('n8n_intake', 'info', 'intake', `NPS recebido: ${score}/10 (${tipo})`);
      return json({ success: true, action: 'nps', score, tipo });
    }

    // ── Parte 4: Reativação (60d / 180d pós-consulta) ──────────────────────────
    if (action === 'reativacao') {
      const { leadId } = await resolverPaciente(db, body);
      if (!leadId) return json({ error: 'Lead não encontrado.' }, 404);
      // Registra o contato de reativação no log de integração
      const respondeu = body.respondeu === true || body.respondeu === 'true';
      await logIntegracao('n8n_intake', 'info', 'intake',
        `Reativação ${respondeu ? 'aceita' : 'tentada'}: lead ${leadId}`);
      return json({ success: true, action: 'reativacao', lead_id: leadId, respondeu });
    }

    return json({ error: 'action inválida' }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('intake erro:', msg);
    return json({ error: msg }, 500);
  }
});
