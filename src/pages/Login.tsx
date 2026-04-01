// Login — HeroicLeap v9
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

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
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        .hl-login-wrap {
          display: grid;
          grid-template-columns: 2fr 3fr;
          min-height: 100vh;
          width: 100%;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
        }

        /* ─── LEFT PANEL ─────────────────────────── */
        .hl-left {
          background: #1A2B4A;
          padding: 48px 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
        }

        /* Decorative elements */
        .hl-deco-circle {
          position: absolute;
          top: 36px;
          right: 32px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(255,255,255,0.08);
        }
        .hl-deco-arc {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 160px;
          height: 160px;
          border-radius: 50% 0 0 0;
          background: rgba(255,255,255,0.06);
        }

        /* Logo */
        .hl-logo-img {
          max-height: 200px;
          width: 85%;
          object-fit: contain;
          position: relative;
          z-index: 1;
        }

        /* Tagline */
        .hl-tagline {
          font-family: 'Playfair Display', serif;
          font-size: clamp(15px, 2.2vw, 28px);
          font-weight: 400;
          color: rgba(255,255,255,0.97);
          line-height: 1.45;
          text-align: center;
          width: 100%;
          position: relative;
          z-index: 1;
        }
        .hl-tagline em {
          font-style: italic;
          color: #E8C97A;
        }

        .hl-left-bottom { height: 40px; }

        /* ─── RIGHT PANEL ────────────────────────── */
        .hl-right {
          background: #F7F5F2;
          padding: 64px 72px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .hl-eyebrow {
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #C9A84C;
          font-weight: 500;
          margin-bottom: 14px;
        }

        .hl-title {
          font-family: 'Playfair Display', serif;
          font-size: 30px;
          font-weight: 400;
          color: #1A2B4A;
          margin: 0 0 6px;
          white-space: nowrap;
        }

        .hl-subtitle {
          font-size: 14px;
          color: #9A9088;
          margin: 0 0 36px;
          font-weight: 300;
        }

        /* Fields */
        .hl-field { margin-bottom: 20px; }

        .hl-label {
          font-size: 13px;
          font-weight: 400;
          color: #2E3F5C;
          margin-bottom: 8px;
          display: block;
        }

        .hl-input-wrap {
          display: flex;
          align-items: center;
          background: #fff;
          border: 1px solid #E8E2D9;
          border-radius: 8px;
          padding: 0 14px;
          height: 48px;
          transition: border-color 0.2s;
          position: relative;
        }
        .hl-input-wrap:focus-within { border-color: #1A2B4A; }

        .hl-input-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          margin-right: 10px;
          opacity: 0.3;
        }

        .hl-input-wrap input {
          border: none;
          background: transparent;
          font-size: 14px;
          color: #1A2B4A;
          font-family: 'DM Sans', sans-serif;
          font-weight: 300;
          outline: none;
          width: 100%;
          box-shadow: none;
        }
        .hl-input-wrap input::placeholder { color: #C8BFBC; }

        .hl-eye-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          opacity: 0.4;
          transition: opacity 0.2s;
          flex-shrink: 0;
          margin-left: 8px;
        }
        .hl-eye-btn:hover { opacity: 0.8; }

        .hl-forgot { text-align: right; margin-top: 8px; }
        .hl-forgot a {
          font-size: 12px;
          color: #C9A84C;
          text-decoration: none;
          opacity: 0.8;
          transition: opacity 0.2s;
        }
        .hl-forgot a:hover { opacity: 1; }

        /* Button */
        .hl-btn {
          width: 100%;
          height: 54px;
          background: #1A2B4A;
          color: #E8C97A;
          border: none;
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          cursor: pointer;
          margin-top: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          position: relative;
          overflow: hidden;
          transition: background 0.25s;
        }
        .hl-btn::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 4px;
          background: #E8C97A;
          transition: background 0.25s;
        }
        .hl-btn:hover { background: #2E3F5C; }
        .hl-btn:hover::before { background: #E8C97A; }
        .hl-btn:disabled { opacity: 0.65; cursor: not-allowed; }

        .hl-btn-arrow { display: flex; gap: 2px; }
        .hl-btn-arrow span {
          display: block;
          width: 7px; height: 7px;
          border-top: 1.5px solid #E8C97A;
          border-right: 1.5px solid #E8C97A;
          transform: rotate(45deg);
        }
        .hl-btn-arrow span:first-child { opacity: 0.4; margin-right: -2px; }

        /* Error */
        .hl-error {
          padding: 10px 14px;
          border-radius: 8px;
          background: rgba(26,43,74,0.05);
          color: #1A2B4A;
          font-size: 13px;
          font-weight: 400;
          margin-top: 12px;
        }

        /* Divider */
        .hl-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 20px 0 0;
        }
        .hl-divider-line { flex: 1; height: 0.5px; background: #DDD5D0; }
        .hl-divider-text {
          font-size: 11px;
          color: #BFB5B1;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        /* ─── MOBILE ──────────────────────────── */
        @media (max-width: 768px) {
          .hl-login-wrap {
            grid-template-columns: 1fr;
            min-height: 100vh;
          }

          .hl-left { display: none; }

          .hl-right {
            padding: 12px 28px 48px;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
          }

          .hl-mobile-logo {
            display: flex !important;
            justify-content: center;
            margin-bottom: 8px;
          }

          .hl-title {
            white-space: normal;
            font-size: 26px;
          }
        }
      `}</style>

      <div className="hl-login-wrap">
        {/* ─── LEFT PANEL ─── */}
        <div className="hl-left">
          <div className="hl-deco-circle" />
          <div className="hl-deco-arc" />

          {/* Logo branca */}
          <img src="/logo2.png" alt="HeroicLeap" className="hl-logo-img" />

          {/* Tagline */}
          <div className="hl-tagline">
            Para você nunca parar de <em>cuidar.</em>
          </div>

          <div className="hl-left-bottom" />
        </div>

        {/* ─── RIGHT PANEL ─── */}
        <div className="hl-right">
          {/* Logo visível apenas no mobile */}
          <div className="hl-mobile-logo" style={{display: 'none'}}>
            <img src="/logo.png" alt="HeroicLeap" style={{maxHeight: '200px', width: '90%', objectFit: 'contain'}} />
          </div>

          <div className="hl-eyebrow">Acesso seguro</div>
          <h1 className="hl-title">Bem-vindo(a) de volta!</h1>
          <p className="hl-subtitle">Menos burocracia. Mais tempo para seus pacientes.</p>

          <form onSubmit={handleLogin}>
            {/* E-mail */}
            <div className="hl-field">
              <label className="hl-label">E-mail</label>
              <div className="hl-input-wrap">
                <svg className="hl-input-icon" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="3" width="14" height="10" rx="2" stroke="#2C2420" strokeWidth="1.2"/>
                  <path d="M1 5.5L8 9.5L15 5.5" stroke="#2C2420" strokeWidth="1.2"/>
                </svg>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Senha */}
            <div className="hl-field">
              <label className="hl-label">Senha</label>
              <div className="hl-input-wrap">
                <svg className="hl-input-icon" viewBox="0 0 16 16" fill="none">
                  <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="#2C2420" strokeWidth="1.2"/>
                  <path d="M5 7V5a3 3 0 016 0v2" stroke="#2C2420" strokeWidth="1.2"/>
                </svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="hl-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="#2C2420" strokeWidth="1.2"/>
                      <circle cx="8" cy="8" r="2" stroke="#2C2420" strokeWidth="1.2"/>
                      <path d="M2 2l12 12" stroke="#2C2420" strokeWidth="1.2"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="#2C2420" strokeWidth="1.2"/>
                      <circle cx="8" cy="8" r="2" stroke="#2C2420" strokeWidth="1.2"/>
                    </svg>
                  )}
                </button>
              </div>
              <div className="hl-forgot">
                <a href="#">Esqueceu a senha?</a>
              </div>
            </div>

            {error && <div className="hl-error">{error}</div>}

            <button type="submit" className="hl-btn" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
              {!loading && (
                <div className="hl-btn-arrow">
                  <span />
                  <span />
                </div>
              )}
            </button>
          </form>


        </div>
      </div>
    </>
  );
}
