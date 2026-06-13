import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, Loader2 } from 'lucide-react';

export function AceitarConvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('t');
  const { signInWithGoogle } = useAuth();

  const [invite, setInvite] = useState<{ id: string; email: string } | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [invalidToken, setInvalidToken] = useState(false);

  useEffect(() => {
    if (!token) {
      setInvalidToken(true);
      setLoadingInvite(false);
      return;
    }
    async function loadInvite() {
      const { data, error } = await supabase
        .from('team_invites')
        .select('id, email')
        .eq('token', token)
        .is('accepted_at', null)
        .maybeSingle();

      if (error || !data) setInvalidToken(true);
      else setInvite(data);
      setLoadingInvite(false);
    }
    loadInvite();
  }, [token]);

  // ── Loading ──────────────────────────────────────────────────
  if (loadingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--muted)]" />
      </div>
    );
  }

  // ── Invalid token ────────────────────────────────────────────
  if (invalidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="font-cormorant font-bold text-xl text-[var(--ink)]">
            Convite inválido ou expirado
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Este link de convite não existe ou já foi utilizado. Solicite um novo convite ao administrador.
          </p>
          <button onClick={() => navigate('/login')} className="text-sm text-[var(--sage-dark)] hover:underline">
            Ir para o login
          </button>
        </div>
      </div>
    );
  }

  // ── Aceite via Google ────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-[var(--sage-dark)] flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-cormorant font-bold text-xl">HL</span>
          </div>
          <h1 className="font-cormorant font-bold text-2xl text-[var(--ink)]">
            Você foi convidado(a)
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Entre com a conta Google de <strong className="text-[var(--ink)]">{invite?.email}</strong> para acessar o sistema.
          </p>
        </div>

        <div className="bg-white border border-[var(--border)] rounded-[16px] p-6 space-y-4">
          <button
            onClick={() => signInWithGoogle()}
            className="w-full flex items-center justify-center gap-3 text-sm font-medium py-3 rounded-[10px] border border-[var(--border-md)] bg-white hover:bg-[var(--bg)] transition-colors text-[var(--ink)]"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 009 18z"/>
              <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 010-3.44V4.94H.96a9 9 0 000 8.12l3.02-2.34z"/>
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 00.96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z"/>
            </svg>
            Entrar com Google
          </button>
          <p className="text-center text-xs text-[var(--muted)]">
            Use exatamente o e-mail do convite. Suas permissões já estão configuradas pelo administrador.
          </p>
        </div>
      </div>
    </div>
  );
}
