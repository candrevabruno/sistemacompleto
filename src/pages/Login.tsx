// v2 - Ajuste de estilo na tela de login
import React, { useState } from 'react';

import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useClinic } from '../contexts/ClinicContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { config } = useClinic();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    if (!email || !password) {
      setError('Preencha os campos obrigatórios.');
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError('Email ou senha incorretos.');
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="flex h-screen w-full bg-[var(--color-bg-base)]">
      {/* Left Panel */}
      <div className="hidden md:flex flex-col items-center justify-center w-[40%] bg-[var(--color-primary)] text-white p-10">
        <div className="mb-0 flex items-center justify-center transform transition-all duration-1000 animate-in fade-in zoom-in-95 duration-700">
          <img 
            src={config?.logo_url || "/logo.png"} 
            alt={config?.nome || "Heroic Leap Logo"} 
            className="max-h-40 w-auto object-contain hover:scale-105 transition-transform cursor-pointer drop-shadow-sm"
          />
        </div>
        <h1 className="font-cormorant text-3xl font-semibold leading-relaxed text-center max-w-md transition-all duration-700 animate-in fade-in slide-in-from-bottom-4">
          Para você nunca parar de cuidar, a IA nunca para de trabalhar.
        </h1>
      </div>

      {/* Right Panel */}
      <div className="flex flex-col items-center justify-center w-full md:w-[60%] p-6">
        <div className="w-full max-w-md">
          <div className="mb-10 text-center md:text-left">
            <h2 className="font-cormorant text-4xl font-semibold text-[var(--color-text-main)] mb-2">
              Bem-vindo(a) de volta!
            </h2>
            <p className="text-[var(--color-text-muted)] text-lg">
              Menos burocracia. Mais tempo para seus pacientes.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <Input
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              icon={<Mail className="w-5 h-5" />}
            />

            <div className="relative">
              <Input
                label="Senha"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                icon={<Lock className="w-5 h-5" />}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-[8px] bg-[#FCEEEE] text-[var(--color-error)] text-sm font-medium">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              loading={loading}
            >
              Entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
