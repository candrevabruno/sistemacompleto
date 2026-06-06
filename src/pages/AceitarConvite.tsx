import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  atendente: 'Atendente',
  profissional: 'Profissional',
};

export function AceitarConvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('t');

  const [invite, setInvite] = useState<{ id: string; email: string; role: string } | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [invalidToken, setInvalidToken] = useState(false);

  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setInvalidToken(true);
      setLoadingInvite(false);
      return;
    }
    async function loadInvite() {
      const { data, error } = await supabase
        .from('team_invites')
        .select('id, email, role')
        .eq('token', token)
        .is('accepted_at', null)
        .single();

      if (error || !data) {
        setInvalidToken(true);
      } else {
        setInvite(data);
      }
      setLoadingInvite(false);
    }
    loadInvite();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invite) return;
    setError(null);

    if (!nome.trim()) { setError('Informe seu nome.'); return; }
    if (senha.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (senha !== confirmSenha) { setError('As senhas não coincidem.'); return; }

    setSubmitting(true);
    try {
      // Create auth account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invite.email,
        password: senha,
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('Este e-mail já possui uma conta. Faça login normalmente.');
        } else {
          setError(signUpError.message);
        }
        return;
      }

      const userId = authData.user?.id;
      if (!userId) { setError('Erro ao criar conta. Tente novamente.'); return; }

      // Create users record with role
      await supabase.from('users').upsert({
        id: userId,
        email: invite.email,
        nome: nome.trim(),
        role: invite.role,
      }, { onConflict: 'id' });

      // Mark invite as accepted
      await supabase
        .from('team_invites')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invite.id);

      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────
  if (loadingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-base)]">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  // ── Invalid token ────────────────────────────────────────────
  if (invalidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-base)] p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="font-cormorant font-bold text-xl text-[var(--color-text-main)]">
            Convite inválido ou expirado
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Este link de convite não existe ou já foi utilizado. Solicite um novo convite ao administrador.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            Ir para o login
          </button>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-base)] p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
            <CheckCircle className="w-7 h-7 text-green-500" />
          </div>
          <h2 className="font-cormorant font-bold text-xl text-[var(--color-text-main)]">
            Conta criada com sucesso!
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Sua conta foi criada como <strong>{ROLE_LABEL[invite?.role || ''] || invite?.role}</strong>.
            {' '}Verifique seu e-mail se solicitado e faça login para acessar o sistema.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center justify-center text-sm font-medium px-6 py-2.5 rounded-[8px] bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
          >
            Fazer login
          </button>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-base)] p-4">
      <div className="w-full max-w-md">
        {/* Logo / header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-[var(--color-primary)] flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-cormorant font-bold text-xl">HL</span>
          </div>
          <h1 className="font-cormorant font-bold text-2xl text-[var(--color-text-main)]">
            Criar sua conta
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Você foi convidado para o sistema
          </p>
        </div>

        <div className="bg-white dark:bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-[16px] p-6 space-y-5">
          {/* Pre-filled info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-[8px] bg-[var(--color-bg-base)] border border-[var(--color-border-card)]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">E-mail</p>
              <p className="text-sm text-[var(--color-text-main)] truncate font-medium">{invite?.email}</p>
            </div>
            <div className="p-3 rounded-[8px] bg-[var(--color-bg-base)] border border-[var(--color-border-card)]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">Cargo</p>
              <p className="text-sm text-[var(--color-text-main)] font-medium">
                {ROLE_LABEL[invite?.role || ''] || invite?.role}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
                Seu nome
              </label>
              <input
                autoFocus
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Como você quer ser chamado"
                className="w-full border border-[var(--color-border-card)] rounded-[8px] px-3 py-2.5 text-sm bg-[var(--color-bg-base)] text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full border border-[var(--color-border-card)] rounded-[8px] px-3 py-2.5 text-sm bg-[var(--color-bg-base)] text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
                Confirmar senha
              </label>
              <input
                type="password"
                value={confirmSenha}
                onChange={e => setConfirmSenha(e.target.value)}
                placeholder="Repita a senha"
                className="w-full border border-[var(--color-border-card)] rounded-[8px] px-3 py-2.5 text-sm bg-[var(--color-bg-base)] text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-[8px] bg-red-50 border border-red-100 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full text-sm font-medium py-3 rounded-[8px] bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {submitting ? 'Criando conta...' : 'Criar minha conta'}
            </button>
          </form>

          <p className="text-center text-xs text-[var(--color-text-muted)]">
            Já tem uma conta?{' '}
            <button onClick={() => navigate('/login')} className="text-[var(--color-primary)] hover:underline">
              Fazer login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
