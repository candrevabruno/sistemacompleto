import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AppUser, UserRole } from '../types';
import type { PermissionMap, PermLevel } from '../lib/permissions';
import { canView as canViewFn, canEdit as canEditFn } from '../lib/permissions';

type AuthStatus = 'loading' | 'anon' | 'authed' | 'denied';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  /** 'denied' = autenticou no Google mas não foi convidado (invite-only). */
  status: AuthStatus;
  deniedEmail: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Pode ao menos visualizar o item? (admin/super_admin sempre true) */
  can: (itemKey: string) => boolean;
  /** Pode editar o item? (admin/super_admin sempre true) */
  canEdit: (itemKey: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  status: 'loading',
  deniedEmail: null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  can: () => false,
  canEdit: () => false,
});

function normalizeRole(raw: string | null | undefined): UserRole {
  if (raw === 'super_admin') return 'super_admin';
  if (raw === 'admin') return 'admin';
  return 'membro';
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (session?.user) {
        await loadUserProfile(session.user);
      } else {
        setStatus('anon');
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await loadUserProfile(session.user);
      } else {
        setUser(null);
        setDeniedEmail(null);
        setStatus('anon');
      }
    });

    init();
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const loadPermissions = async (userId: string): Promise<PermissionMap> => {
    const { data } = await supabase
      .from('user_permissions')
      .select('item_key, level')
      .eq('user_id', userId);
    const map: PermissionMap = {};
    (data || []).forEach((row: { item_key: string; level: PermLevel }) => {
      map[row.item_key] = row.level;
    });
    return map;
  };

  // Invite-only: provisiona usuário no primeiro login se houver convite pendente.
  const tryProvisionFromInvite = async (authUser: any): Promise<boolean> => {
    const email = (authUser.email || '').toLowerCase();
    if (!email) return false;

    const { data: invite } = await supabase
      .from('team_invites')
      .select('id, email, role, permissions')
      .eq('email', email)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!invite) return false;

    // public.users só tem id + role (email e nome vivem em auth.users).
    await supabase.from('users').upsert({
      id: authUser.id,
      role: invite.role || 'membro',
    }, { onConflict: 'id' });

    // Aplica permissões do convite.
    const perms = (invite.permissions || {}) as PermissionMap;
    const rows = Object.entries(perms)
      .filter(([, level]) => level && level !== 'none')
      .map(([item_key, level]) => ({ user_id: authUser.id, item_key, level }));
    if (rows.length > 0) {
      await supabase.from('user_permissions').upsert(rows, { onConflict: 'user_id,item_key' });
    }

    await supabase
      .from('team_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    return true;
  };

  const loadUserProfile = async (authUser: any) => {
    try {
      // public.users só tem id + role.
      let { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', authUser.id)
        .maybeSingle();

      // Não provisionado: tenta convite pendente. Sem convite → acesso negado.
      if (!profile) {
        const provisioned = await tryProvisionFromInvite(authUser);
        if (!provisioned) {
          setDeniedEmail(authUser.email || null);
          setUser(null);
          setStatus('denied');
          return;
        }
        const reloaded = await supabase
          .from('users')
          .select('role')
          .eq('id', authUser.id)
          .maybeSingle();
        profile = reloaded.data;
      }

      const role = normalizeRole(profile?.role);
      // Nome vem dos metadados do Google (auth.users), não de public.users.
      const nome: string | null =
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        null;
      const permissions = await loadPermissions(authUser.id);

      setDeniedEmail(null);
      setUser({ id: authUser.id, email: authUser.email, role, nome, permissions });
      setStatus('authed');
    } catch (e) {
      console.error('[auth] loadUserProfile', e);
      setStatus('anon');
    }
  };

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  };

  const signOut = async () => {
    setStatus('loading');
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setDeniedEmail(null);
      setStatus('anon');
    }
  };

  const can = (itemKey: string) => canViewFn(user?.role, user?.permissions || {}, itemKey);
  const canEdit = (itemKey: string) => canEditFn(user?.role, user?.permissions || {}, itemKey);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: status === 'loading',
        status,
        deniedEmail,
        signInWithGoogle,
        signOut,
        can,
        canEdit,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
