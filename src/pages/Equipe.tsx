import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Copy, Check, Link2, Users, X } from 'lucide-react';

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
  created_at: string;
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  atendente: 'Atendente',
  profissional: 'Profissional',
  user: 'Atendente',
};

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-blue-50 text-blue-700 border-blue-200',
  atendente: 'bg-green-50 text-green-700 border-green-200',
  profissional: 'bg-purple-50 text-purple-700 border-purple-200',
  user: 'bg-green-50 text-green-700 border-green-200',
};

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'atendente', label: 'Atendente' },
  { value: 'profissional', label: 'Profissional' },
];

export function Equipe() {
  const { user } = useAuth();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('atendente');
  const [criandoConvite, setCriandoConvite] = useState(false);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [membrosResult, convitesResult] = await Promise.all([
      supabase.rpc('get_team_members'),
      supabase
        .from('team_invites')
        .select('id, email, role, token, created_at')
        .is('accepted_at', null)
        .order('created_at', { ascending: false }),
    ]);
    if (membrosResult.data) setMembros(membrosResult.data);
    if (convitesResult.data) setConvites(convitesResult.data);
    setLoading(false);
  }

  async function criarConvite() {
    if (!inviteEmail.trim()) return;
    setCriandoConvite(true);
    const { data, error } = await supabase
      .from('team_invites')
      .insert({ email: inviteEmail.trim().toLowerCase(), role: inviteRole, invited_by: user?.id })
      .select('token')
      .single();

    if (!error && data) {
      const link = `${window.location.origin}/convite?t=${data.token}`;
      setLinkGerado(link);
      setConvites(prev => [{
        id: crypto.randomUUID(),
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        token: data.token,
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

  async function alterarRole(membroId: string, novoRole: string) {
    setUpdatingRole(membroId);
    await supabase.from('users').update({ role: novoRole }).eq('id', membroId);
    setMembros(prev => prev.map(m => m.id === membroId ? { ...m, role: novoRole } : m));
    setUpdatingRole(null);
  }

  function fecharModal() {
    setShowModal(false);
    setInviteEmail('');
    setInviteRole('atendente');
    setLinkGerado(null);
    setCopiado(false);
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-cormorant font-bold text-2xl text-[var(--color-text-main)]">Equipe</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {loading ? '...' : `${membros.length} ${membros.length === 1 ? 'membro' : 'membros'}`}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-[8px] bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Convidar
        </button>
      </div>

      {/* Members list */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
          Membros ativos
        </h2>
        {loading ? (
          <div className="text-sm text-[var(--color-text-muted)] py-4">Carregando...</div>
        ) : membros.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-3">
            <Users className="w-8 h-8 text-[var(--color-text-muted)] opacity-30" />
            <p className="text-sm text-[var(--color-text-muted)]">Nenhum membro encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {membros.map(m => {
              const isMe = m.id === user?.id;
              const badgeClass = ROLE_BADGE[m.role] || ROLE_BADGE.atendente;

              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 p-4 border border-[var(--color-border-card)] rounded-[10px] bg-[var(--color-bg-card)]"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-semibold text-sm uppercase flex-shrink-0">
                    {(m.nome || m.email || '?').charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--color-text-main)] truncate">
                        {m.nome || m.email}
                      </p>
                      {isMe && (
                        <span className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-base)] border border-[var(--color-border-card)] px-1.5 py-0.5 rounded-full">
                          você
                        </span>
                      )}
                    </div>
                    {m.nome && (
                      <p className="text-xs text-[var(--color-text-muted)] truncate">{m.email}</p>
                    )}
                  </div>

                  {/* Role */}
                  {isMe ? (
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${badgeClass}`}>
                      {ROLE_LABEL[m.role] || m.role}
                    </span>
                  ) : (
                    <select
                      value={m.role === 'user' ? 'atendente' : m.role}
                      onChange={e => alterarRole(m.id, e.target.value)}
                      disabled={updatingRole === m.id}
                      className="text-xs border border-[var(--color-border-card)] rounded-[6px] px-2 py-1.5 bg-[var(--color-bg-base)] text-[var(--color-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] disabled:opacity-50"
                    >
                      {ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending invites */}
      {convites.length > 0 && (
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
            Convites pendentes
          </h2>
          <div className="space-y-2">
            {convites.map(c => (
              <div
                key={c.id}
                className="flex items-center gap-3 p-4 border border-[var(--color-border-card)] border-dashed rounded-[10px] bg-[var(--color-bg-base)]"
              >
                <div className="w-9 h-9 rounded-full bg-[var(--color-text-muted)]/20 flex items-center justify-center flex-shrink-0">
                  <Link2 className="w-4 h-4 text-[var(--color-text-muted)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--color-text-main)] truncate">{c.email}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {ROLE_LABEL[c.role] || c.role} · aguardando aceite
                  </p>
                </div>
                <button
                  onClick={() => copiarLink(`${window.location.origin}/convite?t=${c.token}`)}
                  className="flex-shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors p-1"
                  title="Copiar link"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => cancelarConvite(c.id)}
                  className="flex-shrink-0 text-[var(--color-text-muted)] hover:text-red-500 transition-colors p-1"
                  title="Cancelar convite"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 bg-white dark:bg-[var(--color-bg-card)] rounded-[16px] border border-[var(--color-border-card)] shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-card)]">
              <h3 className="font-cormorant font-bold text-lg text-[var(--color-text-main)]">
                Convidar membro
              </h3>
              <button onClick={fecharModal} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!linkGerado ? (
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
                    E-mail
                  </label>
                  <input
                    autoFocus
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && criarConvite()}
                    placeholder="nome@email.com"
                    className="w-full border border-[var(--color-border-card)] rounded-[8px] px-3 py-2 text-sm bg-[var(--color-bg-base)] text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
                    Cargo
                  </label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    className="w-full border border-[var(--color-border-card)] rounded-[8px] px-3 py-2 text-sm bg-[var(--color-bg-base)] text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  >
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={fecharModal}
                    className="flex-1 text-sm font-medium px-4 py-2.5 rounded-[8px] border border-[var(--color-border-card)] text-[var(--color-text-main)] hover:border-[var(--color-primary)] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={criarConvite}
                    disabled={!inviteEmail.trim() || criandoConvite}
                    className="flex-1 text-sm font-medium px-4 py-2.5 rounded-[8px] bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                  >
                    {criandoConvite ? 'Criando...' : 'Criar convite'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <p className="text-sm font-semibold text-green-800">Convite criado!</p>
                </div>
                <div>
                  <p className="text-sm text-[var(--color-text-muted)] mb-2">
                    Compartilhe este link com <strong className="text-[var(--color-text-main)]">{inviteEmail}</strong>:
                  </p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={linkGerado}
                      className="flex-1 min-w-0 border border-[var(--color-border-card)] rounded-[8px] px-3 py-2 text-xs bg-[var(--color-bg-base)] text-[var(--color-text-muted)] focus:outline-none select-all"
                      onFocus={e => e.target.select()}
                    />
                    <button
                      onClick={() => copiarLink(linkGerado)}
                      className={`flex-shrink-0 flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-[8px] transition-all ${
                        copiado
                          ? 'bg-green-100 text-green-700'
                          : 'bg-[var(--color-primary)] text-white hover:opacity-90'
                      }`}
                    >
                      {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiado ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>
                <button
                  onClick={fecharModal}
                  className="w-full text-sm font-medium px-4 py-2.5 rounded-[8px] border border-[var(--color-border-card)] text-[var(--color-text-main)] hover:border-[var(--color-primary)] transition-colors"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
