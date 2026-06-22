// Edge Function: cal-webhook
// POST /functions/v1/cal-webhook
// Recebe eventos do Cal.com (BOOKING_CREATED/RESCHEDULED/CANCELLED) e sincroniza
// com a agenda do ClinicOS. Endpoint público — configure esta URL no Cal.com.
// Valida a assinatura x-cal-signature-256 (HMAC-SHA256) com o secret salvo em clinic_config.

import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase-client.ts';

function digits(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '');
}

async function assinaturaValida(secret: string | null | undefined, rawBody: string, header: string | null): Promise<boolean> {
  if (!secret) return true; // sem secret configurado → não bloqueia (recomenda-se configurar)
  if (!header) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === header.toLowerCase();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const ok = () => new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const raw = await req.text();
    const db = createAdminClient();

    const { data: cfg } = await db.from('clinic_config').select('calcom_webhook_secret').eq('id', 1).single();
    const sig = req.headers.get('x-cal-signature-256');
    if (!(await assinaturaValida(cfg?.calcom_webhook_secret, raw, sig))) {
      return new Response(JSON.stringify({ error: 'invalid signature' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = JSON.parse(raw);
    const evt = body.triggerEvent as string;
    const p = (body.payload ?? {}) as Record<string, any>;
    const uid = p.uid as string | undefined;
    console.log(`[cal] event=${evt} uid=${uid}`);
    if (!uid) return ok();

    // ── Mapeia profissional (agenda) pelo event-type ──
    let agenda_id: string | null = null;
    const etid = p.eventTypeId != null ? String(p.eventTypeId) : null;
    if (etid) {
      const { data: ag } = await db.from('agendas').select('id').eq('calcom_event_type_id', etid).limit(1).maybeSingle();
      agenda_id = ag?.id ?? null;
    }
    if (!agenda_id) {
      // Sem mapeamento: se houver só uma agenda ativa, usa ela.
      const { data: ags } = await db.from('agendas').select('id').eq('ativo', true);
      if (ags && ags.length === 1) agenda_id = ags[0].id;
    }

    // ── CANCELAMENTO: libera o slot + aciona lista de espera ──
    if (evt === 'BOOKING_CANCELLED') {
      const { data: upd } = await db.from('agendamentos')
        .update({ status: 'cancelado' }).eq('calcom_uid', uid).neq('status', 'cancelado').select('id, agenda_id, data_hora_inicio, lead_id, procedimento_nome');
      if (upd && upd.length > 0) {
        const a = upd[0];
        await db.from('agente_eventos').insert({
          tipo: 'slot_liberado', agendamento_id: a.id, lead_id: a.lead_id, agenda_id: a.agenda_id,
          payload: { motivo: 'cancelado_calcom', quando: a.data_hora_inicio, procedimento: a.procedimento_nome },
        });
      }
      return ok();
    }

    // ── Dados comuns (create/reschedule) ──
    const att = (Array.isArray(p.attendees) && p.attendees[0]) || {};
    const phone = digits(att.phoneNumber || p.responses?.phone?.value || p.responses?.attendeePhoneNumber?.value || '');
    const email = (att.email as string) || (p.responses?.email?.value as string) || null;
    const nome = (att.name as string) || (p.responses?.name?.value as string) || 'Paciente';
    const inicio = p.startTime ? new Date(p.startTime).toISOString() : null;
    const link = (p.videoCallData?.url as string) || (p.metadata?.videoCallUrl as string) || null;
    const online = !!link || /cal video|google meet|zoom|video|integrations:/i.test(String(p.location || ''));
    const modalidade = online ? 'online' : 'presencial';

    // ── Encontra/cria o lead ──
    // Prioridade 1: lead_id explícito no metadata do booking (enviado pelo agente).
    //   É a chave à prova de duplicidade — quando presente e válido, NUNCA cria lead novo.
    // Prioridade 2: telefone. Prioridade 3: email real (ignora placeholders @sememail.local).
    //   Só cria lead novo se for um booking sem origem conhecida (ex.: link público
    //   do Cal.com, sem conversa prévia no WhatsApp).
    const emailReal = email && !email.endsWith('sememail.local') ? email : null;
    let lead_id: string | null = null;
    const metaLeadId = (p.metadata?.lead_id as string) || null;
    if (metaLeadId) {
      const { data: lm } = await db.from('leads').select('id').eq('id', metaLeadId).maybeSingle();
      lead_id = lm?.id ?? null;
    }
    if (!lead_id && phone) {
      // Normaliza para os últimos 11 dígitos (DDD + número BR) para cobrir
      // divergências de formato: Cal.com envia "5521999999999", banco pode ter "21999999999".
      const phoneLast11 = phone.length > 11 ? phone.slice(-11) : phone;
      const orParts = [`whatsapp_lead.eq.${phone}`];
      if (phoneLast11 !== phone) orParts.push(`whatsapp_lead.eq.${phoneLast11}`);
      orParts.push(`whatsapp_lead.ilike.%${phoneLast11}%`);
      const { data: l } = await db.from('leads').select('id').or(orParts.join(',')).limit(1).maybeSingle();
      lead_id = l?.id ?? null;
    }
    if (!lead_id && emailReal) {
      const { data: l2 } = await db.from('leads').select('id').eq('email', emailReal).limit(1).maybeSingle();
      lead_id = l2?.id ?? null;
    }
    if (!lead_id) {
      const { data: novo } = await db.from('leads').insert({
        nome_lead: nome, whatsapp_lead: phone || null, email: emailReal,
        status: 'agendado', origem: 'calcom',
        inicio_atendimento: new Date().toISOString(), data_agendamento: inicio,
      }).select('id').single();
      lead_id = novo?.id ?? null;
    }

    // ── REAGENDAMENTO: atualiza a MESMA linha (mantém o episódio, libera o slot antigo) ──
    // O Cal.com gera um uid NOVO no reschedule. Procuramos a reserva original por:
    //   1) uid novo  → quando o reagendamento partiu do sistema, a linha já tem o novo uid;
    //   2) uid original presente no payload → reschedule feito direto no Cal.com;
    //   3) fallback → único agendamento ativo do lead.
    // Como atualizamos a própria linha (não inserimos outra), o slot antigo é liberado
    // automaticamente e o episodio_atendimento é preservado (mesmo episódio).
    if (evt === 'BOOKING_RESCHEDULED') {
      // Log para diagnóstico: registra quais campos de origUid estão presentes no payload.
      console.log('[cal] RESCHEDULED body keys:', Object.keys(body).join(','));
      console.log('[cal] RESCHEDULED payload keys:', Object.keys(p).join(','));
      console.log('[cal] RESCHEDULED uid candidates:', JSON.stringify({
        'p.rescheduleUid': p.rescheduleUid,
        'p.rescheduledFromUid': p.rescheduledFromUid,
        'p.fromReschedule': p.fromReschedule,
        'p.originalRescheduledBooking?.uid': p.originalRescheduledBooking?.uid,
        'body.rescheduleUid': body.rescheduleUid,
        'body.rescheduledFromUid': body.rescheduledFromUid,
        'p.previousBooking?.uid': p.previousBooking?.uid,
      }));
      const origUid = (p.rescheduleUid || p.rescheduledFromUid || p.fromReschedule
        || p.originalRescheduledBooking?.uid || p.previousBooking?.uid
        || body.rescheduleUid || body.rescheduledFromUid) ?? null;

      let alvoId: string | null = null;
      let episodioId: string | null = null;
      for (const u of [uid, origUid].filter(Boolean) as string[]) {
        const { data: row } = await db.from('agendamentos')
          .select('id, episodio_id').eq('calcom_uid', u).limit(1).maybeSingle();
        if (row) { alvoId = row.id; episodioId = row.episodio_id; break; }
      }
      if (!alvoId && lead_id) {
        const { data: ativos } = await db.from('agendamentos')
          .select('id, episodio_id').eq('lead_id', lead_id)
          .not('status', 'in', '("cancelado","cancelou_agendamento","faltou","compareceu")');
        if (ativos && ativos.length === 1) { alvoId = ativos[0].id; episodioId = ativos[0].episodio_id; }
      }

      if (alvoId) {
        await db.from('agendamentos').update({
          data_hora_inicio: inicio, link_reuniao: link, modalidade,
          status: 'reagendado', calcom_uid: uid,
        }).eq('id', alvoId);

        // Mesmo episódio: atualiza a data pretendida e conta o reagendamento.
        if (episodioId) {
          const { data: ep } = await db.from('episodio_atendimento')
            .select('n_reagendamentos').eq('id', episodioId).maybeSingle();
          await db.from('episodio_atendimento').update({
            scheduled_for: inicio,
            n_reagendamentos: (ep?.n_reagendamentos ?? 0) + 1,
            final_status: null, final_status_at: null,
          }).eq('id', episodioId);
        }

        if (lead_id) {
          await db.from('leads').update({ status: 'reagendado', data_agendamento: inicio }).eq('id', lead_id);
        }

        // Notifica o agente (n8n) para agir se precisar.
        await db.from('agente_eventos').insert({
          tipo: 'agendamento_reagendado', agendamento_id: alvoId, lead_id, agenda_id,
          payload: { novo_horario: inicio, calcom_uid: uid },
        });
        return ok();
      }
      // Não achou a reserva original → trata como novo (cai no insert abaixo).
    }

    // ── CRIAÇÃO (ou reschedule sem registro prévio) ──
    if (evt === 'BOOKING_CREATED' || evt === 'BOOKING_RESCHEDULED') {
      const { data: existe } = await db.from('agendamentos').select('id').eq('calcom_uid', uid).limit(1).maybeSingle();
      if (existe) return ok(); // dedupe por uid
      // Dedupe extra: se já há agendamento ativo no mesmo profissional/horário
      // (ex.: reagendamento iniciado no painel que gerou este webhook), vincula o uid em vez de duplicar.
      if (agenda_id && inicio) {
        const { data: mesmo } = await db.from('agendamentos').select('id')
          .eq('agenda_id', agenda_id).eq('data_hora_inicio', inicio)
          .not('status', 'in', '("cancelado","cancelou_agendamento","faltou")').limit(1).maybeSingle();
        if (mesmo) {
          await db.from('agendamentos').update({ calcom_uid: uid, link_reuniao: link, modalidade }).eq('id', mesmo.id);
          return ok();
        }
      }
      await db.from('agendamentos').insert({
        agenda_id, lead_id, nome_lead: nome, whatsapp_lead: phone || null,
        procedimento_nome: (p.title as string) || (p.metadata?.procedimento_nome as string) || null,
        data_hora_inicio: inicio, status: 'agendado',
        modalidade, link_reuniao: link, calcom_uid: uid,
      });
      if (lead_id) {
        await db.from('leads').update({ data_agendamento: inicio, status: 'agendado' }).eq('id', lead_id);
      }
    }

    return ok();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('cal-webhook error:', msg);
    // 200 para o Cal.com não re-tentar em loop por erro nosso.
    return new Response(JSON.stringify({ received: true, error: msg }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
