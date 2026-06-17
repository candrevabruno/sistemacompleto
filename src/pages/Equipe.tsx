import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useClinic } from '../contexts/ClinicContext';
import { Plus, Copy, Check, Link2, Users, X, Sparkles, SlidersHorizontal } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { PermissionEditor } from '../components/equipe/PermissionEditor';
import type { PermissionMap, PermLevel } from '../lib/permissions';

interface Membro {
  id: string;
  email: string;
  role: string;
  nome: string | null;
  created_at: string;
}

interface Convite {
  id: string;
  email: string;
  role: string;
  token: string;
  permissions: PermissionMap | null;
  created_at: string;
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Heroic Leap',
  admin: 'Administrador',
  membro: 'Membro',
};

function getIniciais(str: string) {
  return str.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function roleStyle(role: string) {
  if (role === 'super_admin') return { bg: 'var(--rose-light)', color: 'var(--rose-text)' };
  if (role === 'admin') return { bg: 'var(--champ-light)', color: 'var(--champ-text)' };
  return { bg: 'var(--sage-xlight)', color: 'var(--sage-dark)' };
}

export function Equipe() {
  const { user } = useAuth();
  const { config, refreshConfig } = useClinic();
  const isSuperAdmin = user?.role === 'super_admin';

  const flags = { premium_enabled: config?.premium_enabled, eventos_enabled: config?.eventos_enabled };

  const [membros, setMembros] = useState<Membro[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [loading, setLoading] = useState(true);

  // Convite
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePerms, setInvitePerms] = useState<PermissionMap>({});
  const [criandoConvite, setCriandoConvite] = useState(false);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Edição de permissões de um membro
  const [editMembro, setEditMembro] = useState<Membro | null>(null);
  const [editPerms, setEditPerms] = useState<PermissionMap>({});
  const [savingPerms, setSavingPerms] = useState(false);

  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [savingFlag, setSavingFlag] = useState<string | null>(null);
  const [savingConfigTab, setSavingConfigTab] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [membrosResult, convitesResult] = await Promise.all([
      supabase.rpc('get_team_members'),
      supabase
        .from('team_invites')
        .select('id, email, role, token, permissions, created_at')
        .is('accepted_at', null)
        .order('created_at', { ascending: false }),
    ]);
    if (membrosResult.data) setMembros(membrosResult.data);
    if (convitesResult.data) setConvites(convitesResult.data as Convite[]);
    setLoading(false);
  }

  // ── Convite ────────────────────────────────────────────────────────────────
  async function criarConvite() {
    if (!inviteEmail.trim()) return;
    setCriandoConvite(true);
    const { data, error } = await supabase
      .from('team_invites')
      .insert({
        email: inviteEmail.trim().toLowerCase(),
        role: 'membro',
        permissions: invitePerms,
        invited_by: user?.id,
      })
      .select('id, token')
      .single();

    if (!error && data) {
      const link = `${window.location.origin}/convite?t=${data.token}`;
      setLinkGerado(link);
      setConvites(prev => [{
        id: data.id,
        email: inviteEmail.trim().toLowerCase(),
        role: 'membro',
        token: data.token,
        permissions: invitePerms,
        created_at: new Date().toISOString(),
      }, ...prev]);
    }
    setCriandoConvite(false);
  }

  async function copiarLink(link: string) {
    await navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  async function cancelarConvite(id: string) {
    await supabase.from('team_invites').delete().eq('id', id);
    setConvites(prev => prev.filter(c => c.id !== id));
  }

  function fecharInvite() {
    setShowInvite(false);
    setInviteEmail('');
    setInvitePerms({});
    setLinkGerado(null);
    setCopiado(false);
  }

  // ── Permissões de membro ─────────────────────────────────────────────────────
  async function abrirPermissoes(m: Membro) {
    setEditMembro(m);
    setEditPerms({});
    const { data } = await supabase
      .from('user_permissions')
      .select('item_key, level')
      .eq('user_id', m.id);
    const map: PermissionMap = {};
    (data || []).forEach((r: { item_key: string; level: PermLevel }) => { map[r.item_key] = r.level; });
    setEditPerms(map);
  }

  async function salvarPermissoes() {
    if (!editMembro) return;
    setSavingPerms(true);
    // Estratégia simples: zera e reescreve só os níveis ativos.
    await supabase.from('user_permissions').delete().eq('user_id', editMembro.id);
    const rows = Object.entries(editPerms)
      .filter(([, lvl]) => lvl && lvl !== 'none')
      .map(([item_key, level]) => ({ user_id: editMembro.id, item_key, level }));
    if (rows.length > 0) {
      await supabase.from('user_permissions').insert(rows);
    }
    setSavingPerms(false);
    setEditMembro(null);
  }

  async function alterarRole(membroId: string, novoRole: string) {
    setUpdatingRole(membroId);
    await supabase.from('users').update({ role: novoRole }).eq('id', membroId);
    setMembros(prev => prev.map(m => m.id === membroId ? { ...m, role: novoRole } : m));
    setUpdatingRole(null);
  }

  // ── Feature flags (super_admin) ──────────────────────────────────────────────
  async function toggleFlag(flag: 'premium_enabled' | 'eventos_enabled', val: boolean) {
    setSavingFlag(flag);
    await supabase.from('clinic_config').update({ [flag]: val }).eq('id', 1);
    await refreshConfig();
    setSavingFlag(null);
  }

  // ── Permissões de abas de Configurações para admins ──────────────────────────
  const CONFIG_TABS = [
    { id: 'geral', label: 'Geral' },
    { id: 'agendas', label: 'Agendas (Cal.com)' },
    { id: 'servicos', label: 'Serviços' },
    { id: 'kanban', label: 'Kanban' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'webhooks', label: 'Webhooks' },
    { id: 'kpis', label: 'KPIs & Marketing' },
  ];
  const ALL_TAB_IDS = CONFIG_TABS.map(t => t.id);
  // null = todas liberadas; array = apenas as listadas
  const currentAllowed: string[] = config?.admin_config_tabs?.length
    ? config.admin_config_tabs
    : ALL_TAB_IDS;

  async function toggleConfigTab(tabId: string, allow: boolean) {
    setSavingConfigTab(true);
    const updated = allow
      ? [...currentAllowed.filter(t => t !== tabId), tabId]
      : currentAllowed.filter(t => t !== tabId);
    const toSave = updated.length === ALL_TAB_IDS.length ? null : updated;
    await supabase.from('clinic_config').update({ admin_config_tabs: toSave }).eq('id', 1);
    await refreshConfig();
    setSavingConfigTab(false);
  }

  const cardBase = 'rounded-[12px] border border-[var(--border)] bg-[var(--white)] shadow-[0_1px_4px_rgba(4,52,44,0.04)]';
  const divider = <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-7">
      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[1.3px] mb-1" style={{ color: 'var(--muted)' }}>
            Sistema
          </p>
          <h1 className="font-display leading-none" style={{ fontSize: '28px', fontStyle: 'italic', fontWeight: 300, color: 'var(--ink)', letterSpacing: '-0.3px' }}>
            Gestão de equipe
          </h1>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-[8px] hover:opacity-90 transition-opacity"
          style={{ background: 'var(--sage-dark)', color: '#fff' }}
        >
          <Plus className="w-4 h-4" />
          Convidar membro
        </button>
      </div>

      {/* ── Recursos da Heroic Leap (só super_admin) ── */}
      {isSuperAdmin && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-semibold uppercase tracking-[1.3px] flex-shrink-0 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
              <Sparkles className="w-3 h-3" /> Recursos liberados pela Heroic Leap
            </span>
            {divider}
          </div>
          <div className="space-y-2">
            {([
              { key: 'premium_enabled', label: 'Experiência Premium', desc: 'Libera a aba premium no perfil do paciente.' },
              { key: 'eventos_enabled', label: 'Módulo Eventos', desc: 'Libera disparos e ações de eventos para a clínica.' },
            ] as const).map(f => {
              const on = Boolean(config?.[f.key]);
              return (
                <div key={f.key} className={cardBase + ' flex items-center gap-3 p-4'}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{f.label}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>{f.desc}</p>
                  </div>
                  <button
                    onClick={() => toggleFlag(f.key, !on)}
                    disabled={savingFlag === f.key}
                    className="relative flex-shrink-0 rounded-full transition-colors disabled:opacity-50"
                    style={{ width: 42, height: 24, background: on ? 'var(--sage-dark)' : 'var(--border-md)' }}
                  >
                    <span
                      className="absolute top-[3px] rounded-full bg-white transition-all"
                      style={{ width: 18, height: 18, left: on ? 21 : 3 }}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Permissões de Configurações para Administradores (só super_admin) ── */}
      {isSuperAdmin && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-semibold uppercase tracking-[1.3px] flex-shrink-0 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
              <SlidersHorizontal className="w-3 h-3" /> Abas visíveis para administradores
            </span>
            {divider}
          </div>
          <div className={cardBase + ' p-4'}>
            <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
              Defina quais abas de <strong>Configurações</strong> os usuários com papel <em>Administrador</em> podem acessar. O super_admin (Heroic Leap) sempre vê tudo.
            </p>
            <div className="space-y-2">
              {CONFIG_TABS.map(tab => {
                const allowed = currentAllowed.includes(tab.id);
                return (
                  <div key={tab.id} className="flex items-center justify-between gap-3 py-1">
                    <span className="text-sm" style={{ color: 'var(--ink)' }}>{tab.label}</span>
                    <button
                      onClick={() => !savingConfigTab && toggleConfigTab(tab.id, !allowed)}
                      disabled={savingConfigTab}
                      className="relative flex-shrink-0 rounded-full transition-colors disabled:opacity-40"
                      style={{ width: 36, height: 20, background: allowed ? 'var(--sage-dark)' : 'var(--border-md)' }}
                    >
                      <span
                        className="absolute top-[3px] rounded-full bg-white transition-all"
                        style={{ width: 14, height: 14, left: allowed ? 19 : 3 }}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Membros ── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[10px] font-semibold uppercase tracking-[1.3px] flex-shrink-0" style={{ color: 'var(--muted)' }}>
            Membros ativos
          </span>
          {divider}
        </div>

        {loading ? (
          <div className="text-sm py-4" style={{ color: 'var(--muted)' }}>Carregando...</div>
        ) : membros.length === 0 ? (
          <div className="flex flex-col items-center py-14 gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'var(--sage-xlight)' }}>
              <Users className="w-7 h-7 opacity-50" style={{ color: 'var(--sage-dark)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Nenhum membro ainda. Convide alguém para começar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {membros.map(m => {
              const isMe = m.id === user?.id;
              const iniciais = getIniciais(m.nome || m.email || '?');
              const st = roleStyle(m.role);
              const isMembro = m.role === 'membro';
              return (
                <div key={m.id} className={cardBase + ' flex items-center gap-3 p-4'}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm uppercase flex-shrink-0" style={{ background: st.bg, color: st.color }}>
                    {iniciais}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{m.nome || m.email}</p>
                      {isMe && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0" style={{ color: 'var(--muted)', background: 'var(--bg)', borderColor: 'var(--border)' }}>você</span>
                      )}
                    </div>
                    {m.nome && <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{m.email}</p>}
                  </div>

                  {/* Editar permissões (só para membros, e se eu não for o próprio) */}
                  {isMembro && !isMe && (
                    <button
                      onClick={() => abrirPermissoes(m)}
                      className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-[6px] transition-colors hover:opacity-80"
                      style={{ border: '1px solid var(--border)', color: 'var(--ink)', background: 'var(--bg)' }}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" /> Permissões
                    </button>
                  )}

                  {/* Cargo */}
                  {isMe || m.role === 'super_admin' ? (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: st.bg, color: st.color }}>
                      {ROLE_LABEL[m.role] || m.role}
                    </span>
                  ) : (
                    <select
                      value={m.role === 'admin' ? 'admin' : 'membro'}
                      onChange={e => alterarRole(m.id, e.target.value)}
                      disabled={updatingRole === m.id}
                      className="text-xs rounded-[6px] px-2 py-1.5 focus:outline-none disabled:opacity-50 flex-shrink-0"
                      style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)' }}
                    >
                      <option value="membro">Membro</option>
                      <option value="admin">Administrador</option>
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Convites pendentes ── */}
      {convites.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-semibold uppercase tracking-[1.3px] flex-shrink-0" style={{ color: 'var(--muted)' }}>
              Convites pendentes
            </span>
            {divider}
          </div>
          <div className="space-y-2">
            {convites.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-4 border border-dashed rounded-[12px]" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--champ-light)' }}>
                  <Link2 className="w-4 h-4" style={{ color: 'var(--champ-text)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: 'var(--ink)' }}>{c.email}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    {Object.keys(c.permissions || {}).length} permiss{Object.keys(c.permissions || {}).length === 1 ? 'ão' : 'ões'} · aguardando aceite
                  </p>
                </div>
                <button onClick={() => copiarLink(`${window.location.origin}/convite?t=${c.token}`)} className="flex-shrink-0 p-1" style={{ color: 'var(--muted)' }} title="Copiar link">
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={() => cancelarConvite(c.id)} className="flex-shrink-0 p-1" style={{ color: 'var(--muted)' }} title="Cancelar convite">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal: convidar ── */}
      <Modal isOpen={showInvite} onClose={fecharInvite} bare className="max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-display" style={{ fontSize: '20px', fontStyle: 'italic', fontWeight: 300, color: 'var(--ink)' }}>
            Convidar membro
          </h3>
          <button onClick={fecharInvite} style={{ color: 'var(--muted)' }}><X className="w-5 h-5" /></button>
        </div>

        {!linkGerado ? (
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[1.1px] mb-1.5" style={{ color: 'var(--muted)' }}>E-mail</label>
              <input
                autoFocus type="email" value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="nome@email.com"
                className="w-full rounded-[var(--r-xs)] px-3 py-2 text-sm focus:outline-none"
                style={{ border: '1px solid var(--border-md)', background: 'var(--bg)', color: 'var(--ink)' }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[1.1px] mb-3" style={{ color: 'var(--muted)' }}>
                Nível de acesso por item
              </label>
              <PermissionEditor value={invitePerms} onChange={setInvitePerms} flags={flags} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={fecharInvite} className="flex-1 text-sm font-medium px-4 py-2.5 rounded-[var(--r-xs)] hover:opacity-80" style={{ border: '1px solid var(--border-md)', color: 'var(--ink)', background: 'transparent' }}>
                Cancelar
              </button>
              <button onClick={criarConvite} disabled={!inviteEmail.trim() || criandoConvite} className="flex-1 text-sm font-medium px-4 py-2.5 rounded-[var(--r-xs)] hover:opacity-90 disabled:opacity-40" style={{ background: 'var(--sage-dark)', color: '#fff' }}>
                {criandoConvite ? 'Criando...' : 'Criar convite'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-[var(--r-xs)]" style={{ background: 'var(--sage-xlight)', border: '1px solid var(--border)' }}>
              <Check className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--sage-dark)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--sage-dark)' }}>Convite criado com sucesso!</p>
            </div>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Compartilhe este link com <strong style={{ color: 'var(--ink)' }}>{inviteEmail}</strong>. Ela entra com o Google e recebe exatamente as permissões definidas.
            </p>
            <div className="flex gap-2">
              <input readOnly value={linkGerado} onFocus={e => e.target.select()} className="flex-1 min-w-0 rounded-[var(--r-xs)] px-3 py-2 text-xs focus:outline-none" style={{ border: '1px solid var(--border-md)', background: 'var(--bg)', color: 'var(--muted)' }} />
              <button onClick={() => copiarLink(linkGerado)} className="flex-shrink-0 flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-[var(--r-xs)]" style={copiado ? { background: 'var(--sage-xlight)', color: 'var(--sage-dark)' } : { background: 'var(--sage-dark)', color: '#fff' }}>
                {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <button onClick={fecharInvite} className="w-full text-sm font-medium px-4 py-2.5 rounded-[var(--r-xs)] hover:opacity-80" style={{ border: '1px solid var(--border-md)', color: 'var(--ink)', background: 'transparent' }}>
              Fechar
            </button>
          </div>
        )}
      </Modal>

      {/* ── Modal: permissões do membro ── */}
      <Modal isOpen={!!editMembro} onClose={() => setEditMembro(null)} bare className="max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="min-w-0">
            <h3 className="font-display truncate" style={{ fontSize: '20px', fontStyle: 'italic', fontWeight: 300, color: 'var(--ink)' }}>
              Permissões
            </h3>
            <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{editMembro?.nome || editMembro?.email}</p>
          </div>
          <button onClick={() => setEditMembro(null)} style={{ color: 'var(--muted)' }}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          <PermissionEditor value={editPerms} onChange={setEditPerms} flags={flags} />
          <div className="flex gap-3 pt-2">
            <button onClick={() => setEditMembro(null)} className="flex-1 text-sm font-medium px-4 py-2.5 rounded-[var(--r-xs)] hover:opacity-80" style={{ border: '1px solid var(--border-md)', color: 'var(--ink)', background: 'transparent' }}>
              Cancelar
            </button>
            <button onClick={salvarPermissoes} disabled={savingPerms} className="flex-1 text-sm font-medium px-4 py-2.5 rounded-[var(--r-xs)] hover:opacity-90 disabled:opacity-40" style={{ background: 'var(--sage-dark)', color: '#fff' }}>
              {savingPerms ? 'Salvando...' : 'Salvar permissões'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
