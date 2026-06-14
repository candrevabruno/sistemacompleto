import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verificar token do usuário
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });

    // Ler config da Evolution do banco
    const { data: config } = await supabase
      .from('clinic_config')
      .select('evolution_server_url, evolution_instance_name, evolution_api_key')
      .single();

    if (!config?.evolution_server_url || !config?.evolution_api_key) {
      return new Response(JSON.stringify({ error: 'Evolution API não configurada' }), { status: 400, headers: corsHeaders });
    }

    const { action } = await req.json().catch(() => ({}));

    let evoUrl = '';
    let method = 'GET';

    if (action === 'connectionState') {
      evoUrl = `${config.evolution_server_url}/instance/connectionState/${config.evolution_instance_name}`;
    } else if (action === 'connect') {
      evoUrl = `${config.evolution_server_url}/instance/connect/${config.evolution_instance_name}`;
    } else {
      return new Response(JSON.stringify({ error: 'Ação inválida' }), { status: 400, headers: corsHeaders });
    }

    const evoResp = await fetch(evoUrl, {
      method,
      headers: { apikey: config.evolution_api_key },
    });

    const data = await evoResp.json();
    return new Response(JSON.stringify(data), {
      status: evoResp.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
