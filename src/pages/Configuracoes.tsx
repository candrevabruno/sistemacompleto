import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useClinic } from '../contexts/ClinicContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Copy, Plus, Trash2, PowerOff } from 'lucide-react';

// For simplicity in this giant file, we will put everything here.
export function Configuracoes() {
  const [activeTab, setActiveTab] = useState('geral');

  const tabs = [
    { id: 'geral', label: 'Geral' },
    { id: 'usuarios', label: 'Usuários' },
    { id: 'tokens', label: 'Token de API' },
    { id: 'kanban', label: 'Kanban' }
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
        {activeTab === 'usuarios' && <AbaUsuarios />}
        {activeTab === 'tokens' && <AbaTokens />}
        {activeTab === 'kanban' && <AbaKanban />}
      </div>
    </div>
  );
}

function AbaGeral() {
  const { config, refreshConfig } = useClinic();
  const [nome, setNome] = useState(config?.nome || '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [hours, setHours] = useState<any[]>([]);
  const [loadingHours, setLoadingHours] = useState(false);

  useEffect(() => {
    setNome(config?.nome || '');
  }, [config]);

  useEffect(() => {
    loadHours();
  }, []);

  const loadHours = async () => {
    const order = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const { data } = await supabase.from('clinic_hours').select('*');
    if (data) {
      data.sort((a,b) => order.indexOf(a.dia) - order.indexOf(b.dia));
      setHours(data);
    }
  };

  const saveGeral = async () => {
    setLoading(true);
    let logo_url = config?.logo_url;
    if (logoFile) {
      const { data, error } = await supabase.storage.from('clinic-assets').upload(`logo-${Date.now()}`, logoFile);
      if (data) {
        const urlReq = supabase.storage.from('clinic-assets').getPublicUrl(data.path);
        logo_url = urlReq.data.publicUrl;
      }
    }
    await supabase.from('clinic_config').update({ nome, logo_url }).eq('id', 1);
    await refreshConfig();
    setLoading(false);
    alert('Configurações salvas!');
  };

  const saveHours = async () => {
    setLoadingHours(true);
    for (const h of hours) {
      await supabase.from('clinic_hours').update({ aberto: h.aberto, hora_inicio: h.hora_inicio, hora_fim: h.hora_fim }).eq('id', h.id);
    }
    setLoadingHours(false);
    alert('Horários salvos!');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Identidade da Clínica</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input label="Nome da clínica" value={nome} onChange={e => setNome(e.target.value)} />
          <div>
            <label className="block text-sm font-medium mb-1">Logo da clínica (max 2MB)</label>
            <div className="flex items-center gap-4">
              {config?.logo_url && <img src={config.logo_url} className="h-16 object-contain border" alt="Logo" />}
              <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)} className="text-sm" />
            </div>
          </div>
          <Button onClick={saveGeral} loading={loading}>Salvar alterações</Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader><CardTitle>Horário de Funcionamento</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {hours.map((h, i) => (
            <div key={h.id} className="flex items-center gap-4">
              <div className="w-24 font-medium capitalize">{h.dia}</div>
              <label className="flex items-center space-x-2">
                <input type="checkbox" checked={h.aberto} onChange={e => {
                  const newH = [...hours]; newH[i].aberto = e.target.checked; setHours(newH);
                }} />
                <span>Aberto</span>
              </label>
              <Input type="time" disabled={!h.aberto} value={h.hora_inicio || ''} onChange={e => {
                const newH = [...hours]; newH[i].hora_inicio = e.target.value; setHours(newH);
              }} />
              <span>até</span>
              <Input type="time" disabled={!h.aberto} value={h.hora_fim || ''} onChange={e => {
                const newH = [...hours]; newH[i].hora_fim = e.target.value; setHours(newH);
              }} />
            </div>
          ))}
          <Button onClick={saveHours} loading={loadingHours}>Salvar horários</Button>
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

function AbaTokens() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [openDisable, setOpenDisable] = useState(false);
  const [label, setLabel] = useState('');
  const [newTokenRaw, setNewTokenRaw] = useState('');
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);

  const loadTokens = async () => {
    const { data } = await supabase.from('api_tokens').select('*').order('created_at', { ascending: false });
    if (data) setTokens(data);
  };
  useEffect(() => { loadTokens(); }, []);

  const createToken = async () => {
    const uuid = crypto.randomUUID();
    setNewTokenRaw(uuid);
    
    // Na API web moderna isso requer acesso a Crypto subtle.
    const encoder = new TextEncoder();
    const data = encoder.encode(uuid);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    await supabase.from('api_tokens').insert({ label, token_hash: tokenHash });
    
    setOpenNew(false);
    setLabel('');
    loadTokens();
    setOpenView(true);
  };

  const copyToken = () => {
    navigator.clipboard.writeText(newTokenRaw);
    alert('Pronto! Token copiado.');
  };

  const disableTokenConfirm = async () => {
    if (!selectedTokenId) return;
    await supabase.from('api_tokens').update({ ativo: false }).eq('id', selectedTokenId);
    setOpenDisable(false);
    loadTokens();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Tokens de API</CardTitle>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Os tokens são necessários para todas as chamadas de API.</p>
          </div>
          <Button onClick={() => setOpenNew(true)} size="sm">Novo token</Button>
        </div>
      </CardHeader>
      <CardContent>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b font-medium">
              <th className="pb-3">Label</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Criado em</th>
              <th className="pb-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map(t => (
              <tr key={t.id} className="border-b last:border-0 hover:bg-[var(--color-bg-base)] transition-colors">
                <td className="py-3 font-medium">{t.label}</td>
                <td className="py-3">
                  <Badge variant={t.ativo ? 'success' : 'default'} className={!t.ativo ? 'bg-gray-100 text-gray-500' : ''}>
                    {t.ativo ? 'Ativo' : 'Desabilitado'}
                  </Badge>
                </td>
                <td className="py-3 text-[var(--color-text-muted)]">{new Date(t.created_at).toLocaleDateString('pt-BR')}</td>
                <td className="py-3 text-right">
                  {t.ativo && (
                    <button onClick={() => { setSelectedTokenId(t.id); setOpenDisable(true); }} className="text-[var(--color-error)] hover:opacity-75 flex items-center inline-flex">
                      <PowerOff className="w-4 h-4 mr-1" /> Desabilitar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {tokens.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-[var(--color-text-muted)]">Nenhum token criado.</td></tr>}
          </tbody>
        </table>

        <Modal isOpen={openNew} onClose={() => setOpenNew(false)} title="Criar novo token">
          <div className="space-y-4">
            <Input label="Label do token" placeholder="ex: N8N Produção" value={label} onChange={e=>setLabel(e.target.value)}/>
            <Button onClick={createToken} disabled={!label} className="w-full">Gerar Token</Button>
          </div>
        </Modal>

        <Modal isOpen={openView} onClose={() => setOpenView(false)} title="Novo token gerado">
          <div className="space-y-4">
            <p className="text-sm font-medium text-[var(--color-error)] border border-[var(--color-error)] p-3 rounded bg-[var(--color-error)]/10">
              Copie agora — este token não será exibido em texto puro novamente.
            </p>
            <div className="p-3 bg-gray-100 dark:bg-black/20 rounded font-mono text-sm break-all">
              {newTokenRaw}
            </div>
            <div className="flex gap-3">
              <Button onClick={copyToken} variant="secondary" className="flex-1"><Copy className="w-4 h-4 mr-2" /> Copiar</Button>
              <Button onClick={() => setOpenView(false)} className="flex-1">Fechar</Button>
            </div>
          </div>
        </Modal>

        <Modal isOpen={openDisable} onClose={() => setOpenDisable(false)} title="Desabilitar token">
          <p className="mb-6 mt-2 text-[var(--color-text-muted)] text-sm">Tem certeza? Esta ação é permanente e não pode ser desfeita. O token será desabilitado imediatamente.</p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setOpenDisable(false)}>Cancelar</Button>
            <Button variant="danger" onClick={disableTokenConfirm}>Desabilitar permanentemente</Button>
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
    { kanban: 'Compareceu', db: 'compareceu' },
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
          <p>Para atualizar o status de um lead via N8N, envie uma requisição ao Supabase atualizando o campo <code>status</code> da tabela <code>leads_estetica</code> com um dos valores acima.</p>
        </div>
      </CardContent>
    </Card>
  );
}
