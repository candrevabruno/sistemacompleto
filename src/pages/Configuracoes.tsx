import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useClinic } from '../contexts/ClinicContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Copy, Plus, Trash2, PowerOff, Pencil, CheckCircle, AlertCircle } from 'lucide-react';

// For simplicity in this giant file, we will put everything here.
export function Configuracoes() {
  const [activeTab, setActiveTab] = useState('geral');

  const tabs = [
    { id: 'geral', label: 'Geral' },
    { id: 'agendas', label: 'Agendas (Cal.com)' },
    { id: 'servicos', label: 'Serviços' },
    { id: 'usuarios', label: 'Usuários' },
    { id: 'kanban', label: 'Kanban' },
    { id: 'whatsapp', label: 'WhatsApp' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex border-b border-[var(--color-border-card)] space-x-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === t.id ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>
        {activeTab === 'geral' && <AbaGeral />}
        {activeTab === 'agendas' && <AbaAgendas />}
        {activeTab === 'servicos' && <AbaServicos />}
        {activeTab === 'usuarios' && <AbaUsuarios />}
        {activeTab === 'kanban' && <AbaKanban />}
        {activeTab === 'whatsapp' && <AbaWhatsApp />}
      </div>
    </div>
  );
}

function AbaGeral() {
  const { config, refreshConfig } = useClinic();
  const [nome, setNome] = useState(config?.nome || 'Heroic Leap');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [hours, setHours] = useState<any[]>([]);
  const [loadingHours, setLoadingHours] = useState(false);

  useEffect(() => {
    setNome(config?.nome || 'Heroic Leap');
  }, [config]);

  useEffect(() => {
    loadHours();
  }, []);

  const loadHours = async () => {
    const order = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const { data } = await supabase.from('clinic_hours').select('*');
    if (data) {
      if (data.length === 0) {
        const defaults = order.map(dia => ({ dia, aberto: dia !== 'domingo' && dia !== 'sabado', hora_inicio: '08:00', hora_fim: '18:00' }));
        const { data: inserted } = await supabase.from('clinic_hours').insert(defaults).select('*');
        if (inserted) {
          inserted.sort((a: any, b: any) => order.indexOf(a.dia) - order.indexOf(b.dia));
          setHours(inserted);
        }
      } else {
        data.sort((a,b) => order.indexOf(a.dia) - order.indexOf(b.dia));
        setHours(data);
      }
    }
  };

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
      await supabase.from('clinic_config').update({ nome, logo_url }).eq('id', 1);
      await refreshConfig();
      setLogoFile(null); // limpa preview local para forçar carregar do servidor
      alert('Configurações salvas com sucesso!');
    } catch (err: any) {
      alert('Ocorreu um erro: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveHours = async () => {
    setLoadingHours(true);
    for (const h of hours) {
      await supabase.from('clinic_hours').update({ aberto: h.aberto, hora_inicio: h.hora_inicio, hora_fim: h.hora_fim }).eq('id', h.id);
    }
    setLoadingHours(false);
    alert('Horários salvos!');
  };

  const diasPT: Record<string, string> = {
    domingo: 'Domingo', segunda: 'Segunda-feira', terca: 'Terça-feira',
    quarta: 'Quarta-feira', quinta: 'Quinta-feira', sexta: 'Sexta-feira', sabado: 'Sábado'
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Identidade da Empresa</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input label="Nome da empresa" value={nome} onChange={e => setNome(e.target.value)} />

          {/* Logo upload estilizado */}
          <div>
            <label className="block text-sm font-medium mb-2">Logo da empresa (max 2MB)</label>
            <div className="flex items-center gap-4">
              {(logoFile ? URL.createObjectURL(logoFile) : config?.logo_url) && (
                <img
                  src={logoFile ? URL.createObjectURL(logoFile) : config?.logo_url || ''}
                  className="h-14 w-auto object-contain border border-[var(--color-border-card)] rounded-lg p-1"
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
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
                >
                  Remover
                </button>
              )}
            </div>
          </div>

          <Button onClick={saveGeral} loading={loading}>Salvar alterações</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Horário de Funcionamento</CardTitle></CardHeader>
        <CardContent>
          {hours.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] py-4">Carregando horários...</p>
          ) : (
            <div className="divide-y divide-[var(--color-border-card)]">
              {hours.map((h, i) => (
                <div key={h.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-4 sm:py-3">
                  <div className="flex items-center justify-between w-full sm:w-auto">
                    {/* Dia */}
                    <div className="w-32 sm:w-36 text-sm font-medium text-[var(--color-text-main)]">
                      {diasPT[h.dia] || h.dia}
                    </div>

                    {/* Toggle Aberto/Fechado */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const newH = [...hours]; newH[i].aberto = !newH[i].aberto; setHours(newH);
                        }}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0 ${h.aberto ? 'bg-[var(--color-primary)]' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${h.aberto ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                      <span className={`text-xs w-14 ${h.aberto ? 'text-[var(--color-primary)] font-medium' : 'text-[var(--color-text-muted)]'}`}>
                        {h.aberto ? 'Aberto' : 'Fechado'}
                      </span>
                    </div>
                  </div>

                  {/* Horários */}
                  {h.aberto ? (
                    <div className="flex items-center gap-2 w-full sm:flex-1 mt-1 sm:mt-0 justify-between sm:justify-start">
                      <input
                        type="time"
                        value={h.hora_inicio || '08:00'}
                        onChange={e => { const newH = [...hours]; newH[i].hora_inicio = e.target.value; setHours(newH); }}
                        className="border border-[var(--color-border-card)] flex-1 sm:flex-none w-full sm:w-auto rounded-lg px-2 sm:px-3 py-1.5 text-sm text-[var(--color-text-main)] bg-white focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                      />
                      <span className="text-sm text-[var(--color-text-muted)]">até</span>
                      <input
                        type="time"
                        value={h.hora_fim || '18:00'}
                        onChange={e => { const newH = [...hours]; newH[i].hora_fim = e.target.value; setHours(newH); }}
                        className="border border-[var(--color-border-card)] flex-1 sm:flex-none w-full sm:w-auto rounded-lg px-2 sm:px-3 py-1.5 text-sm text-[var(--color-text-main)] bg-white focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-[var(--color-text-muted)] italic mt-1 sm:mt-0">Não atende neste dia</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="pt-4 border-t border-[var(--color-border-card)] mt-2">
            <Button onClick={saveHours} loading={loadingHours}>Salvar horários</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AbaUsuarios() {
  const [users, setUsers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loadUsers = async () => {
    // Note: Due to RLS, a standard user might not see auth.users. 
    // Usually, we fetch from public.users and wait for Supabase Edge Functions for full auth sync.
    // Assuming backend triggers work, we just list public.users for now. 
    // Real implementation requires joining auth.users which might not be accessible from frontend directly without RPC.
    // We will just fetch public.users and show ID. In a real app we need a secure RPC for emails.
  };

  useEffect(() => { loadUsers(); }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Usuários</CardTitle>
          <Button onClick={() => setOpen(true)} size="sm"><Plus className="w-4 h-4 mr-2"/> Adicionar usuário</Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-[var(--color-text-muted)]">Nesta versão MVP a gestão de usuários por interface administrativa depende do Auth Admin e será expandida posteriormente.</p>
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Adicionar usuário">
          <div className="space-y-4">
            <Input label="E-mail" value={email} onChange={e=>setEmail(e.target.value)}/>
            <Input label="Senha" type="password" value={password} onChange={e=>setPassword(e.target.value)}/>
            <Button className="w-full">Adicionar</Button>
          </div>
        </Modal>
      </CardContent>
    </Card>
  );
}


function AbaKanban() {
  const status = [
    { kanban: 'Iniciou o Atendimento', db: 'iniciou_atendimento' },
    { kanban: 'Conversando', db: 'conversando' },
    { kanban: 'Agendado', db: 'agendado' },
    { kanban: 'Reagendado', db: 'reagendado' },
    { kanban: 'Converteu', db: 'converteu' },
    { kanban: 'Cancelou o Agendamento', db: 'cancelou_agendamento' },
    { kanban: 'Follow Up', db: 'follow_up' },
    { kanban: 'Abandonou a Conversa', db: 'abandonou_conversa' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Referência do CRM</CardTitle>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Use os valores abaixo para atualizar o status dos leads via N8N ou agente de IA.</p>
      </CardHeader>
      <CardContent>
        <table className="w-full text-left text-sm border border-[var(--color-border-card)] rounded-lg overflow-hidden">
          <thead className="bg-[#FAF0EE] dark:bg-black/20">
            <tr>
              <th className="p-3">Coluna do Kanban</th>
              <th className="p-3">Valor no banco</th>
            </tr>
          </thead>
          <tbody>
            {status.map((item, i) => (
              <tr key={i} className="border-t border-[var(--color-border-card)]">
                <td className="p-3"><Badge variant={item.db as any}>{item.kanban}</Badge></td>
                <td className="p-3 font-mono text-xs flex items-center justify-between group">
                  <span>{item.db}</span>
                  <button 
                    onClick={() => navigator.clipboard.writeText(item.db)}
                    className="p-1 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-border-card)] hover:text-[var(--color-primary)] transition-colors opacity-0 group-hover:opacity-100"
                    title="Copiar"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 p-3 mt-4 rounded text-sm flex items-start gap-2">
          <span className="font-bold text-lg mt-0.5">•</span>
          <p>Para atualizar o status de um lead via N8N, envie uma requisição ao Supabase atualizando o campo <code>status</code> da tabela <code>leads</code> com um dos valores acima.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AbaAgendas() {
  const [agendas, setAgendas] = useState<any[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ nome: '', cor: '#C47E7E', calcom_link: '' });
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
        calcom_link: form.calcom_link
      }).eq('id', editingId);
    } else {
      res = await supabase.from('agendas').insert({
        nome: form.nome,
        cor: form.cor,
        calcom_link: form.calcom_link,
        ativo: true
      });
    }

    setLoading(false);
    if (res.error) {
      alert(`Erro: ${res.error.message}`);
      return;
    }
    
    setForm({ nome: '', cor: '#C47E7E', calcom_link: '' });
    setEditingId(null);
    setOpenNew(false);
    loadAgendas();
  };

  const handleEdit = (ag: any) => {
    setForm({ nome: ag.nome, cor: ag.cor, calcom_link: ag.calcom_link || '' });
    setEditingId(ag.id);
    setOpenNew(true);
  };

  const deleteAgenda = async (id: string) => {
    if (!window.confirm("Atenção: Excluir esta agenda pode afetar os agendamentos vinculados a ela. Tem certeza?")) return;
    await supabase.from('agendas').delete().eq('id', id);
    loadAgendas();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Agendas (Cal.com)</CardTitle>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Conecte seus profissionais ou salas aos Event Types do Cal.com.</p>
          </div>
          <Button onClick={() => setOpenNew(true)} size="sm"><Plus className="w-4 h-4 mr-2"/> Nova Agenda</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agendas.map(ag => (
            <div key={ag.id} className="border border-[var(--color-border-card)] rounded-[12px] p-4 flex flex-col gap-3 relative overflow-hidden bg-white">
              <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: ag.cor }}></div>
              <div className="flex justify-between items-start pl-3">
                <div>
                  <h3 className="font-bold text-lg text-[var(--color-text-main)] flex items-center gap-2">
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
             <div className="col-span-1 md:col-span-2 text-center py-8 text-[var(--color-text-muted)] border border-dashed border-[var(--color-border-card)] rounded-lg">
               Nenhuma agenda cadastrada.
             </div>
          )}
        </div>

        <Modal 
          isOpen={openNew} 
          onClose={() => { setOpenNew(false); setEditingId(null); setForm({ nome: '', cor: '#C47E7E', calcom_link: '' }); }} 
          title={editingId ? "Editar Agenda" : "Adicionar Agenda"}
        >
          <div className="space-y-4">
            <Input label="Nome da Cadeira / Profissional" placeholder="Ex: Dra. Juliana" value={form.nome} onChange={e=>setForm({...form, nome: e.target.value})}/>
            <div>
               <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Link da Agenda no Cal.com</label>
               <input
                 type="text"
                 className="w-full border border-[var(--color-border-card)] rounded-[8px] px-3 py-2 text-sm bg-[var(--color-bg-base)] text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                 placeholder="Ex: cal.com/suaclinica/dr-bruno"
                 value={form.calcom_link}
                 onChange={e=>setForm({...form, calcom_link: e.target.value})}
               />
               <p className="text-xs text-[var(--color-text-muted)] mt-1">Copie e cole o link público oficial do "Event Type" criado no Cal.com.</p>
            </div>
            <div>
               <label className="block text-sm font-medium text-[var(--color-text-main)] mb-1">Cor de identificação</label>
               <div className="flex gap-2">
                  <input
                    type="color"
                    className="w-10 h-10 border-0 p-0 rounded cursor-pointer"
                    value={form.cor}
                    onChange={e=>setForm({...form, cor: e.target.value})}
                  />
                  <div className="text-xs text-[var(--color-text-muted)] self-center">Aparece na barra lateral desta agenda</div>
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
  const [loading, setLoading] = useState(false);

  const loadServicos = async () => {
    const { data } = await supabase.from('servicos').select('*').order('created_at', { ascending: true });
    if (data) setServicos(data);
  };

  useEffect(() => { loadServicos(); }, []);

  const saveServico = async () => {
    if (!nome) return;
    setLoading(true);
    
    const { error } = await supabase.from('servicos').insert({ nome });
    
    setLoading(false);
    if (error) {
      alert(`Erro: ${error.message}`);
      return;
    }
    
    setNome('');
    setOpenNew(false);
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
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Cadastre os serviços que serão selecionados quando uma venda for fechada.</p>
          </div>
          <Button onClick={() => setOpenNew(true)} size="sm"><Plus className="w-4 h-4 mr-2"/> Novo Serviço</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {servicos.map(srv => (
            <div key={srv.id} className="border border-[var(--color-border-card)] rounded-[12px] p-4 flex justify-between items-center bg-[var(--color-bg-base)] group">
              <span className="font-medium text-[var(--color-text-main)] truncate pr-2">{srv.nome}</span>
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
             <div className="col-span-1 sm:col-span-2 md:col-span-3 text-center py-8 text-[var(--color-text-muted)] border border-dashed border-[var(--color-border-card)] rounded-lg">
               Nenhum serviço cadastrado.
             </div>
          )}
        </div>

        <Modal isOpen={openNew} onClose={() => { setOpenNew(false); setNome(''); }} title="Adicionar Serviço">
          <div className="space-y-4">
            <Input
              label="Nome do Serviço"
              placeholder="Ex: Planejamento Previdenciário"
              value={nome}
              onChange={e => setNome(e.target.value)}
            />
            <Button className="w-full" disabled={!nome || loading} onClick={saveServico}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </Modal>
      </CardContent>
    </Card>
  );
}

function AbaWhatsApp() {
  const { config, refreshConfig } = useClinic();
  const [provider, setProvider] = useState<'meta' | 'evolution'>(
    (config?.whatsapp_provider as 'meta' | 'evolution') || 'meta'
  );

  // Meta Cloud API
  const [metaPhoneId, setMetaPhoneId] = useState(config?.meta_phone_number_id || '');
  const [metaToken, setMetaToken] = useState(config?.meta_access_token || '');
  const [metaVerifyToken, setMetaVerifyToken] = useState(config?.meta_webhook_verify_token || '');
  const [metaBusinessId, setMetaBusinessId] = useState(config?.meta_business_account_id || '');

  // Evolution API
  const [evoServerUrl, setEvoServerUrl] = useState(config?.evolution_server_url || '');
  const [evoApiKey, setEvoApiKey] = useState(config?.evolution_api_key || '');
  const [evoInstance, setEvoInstance] = useState(config?.evolution_instance_name || '');

  // Webhook de nota (IA)
  const [notaWebhook, setNotaWebhook] = useState(config?.nota_webhook_url || '');

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) {
      setProvider((config.whatsapp_provider as 'meta' | 'evolution') || 'meta');
      setMetaPhoneId(config.meta_phone_number_id || '');
      setMetaToken(config.meta_access_token || '');
      setMetaVerifyToken(config.meta_webhook_verify_token || '');
      setMetaBusinessId(config.meta_business_account_id || '');
      setEvoServerUrl(config.evolution_server_url || '');
      setEvoApiKey(config.evolution_api_key || '');
      setEvoInstance(config.evolution_instance_name || '');
      setNotaWebhook(config.nota_webhook_url || '');
    }
  }, [config]);

  const save = async () => {
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
      nota_webhook_url: notaWebhook || null,
    }).eq('id', 1);
    setLoading(false);
    if (error) {
      alert('Erro ao salvar: ' + error.message);
      return;
    }
    await refreshConfig();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const isConfigured = provider === 'meta'
    ? !!(metaPhoneId && metaToken)
    : !!(evoServerUrl && evoApiKey && evoInstance);

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className={`flex items-center gap-3 p-4 rounded-[12px] border ${isConfigured ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        {isConfigured
          ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          : <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
        }
        <div>
          <p className={`text-sm font-semibold ${isConfigured ? 'text-green-800' : 'text-amber-800'}`}>
            {isConfigured ? 'Integração configurada' : 'Integração pendente'}
          </p>
          <p className={`text-xs mt-0.5 ${isConfigured ? 'text-green-700' : 'text-amber-700'}`}>
            {isConfigured
              ? `Provedor ativo: ${provider === 'meta' ? 'Meta Cloud API (oficial)' : 'Evolution API'}`
              : 'Preencha as credenciais abaixo para ativar o Inbox de WhatsApp.'}
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
                onClick={() => setProvider(p)}
                className={`flex flex-col items-start gap-1 p-4 rounded-[12px] border-2 text-left transition-colors ${provider === p ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-[var(--color-border-card)] hover:border-[var(--color-primary)]/40'}`}
              >
                <span className="font-semibold text-sm text-[var(--color-text-main)]">
                  {p === 'meta' ? 'Meta Cloud API' : 'Evolution API'}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {p === 'meta' ? 'API oficial do WhatsApp Business (Meta)' : 'API self-hosted (Evolution)'}
                </span>
                {provider === p && (
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-primary)]">Ativo</span>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Credenciais Meta Cloud API */}
      {provider === 'meta' && (
        <Card>
          <CardHeader>
            <CardTitle>Meta Cloud API — Credenciais</CardTitle>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Encontre esses dados em <span className="font-mono text-xs">developers.facebook.com → Seu App → WhatsApp</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Phone Number ID"
              placeholder="Ex: 123456789012345"
              value={metaPhoneId}
              onChange={e => setMetaPhoneId(e.target.value)}
            />
            <Input
              label="Access Token (permanente)"
              placeholder="EAABsb..."
              value={metaToken}
              onChange={e => setMetaToken(e.target.value)}
            />
            <Input
              label="Webhook Verify Token"
              placeholder="Token que você criou para verificar o webhook"
              value={metaVerifyToken}
              onChange={e => setMetaVerifyToken(e.target.value)}
            />
            <Input
              label="Business Account ID (WABA ID)"
              placeholder="Ex: 987654321098765"
              value={metaBusinessId}
              onChange={e => setMetaBusinessId(e.target.value)}
            />
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-800">
              <p className="font-semibold mb-1">URL do Webhook (configure no Meta):</p>
              <p className="font-mono break-all">{window.location.origin}/api/webhook/whatsapp</p>
              <p className="mt-1 text-blue-600">Campos assinados: <span className="font-mono">messages</span></p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credenciais Evolution API */}
      {provider === 'evolution' && (
        <Card>
          <CardHeader>
            <CardTitle>Evolution API — Credenciais</CardTitle>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Servidor self-hosted da Evolution API
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="URL do Servidor"
              placeholder="Ex: https://evolution.seudominio.com"
              value={evoServerUrl}
              onChange={e => setEvoServerUrl(e.target.value)}
            />
            <Input
              label="API Key"
              placeholder="Chave de autenticação da Evolution API"
              value={evoApiKey}
              onChange={e => setEvoApiKey(e.target.value)}
            />
            <Input
              label="Nome da Instância"
              placeholder="Ex: clinica-principal"
              value={evoInstance}
              onChange={e => setEvoInstance(e.target.value)}
            />
          </CardContent>
        </Card>
      )}

      {/* Webhook de nota da IA */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook — Nota da Médica (IA)</CardTitle>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Quando a médica salvar uma nota no perfil do paciente, este webhook será disparado para o n8n. A IA lerá a nota e enviará a mensagem ao paciente via WhatsApp.
          </p>
        </CardHeader>
        <CardContent>
          <Input
            label="URL do Webhook (n8n)"
            placeholder="Ex: https://n8n.seudominio.com/webhook/nota-paciente"
            value={notaWebhook}
            onChange={e => setNotaWebhook(e.target.value)}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button onClick={save} loading={loading}>
          Salvar configurações
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-700 font-medium">
            <CheckCircle className="w-4 h-4" /> Salvo com sucesso
          </span>
        )}
      </div>
    </div>
  );
}
