import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Copy, Check, Link2, Users, X, Shield, UserCog, User } from 'lucide-react';

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
  profissional: 'Profissional da Saúde',
  user: 'Atendente',
};

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'atendente', label: 'Atendente' },
  { value: 'profissional', label: 'Profissional da Saúde' },
];

function getIniciais(str: string) {
  return str.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function getAvatarStyle(role: string) {
  if (role === 'admin') return { bg: 'var(--rose-light)', color: 'var(--rose-text)' };
  if (role === 'profissional') return { bg: 'var(--sage-xlight)', color: 'var(--sage-dark)' };
  return { bg: 'var(--champ-light)', color: 'var(--champ-text)' };
}

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

  const profCount = membros.filter(m => m.role === 'profissional').length;
  const atendenteCount = membros.filter(m => m.role === 'atendente' || m.role === 'user').length;
  const adminCount = membros.filter(m => m.role === 'admin').length;

  const cardBase = 'rounded-[12px] border border-[var(--border)] bg-[var(--white)] shadow-[0_1px_4px_rgba(4,52,44,0.04)]';
  const dividerRow = (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-7">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[1.3px] mb-1" style={{ color: 'var(--muted)' }}>
            Sistema
          </p>
          <h1
            className="font-display leading-none"
            style={{ fontSize: '28px', fontStyle: 'italic', fontWeight: 300, color: 'var(--ink)', letterSpacing: '-0.3px' }}
          >
            Gestão de equipe
          </h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-[8px] hover:opacity-90 transition-opacity"
          style={{ background: 'var(--sage-dark)', color: '#fff' }}
        >
          <Plus className="w-4 h-4" />
          Convidar membro
        </button>
      </div>

      {/* ── 3 role summary cards ─────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          <div className={cardBase + ' p-4'}>
            <div className="w-8 h-8 rounded-[8px] flex items-center justify-center mb-3"
              style={{ background: 'var(--sage-xlight)' }}>
              <User className="w-4 h-4" style={{ color: 'var(--sage-dark)' }} />
            </div>
            <p className="text-2xl font-semibold leading-none mb-1" style={{ color: 'var(--ink)' }}>
              {profCount}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Profissionais</p>
          </div>
          <div className={cardBase + ' p-4'}>
            <div className="w-8 h-8 rounded-[8px] flex items-center justify-center mb-3"
              style={{ background: 'var(--champ-light)' }}>
              <UserCog className="w-4 h-4" style={{ color: 'var(--champ-text)' }} />
            </div>
            <p className="text-2xl font-semibold leading-none mb-1" style={{ color: 'var(--ink)' }}>
              {atendenteCount}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Recepcionistas</p>
          </div>
          <div className={cardBase + ' p-4'}>
            <div className="w-8 h-8 rounded-[8px] flex items-center justify-center mb-3"
              style={{ background: 'var(--rose-light)' }}>
              <Shield className="w-4 h-4" style={{ color: 'var(--rose-text)' }} />
            </div>
            <p className="text-2xl font-semibold leading-none mb-1" style={{ color: 'var(--ink)' }}>
              {adminCount}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Administradores</p>
          </div>
        </div>
      )}

      {/* ── Members list ─────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[10px] font-semibold uppercase tracking-[1.3px] flex-shrink-0" style={{ color: 'var(--muted)' }}>
            Membros ativos
          </span>
          {dividerRow}
        </div>

        {loading ? (
          <div className="text-sm py-4" style={{ color: 'var(--muted)' }}>Carregando...</div>
        ) : membros.length === 0 ? (
          <div className="flex flex-col items-center py-14 gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'var(--sage-xlight)' }}>
              <Users className="w-7 h-7 opacity-50" style={{ color: 'var(--sage-dark)' }} />
            </div>
            <div className="text-center">
              <p className="font-display mb-1.5"
                style={{ fontSize: '18px', fontStyle: 'italic', fontWeight: 300, color: 'var(--ink)' }}>
                Equipe vazia
              </p>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Convide membros para começar a colaborar
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-[8px] hover:opacity-90 transition-opacity mt-1"
              style={{ background: 'var(--sage-dark)', color: '#fff' }}
            >
              <Plus className="w-4 h-4" />
              Convidar primeiro membro
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {membros.map(m => {
              const isMe = m.id === user?.id;
              const iniciais = getIniciais(m.nome || m.email || '?');
              const av = getAvatarStyle(m.role);

              return (
                <div
                  key={m.id}
                  className={cardBase + ' flex items-center gap-3 p-4'}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm uppercase flex-shrink-0"
                    style={{ background: av.bg, color: av.color }}
                  >
                    {iniciais}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                        {m.nome || m.email}
                      </p>
                      {isMe && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0"
                          style={{ color: 'var(--muted)', background: 'var(--bg)', borderColor: 'var(--border)' }}>
                          você
                        </span>
                      )}
                    </div>
                    {m.nome && (
                      <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{m.email}</p>
                    )}
                  </div>

                  {isMe ? (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ background: av.bg, color: av.color }}>
                      {ROLE_LABEL[m.role] || m.role}
                    </span>
                  ) : (
                    <select
                      value={m.role === 'user' ? 'atendente' : m.role}
                      onChange={e => alterarRole(m.id, e.target.value)}
                      disabled={updatingRole === m.id}
                      className="text-xs rounded-[6px] px-2 py-1.5 focus:outline-none focus:ring-1 disabled:opacity-50"
                      style={{
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--ink)',
                        // @ts-ignore
                        '--tw-ring-color': 'var(--sage-dark)',
                      }}
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

      {/* ── Pending invites ───────────────────────────────── */}
      {convites.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-semibold uppercase tracking-[1.3px] flex-shrink-0" style={{ color: 'var(--muted)' }}>
              Convites pendentes
            </span>
            {dividerRow}
          </div>
          <div className="space-y-2">
            {convites.map(c => (
              <div
                key={c.id}
                className="flex items-center gap-3 p-4 border border-dashed rounded-[12px]"
                style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(100,116,139,0.1)' }}>
                  <Link2 className="w-4 h-4" style={{ color: 'var(--muted)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: 'var(--ink)' }}>{c.email}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    {ROLE_LABEL[c.role] || c.role} · aguardando aceite
                  </p>
                </div>
                <button
                  onClick={() => copiarLink(`${window.location.origin}/convite?t=${c.token}`)}
                  className="flex-shrink-0 p-1 transition-colors"
                  style={{ color: 'var(--muted)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--sage-dark)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                  title="Copiar link"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => cancelarConvite(c.id)}
                  className="flex-shrink-0 p-1 transition-colors"
                  style={{ color: 'var(--muted)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                  title="Cancelar convite"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Permissions grid ─────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[10px] font-semibold uppercase tracking-[1.3px] flex-shrink-0" style={{ color: 'var(--muted)' }}>
            Permissões por cargo
          </span>
          {dividerRow}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className={cardBase + ' p-4'}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-[6px] flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--sage-xlight)' }}>
                <User className="w-3.5 h-3.5" style={{ color: 'var(--sage-dark)' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Profissional da Saúde</p>
            </div>
            <ul className="space-y-1.5">
              {['Dashboard completo', 'Agenda e pacientes', 'Inbox e CRM', 'Relatórios'].map(item => (
                <li key={item} className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--sage-dark)' }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className={cardBase + ' p-4'}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-[6px] flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--champ-light)' }}>
                <UserCog className="w-3.5 h-3.5" style={{ color: 'var(--champ-text)' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Atendente</p>
            </div>
            <ul className="space-y-1.5">
              {['Inbox e mensagens', 'Cadastro de leads', 'Agenda básica', 'Sem acesso financeiro'].map(item => (
                <li key={item} className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--champ-text)' }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Invite modal ─────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-[16px] border"
            style={{ background: 'var(--white)', borderColor: 'var(--border)', boxShadow: '0 20px 60px rgba(30,41,59,0.18)' }}>

            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="font-display" style={{ fontSize: '20px', fontStyle: 'italic', fontWeight: 300, color: 'var(--ink)' }}>
                  Convidar membro
                </h3>
              </div>
              <button onClick={fecharModal} style={{ color: 'var(--muted)' }}
                className="hover:opacity-70 transition-opacity">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!linkGerado ? (
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[1.1px] mb-1.5" style={{ color: 'var(--muted)' }}>
                    E-mail
                  </label>
                  <input
                    autoFocus
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && criarConvite()}
                    placeholder="nome@email.com"
                    className="w-full rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--ink)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[1.1px] mb-1.5" style={{ color: 'var(--muted)' }}>
                    Cargo
                  </label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    className="w-full rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--ink)',
                    }}
                  >
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={fecharModal}
                    className="flex-1 text-sm font-medium px-4 py-2.5 rounded-[8px] transition-colors"
                    style={{ border: '1px solid var(--border)', color: 'var(--ink)' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={criarConvite}
                    disabled={!inviteEmail.trim() || criandoConvite}
                    className="flex-1 text-sm font-medium px-4 py-2.5 rounded-[8px] hover:opacity-90 disabled:opacity-40 transition-opacity"
                    style={{ background: 'var(--sage-dark)', color: '#fff' }}
                  >
                    {criandoConvite ? 'Criando...' : 'Criar convite'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-[10px]"
                  style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <Check className="w-5 h-5 flex-shrink-0" style={{ color: '#059669' }} />
                  <p className="text-sm font-semibold" style={{ color: '#065f46' }}>Convite criado com sucesso!</p>
                </div>
                <div>
                  <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>
                    Compartilhe este link com <strong style={{ color: 'var(--ink)' }}>{inviteEmail}</strong>:
                  </p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={linkGerado}
                      className="flex-1 min-w-0 rounded-[8px] px-3 py-2 text-xs focus:outline-none select-all"
                      style={{
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--muted)',
                      }}
                      onFocus={e => e.target.select()}
                    />
                    <button
                      onClick={() => copiarLink(linkGerado)}
                      className="flex-shrink-0 flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-[8px] transition-all"
                      style={copiado
                        ? { background: 'rgba(16,185,129,0.1)', color: '#059669' }
                        : { background: 'var(--sage-dark)', color: '#fff' }
                      }
                    >
                      {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiado ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>
                <button
                  onClick={fecharModal}
                  className="w-full text-sm font-medium px-4 py-2.5 rounded-[8px] transition-colors"
                  style={{ border: '1px solid var(--border)', color: 'var(--ink)' }}
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
