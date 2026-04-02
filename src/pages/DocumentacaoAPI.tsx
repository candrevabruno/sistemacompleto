import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Copy, CheckCircle2, Terminal } from 'lucide-react';

const ENDPOINTS = [
  { id: 'marcar', method: 'POST', badge: 'bg-green-100 text-green-800', title: 'Marcar Agendamento' },
  { id: 'reagendar', method: 'PUT', badge: 'bg-blue-100 text-blue-800', title: 'Reagendar Agendamento' },
  { id: 'cancelar', method: 'DELETE', badge: 'bg-red-100 text-red-800', title: 'Cancelar Agendamento' },
  { id: 'horarios', method: 'GET', badge: 'bg-gray-200 text-gray-800', title: 'Consultar Horários' }
];

export function DocumentacaoAPI() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [agendas, setAgendas] = useState<any[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [selectedAgenda, setSelectedAgenda] = useState<string>('');
  const [activeSection, setActiveSection] = useState<string>('marcar');

  // Base URL calculation (Assuming Supabase functions URL structure from VITE env)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://seu-projeto.supabase.co';
  const baseUrl = `${supabaseUrl}/functions/v1`;

  useEffect(() => {
    const fetchData = async () => {
      const [resTokens, resAgendas] = await Promise.all([
        supabase.from('api_tokens').select('id, label').eq('ativo', true),
        supabase.from('agendas').select('id, nome').eq('ativo', true)
      ]);
      if (resTokens.data) setTokens(resTokens.data);
      if (resAgendas.data) setAgendas(resAgendas.data);
    };
    fetchData();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -80% 0px' }
    );

    ENDPOINTS.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const CopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    return (
      <button 
        onClick={handleCopy} 
        className="absolute top-3 right-3 p-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors text-white flex items-center gap-1 text-xs"
      >
        {copied ? <><CheckCircle2 className="w-3.5 h-3.5"/> Copiado</> : <><Copy className="w-3.5 h-3.5"/> Copiar</>}
      </button>
    );
  };

  const CodeBlock = ({ code, language = 'json' }: { code: string, language?: string }) => {
    // Basic syntax highlighter logic just for the requested aesthetic
    const highlight = (str: string) => {
      if (language === 'bash') {
        return str
          .replace(/(\{TOKEN\}|\{AGENDA_ID\}|\{BASE_URL\}|UUID_DO_LEAD|UUID_DO_CLIENTE|ID_DO_AGENDAMENTO|2025-03-\d\d|14:00|10:00)/g, '<span class="text-amber-400 border-b border-dotted pb-0.5 cursor-help" title="Substitua pelo valor real">$1</span>')
          .replace(/(curl|-X|-H|-d|GET|POST|PUT|DELETE)/g, '<span class="text-purple-300">$1</span>')
          .replace(/("[^"]*")/g, '<span class="text-emerald-300">$1</span>');
      }
      return str
        .replace(/("[^"]*")(\s*:)/g, '<span class="text-slate-300">$1</span>$2')
        .replace(/:\s*("[^"]*")/g, ': <span class="text-emerald-300">$1</span>')
        .replace(/:\s*(true|false|null)/g, ': <span class="text-blue-300">$1</span>')
        .replace(/:\s*([0-9.-]+)/g, ': <span class="text-orange-300">$1</span>');
    };

    return (
      <div className="relative group dark:bg-[#0D0A0B] bg-[#1A1218] rounded-[8px] overflow-hidden my-4 border border-[var(--color-border-card)] border-opacity-20 shadow-lg">
        <CopyButton text={code} />
        <pre className="p-4 overflow-x-auto text-[13px] font-mono leading-relaxed text-slate-100" style={{ fontFamily: "'Fira Code', 'Cascadia Code', monospace" }}>
          <code dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(highlight(code)) }} />
        </pre>
      </div>
    );
  };

  // Dynamic token display logic
  const displayToken = selectedToken ? `••••••${selectedToken.substring(selectedToken.length - 8, selectedToken.length)}` : '{TOKEN}';
  const displayAgenda = selectedAgenda || '{AGENDA_ID}';

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
      
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="font-cormorant text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-primary)] to-[#9E6060]">
          Documentação da API
        </h1>
        <p className="text-[var(--color-text-muted)] mt-2 max-w-2xl text-lg">
          Use os endpoints abaixo para integrar seu agente de IA e N8N com o Heroic Leap.
        </p>
      </div>

      {/* CONFIGURATION PANEL */}
      <Card className="mb-8 border-[var(--color-primary)] bg-[var(--color-primary-light)]/20 shadow-md">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                Token ativo <span className="text-[10px] bg-white/50 px-2 py-0.5 rounded-full font-normal border">Necessário p/ Auth</span>
              </label>
              <select 
                className="w-full bg-white border border-[var(--color-border-card)] rounded-[8px] px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]"
                value={selectedToken}
                onChange={e => setSelectedToken(e.target.value)}
              >
                <option value="">Selecione um token...</option>
                {tokens.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              {!tokens.length && <p className="text-xs text-red-500 mt-1 mt-2 font-medium">Nenhum token ativo encontrado. Crie um em Configurações.</p>}
              {selectedToken && <p className="text-xs text-[var(--color-text-muted)] mt-2 italic border-l-2 p-1 border-[var(--color-primary)] bg-white/40">O token real não é exibido por segurança. Copie o cURL e substitua pelo token completo original.</p>}
            </div>
            
            <div>
              <label className="block text-sm font-semibold mb-2">Agenda Alvo</label>
              <select 
                className="w-full bg-white border border-[var(--color-border-card)] rounded-[8px] px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]"
                value={selectedAgenda}
                onChange={e => setSelectedAgenda(e.target.value)}
              >
                <option value="">Selecione a agenda...</option>
                {agendas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Base URL</label>
              <div className="relative">
                <input 
                  type="text" 
                  readOnly 
                  value={baseUrl} 
                  className="w-full bg-gray-50 text-gray-500 border border-[var(--color-border-card)] rounded-[8px] px-3 py-2 text-sm font-mono shadow-inner"
                />
                <button onClick={() => navigator.clipboard.writeText(baseUrl)} className="absolute right-2 top-1.5 p-1 text-gray-400 hover:text-[var(--color-primary)] transition-colors"><Copy className="w-4 h-4"/></button>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-[var(--color-border-card)] space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--color-primary)]">Guia de Integração</h4>
              
              <div className="flex gap-4 bg-white p-4 rounded-xl border border-[var(--color-primary)]/15 shadow-sm">
                <div className="bg-[var(--color-primary)] text-white w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 font-bold shadow-sm">1</div>
                <div>
                  <p className="text-base text-slate-900 font-bold mb-1">Criar ou Consultar (URL Padrão):</p>
                  <p className="text-sm text-slate-800 leading-relaxed">
                    Para <span className="font-bold text-black bg-amber-50 px-1 rounded">Marcar</span>, use a <span className="font-mono bg-white px-2 py-0.5 border-2 border-[var(--color-primary)]/20 rounded text-xs select-all text-black font-bold">Base URL + /agendamentos</span>. <br/>
                    Para <span className="font-bold text-black bg-amber-50 px-1 rounded">Ver Horários</span>, use <span className="font-mono bg-white px-2 py-0.5 border-2 border-[var(--color-primary)]/20 rounded text-xs select-all text-black font-bold">/agendamentos/horarios</span>.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 bg-white p-4 rounded-xl border border-[var(--color-primary)]/15 shadow-sm">
                <div className="bg-[var(--color-primary)] text-white w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 font-bold shadow-sm">2</div>
                <div>
                  <p className="text-base text-slate-900 font-bold mb-1">Reagendar ou Cancelar (URL com ID):</p>
                  <p className="text-sm text-slate-800 leading-relaxed">Para <span className="font-bold text-black bg-amber-50 px-1 rounded">Alterar</span> ou <span className="font-bold text-black bg-amber-50 px-1 rounded">Remover</span>, você deve "colar" o ID do agendamento no final da URL: <br/>
                  <span className="font-mono bg-white px-2 py-0.5 border-2 border-[var(--color-primary)]/20 rounded text-xs text-black font-bold">/agendamentos/ID_DO_AGENDAMENTO</span></p>
                </div>
              </div>

              <div className="flex gap-4 bg-white p-4 rounded-xl border border-[var(--color-primary)]/15 shadow-sm">
                <div className="bg-[var(--color-primary)] text-white w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 font-bold shadow-sm">3</div>
                <div>
                  <p className="text-base text-slate-900 font-bold mb-1">Múltiplas Agendas:</p>
                  <p className="text-sm text-slate-800 leading-relaxed font-medium">Se você tem vários profissionais ou salas, a <span className="underline decoration-[var(--color-primary)] decoration-2 underline-offset-4 text-black font-bold">URL é exatamente a mesma para todos</span>. O que diferencia quem será agendado é o campo <span className="font-mono bg-white px-2 py-0.5 border-2 border-[var(--color-primary)]/20 rounded text-xs text-black font-bold">agenda_id</span> enviado dentro do seu JSON.</p>
                </div>
              </div>

              <div className="flex gap-4 bg-white p-4 rounded-xl border border-[var(--color-primary)]/15 shadow-sm">
                <div className="bg-[var(--color-primary)] text-white w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 font-bold shadow-sm">4</div>
                <div>
                  <p className="text-base text-slate-900 font-bold mb-1">Autenticação (Segurança):</p>
                  <p className="text-sm text-slate-800 leading-relaxed font-medium">Insira o token gerado anteriormente no Header da sua requisição: <br/>
                  <span className="font-mono bg-white px-2 py-1 border-2 border-[var(--color-primary)]/20 rounded text-xs text-black font-bold">Authorization: Bearer {`{SEU_TOKEN}`}</span>.</p>
                </div>
              </div>

              <div className="flex gap-4 text-slate-900 bg-amber-100 p-5 rounded-xl border-2 border-amber-300 shadow-md">
                <div className="bg-amber-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 font-extrabold shadow-sm">!</div>
                <p className="text-sm leading-relaxed">
                  <span className="font-extrabold block mb-2 uppercase tracking-wider text-amber-900">Configuração Crucial no N8N:</span>
                  Ao usar o nó de <span className="font-bold italic text-black border-b-2 border-amber-500 bg-white/40 px-1">HTTP Request</span>, lembre-se de selecionar o método correspondente (<span className="font-bold text-amber-900">POST, PUT ou DELETE</span>) e utilizar a URL completa gerada somando a Base URL com o endpoint desejado.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TWO COLUMN LAYOUT */}
      <div className="flex flex-1 gap-8 relative pb-20">
        
        {/* SIDEBAR NAVIGATION */}
        <div className="hidden md:block w-64 shrink-0">
          <div className="sticky top-6 flex flex-col gap-1">
            <h3 className="text-xs font-bold tracking-widest text-[var(--color-text-muted)] uppercase mb-3 px-2">Endpoints</h3>
            {ENDPOINTS.map(ep => (
              <button
                key={ep.id}
                onClick={() => scrollTo(ep.id)}
                className={`flex items-center text-left w-full px-3 py-2 rounded-[8px] transition-all text-sm font-medium ${
                  activeSection === ep.id 
                    ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] shadow-sm' 
                    : 'text-[var(--color-text-muted)] hover:bg-gray-100'
                }`}
              >
                <div className="w-16 shrink-0"><span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${ep.badge}`}>{ep.method}</span></div>
                {ep.title}
              </button>
            ))}
          </div>
        </div>

        {/* MAIN CONTENT / SECTIONS */}
        <div className="flex-1 space-y-16 max-w-4xl">
          
          {/* POST - MARCAR */}
          <section id="marcar" className="scroll-mt-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-green-100 text-green-800 text-sm font-bold px-2 py-1 rounded-[6px]">POST</span>
              <h2 className="font-cormorant text-3xl font-bold">Marcar Agendamento</h2>
            </div>
            <p className="text-[var(--color-text-main)] mb-6 text-lg leading-relaxed">
              Cria um novo agendamento na agenda informada para um lead ou cliente existente no sistema. Duração fixa de 60 minutos.
            </p>
            
            <h3 className="font-semibold text-lg mb-3">Parâmetros</h3>
            <div className="overflow-x-auto rounded-[8px] border border-[var(--color-border-card)] mb-6">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#FAF0EE] text-[var(--color-text-muted)] uppercase text-xs">
                  <tr><th className="px-4 py-3">Campo</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3 text-center">Obrigatório</th><th className="px-4 py-3">Descrição</th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-card)] bg-white">
                  <tr><td className="px-4 py-3 font-mono">agenda_id</td><td className="px-4 py-3 text-gray-500">UUID</td><td className="px-4 py-3 text-center"><Badge variant="compareceu">SIM</Badge></td><td className="px-4 py-3">ID da agenda — preenchido automaticamente acima</td></tr>
                  <tr><td className="px-4 py-3 font-mono">lead_id</td><td className="px-4 py-3 text-gray-500">UUID</td><td className="px-4 py-3 text-center"><Badge variant="agendado">COND</Badge></td><td className="px-4 py-3">Obrigatório se não informar cliente_id</td></tr>
                  <tr><td className="px-4 py-3 font-mono">cliente_id</td><td className="px-4 py-3 text-gray-500">UUID</td><td className="px-4 py-3 text-center"><Badge variant="agendado">COND</Badge></td><td className="px-4 py-3">Obrigatório se não informar lead_id</td></tr>
                  <tr><td className="px-4 py-3 font-mono">data</td><td className="px-4 py-3 text-gray-500">String</td><td className="px-4 py-3 text-center"><Badge variant="compareceu">SIM</Badge></td><td className="px-4 py-3 font-mono bg-gray-50 p-1 rounded inline-block">YYYY-MM-DD</td></tr>
                  <tr><td className="px-4 py-3 font-mono">hora</td><td className="px-4 py-3 text-gray-500">String</td><td className="px-4 py-3 text-center"><Badge variant="compareceu">SIM</Badge></td><td className="px-4 py-3 font-mono bg-gray-50 p-1 rounded inline-block">HH:MM</td></tr>
                  <tr><td className="px-4 py-3 font-mono">procedimento_nome</td><td className="px-4 py-3 text-gray-500">String</td><td className="px-4 py-3 text-center"><Badge variant="default">NÃO</Badge></td><td className="px-4 py-3">Nome do procedimento (texto livre)</td></tr>
                  <tr><td className="px-4 py-3 font-mono">nome_lead</td><td className="px-4 py-3 text-gray-500">String</td><td className="px-4 py-3 text-center"><Badge variant="default">NÃO</Badge></td><td className="px-4 py-3">Nome do lead (cache rápido)</td></tr>
                  <tr><td className="px-4 py-3 font-mono">whatsapp_lead</td><td className="px-4 py-3 text-gray-500">String</td><td className="px-4 py-3 text-center"><Badge variant="default">NÃO</Badge></td><td className="px-4 py-3">WhatsApp do lead</td></tr>
                  <tr><td className="px-4 py-3 font-mono">observacoes</td><td className="px-4 py-3 text-gray-500">String</td><td className="px-4 py-3 text-center"><Badge variant="default">NÃO</Badge></td><td className="px-4 py-3">Anotações extras livres</td></tr>
                </tbody>
              </table>
            </div>

            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2"><Terminal className="w-4 h-4"/> Exemplo Request (cURL)</h3>
            <CodeBlock language="bash" code={`curl -X POST ${baseUrl}/agendamentos \\
  -H "Authorization: Bearer ${displayToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agenda_id": "${displayAgenda}",
    "lead_id": "UUID_DO_LEAD",
    "procedimento_nome": "Limpeza de Pele",
    "nome_lead": "Maria Silva",
    "whatsapp_lead": "5548999999999",
    "data": "2025-03-15",
    "hora": "14:00"
  }'`} />

            <h3 className="font-semibold text-lg mt-6 mb-2">Exemplo Resposta Sucesso (201)</h3>
            <CodeBlock language="json" code={`{
  "sucesso": true,
  "situacao": "AGENDAMENTO_CRIADO",
  "mensagem": "Agendamento criado com sucesso.",
  "agendamento": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "agenda_id": "3d94b8e2-1c7a-4f9d-b123-456789abcdef",
    "lead_id": "a1b2c3d4-1234-5678-abcd-ef0123456789",
    "cliente_id": null,
    "procedimento_nome": "Limpeza de Pele",
    "nome_lead": "Maria Silva",
    "whatsapp_lead": "5548999999999",
    "data_hora_inicio": "2025-03-15T14:00:00-03:00",
    "data_hora_fim": "2025-03-15T15:00:00-03:00",
    "status": "agendado"
  }
}`} />

            <h3 className="font-semibold text-lg mt-6 mb-3">Situações e Erros Mapeados</h3>
            <div className="overflow-hidden rounded-[8px] border border-[var(--color-border-card)]">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#FAF0EE]"><tr><th className="px-4 py-2 w-20">HTTP</th><th className="px-4 py-2 w-64">Situação (código)</th><th className="px-4 py-2">Motivo</th></tr></thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  <tr><td className="px-4 py-2 font-mono text-green-600 font-bold">201</td><td className="px-4 py-2 font-mono text-xs">AGENDAMENTO_CRIADO</td><td className="px-4 py-2 text-gray-600">Sucesso.</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-blue-600 font-bold">200</td><td className="px-4 py-2 font-mono text-xs">HORARIO_OCUPADO</td><td className="px-4 py-2 text-gray-600">Conflito geográfico — retorna vetor com <code className="bg-gray-100 px-1 rounded">sugestoes</code>.</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-blue-600 font-bold">200</td><td className="px-4 py-2 font-mono text-xs">AGENDA_FECHADA</td><td className="px-4 py-2 text-gray-600">A clínica não funciona neste dia da semana.</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-blue-600 font-bold">200</td><td className="px-4 py-2 font-mono text-xs">DATA_PASSADA</td><td className="px-4 py-2 text-gray-600">Agendamento retroativo bloqueado.</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-red-600 font-bold">401</td><td className="px-4 py-2 font-mono text-xs">TOKEN_INVALIDO</td><td className="px-4 py-2 text-gray-600">Hash SHA-256 não deu match.</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-red-600 font-bold">404</td><td className="px-4 py-2 font-mono text-xs">LEAD_NAO_ENCONTRADO</td><td className="px-4 py-2 text-gray-600">UUID não existe na base.</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <hr className="border-[var(--color-border-card)]" />

          {/* PUT - REAGENDAR */}
          <section id="reagendar" className="scroll-mt-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-blue-100 text-blue-800 text-sm font-bold px-2 py-1 rounded-[6px]">PUT</span>
              <h2 className="font-cormorant text-3xl font-bold">Reagendar Agendamento</h2>
            </div>
            <p className="text-[var(--color-text-main)] mb-6 text-lg leading-relaxed">
              Altera a data e/ou hora de um agendamento existente. O ID numérico alfanumérico do agendamento é retornado no momento da criação.
            </p>
            
            <h3 className="font-semibold text-lg mb-3">Parâmetros (Body / URL)</h3>
            <div className="overflow-x-auto rounded-[8px] border border-[var(--color-border-card)] mb-6">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#FAF0EE] text-[var(--color-text-muted)] uppercase text-xs"><tr><th className="px-4 py-3">Campo / Local</th><th className="px-4 py-3 text-center">Obrigatório</th><th className="px-4 py-3">Descrição</th></tr></thead>
                <tbody className="divide-y divide-[var(--color-border-card)] bg-white">
                  <tr><td className="px-4 py-3 font-mono">:id <span className="text-[10px] text-gray-400 ml-2 uppercase">URL Pth</span></td><td className="px-4 py-3 text-center"><Badge variant="compareceu">SIM</Badge></td><td className="px-4 py-3">ID do agendamento UUID</td></tr>
                  <tr><td className="px-4 py-3 font-mono">agenda_id <span className="text-[10px] text-gray-400 ml-2 uppercase">Body Json</span></td><td className="px-4 py-3 text-center"><Badge variant="compareceu">SIM</Badge></td><td className="px-4 py-3">ID da agenda</td></tr>
                  <tr><td className="px-4 py-3 font-mono">data <span className="text-[10px] text-gray-400 ml-2 uppercase">Body Json</span></td><td className="px-4 py-3 text-center"><Badge variant="compareceu">SIM</Badge></td><td className="px-4 py-3">Nova data `YYYY-MM-DD`</td></tr>
                  <tr><td className="px-4 py-3 font-mono">hora <span className="text-[10px] text-gray-400 ml-2 uppercase">Body Json</span></td><td className="px-4 py-3 text-center"><Badge variant="compareceu">SIM</Badge></td><td className="px-4 py-3">Nova hora `HH:MM`</td></tr>
                </tbody>
              </table>
            </div>

            <CodeBlock language="bash" code={`curl -X PUT ${baseUrl}/agendamentos/ID_DO_AGENDAMENTO \\
  -H "Authorization: Bearer ${displayToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agenda_id": "${displayAgenda}",
    "data": "2025-03-20",
    "hora": "10:00"
  }'`} />
            
            <h3 className="font-semibold text-lg mt-6 mb-2">Exemplo Resposta Sucesso (200)</h3>
            <CodeBlock language="json" code={`{
  "sucesso": true,
  "situacao": "AGENDAMENTO_REAGENDADO",
  "mensagem": "Agendamento reagendado com sucesso.",
  "agendamento": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "agenda_id": "3d94b8e2-1c7a-4f9d-b123-456789abcdef",
    "procedimento_nome": "Limpeza de Pele",
    "nome_lead": "Maria Silva",
    "whatsapp_lead": "5548999999999",
    "data_hora_inicio": "2025-03-20T10:00:00-03:00",
    "data_hora_fim": "2025-03-20T11:00:00-03:00",
    "status": "agendado"
  }
}`} />
          </section>

          <hr className="border-[var(--color-border-card)]" />

          {/* DELETE - CANCELAR */}
          <section id="cancelar" className="scroll-mt-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-red-100 text-red-800 text-sm font-bold px-2 py-1 rounded-[6px]">DELETE</span>
              <h2 className="font-cormorant text-3xl font-bold">Cancelar Agendamento</h2>
            </div>
            <p className="text-[var(--color-text-main)] mb-6 text-lg leading-relaxed">
              Cancela um agendamento existente. Soft delete implementado — o registro não é apagado da base, seu status transmuta para <code>cancelado</code>.
            </p>
            
            <CodeBlock language="bash" code={`curl -X DELETE ${baseUrl}/agendamentos/ID_DO_AGENDAMENTO \\
  -H "Authorization: Bearer ${displayToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agenda_id": "${displayAgenda}"
  }'`} />
            
            <CodeBlock language="json" code={`{
  "sucesso": true,
  "situacao": "AGENDAMENTO_CANCELADO",
  "mensagem": "Agendamento cancelado com sucesso.",
  "agendamento": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "status": "cancelado"
  }
}`} />
          </section>

          <hr className="border-[var(--color-border-card)]" />

          {/* GET - HORÁRIOS */}
          <section id="horarios" className="scroll-mt-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-gray-200 text-gray-800 text-sm font-bold px-2 py-1 rounded-[6px]">GET</span>
              <h2 className="font-cormorant text-3xl font-bold">Consultar Horários Disponíveis</h2>
            </div>
            <p className="text-[var(--color-text-main)] mb-6 text-lg leading-relaxed">
              Consulta a disponibilidade de horários respeitando limites da clínica (Business Hours).
            </p>

            <div className="bg-[var(--color-bg-sidebar)] border border-gray-200 rounded-[8px] p-6 mb-6">
              <h4 className="font-bold mb-2">Variação 1 — Procurar e Validar Check</h4>
              <p className="text-sm text-gray-600 mb-4">Informe queryParams `data` + `hora` para verificação binária com offset suggestions.</p>
              <CodeBlock language="bash" code={`curl -X GET "${baseUrl}/agendamentos/horarios?agenda_id=${displayAgenda}&data=2025-03-15&hora=14:00" \\
  -H "Authorization: Bearer ${displayToken}"`} />
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <h5 className="text-sm font-mono text-green-600 font-bold mb-2">Se livre (200 OK):</h5>
                  <CodeBlock language="json" code={`{
  "sucesso": true,
  "situacao": "HORARIO_DISPONIVEL",
  "mensagem": "O horário solicitado...livre",
  "horario": "2025-03-15T14:00:00-03:00"
}`} />
                </div>
                <div>
                  <h5 className="text-sm font-mono text-red-600 font-bold mb-2">Se ocupado (200 OK):</h5>
                  <CodeBlock language="json" code={`{
  "sucesso": false,
  "situacao": "HORARIO_OCUPADO",
  "mensagem": "Ocupado. Sugestões:",
  "sugestoes": [
    "2025-03-15T15:00:00-03:00",
    "2025-03-15T16:00:00-03:00"
  ]
}`} />
                </div>
              </div>
            </div>

            <div className="bg-[var(--color-bg-sidebar)] border border-gray-200 rounded-[8px] p-6 mb-6">
              <h4 className="font-bold mb-2">Variação 2 — Obter Full Array Diário</h4>
              <p className="text-sm text-gray-600 mb-4">Omita o parâmetro horário para receber vetor completo de Slots.</p>
              <CodeBlock language="bash" code={`curl -X GET "${baseUrl}/agendamentos/horarios?agenda_id=${displayAgenda}&data=2025-03-15" \\
  -H "Authorization: Bearer ${displayToken}"`} />
              <div className="mt-4">
                <CodeBlock language="json" code={`{
  "sucesso": true,
  "situacao": "HORARIOS_DISPONIVEIS",
  "mensagem": "Horários extraídos",
  "data": "2025-03-15",
  "duracao_minutos": 60,
  "slots_disponiveis": ["08:00", "09:00", "10:00", "14:00", "15:00", "16:00"]
}`} />
              </div>
            </div>

          </section>

        </div>
      </div>

    </div>
  );
}
