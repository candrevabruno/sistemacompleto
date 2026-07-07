// Edge Function: cal-webhook
// POST /functions/v1/cal-webhook
// Recebe eventos do Cal.com (BOOKING_CREATED/RESCHEDULED/CANCELLED) e sincroniza
// com a agenda do ClinicOS. Endpoint público — configure esta URL no Cal.com.
// Valida a assinatura x-cal-signature-256 (HMAC-SHA256) com o secret salvo em clinic_config.

import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase-client.ts';
import { WhatsAppService } from '../_shared/whatsapp.ts';

function digits(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '');
}

function fmtData(iso: string | null | undefined, tz: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz });
}

function fmtHora(iso: string | null | undefined, tz: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz });
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

async function notificarGrupo(
  cfg: Record<string, any>,
  texto: string,
  db: ReturnType<typeof createAdminClient>,
): Promise<void> {
  const grupoNum = cfg.grupo_whatsapp_numero as string | null;
  if (!grupoNum) return;
  const jid = grupoNum.includes('@') ? grupoNum : `${grupoNum}@g.us`;
  try {
    const ws = new WhatsAppService({
      whatsapp_provider: (cfg.whatsapp_provider as 'evolution' | 'meta') || 'evolution',
      evolution_server_url: cfg.evolution_server_url as string | null,
      evolution_api_key: cfg.evolution_api_key as string | null,
      evolution_instance_name: cfg.evolution_instance_name as string | null,
      meta_phone_number_id: cfg.meta_phone_number_id as string | null,
      meta_access_token: cfg.meta_access_token as string | null,
    });
    await ws.sendText(jid, texto);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Falha na notificação de grupo nunca quebra o fluxo — apenas loga.
    await db.from('erros_log').insert({
      workflow: 'cal-webhook', severity: 'warning',
      mensagem: `Notificação de grupo falhou: ${msg}`,
    }).catch(() => undefined);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const ok = () => new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const raw = await req.text();
    const db = createAdminClient();

    const { data: cfg } = await db.from('clinic_config').select(
      'calcom_webhook_secret, grupo_whatsapp_numero, fuso_horario, ' +
      'whatsapp_provider, evolution_server_url, evolution_api_key, evolution_instance_name, ' +
      'meta_phone_number_id, meta_access_token',
    ).eq('id', 1).single();

    const sig = req.headers.get('x-cal-signature-256');
    if (!(await assinaturaValida(cfg?.calcom_webhook_secret, raw, sig))) {
      return new Response(JSON.stringify({ error: 'invalid signature' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = JSON.parse(raw);
    const evt = body.triggerEvent as string;
    const p = (body.payload ?? {}) as Record<string, any>;
    const uid = p.uid as string | undefined;
    const tz = (cfg as any)?.fuso_horario || 'America/Sao_Paulo';
    console.log(`[cal] event=${evt} uid=${uid}`);
    if (!uid) return ok();

    // ── Mapeia profissional (agenda) pelo event-type ──
    let agenda_id: string | null = null;
    let agenda_nome: string | null = null;
    const etid = p.eventTypeId != null ? String(p.eventTypeId) : null;
    if (etid) {
      const { data: ag } = await db.from('agendas').select('id, nome').eq('calcom_event_type_id', etid).limit(1).maybeSingle();
      agenda_id = ag?.id ?? null;
      agenda_nome = ag?.nome ?? null;
    }
    if (!agenda_id) {
      // Sem mapeamento: se houver só uma agenda ativa, usa ela.
      const { data: ags } = await db.from('agendas').select('id, nome').eq('ativo', true);
      if (ags && ags.length === 1) { agenda_id = ags[0].id; agenda_nome = ags[0].nome; }
    }

    // ── CANCELAMENTO: libera o slot + aciona lista de espera ──
    if (evt === 'BOOKING_CANCELLED') {
      const { data: upd } = await db.from('agendamentos')
        .update({ status: 'cancelado' })
        .eq('calcom_uid', uid).neq('status', 'cancelado')
        .select('id, agenda_id, data_hora_inicio, lead_id, procedimento_nome, nome_lead');

      if (upd && upd.length > 0) {
        const a = upd[0];
        await db.from('agente_eventos').insert({
          tipo: 'slot_liberado', agendamento_id: a.id, lead_id: a.lead_id, agenda_id: a.agenda_id,
          payload: { motivo: 'cancelado_calcom', quando: a.data_hora_inicio, procedimento: a.procedimento_nome },
        });

        // Reflete o cancelamento no CRM: move o lead para "Cancelou Agendamento"
        // (só se este agendamento ainda é o vigente do lead — evita rebaixar
        // um lead que já remarcou outra consulta).
        if (a.lead_id) {
          const { data: leadUpd } = await db.from('leads')
            .update({ status: 'cancelou_agendamento', data_agendamento: null })
            .eq('id', a.lead_id).eq('id_agendamento', a.id)
            .select('id');
          if (!leadUpd || leadUpd.length === 0) {
            // Lead sem id_agendamento vinculado (agendamento criado fora do CRM):
            // atualiza pelo status atual, sem sobrescrever estágios finais.
            await db.from('leads')
              .update({ status: 'cancelou_agendamento', data_agendamento: null })
              .eq('id', a.lead_id)
              .in('status', ['agendado', 'reagendado', 'retorno']);
          }
        }

        // Notificação de grupo — non-blocking
        if ((cfg as any)?.grupo_whatsapp_numero) {
          let profNome = agenda_nome;
          if (!profNome && a.agenda_id) {
            const { data: agRow } = await db.from('agendas').select('nome').eq('id', a.agenda_id).maybeSingle();
            profNome = agRow?.nome ?? null;
          }
          const motivo = (p.cancellationReason as string) || (p.reason as string) || '';
          const linhas = [
            '❌ Consulta cancelada',
            `Paciente: ${a.nome_lead || 'Paciente'}`,
            `Data cancelada: ${fmtData(a.data_hora_inicio, tz)} às ${fmtHora(a.data_hora_inicio, tz)}`,
            profNome ? `Profissional: ${profNome}` : null,
            motivo ? `Motivo: ${motivo}` : null,
          ].filter(Boolean).join('\n');
          await notificarGrupo(cfg as any, linhas, db);
        }
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
    const locStr = String(p.location || '');
    const isOnline = !!link
      || /meet\.google\.com/i.test(locStr)
      || /integrations:google:meet/i.test(locStr)
      || /cal video|zoom|video|integrations:/i.test(locStr);
    // A escolha explícita da paciente (enviada pelo agente no metadata do booking)
    // tem prioridade sobre a auto-detecção por link/location — necessário quando a
    // clínica usa UMA única agenda/event-type para presencial e online.
    const metaModalidade = String(p.metadata?.modalidade || '').toLowerCase();
    const modalidade = (metaModalidade === 'online' || metaModalidade === 'presencial')
      ? metaModalidade
      : (isOnline ? 'online' : 'presencial');
    const tipo_consulta = modalidade; // alias para nova coluna

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
      let dataHoraAnterior: string | null = null;
      for (const u of [uid, origUid].filter(Boolean) as string[]) {
        const { data: row } = await db.from('agendamentos')
          .select('id, episodio_id, data_hora_inicio').eq('calcom_uid', u).limit(1).maybeSingle();
        if (row) { alvoId = row.id; episodioId = row.episodio_id; dataHoraAnterior = row.data_hora_inicio; break; }
      }
      if (!alvoId && lead_id) {
        const { data: ativos } = await db.from('agendamentos')
          .select('id, episodio_id, data_hora_inicio').eq('lead_id', lead_id)
          .not('status', 'in', '("cancelado","cancelou_agendamento","faltou","compareceu")');
        if (ativos && ativos.length === 1) { alvoId = ativos[0].id; episodioId = ativos[0].episodio_id; dataHoraAnterior = ativos[0].data_hora_inicio; }
      }

      if (alvoId) {
        await db.from('agendamentos').update({
          data_hora_inicio: inicio, link_reuniao: link, modalidade, tipo_consulta,
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

        // Notificação de grupo
        if ((cfg as any)?.grupo_whatsapp_numero) {
          const linhas = [
            '📅 Consulta reagendada',
            `Paciente: ${nome}`,
            dataHoraAnterior
              ? `De: ${fmtData(dataHoraAnterior, tz)} às ${fmtHora(dataHoraAnterior, tz)}`
              : null,
            `Para: ${fmtData(inicio, tz)} às ${fmtHora(inicio, tz)}`,
            agenda_nome ? `Profissional: ${agenda_nome}` : null,
            tipo_consulta === 'online'
              ? `Tipo: Online (Google Meet)${link ? `\nLink: ${link}` : ''}`
              : 'Tipo: Presencial',
          ].filter(Boolean).join('\n');
          await notificarGrupo(cfg as any, linhas, db);
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
        const { data: mesmo } = await db.from('agendamentos').select('id, notificacao_grupo_enviada')
          .eq('agenda_id', agenda_id).eq('data_hora_inicio', inicio)
          .not('status', 'in', '("cancelado","cancelou_agendamento","faltou")').limit(1).maybeSingle();
        if (mesmo) {
          await db.from('agendamentos').update({ calcom_uid: uid, link_reuniao: link, modalidade, tipo_consulta }).eq('id', mesmo.id);

          // Envia notificação de grupo se ainda não enviada
          if ((cfg as any)?.grupo_whatsapp_numero && !mesmo.notificacao_grupo_enviada) {
            await enviarNotificacaoCriacao(cfg as any, nome, inicio, tz, agenda_nome, tipo_consulta, link, db);
            await db.from('agendamentos').update({ notificacao_grupo_enviada: true }).eq('id', mesmo.id);
          }
          return ok();
        }
      }

      const { data: novoAg } = await db.from('agendamentos').insert({
        agenda_id, lead_id, nome_lead: nome, whatsapp_lead: phone || null,
        procedimento_nome: (p.title as string) || (p.metadata?.procedimento_nome as string) || null,
        data_hora_inicio: inicio, status: 'agendado',
        modalidade, tipo_consulta, link_reuniao: link, calcom_uid: uid,
        notificacao_grupo_enviada: false,
      }).select('id').single();

      if (lead_id) {
        await db.from('leads').update({ data_agendamento: inicio, status: 'agendado' }).eq('id', lead_id);
      }

      // Notificação de grupo para BOOKING_CREATED
      if ((cfg as any)?.grupo_whatsapp_numero && novoAg?.id) {
        await enviarNotificacaoCriacao(cfg as any, nome, inicio, tz, agenda_nome, tipo_consulta, link, db);
        await db.from('agendamentos').update({ notificacao_grupo_enviada: true }).eq('id', novoAg.id);
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

async function enviarNotificacaoCriacao(
  cfg: Record<string, any>,
  nomePaciente: string,
  inicio: string | null,
  tz: string,
  agendaNome: string | null,
  tipoConsulta: string,
  link: string | null,
  db: ReturnType<typeof createAdminClient>,
): Promise<void> {
  const linhas = [
    '📅 Nova consulta agendada',
    `Paciente: ${nomePaciente}`,
    `Data: ${fmtData(inicio, tz)}`,
    `Horário: ${fmtHora(inicio, tz)}`,
    agendaNome ? `Profissional: ${agendaNome}` : null,
    tipoConsulta === 'online'
      ? `Tipo: Online (Google Meet)${link ? `\nLink: ${link}` : ''}`
      : 'Tipo: Presencial',
  ].filter(Boolean).join('\n');
  await notificarGrupo(cfg, linhas, db);
}
