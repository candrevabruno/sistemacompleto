import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop(); 
    
    // VER HORARIOS (GET)
    if (req.method === "GET" && path === "horarios") {
      const agenda_id = url.searchParams.get("agenda_id");
      const data = url.searchParams.get("data"); 

      if (!agenda_id || !data) {
        return new Response(JSON.stringify({ error: "Parâmetros 'agenda_id' e 'data' são obrigatórios" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const dataFormatada = new Date(data + "T12:00:00");
      const diasSemana = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
      const nomeDia = diasSemana[dataFormatada.getDay()];

      const { data: agendaHours, error: errHours } = await supabaseClient
        .from("agenda_hours")
        .select("*")
        .eq("agenda_id", agenda_id)
        .eq("dia", nomeDia)
        .eq("aberto", true)
        .single();

      if (errHours || !agendaHours) {
        return new Response(JSON.stringify({ mensagem: "A agenda está fechada neste dia.", sugestoes: "" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const dataInicioStr = `${data}T00:00:00-03:00`;
      const dataFimStr = `${data}T23:59:59-03:00`;
      
      // 'faltou'/cancelados liberam o slot automaticamente.
      const { data: agendamentosMarcados } = await supabaseClient
        .from("agendamentos")
        .select("data_hora_inicio")
        .eq("agenda_id", agenda_id)
        .not("status", "in", '("cancelado","cancelou_agendamento","faltou")')
        .gte("data_hora_inicio", dataInicioStr)
        .lte("data_hora_inicio", dataFimStr);

      // Bloqueios que tocam este dia (horário, dia inteiro ou período/férias).
      const { data: bloqueios } = await supabaseClient
        .from("bloqueios")
        .select("inicio, fim, dia_inteiro")
        .eq("agenda_id", agenda_id)
        .lte("inicio", dataFimStr)
        .gte("fim", dataInicioStr);

      const startHour = parseInt(agendaHours.hora_inicio.split(":")[0]);
      const endHour = parseInt(agendaHours.hora_fim.split(":")[0]);
      const horasDisponiveis = [];
      const horasOcupadas = (agendamentosMarcados || []).map(a => new Date(a.data_hora_inicio).getHours());

      const diaIni = new Date(dataInicioStr).getTime();
      const diaFim = new Date(dataFimStr).getTime();
      const horaBloqueada = (h: number): boolean => {
        const slot = new Date(`${data}T${h.toString().padStart(2, '0')}:00:00-03:00`).getTime();
        return (bloqueios || []).some((b: any) => {
          if (b.dia_inteiro) {
            return new Date(b.inicio).getTime() <= diaFim && new Date(b.fim).getTime() >= diaIni;
          }
          return new Date(b.inicio).getTime() <= slot && new Date(b.fim).getTime() > slot;
        });
      };

      for (let h = startHour; h < endHour; h++) {
        if (!horasOcupadas.includes(h) && !horaBloqueada(h)) {
          horasDisponiveis.push(`${h.toString().padStart(2, '0')}:00`);
        }
      }

      if (horasDisponiveis.length === 0) {
        return new Response(JSON.stringify({ mensagem: `Neste dia não temos mais vagas.`, sugestoes: "" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const mensagem = `Temos vagas nos seguintes horários para o dia solicitado:\n- ` + horasDisponiveis.join("h\n- ") + "h";
      return new Response(JSON.stringify({ mensagem, sugestoes: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // AGENDAR (POST) — Cal.com é a fonte ÚNICA do agendamento.
    // Em vez de inserir direto em `agendamentos` (o que gerava lead/agendamento
    // duplicado junto com o webhook), criamos a reserva no Cal.com passando o
    // telefone + metadata.lead_id. Quem grava a linha em `agendamentos` é o
    // `cal-webhook` — casando pelo metadata.lead_id, sem duplicar.
    if (req.method === "POST" && path === "horarios") {
      const body = await req.json();
      const { agenda_id, lead_id, procedimento_nome, nome_lead, whatsapp_lead, data, hora } = body;

      const inicio = new Date(`${data}T${hora}:00-03:00`);

      // Cliente service-role para ler config/credenciais e validar sem esbarrar em RLS.
      const dbAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );

      // Proteção: não agendar em horário bloqueado.
      const { data: bloqOverlap } = await dbAdmin
        .from("bloqueios")
        .select("id, dia_inteiro, inicio, fim")
        .eq("agenda_id", agenda_id)
        .lte("inicio", inicio.toISOString())
        .gte("fim", inicio.toISOString());
      if (bloqOverlap && bloqOverlap.length > 0) {
        return new Response(JSON.stringify({ error: "Horário bloqueado para este profissional." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Proteção: sem marcação duplicada no mesmo slot/profissional.
      const { data: jaMarcado } = await dbAdmin
        .from("agendamentos")
        .select("id")
        .eq("agenda_id", agenda_id)
        .eq("data_hora_inicio", inicio.toISOString())
        .not("status", "in", '("cancelado","cancelou_agendamento","faltou")')
        .limit(1);
      if (jaMarcado && jaMarcado.length > 0) {
        return new Response(JSON.stringify({ error: "Este horário já está ocupado." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // event-type do Cal.com da agenda escolhida.
      const { data: ag } = await dbAdmin.from("agendas").select("calcom_event_type_id").eq("id", agenda_id).maybeSingle();
      const eventTypeId = ag?.calcom_event_type_id ? Number(ag.calcom_event_type_id) : null;
      if (!eventTypeId) {
        return new Response(JSON.stringify({ error: "Agenda sem calcom_event_type_id configurado." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: cfg } = await dbAdmin.from("clinic_config").select("calcom_api_key").eq("id", 1).single();
      if (!cfg?.calcom_api_key) {
        return new Response(JSON.stringify({ error: "Cal.com API key não configurada." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Telefone só dígitos → chave de matching no webhook + e-mail placeholder
      // (a paciente NUNCA é perguntada pelo e-mail; @sememail.local não roteia).
      const fone = String(whatsapp_lead || "").replace(/\D/g, "");
      const placeholderEmail = `wa.${fone || Date.now()}@sememail.local`;

      const att: Record<string, unknown> = {
        name: nome_lead || "Paciente",
        email: placeholderEmail,
        timeZone: "America/Sao_Paulo",
        language: "pt",
      };
      if (fone) att.phoneNumber = `+${fone}`;

      const calRes = await fetch("https://api.cal.com/v2/bookings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.calcom_api_key}`,
          "cal-api-version": "2026-02-25",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start: inicio.toISOString(),
          eventTypeId,
          attendee: att,
          // metadata.lead_id é lido pelo cal-webhook para casar o lead existente
          // e nunca duplicar. procedimento_nome volta no agendamento gravado lá.
          metadata: { lead_id: lead_id ?? "", procedimento_nome: procedimento_nome ?? "" },
        }),
      });

      const calText = await calRes.text();
      if (!calRes.ok) {
        return new Response(JSON.stringify({ error: `Cal.com ${calRes.status}: ${calText.slice(0, 300)}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const calJson = JSON.parse(calText || "{}");
      const uid = calJson?.data?.uid ?? calJson?.uid ?? null;

      // O cal-webhook grava o agendamento e atualiza o lead. Refletimos o status do
      // lead aqui também (idempotente) para o painel atualizar de imediato.
      if (lead_id) {
        await dbAdmin.from("leads").update({ data_agendamento: inicio.toISOString(), status: "agendado" }).eq("id", lead_id);
      }

      return new Response(JSON.stringify({ mensagem: "Agendamento criado no Cal.com.", calcom_uid: uid }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // REAGENDAR (PUT)
    if (req.method === "PUT") {
      const agendamentoId = path;
      const { data, hora } = await req.json();
      const inicio = new Date(`${data}T${hora}:00-03:00`);
      
      const { error } = await supabaseClient
        .from("agendamentos")
        .update({ data_hora_inicio: inicio.toISOString(), status: "agendado" })
        .eq("id", agendamentoId);

      if (error) throw error;
      return new Response(JSON.stringify({ mensagem: "Reagendamento feito com sucesso" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CANCELAR (DELETE)
    if (req.method === "DELETE") {
      const agendamentoId = path;
      const { error } = await supabaseClient
        .from("agendamentos")
        .delete()
        .eq("id", agendamentoId);

      if (error) throw error;
      return new Response(JSON.stringify({ mensagem: "Cancelamento feito com sucesso." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Rota não encontrada" }), { status: 404, headers: corsHeaders });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
