// Proxy autenticado para a uazapi (https://docs.uazapi.com/) — evita expor o
// token da instância no browser. Mesmo padrão do evolution-proxy.
// Ações: status (GET /instance/status), connect (POST /instance/connect),
// disconnect (POST /instance/disconnect). Auth uazapi: header `token`.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Verificar autenticação do usuário do painel
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });

    // Ler config da uazapi do banco
    const { data: config } = await supabase
      .from('clinic_config')
      .select('uazapi_server_url, uazapi_token')
      .single();

    if (!config?.uazapi_server_url || !config?.uazapi_token) {
      return new Response(JSON.stringify({ error: 'uazapi não configurada' }), { status: 400, headers: corsHeaders });
    }

    const { action } = await req.json().catch(() => ({}));
    const base = config.uazapi_server_url.replace(/\/+$/, '');

    let url = '';
    let method = 'GET';

    if (action === 'status') {
      url = `${base}/instance/status`;
    } else if (action === 'connect') {
      url = `${base}/instance/connect`;
      method = 'POST';
    } else if (action === 'disconnect') {
      url = `${base}/instance/disconnect`;
      method = 'POST';
    } else {
      return new Response(JSON.stringify({ error: 'Ação inválida' }), { status: 400, headers: corsHeaders });
    }

    const resp = await fetch(url, {
      method,
      headers: {
        token: config.uazapi_token,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify({}) } : {}),
    });

    const data = await resp.json().catch(() => ({}));
    return new Response(JSON.stringify(data), {
      status: resp.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
