import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useClinic } from '../contexts/ClinicContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Copy, Plus, Trash2, Pencil, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const ALL_TABS = [
  { id: 'geral', label: 'Geral' },
  { id: 'agendas', label: 'Agendas (Cal.com)' },
  { id: 'servicos', label: 'Serviços' },
  { id: 'kanban', label: 'Kanban' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'kpis', label: 'KPIs & Marketing' },
];

export function Configuracoes() {
  const { user } = useAuth();
  const { config } = useClinic();
  const [activeTab, setActiveTab] = useState('geral');

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';

  // super_admin vê tudo; admin vê somente as abas liberadas (ou todas se nenhuma restrição)
  const allowedTabIds: string[] = config?.admin_config_tabs?.length
    ? config.admin_config_tabs
    : ALL_TABS.map(t => t.id);
  const tabs = isSuperAdmin ? ALL_TABS : ALL_TABS.filter(t => allowedTabIds.includes(t.id));

  return (
    <div className="space-y-6">
      <div className="flex border-b border-[var(--border)] space-x-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === t.id ? 'border-[var(--sage-dark)] text-[var(--sage-dark)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>
        {activeTab === 'geral' && <AbaGeral />}
        {activeTab === 'agendas' && <AbaAgendas />}
        {activeTab === 'servicos' && <AbaServicos />}
        {activeTab === 'kanban' && <AbaKanban />}
        {activeTab === 'whatsapp' && <AbaWhatsApp />}
        {activeTab === 'webhooks' && <AbaWebhooks />}
        {activeTab === 'kpis' && <AbaKpis />}
      </div>
    </div>
  );
}

function AbaGeral() {
  const { config, refreshConfig } = useClinic();
  const [nome, setNome] = useState(config?.nome || 'Heroic Leap');
  const [subtitulo, setSubtitulo] = useState(config?.subtitulo || '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNome(config?.nome || 'Heroic Leap');
    setSubtitulo(config?.subtitulo || '');
  }, [config]);

  const saveGeral = async () => {
    setLoading(true);
    try {
      let logo_url = config?.logo_url;
      if (logoFile) {
        const { data, error } = await supabase.storage.from('clinic-assets').upload(`logo-${Date.now()}`, logoFile);
        if (error) {
          console.error(error);
          alert('Erro ao fazer upload da imagem: O bucket "clinic-assets" pode não existir no seu Supabase ou não estar público/com permissão. Detalhe: ' + error.message);
          setLoading(false);
          return;
        }
        if (data) {
          const urlReq = supabase.storage.from('clinic-assets').getPublicUrl(data.path);
          logo_url = urlReq.data.publicUrl;
        }
      }
      const updatePayload: Record<string, unknown> = { nome, subtitulo: subtitulo || null, logo_url };
      await supabase.from('clinic_config').update(updatePayload).eq('id', 1);
      await refreshConfig();
      setLogoFile(null);
      alert('Configurações salvas com sucesso!');
    } catch (err: any) {
      alert('Ocorreu um erro: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Identidade da Empresa</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input label="Nome da empresa" value={nome} onChange={e => setNome(e.target.value)} />
          <Input
            label="Subtítulo (aparece abaixo do nome na sidebar)"
            placeholder="Ex: Dra. Ana · Estética Avançada"
            value={subtitulo}
            onChange={e => setSubtitulo(e.target.value)}
          />

          {/* Logo upload estilizado */}
          <div>
            <label className="block text-sm font-medium mb-2">Logo da empresa (max 2MB)</label>
            <div className="flex items-center gap-4">
              {(logoFile ? URL.createObjectURL(logoFile) : config?.logo_url) && (
                <img
                  src={logoFile ? URL.createObjectURL(logoFile) : config?.logo_url || ''}
                  className="h-14 w-auto object-contain border border-[var(--border)] rounded-lg p-1"
                  alt="Logo atual"
                />
              )}
              
              <div>
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 0L8 8m4-4l4 4" />
                  </svg>
                  {logoFile ? logoFile.name : 'Escolher imagem'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => setLogoFile(e.target.files?.[0] || null)}
                />
              </div>

              {logoFile && (
                <button
                  onClick={() => setLogoFile(null)}
                  className="text-xs text-[var(--muted)] hover:text-[var(--color-error)] transition-colors"
                >
                  Remover
                </button>
              )}
            </div>
          </div>

          <Button onClick={saveGeral} loading={loading}>Salvar alterações</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AbaKanban() {
  // Pipeline unificado com Leads e CRM Kanban (ETAPA 4). Edição via código.
  const status = [
    { kanban: 'Iniciou o Atendimento', db: 'iniciou_atendimento' },
    { kanban: 'Conversando', db: 'conversando' },
    { kanban: 'Follow Up', db: 'follow_up' },
    { kanban: 'Agendado', db: 'agendado' },
    { kanban: 'Reagendado', db: 'reagendado' },
    { kanban: 'Faltou', db: 'faltou' },
    { kanban: 'Cancelou o Agendamento', db: 'cancelou_agendamento' },
    { kanban: 'Não Converteu', db: 'nao_converteu' },
    { kanban: 'Abandonou a Conversa', db: 'abandonou_conversa' },
    { kanban: 'Converteu', db: 'converteu' },
  ];

  const [copiado, setCopiado] = useState<string | null>(null);
  const copiar = (v: string) => {
    navigator.clipboard.writeText(v);
    setCopiado(v);
    setTimeout(() => setCopiado(null), 1500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Referência do CRM Kanban</CardTitle>
        <p className="text-sm text-[var(--muted)] mt-1">
          As colunas do Kanban são definidas em código (mesmo pipeline de Leads e CRM). Use os valores
          abaixo para atualizar o status dos leads via n8n ou agente de IA.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {status.map((item) => (
            <div
              key={item.db}
              className="border border-[var(--border)] rounded-[12px] p-3.5 bg-[var(--bg)] flex flex-col gap-2.5"
            >
              <Badge variant={item.db as any}>{item.kanban}</Badge>
              <button
                onClick={() => copiar(item.db)}
                className="group flex items-center justify-between gap-2 w-full rounded-[8px] border border-[var(--border)] bg-white px-2.5 py-1.5 transition-colors hover:border-[var(--sage-dark)]"
                title="Copiar valor do banco"
              >
                <span className="font-mono text-xs text-[var(--ink)] truncate">{item.db}</span>
                {copiado === item.db
                  ? <CheckCircle className="w-3.5 h-3.5 shrink-0 text-[var(--sage-dark)]" />
                  : <Copy className="w-3.5 h-3.5 shrink-0 text-[var(--muted)] group-hover:text-[var(--sage-dark)]" />}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-[8px] border border-[var(--border)] bg-[var(--sage-xlight)] p-3 text-sm text-[var(--sage-dark)] flex items-start gap-2">
          <span className="font-bold text-lg leading-none mt-0.5">•</span>
          <p>
            Para mover um lead no Kanban via n8n, atualize o campo <code className="font-mono">status</code> da
            tabela <code className="font-mono">leads</code> com um dos valores acima.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function AbaAgendas() {
  const [agendas, setAgendas] = useState<any[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ nome: '', cor: '#C47E7E', calcom_link: '', calcom_event_type_id: '' });
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadAgendas = async () => {
    const { data } = await supabase.from('agendas').select('*').order('created_at', { ascending: false });
    if (data) setAgendas(data);
  };
  useEffect(() => { loadAgendas(); }, []);

  const saveAgenda = async () => {
    if (!form.nome) return;
    setLoading(true);
    
    let res;
    if (editingId) {
      res = await supabase.from('agendas').update({
        nome: form.nome,
        cor: form.cor,
        calcom_link: form.calcom_link,
        calcom_event_type_id: form.calcom_event_type_id || null
      }).eq('id', editingId);
    } else {
      res = await supabase.from('agendas').insert({
        nome: form.nome,
        cor: form.cor,
        calcom_link: form.calcom_link,
        calcom_event_type_id: form.calcom_event_type_id || null,
        ativo: true
      });
    }

    setLoading(false);
    if (res.error) {
      alert(`Erro: ${res.error.message}`);
      return;
    }
    
    setForm({ nome: '', cor: '#C47E7E', calcom_link: '', calcom_event_type_id: '' });
    setEditingId(null);
    setOpenNew(false);
    loadAgendas();
  };

  const handleEdit = (ag: any) => {
    setForm({ nome: ag.nome, cor: ag.cor, calcom_link: ag.calcom_link || '', calcom_event_type_id: ag.calcom_event_type_id || '' });
    setEditingId(ag.id);
    setOpenNew(true);
  };

  const deleteAgenda = async (id: string) => {
    if (!window.confirm("Atenção: isto apaga a agenda E todos os agendamentos/bloqueios vinculados a ela (histórico incluso). Esta ação é irreversível. Para apenas ocultar, edite e marque como inativa. Tem certeza?")) return;
    const { error } = await supabase.rpc('apagar_agenda_completa', { p_agenda_id: id });
    if (error) { alert('Erro ao apagar: ' + error.message); return; }
    loadAgendas();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Agendas (Cal.com)</CardTitle>
            <p className="text-sm text-[var(--muted)] mt-1">Conecte seus profissionais ou salas aos Event Types do Cal.com.</p>
          </div>
          <Button onClick={() => setOpenNew(true)} size="sm"><Plus className="w-4 h-4 mr-2"/> Nova Agenda</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agendas.map(ag => (
            <div key={ag.id} className="border border-[var(--border)] rounded-[12px] p-4 flex flex-col gap-3 relative overflow-hidden bg-white">
              <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: ag.cor }}></div>
              <div className="flex justify-between items-start pl-3">
                <div>
                  <h3 className="font-bold text-lg text-[var(--ink)] flex items-center gap-2">
                    {ag.nome}
                    {!ag.ativo && <Badge variant="default" className="text-[10px]">Inativo</Badge>}
                  </h3>
                  <div className="text-sm border bg-gray-50 text-gray-600 rounded px-2 py-1 mt-2 inline-flex items-center gap-2 overflow-hidden max-w-[200px] sm:max-w-[280px]">
                    <span className="opacity-70 font-mono text-xs whitespace-nowrap">Link Cal.com:</span>
                    <span className="truncate">{ag.calcom_link || <span className="text-red-400 italic">Não configurado</span>}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(ag)} className="p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600 transition-colors rounded" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteAgenda(ag.id)} className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors rounded" title="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {agendas.length === 0 && (
             <div className="col-span-1 md:col-span-2 text-center py-8 text-[var(--muted)] border border-dashed border-[var(--border)] rounded-lg">
               Nenhuma agenda cadastrada.
             </div>
          )}
        </div>

        <Modal 
          isOpen={openNew} 
          onClose={() => { setOpenNew(false); setEditingId(null); setForm({ nome: '', cor: '#C47E7E', calcom_link: '', calcom_event_type_id: '' }); }} 
          title={editingId ? "Editar Agenda" : "Adicionar Agenda"}
        >
          <div className="space-y-4">
            <Input label="Nome da Cadeira / Profissional" placeholder="Ex: Dra. Juliana" value={form.nome} onChange={e=>setForm({...form, nome: e.target.value})}/>
            <div>
               <label className="block text-sm font-medium text-[var(--ink)] mb-1">Link da Agenda no Cal.com</label>
               <input
                 type="text"
                 className="w-full border border-[var(--border)] rounded-[8px] px-3 py-2 text-sm bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--sage-dark)]"
                 placeholder="Ex: cal.com/suaclinica/dr-bruno"
                 value={form.calcom_link}
                 onChange={e=>setForm({...form, calcom_link: e.target.value})}
               />
               <p className="text-xs text-[var(--muted)] mt-1">Copie e cole o link público oficial do "Event Type" criado no Cal.com.</p>
            </div>
            <div>
               <label className="block text-sm font-medium text-[var(--ink)] mb-1">ID do Event-type (sincronização)</label>
               <input
                 type="text"
                 className="w-full border border-[var(--border)] rounded-[8px] px-3 py-2 text-sm bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--sage-dark)]"
                 placeholder="Ex: 123456"
                 value={form.calcom_event_type_id}
                 onChange={e=>setForm({...form, calcom_event_type_id: e.target.value})}
               />
               <p className="text-xs text-[var(--muted)] mt-1">O ID numérico do Event-type no Cal.com. É por ele que o webhook sabe de qual profissional é a reserva.</p>
            </div>
            <div>
               <label className="block text-sm font-medium text-[var(--ink)] mb-1">Cor de identificação</label>
               <div className="flex gap-2">
                  <input
                    type="color"
                    className="w-10 h-10 border-0 p-0 rounded cursor-pointer"
                    value={form.cor}
                    onChange={e=>setForm({...form, cor: e.target.value})}
                  />
                  <div className="text-xs text-[var(--muted)] self-center">Aparece na barra lateral desta agenda</div>
               </div>
            </div>

            <Button className="w-full" disabled={!form.nome || loading} onClick={saveAgenda}>
              {loading ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Adicionar Agenda'}
            </Button>
          </div>
        </Modal>
      </CardContent>
    </Card>
  );
}

function AbaServicos() {
  const [servicos, setServicos] = useState<any[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const [loading, setLoading] = useState(false);

  const loadServicos = async () => {
    const { data } = await supabase.from('servicos').select('*').order('created_at', { ascending: true });
    if (data) setServicos(data);
  };

  useEffect(() => { loadServicos(); }, []);

  const fecharModal = () => { setOpenNew(false); setNome(''); setValor(''); };

  const saveServico = async () => {
    if (!nome) return;
    setLoading(true);

    const valorNum = valor ? parseFloat(valor.replace(',', '.')) : null;
    const { error } = await supabase.from('servicos').insert({ nome, valor: valorNum });

    setLoading(false);
    if (error) {
      alert(`Erro: ${error.message}`);
      return;
    }

    fecharModal();
    loadServicos();
  };

  const deleteServico = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este serviço?")) return;
    await supabase.from('servicos').delete().eq('id', id);
    loadServicos();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Serviços Prestados</CardTitle>
            <p className="text-sm text-[var(--muted)] mt-1">Cadastre os serviços que serão selecionados quando uma venda for fechada.</p>
          </div>
          <Button onClick={() => setOpenNew(true)} size="sm"><Plus className="w-4 h-4 mr-2"/> Novo Serviço</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {servicos.map(srv => (
            <div key={srv.id} className="border border-[var(--border)] rounded-[12px] p-4 flex justify-between items-center bg-[var(--bg)] group">
              <div className="min-w-0 pr-2">
                <span className="block font-medium text-[var(--ink)] truncate">{srv.nome}</span>
                <span className="block text-xs mt-0.5" style={{ color: srv.valor ? 'var(--sage-dark)' : 'var(--muted)' }}>
                  {srv.valor != null
                    ? Number(srv.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    : 'Sem valor'}
                </span>
              </div>
              <button
                onClick={() => deleteServico(srv.id)}
                className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors rounded opacity-0 group-hover:opacity-100"
                title="Excluir"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {servicos.length === 0 && (
             <div className="col-span-1 sm:col-span-2 md:col-span-3 text-center py-8 text-[var(--muted)] border border-dashed border-[var(--border)] rounded-lg">
               Nenhum serviço cadastrado.
             </div>
          )}
        </div>

        <Modal isOpen={openNew} onClose={fecharModal} title="Adicionar Serviço">
          <div className="space-y-4">
            <Input
              label="Nome do Serviço"
              placeholder="Ex: Planejamento Previdenciário"
              value={nome}
              onChange={e => setNome(e.target.value)}
            />
            <Input
              label="Valor (R$)"
              placeholder="Ex: 1500,00"
              inputMode="decimal"
              value={valor}
              onChange={e => setValor(e.target.value)}
            />
            <p className="text-xs text-[var(--muted)] -mt-2">
              Esse valor preenche automaticamente o procedimento do paciente ao selecionar o serviço.
            </p>
            <Button className="w-full" disabled={!nome || loading} onClick={saveServico}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </Modal>
      </CardContent>
    </Card>
  );
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Pequeno bloco de URL com botão copiar.
function CopyableUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copiar = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={e => e.target.select()}
        className="flex-1 min-w-0 rounded-[8px] px-3 py-2 text-xs font-mono bg-[var(--bg)] border border-[var(--border-md)] text-[var(--muted)] focus:outline-none"
      />
      <button
        onClick={copiar}
        className="flex-shrink-0 flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-[8px] transition-colors"
        style={copied ? { background: 'var(--sage-xlight)', color: 'var(--sage-dark)' } : { background: 'var(--sage-dark)', color: '#fff' }}
      >
        {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

// Linha "label: ••••••" para credenciais salvas.
function MaskedRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <span className="text-sm font-mono text-[var(--ink)]">
        {value ? '•'.repeat(10) : <span className="text-[var(--muted)] italic">não informado</span>}
      </span>
    </div>
  );
}

function AbaWhatsApp() {
  const { config, refreshConfig } = useClinic();
  const { user } = useAuth();
  const isAdminOrAbove = user?.role === 'admin' || user?.role === 'super_admin';
  const [provider, setProvider] = useState<'meta' | 'evolution'>(
    (config?.whatsapp_provider as 'meta' | 'evolution') || 'meta'
  );

  const [sensitiveConfig, setSensitiveConfig] = useState<{
    meta_access_token: string;
    meta_webhook_verify_token: string;
    evolution_api_key: string;
  } | null>(null);

  const fetchSensitiveConfig = async () => {
    const { data } = await supabase
      .from('clinic_config')
      .select('meta_access_token, meta_webhook_verify_token, evolution_api_key')
      .single();
    if (data) setSensitiveConfig(data);
  };

  // Meta Cloud API
  const [metaPhoneId, setMetaPhoneId] = useState(config?.meta_phone_number_id || '');
  const [metaToken, setMetaToken] = useState('');
  const [metaVerifyToken, setMetaVerifyToken] = useState('');
  const [metaBusinessId, setMetaBusinessId] = useState(config?.meta_business_account_id || '');

  // Evolution API
  const [evoServerUrl, setEvoServerUrl] = useState(config?.evolution_server_url || '');
  const [evoApiKey, setEvoApiKey] = useState('');
  const [evoInstance, setEvoInstance] = useState(config?.evolution_instance_name || '');

  // Modal de credenciais + URL gerada
  const [credModalOpen, setCredModalOpen] = useState(false);
  const [webhookGerada, setWebhookGerada] = useState(false);
  const [loading, setLoading] = useState(false);

  // Desconexão intencional
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  // Status e QR code da Evolution API
  const [connectionState, setConnectionState] = useState<'open' | 'close' | 'connecting' | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [generatingQr, setGeneratingQr] = useState(false);

  // URLs de webhook geradas (Edge Functions deste projeto).
  const metaWebhookUrl = `${SUPABASE_URL}/functions/v1/webhook-meta`;
  const evoWebhookUrl = `${SUPABASE_URL}/functions/v1/webhook-evolution`;
  const providerWebhookUrl = provider === 'meta' ? metaWebhookUrl : evoWebhookUrl;

  const metaConfigured = !!(config?.meta_phone_number_id && sensitiveConfig?.meta_access_token);
  const evoConfigured = !!(config?.evolution_server_url && sensitiveConfig?.evolution_api_key && config?.evolution_instance_name);
  const activeConfigured = provider === 'meta' ? metaConfigured : evoConfigured;

  async function verificarStatus() {
    setCheckingStatus(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/evolution-proxy`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connectionState' }),
      });
      const data = await resp.json();
      const state = data?.instance?.state ?? data?.state ?? 'close';
      setConnectionState(state === 'open' ? 'open' : state === 'connecting' ? 'connecting' : 'close');
    } catch {
      setConnectionState('close');
    } finally {
      setCheckingStatus(false);
    }
  }

  async function gerarQrCode() {
    setGeneratingQr(true);
    setQrCode(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/evolution-proxy`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect' }),
      });
      const data = await resp.json();
      const base64 = data?.base64 ?? data?.qrcode?.base64 ?? null;
      setQrCode(base64);
    } catch {
      alert('Erro ao gerar QR Code. Verifique a URL e a API Key.');
    } finally {
      setGeneratingQr(false);
    }
  }

  async function desconectarInstancia() {
    setDisconnecting(true);
    setDisconnectError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/evolution-proxy`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
      const resData = await resp.json().catch(() => ({}));
      // 404 = instância já desconectada — trata como sucesso
      if (!resp.ok && resp.status !== 404) {
        throw new Error(resData?.error || resData?.message || `HTTP ${resp.status}`);
      }
      // Limpar credenciais do banco
      await supabase.from('clinic_config').update({
        evolution_server_url: null,
        evolution_api_key: null,
        evolution_instance_name: null,
      }).eq('id', 1);
      await refreshConfig();
      setSensitiveConfig(null);
      setEvoServerUrl('');
      setEvoApiKey('');
      setEvoInstance('');
      setConnectionState(null);
      setQrCode(null);
      setDisconnectModalOpen(false);
    } catch (err: unknown) {
      setDisconnectError((err as Error).message || 'Erro ao desconectar');
    } finally {
      setDisconnecting(false);
    }
  }

  useEffect(() => { fetchSensitiveConfig(); }, []);

  useEffect(() => {
    if (config) {
      setProvider((config.whatsapp_provider as 'meta' | 'evolution') || 'meta');
      setMetaPhoneId(config.meta_phone_number_id || '');
      setMetaBusinessId(config.meta_business_account_id || '');
      setEvoServerUrl(config.evolution_server_url || '');
      setEvoInstance(config.evolution_instance_name || '');
    }
  }, [config]);

  useEffect(() => {
    if (sensitiveConfig) {
      setMetaToken(sensitiveConfig.meta_access_token || '');
      setMetaVerifyToken(sensitiveConfig.meta_webhook_verify_token || '');
      setEvoApiKey(sensitiveConfig.evolution_api_key || '');
    }
  }, [sensitiveConfig]);

  // Polling do status (item 2): a cada 6s enquanto não estiver conectado.
  useEffect(() => {
    if (provider !== 'evolution' || !evoConfigured) return;
    verificarStatus();
    if (connectionState === 'open') return;
    const id = setInterval(verificarStatus, 6000);
    return () => clearInterval(id);
  }, [provider, evoConfigured, connectionState]);

  // Ao conectar, o QR some e o status fica verde (item 2).
  useEffect(() => {
    if (connectionState === 'open') setQrCode(null);
  }, [connectionState]);

  function abrirModalCredenciais(p: 'meta' | 'evolution') {
    setProvider(p);
    setWebhookGerada(false);
    setCredModalOpen(true);
  }

  function selecionarProvedor(p: 'meta' | 'evolution') {
    setProvider(p);
    const configured = p === 'meta' ? metaConfigured : evoConfigured;
    if (!configured) abrirModalCredenciais(p);
  }

  const salvarCredenciais = async () => {
    setLoading(true);
    const { error } = await supabase.from('clinic_config').update({
      whatsapp_provider: provider,
      meta_phone_number_id: metaPhoneId || null,
      meta_access_token: metaToken || null,
      meta_webhook_verify_token: metaVerifyToken || null,
      meta_business_account_id: metaBusinessId || null,
      evolution_server_url: evoServerUrl || null,
      evolution_api_key: evoApiKey || null,
      evolution_instance_name: evoInstance || null,
    }).eq('id', 1);
    setLoading(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    await refreshConfig();
    await fetchSensitiveConfig();
    setWebhookGerada(true); // mostra a URL de webhook para copiar
  };

  return (
    <div className="space-y-6">
      {/* Status geral */}
      <div className={`flex items-center gap-3 p-4 rounded-[12px] border ${activeConfigured ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        {activeConfigured
          ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          : <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />}
        <div>
          <p className={`text-sm font-semibold ${activeConfigured ? 'text-green-800' : 'text-amber-800'}`}>
            {activeConfigured ? 'Integração configurada' : 'Integração pendente'}
          </p>
          <p className={`text-xs mt-0.5 ${activeConfigured ? 'text-green-700' : 'text-amber-700'}`}>
            {activeConfigured
              ? `Provedor ativo: ${provider === 'meta' ? 'Meta Cloud API (oficial)' : 'Evolution API'}`
              : 'Selecione um provedor e informe as credenciais para ativar o Inbox.'}
          </p>
        </div>
      </div>

      {/* Seletor de provedor */}
      <Card>
        <CardHeader><CardTitle>Provedor de WhatsApp</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['meta', 'evolution'] as const).map(p => (
              <button
                key={p}
                onClick={() => selecionarProvedor(p)}
                className={`flex flex-col items-start gap-1 p-4 rounded-[12px] border-2 text-left transition-colors ${provider === p ? 'border-[var(--sage-dark)] bg-[var(--sage-dark)]/5' : 'border-[var(--border)] hover:border-[var(--sage-dark)]/40'}`}
              >
                <span className="font-semibold text-sm text-[var(--ink)]">
                  {p === 'meta' ? 'Meta Cloud API' : 'Evolution API'}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {p === 'meta' ? 'API oficial do WhatsApp Business (Meta)' : 'API self-hosted (Evolution)'}
                </span>
                {provider === p && (
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--sage-dark)]">Ativo</span>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Credenciais — resumo mascarado + Editar (item 1) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{provider === 'meta' ? 'Meta Cloud API — Credenciais' : 'Evolution API — Credenciais'}</CardTitle>
            <button
              onClick={() => abrirModalCredenciais(provider)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[8px] border border-[var(--border-md)] hover:bg-[var(--bg)] transition-colors text-[var(--ink)]"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {activeConfigured ? (
            <div className="divide-y divide-[var(--border)]">
              {provider === 'meta' ? (
                <>
                  <MaskedRow label="Phone Number ID" value={config?.meta_phone_number_id} />
                  <MaskedRow label="Access Token" value={sensitiveConfig?.meta_access_token} />
                  <MaskedRow label="Webhook Verify Token" value={sensitiveConfig?.meta_webhook_verify_token} />
                  <MaskedRow label="Business Account ID" value={config?.meta_business_account_id} />
                </>
              ) : (
                <>
                  <MaskedRow label="URL do Servidor" value={config?.evolution_server_url} />
                  <MaskedRow label="API Key" value={sensitiveConfig?.evolution_api_key} />
                  <MaskedRow label="Instância" value={config?.evolution_instance_name} />
                </>
              )}
              <div className="pt-3">
                <p className="text-xs font-semibold text-[var(--muted)] mb-1.5">URL do Webhook (configure no provedor):</p>
                <CopyableUrl url={providerWebhookUrl} />
              </div>
              {provider === 'evolution' && (
                <div className="pt-3">
                  <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg)] p-3 text-xs text-[var(--muted)] leading-relaxed">
                    <p className="font-semibold text-[var(--ink)] mb-1.5">Eventos a habilitar na Evolution</p>
                    <p className="mb-2">
                      No painel da Evolution, em <span className="font-medium">Events → Webhook</span>, cole a URL acima e
                      ligue os eventos abaixo (senão mensagens recebidas e apagamentos não chegam ao Inbox):
                    </p>
                    <ul className="space-y-1">
                      <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--sage-dark)] flex-shrink-0" /><code className="font-mono">MESSAGES_UPSERT</code> — receber mensagens</li>
                      <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--sage-dark)] flex-shrink-0" /><code className="font-mono">MESSAGES_UPDATE</code> — paciente apaga (apagar p/ todos)</li>
                      <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--sage-dark)] flex-shrink-0" /><code className="font-mono">MESSAGES_DELETE</code> — apagamento de mensagens</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-[var(--muted)] mb-3">Nenhuma credencial salva para este provedor.</p>
              <Button size="sm" onClick={() => abrirModalCredenciais(provider)}>
                <Pencil className="w-4 h-4 mr-2" /> Inserir credenciais
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status da conexão Evolution API (polling automático) */}
      {provider === 'evolution' && evoConfigured && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Status da Conexão WhatsApp</CardTitle>
              <button
                onClick={verificarStatus}
                disabled={checkingStatus}
                className="text-xs text-[var(--sage-dark)] hover:underline disabled:opacity-50"
              >
                {checkingStatus ? 'Verificando...' : 'Verificar agora'}
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {connectionState !== null && (
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-[8px] border text-sm font-medium flex-1 ${
                  connectionState === 'open'
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : connectionState === 'connecting'
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    connectionState === 'open' ? 'bg-green-500' : connectionState === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                  }`} />
                  {connectionState === 'open' ? 'Conectado — WhatsApp ativo' : connectionState === 'connecting' ? 'Conectando...' : 'Desconectado'}
                </div>
                {connectionState === 'open' && isAdminOrAbove && (
                  <button
                    onClick={() => { setDisconnectError(null); setDisconnectModalOpen(true); }}
                    className="flex-shrink-0 px-3 py-2 rounded-[8px] text-sm font-medium transition-colors hover:bg-red-50"
                    style={{ border: '1px solid #C0392B', color: '#C0392B', background: 'transparent' }}
                  >
                    Desconectar
                  </button>
                )}
              </div>
            )}

            {connectionState !== 'open' && connectionState !== null && (
              <div className="space-y-3">
                <button
                  onClick={gerarQrCode}
                  disabled={generatingQr}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[8px] bg-[var(--sage-dark)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {generatingQr ? 'Gerando QR Code...' : 'Gerar QR Code para reconectar'}
                </button>

                {qrCode && (
                  <div className="flex flex-col items-center gap-3 p-4 bg-white border border-[var(--border)] rounded-[12px]">
                    <p className="text-sm font-medium text-[var(--ink)]">Escaneie com o WhatsApp do celular</p>
                    <img src={qrCode} alt="QR Code WhatsApp" className="w-48 h-48 rounded-[8px]" />
                    <ol className="text-xs text-[var(--muted)] space-y-1 self-start">
                      <li>1. Abra o WhatsApp no celular</li>
                      <li>2. Toque em <strong>⋮ → Aparelhos conectados</strong></li>
                      <li>3. Toque em <strong>Conectar um aparelho</strong></li>
                      <li>4. Escaneie este QR code</li>
                    </ol>
                    <p className="text-xs text-[var(--muted)]">A conexão é detectada automaticamente.</p>
                  </div>
                )}
              </div>
            )}

            {connectionState === null && (
              <p className="text-sm text-[var(--muted)]">Verificando status da conexão...</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Modal: confirmar desconexão ── */}
      <Modal
        isOpen={disconnectModalOpen}
        onClose={() => { if (!disconnecting) setDisconnectModalOpen(false); }}
        title="Desconectar WhatsApp"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--ink)]">
            Deseja desconectar o WhatsApp? O agente deixará de responder até a reconexão.
          </p>
          {disconnectError && (
            <div className="px-3 py-2 rounded-[8px] bg-red-50 border border-red-200 text-sm text-red-700">
              {disconnectError}
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setDisconnectModalOpen(false)}
              disabled={disconnecting}
              className="px-4 py-2 rounded-[8px] border border-[var(--border-md)] text-sm font-medium text-[var(--ink)] hover:bg-[var(--bg)] disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <Button
              onClick={desconectarInstancia}
              loading={disconnecting}
              style={{ backgroundColor: '#C0392B', borderColor: '#C0392B' }}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: credenciais do provedor ── */}
      <Modal
        isOpen={credModalOpen}
        onClose={() => setCredModalOpen(false)}
        title={provider === 'meta' ? 'Credenciais — Meta Cloud API' : 'Credenciais — Evolution API'}
      >
        {!webhookGerada ? (
          <div className="space-y-4">
            {provider === 'meta' ? (
              <>
                <Input label="Phone Number ID" placeholder="Ex: 123456789012345" value={metaPhoneId} onChange={e => setMetaPhoneId(e.target.value)} />
                <Input label="Access Token (permanente)" placeholder="EAABsb..." type="password" value={metaToken} onChange={e => setMetaToken(e.target.value)} />
                <Input label="Webhook Verify Token" placeholder="Token de verificação do webhook" type="password" value={metaVerifyToken} onChange={e => setMetaVerifyToken(e.target.value)} />
                <Input label="Business Account ID (WABA ID)" placeholder="Ex: 987654321098765" value={metaBusinessId} onChange={e => setMetaBusinessId(e.target.value)} />
              </>
            ) : (
              <>
                <Input label="URL do Servidor" placeholder="Ex: https://evolution.seudominio.com" value={evoServerUrl} onChange={e => setEvoServerUrl(e.target.value)} />
                <Input label="API Key" placeholder="Chave da Evolution API" type="password" value={evoApiKey} onChange={e => setEvoApiKey(e.target.value)} />
                <Input label="Nome da Instância" placeholder="Ex: clinica-principal" value={evoInstance} onChange={e => setEvoInstance(e.target.value)} />
              </>
            )}
            <Button className="w-full" loading={loading} onClick={salvarCredenciais}>
              Salvar credenciais
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-[8px]" style={{ background: 'var(--sage-xlight)' }}>
              <CheckCircle className="w-5 h-5 shrink-0" style={{ color: 'var(--sage-dark)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--sage-dark)' }}>Credenciais salvas com sucesso!</p>
            </div>
            <div>
              <p className="text-sm text-[var(--muted)] mb-2">
                Configure esta <strong className="text-[var(--ink)]">URL de webhook</strong> no
                {provider === 'meta' ? ' painel do Meta' : ' painel da Evolution'}:
              </p>
              <CopyableUrl url={providerWebhookUrl} />
            </div>
            <Button className="w-full" variant="secondary" onClick={() => setCredModalOpen(false)}>
              Concluir
            </Button>
          </div>
        )}
      </Modal>

    </div>
  );
}

// ── AbaWebhooks ──────────────────────────────────────────────────────────────
// Integrações via n8n, separadas da aba WhatsApp (evita confusão). Cada item
// abre um popup próprio para editar.
function AbaWebhooks() {
  const { config, refreshConfig } = useClinic();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [editando, setEditando] = useState<null | 'nota' | 'aniversario' | 'upgrade'>(null);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [heroicWhatsapp, setHeroicWhatsapp] = useState(config?.heroic_leap_whatsapp || '');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);

  useEffect(() => {
    setHeroicWhatsapp(config?.heroic_leap_whatsapp || '');
  }, [config]);

  const saveHeroicWhatsapp = async () => {
    setSavingWhatsapp(true);
    const { error } = await supabase.from('clinic_config').update({ heroic_leap_whatsapp: heroicWhatsapp || null }).eq('id', 1);
    setSavingWhatsapp(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    await refreshConfig();
  };

  const itens = [
    {
      key: 'nota' as const, campo: 'nota_webhook_url',
      titulo: 'Resumo Pós-Consulta',
      desc: 'Quando o profissional salva o resumo pós-consulta no perfil do paciente, dispara para o n8n — a IA lê e envia a mensagem ao paciente.',
      valor: config?.nota_webhook_url || '', placeholder: 'https://n8n.seudominio.com/webhook/resumo-paciente',
      label: 'URL do Webhook (n8n)',
    },
    {
      key: 'aniversario' as const, campo: 'aniversario_webhook_url',
      titulo: 'Aniversário (Eventos)',
      desc: 'Recebe a lista de aniversariantes + a mensagem para o n8n disparar um a um pelo WhatsApp.',
      valor: config?.aniversario_webhook_url || '', placeholder: 'https://n8n.seudominio.com/webhook/aniversario',
      label: 'URL do Webhook (n8n)',
    },
    {
      key: 'upgrade' as const, campo: 'upgrade_webhook_url',
      titulo: 'Notificação de upgrade — Heroic Leap',
      desc: 'Quando uma clínica solicita liberar Eventos ou Experiência Premium, dispara este webhook do n8n — que envia um e-mail pelo Gmail (SMTP/App Password) para a Heroic Leap. Configurado pela Heroic Leap.',
      valor: config?.upgrade_webhook_url || '', placeholder: 'https://n8n.heroicleap.com/webhook/upgrade',
      label: 'URL do webhook n8n (envia e-mail via Gmail)',
    },
  ];

  const abrir = (it: typeof itens[number]) => { setValor(it.valor); setEditando(it.key); };
  const atual = itens.find(i => i.key === editando);

  const salvar = async () => {
    if (!atual) return;
    setSalvando(true);
    const { error } = await supabase.from('clinic_config').update({ [atual.campo]: valor || null }).eq('id', 1);
    setSalvando(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    await refreshConfig();
    setEditando(null);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Integrações com o n8n. Clique em <strong>Editar</strong> para configurar cada uma.
      </p>
      {itens.map(it => (
        <Card key={it.key}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{it.titulo}</CardTitle>
              <button
                onClick={() => abrir(it)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[8px] border border-[var(--border-md)] hover:bg-[var(--bg)] transition-colors text-[var(--ink)]"
              >
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
            </div>
            <p className="text-sm text-[var(--muted)] mt-1">{it.desc}</p>
          </CardHeader>
          <CardContent>
            <MaskedRow label={it.label} value={it.valor} />
          </CardContent>
        </Card>
      ))}

      <Modal isOpen={!!editando} onClose={() => setEditando(null)} title={atual?.titulo || ''}>
        <div className="space-y-4">
          <Input label={atual?.label || 'URL'} placeholder={atual?.placeholder} value={valor} onChange={e => setValor(e.target.value)} />
          <Button className="w-full" loading={salvando} onClick={salvar}>Salvar</Button>
        </div>
      </Modal>

      {isSuperAdmin && (
        <Card>
          <CardHeader><CardTitle>Contato da Heroic Leap</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="WhatsApp da Heroic Leap (somente dígitos, ex: 5511999999999)"
              placeholder="5511999999999"
              value={heroicWhatsapp}
              onChange={e => setHeroicWhatsapp(e.target.value)}
            />
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Número usado nos botões de "Solicitar acesso" para upgrade de recursos (Lista de Espera, Experiência Premium).
            </p>
            <Button onClick={saveHeroicWhatsapp} loading={savingWhatsapp}>Salvar</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── AbaKpis ───────────────────────────────────────────────────────────────────

const PILAR_LABEL: Record<string, string> = {
  operacional: 'Pilar Operacional',
  comercial:   'Pilar Comercial',
  experiencia: 'Pilar Experiência',
};

function KpiToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      style={{
        width: '34px', height: '18px', borderRadius: '9px',
        background: on ? 'var(--sage-dark)' : 'var(--border-md)',
        border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
        transition: 'background 0.15s',
      }}
    >
      <div style={{
        position: 'absolute', top: '2px', left: on ? '18px' : '2px',
        width: '14px', height: '14px', borderRadius: '50%', background: 'white',
        transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

function AbaKpis() {
  const [loadingKpis, setLoadingKpis]   = useState(true);
  const [catalog, setCatalog]           = useState<any[]>([]);
  const [selection, setSelection]       = useState<Record<string, boolean>>({});
  const [investimentos, setInvestimentos] = useState<any[]>([]);
  const [novInv, setNovInv]             = useState({ inicio: '', fim: '', valor: '', canal: '' });
  const [salvandoInv, setSalvandoInv]   = useState(false);

  useEffect(() => {
    carregarKpis();
    carregarInvestimentos();
  }, []);

  const carregarKpis = async () => {
    setLoadingKpis(true);
    const [catReq, selReq] = await Promise.all([
      supabase.from('kpi_catalog').select('*').order('ordem'),
      supabase.from('clinic_kpi_selection').select('*'),
    ]);
    if (catReq.data) setCatalog(catReq.data);
    const sel: Record<string, boolean> = {};
    (selReq.data || []).forEach((r: any) => { sel[r.kpi_codigo] = r.ativo; });
    setSelection(sel);
    setLoadingKpis(false);
  };

  const carregarInvestimentos = async () => {
    const { data } = await supabase
      .from('marketing_investimento')
      .select('*')
      .order('periodo_inicio', { ascending: false });
    if (data) setInvestimentos(data);
  };

  const toggleKpi = async (codigo: string, ativo: boolean) => {
    setSelection(prev => ({ ...prev, [codigo]: ativo }));
    await supabase
      .from('clinic_kpi_selection')
      .upsert({ kpi_codigo: codigo, ativo, updated_at: new Date().toISOString() }, { onConflict: 'kpi_codigo' });
  };

  const adicionarInvestimento = async () => {
    if (!novInv.inicio || !novInv.fim || !novInv.valor) return;
    setSalvandoInv(true);
    const { data } = await supabase
      .from('marketing_investimento')
      .insert({ periodo_inicio: novInv.inicio, periodo_fim: novInv.fim, valor: parseFloat(novInv.valor), canal: novInv.canal || null })
      .select()
      .single();
    if (data) setInvestimentos(prev => [data, ...prev]);
    setNovInv({ inicio: '', fim: '', valor: '', canal: '' });
    setSalvandoInv(false);
  };

  const excluirInvestimento = async (id: string) => {
    await supabase.from('marketing_investimento').delete().eq('id', id);
    setInvestimentos(prev => prev.filter(i => i.id !== id));
  };

  if (loadingKpis) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--muted)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Seleção de KPIs ── */}
      <Card>
        <CardHeader>
          <CardTitle>KPIs ativos no dashboard</CardTitle>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Ligue/desligue cada métrica. KPIs "aguardando dados" aparecem no dashboard mas sem valor até a fonte estar disponível.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {['operacional', 'comercial', 'experiencia'].map(pilar => {
            const kpis = catalog.filter((k: any) => k.pilar === pilar);
            return (
              <div key={pilar}>
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--muted)', paddingBottom: '8px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
                  {PILAR_LABEL[pilar]}
                </div>
                {kpis.map((kpi: any) => (
                  <div
                    key={kpi.codigo}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px', borderRadius: 'var(--r-xs)', gap: '12px',
                      background: selection[kpi.codigo] ? 'var(--sage-xlight)' : 'transparent',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>{kpi.nome}</span>
                        {kpi.fonte === 'aguardando' && (
                          <span style={{ fontSize: '9.5px', padding: '1px 6px', background: 'var(--champ-light)', color: 'var(--champ-text)', borderRadius: '4px', fontWeight: 600 }}>
                            aguardando dados
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>{kpi.descricao}</div>
                    </div>
                    <KpiToggle on={!!selection[kpi.codigo]} onChange={v => toggleKpi(kpi.codigo, v)} />
                  </div>
                ))}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Investimento em Marketing ── */}
      <Card>
        <CardHeader>
          <CardTitle>Investimento em Marketing</CardTitle>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Registre o investimento por período para calcular CAC, CPL e ROAS quando os dados de conversão estiverem disponíveis.
          </p>
        </CardHeader>
        <CardContent>
          {/* Formulário */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginBottom: '14px', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Início do período</label>
              <input
                type="date"
                value={novInv.inicio}
                onChange={e => setNovInv(p => ({ ...p, inicio: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', fontSize: '12.5px', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'inherit' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Fim do período</label>
              <input
                type="date"
                value={novInv.fim}
                onChange={e => setNovInv(p => ({ ...p, fim: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', fontSize: '12.5px', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'inherit' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Valor (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={novInv.valor}
                onChange={e => setNovInv(p => ({ ...p, valor: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', fontSize: '12.5px', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'inherit' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Canal (opcional)</label>
              <input
                type="text"
                placeholder="Ex: Meta Ads"
                value={novInv.canal}
                onChange={e => setNovInv(p => ({ ...p, canal: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', fontSize: '12.5px', border: '1px solid var(--border-md)', borderRadius: 'var(--r-xs)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'inherit' }}
              />
            </div>
            <button
              onClick={adicionarInvestimento}
              disabled={salvandoInv || !novInv.inicio || !novInv.fim || !novInv.valor}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '7px 14px', fontSize: '12.5px', fontWeight: 600,
                background: 'var(--sage-dark)', color: 'white', border: 'none',
                borderRadius: 'var(--r-xs)', cursor: 'pointer', fontFamily: 'inherit',
                opacity: (salvandoInv || !novInv.inicio || !novInv.fim || !novInv.valor) ? 0.5 : 1,
              }}
            >
              {salvandoInv ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Adicionar
            </button>
          </div>

          {/* Tabela de registros */}
          {investimentos.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-xs)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {['Período', 'Valor', 'Canal', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', fontSize: '9.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {investimentos.map((inv: any) => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--ink)' }}>
                        {inv.periodo_inicio} → {inv.periodo_fim}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
                        {parseFloat(inv.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--muted)' }}>
                        {inv.canal || '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <button
                          onClick={() => excluirInvestimento(inv.id)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px', lineHeight: 1 }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {investimentos.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '12.5px', fontStyle: 'italic' }}>
              Nenhum investimento registrado ainda.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
