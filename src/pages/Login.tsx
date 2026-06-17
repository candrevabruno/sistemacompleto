import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const GOLD = '#C9A84C';
const GREEN_DARK = '#1A2C1A';
const CREAM = '#FAF9F7';

function GridLogo() {
  return (
    <svg width="46" height="48" viewBox="0 0 46 48" fill="none">
      {[0,1,2,3].map(col => [0,1].map(row => (
        <rect key={`${col}-${row}`} x={col * 12} y={row * 12} width="10" height="10" rx="1.5"
          fill="none" stroke={GOLD} strokeWidth="1.5"/>
      )))}
      <rect x="26" y="24" width="10" height="10" rx="1.5" fill="none" stroke={GOLD} strokeWidth="1.5"/>
      <rect x="38" y="24" width="10" height="10" rx="1.5" fill="none" stroke={GOLD} strokeWidth="1.5"/>
      <rect x="0" y="36" width="13" height="12" rx="2" fill={GOLD}/>
    </svg>
  );
}

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const navigate = useNavigate();
  const { user, status, deniedEmail, signInWithGoogle, signOut } = useAuth();

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (!email || !password) {
      setError('Preencha os campos obrigatórios.');
      setLoading(false);
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError('Email ou senha incorretos.');
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) { setError('Digite seu e-mail primeiro para recuperar a senha.'); return; }
    await supabase.auth.resetPasswordForEmail(email);
    setError(null);
    alert('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
  };

  if (status === 'denied') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: CREAM, fontFamily: "'DM Sans', sans-serif", padding: 24 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400;1,600&family=DM+Sans:wght@300;400;500;600&display=swap');`}</style>
        <div style={{ maxWidth: 400, width: '100%', textAlign: 'center', background: '#fff', border: '1px solid #E8E2D9', borderRadius: 16, padding: '40px 32px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${GREEN_DARK}0d` }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="10" width="16" height="10" rx="2" stroke={GREEN_DARK} strokeWidth="1.5"/>
              <path d="M8 10V7a4 4 0 018 0v3" stroke={GREEN_DARK} strokeWidth="1.5"/>
            </svg>
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: GREEN_DARK, margin: '0 0 10px', fontStyle: 'italic' }}>Acesso restrito</h1>
          <p style={{ fontSize: 14, color: '#6B6B6B', lineHeight: 1.6, margin: '0 0 6px' }}>
            A conta{deniedEmail ? <strong style={{ color: GREEN_DARK }}> {deniedEmail}</strong> : ''} ainda não foi convidada para este sistema.
          </p>
          <p style={{ fontSize: 13, color: '#9A9A9A', lineHeight: 1.6, margin: '0 0 28px' }}>Solicite um convite ao administrador da clínica e tente novamente.</p>
          <button onClick={signOut} style={{ width: '100%', height: 48, background: GREEN_DARK, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400;1,600&family=DM+Sans:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        .lc-wrap {
          display: grid;
          grid-template-columns: 55fr 45fr;
          min-height: 100vh;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
        }

        /* ── LEFT ── */
        .lc-left {
          background: ${GREEN_DARK};
          display: flex;
          flex-direction: column;
          padding: 44px 52px;
          position: relative;
          overflow: hidden;
        }

        .lc-left-brand {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .lc-brand-text { display: flex; flex-direction: column; gap: 2px; }
        .lc-brand-name {
          font-family: 'DM Sans', sans-serif;
          font-size: 22px;
          font-weight: 600;
          color: #fff;
          letter-spacing: -0.3px;
          line-height: 1;
        }
        .lc-brand-sub {
          font-size: 9px;
          font-weight: 400;
          color: rgba(255,255,255,0.45);
          letter-spacing: 2.2px;
          text-transform: uppercase;
        }

        .lc-left-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 40px 0 20px;
        }

        .lc-headline {
          font-family: 'Playfair Display', serif;
          font-size: clamp(32px, 3.4vw, 50px);
          font-style: italic;
          font-weight: 400;
          line-height: 1.2;
          color: #fff;
          margin: 0 0 4px;
        }
        .lc-headline-muted {
          font-family: 'Playfair Display', serif;
          font-size: clamp(32px, 3.4vw, 50px);
          font-style: italic;
          font-weight: 400;
          line-height: 1.2;
          color: #7A9E7A;
          margin: 0 0 36px;
        }

        .lc-divider-line {
          width: 40px;
          height: 2px;
          background: ${GOLD};
          border-radius: 2px;
          margin-bottom: 28px;
        }

        .lc-tagline {
          font-size: 14px;
          font-weight: 300;
          color: rgba(255,255,255,0.6);
          line-height: 1.5;
        }

        .lc-left-footer {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .lc-dots {
          display: flex;
          gap: 7px;
          align-items: center;
        }
        .lc-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: rgba(255,255,255,0.25);
        }
        .lc-dot.active {
          background: ${GOLD};
        }
        .lc-copyright {
          font-size: 11px;
          color: ${GOLD};
          opacity: 0.75;
          letter-spacing: 0.5px;
        }

        /* ── RIGHT ── */
        .lc-right {
          background: ${CREAM};
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 56px 64px;
        }

        .lc-right-title {
          font-family: 'Playfair Display', serif;
          font-size: 36px;
          font-style: italic;
          font-weight: 400;
          color: #1A1A1A;
          margin: 0 0 8px;
        }
        .lc-right-sub {
          font-size: 14px;
          font-weight: 300;
          color: #8A8A8A;
          margin: 0 0 28px;
        }

        .lc-google-btn {
          width: 100%;
          height: 52px;
          background: #fff;
          border: 1.5px solid #E4DED7;
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 500;
          color: #2A2A2A;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: border-color 0.2s, box-shadow 0.2s;
          margin-bottom: 24px;
        }
        .lc-google-btn:hover { border-color: #999; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }

        .lc-or {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 22px;
        }
        .lc-or-line { flex: 1; height: 1px; background: #E4DED7; }
        .lc-or-text { font-size: 12px; color: #BBBBBB; letter-spacing: 0.5px; }

        .lc-field { margin-bottom: 16px; }
        .lc-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1.4px;
          text-transform: uppercase;
          color: #5A5A5A;
          margin-bottom: 7px;
        }
        .lc-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
          background: #fff;
          border: 1.5px solid #E4DED7;
          border-radius: 8px;
          height: 48px;
          padding: 0 14px;
          transition: border-color 0.2s;
        }
        .lc-input-wrap:focus-within { border-color: ${GREEN_DARK}; }
        .lc-input-wrap input {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 14px;
          color: #1A1A1A;
          font-family: 'DM Sans', sans-serif;
          font-weight: 400;
          outline: none;
        }
        .lc-input-wrap input::placeholder { color: #C8C4C0; }
        .lc-eye-btn {
          background: none; border: none; cursor: pointer;
          padding: 0; display: flex; align-items: center;
          color: #BBBBBB; transition: color 0.2s; flex-shrink: 0;
        }
        .lc-eye-btn:hover { color: #5A5A5A; }

        .lc-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 12px;
          margin-bottom: 20px;
        }
        .lc-remember {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          color: #6B6B6B;
          cursor: pointer;
          user-select: none;
        }
        .lc-remember input[type="checkbox"] {
          width: 15px; height: 15px;
          accent-color: ${GREEN_DARK};
          cursor: pointer;
        }
        .lc-forgot {
          font-size: 13px;
          color: ${GOLD};
          text-decoration: none;
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
          font-family: 'DM Sans', sans-serif;
          opacity: 0.85;
          transition: opacity 0.2s;
        }
        .lc-forgot:hover { opacity: 1; }

        .lc-submit {
          width: 100%;
          height: 52px;
          background: #1A1A1A;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: background 0.2s;
          margin-bottom: 24px;
        }
        .lc-submit:hover:not(:disabled) { background: ${GREEN_DARK}; }
        .lc-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        .lc-error {
          background: #FFF3F3;
          border: 1px solid #F5C6C6;
          color: #C0392B;
          font-size: 13px;
          padding: 10px 14px;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .lc-restricted {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .lc-lock-icon {
          width: 38px; height: 38px;
          background: rgba(201,168,76,0.12);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .lc-restricted-text { display: flex; flex-direction: column; gap: 2px; }
        .lc-restricted-text strong { font-size: 13px; color: #3A3A3A; font-weight: 600; }
        .lc-restricted-text span { font-size: 12px; color: #8A8A8A; }

        /* Mobile */
        @media (max-width: 768px) {
          .lc-wrap { grid-template-columns: 1fr; }
          .lc-left { display: none; }
          .lc-right { padding: 40px 28px; justify-content: flex-start; padding-top: 60px; }
        }
      `}</style>

      <div className="lc-wrap">
        {/* ── LEFT PANEL ── */}
        <div className="lc-left">
          <div className="lc-left-brand">
            <GridLogo />
            <div className="lc-brand-text">
              <span className="lc-brand-name">LeapCare</span>
              <span className="lc-brand-sub">Plataforma de Gestão Clínica</span>
            </div>
          </div>

          <div className="lc-left-content">
            <div className="lc-headline">Atendimento<br/>inteligente.</div>
            <div className="lc-headline-muted">Experiência<br/>humana.</div>
            <div className="lc-divider-line"/>
            <div className="lc-tagline">O operacional da<br/>clínica moderna.</div>
          </div>

          <div className="lc-left-footer">
            <div className="lc-dots">
              <div className="lc-dot active"/>
              <div className="lc-dot"/>
              <div className="lc-dot"/>
              <div className="lc-dot"/>
            </div>
            <div className="lc-copyright">LeapCare &middot; Heroic Leap&reg; &middot; 2026 &middot; LGPD</div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="lc-right">
          <h1 className="lc-right-title">Bem-vindo(a)!</h1>
          <p className="lc-right-sub">Acesse sua conta para continuar.</p>

          {/* Google */}
          <button type="button" className="lc-google-btn" onClick={() => signInWithGoogle()}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 009 18z"/>
              <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 010-3.44V4.94H.96a9 9 0 000 8.12l3.02-2.34z"/>
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 00.96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z"/>
            </svg>
            Entrar com Google
          </button>

          {/* Divider */}
          <div className="lc-or">
            <div className="lc-or-line"/>
            <span className="lc-or-text">ou</span>
            <div className="lc-or-line"/>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin}>
            <div className="lc-field">
              <label className="lc-label">E-mail</label>
              <div className="lc-input-wrap">
                <input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"/>
              </div>
            </div>

            <div className="lc-field">
              <label className="lc-label">Senha</label>
              <div className="lc-input-wrap">
                <input type={showPassword ? 'text' : 'password'} placeholder="••••••••••" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"/>
                <button type="button" className="lc-eye-btn" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                  {showPassword ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            <div className="lc-row">
              <label className="lc-remember">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}/>
                Lembrar-me
              </label>
              <button type="button" className="lc-forgot" onClick={handleForgotPassword}>Esqueci minha senha</button>
            </div>

            {error && <div className="lc-error">{error}</div>}

            <button type="submit" className="lc-submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
              {!loading && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              )}
            </button>
          </form>

          {/* Restricted notice */}
          <div className="lc-restricted">
            <div className="lc-lock-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            </div>
            <div className="lc-restricted-text">
              <strong>Acesso restrito.</strong>
              <span>Solicitar acesso ao sistema.</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
