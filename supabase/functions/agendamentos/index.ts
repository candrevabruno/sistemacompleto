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
      
      const { data: agendamentosMarcados } = await supabaseClient
        .from("agendamentos")
        .select("data_hora_inicio")
        .eq("agenda_id", agenda_id)
        .neq("status", "cancelado")
        .gte("data_hora_inicio", dataInicioStr)
        .lte("data_hora_inicio", dataFimStr);

      const startHour = parseInt(agendaHours.hora_inicio.split(":")[0]);
      const endHour = parseInt(agendaHours.hora_fim.split(":")[0]);
      const horasDisponiveis = [];
      const horasOcupadas = (agendamentosMarcados || []).map(a => new Date(a.data_hora_inicio).getHours());

      for (let h = startHour; h < endHour; h++) {
        if (!horasOcupadas.includes(h)) {
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

    // AGENDAR (POST)
    if (req.method === "POST" && path === "horarios") {
      const body = await req.json();
      const { agenda_id, lead_id, procedimento_nome, nome_lead, whatsapp_lead, data, hora } = body;
      
      const inicio = new Date(`${data}T${hora}:00-03:00`);
      
      const { data: newAgendamento, error } = await supabaseClient
        .from("agendamentos")
        .insert({
          agenda_id,
          lead_id,
          procedimento_nome,
          nome_lead,
          whatsapp_lead,
          data_hora_inicio: inicio.toISOString(),
          status: "agendado"
        })
        .select()
        .single();
        
      if (error) throw error;
      
      if (lead_id) {
         await supabaseClient.from("leads").update({ data_agendamento: inicio.toISOString(), status: "agendado" }).eq("id", lead_id);
      }

      return new Response(JSON.stringify({ mensagem: "Agendamento criado com sucesso." }), {
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
