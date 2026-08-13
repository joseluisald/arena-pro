/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Lock, ShieldCheck, KeyRound, Mail, AlertCircle, ArrowRight, Eye, EyeOff, Trophy, Globe, CheckCircle2 } from 'lucide-react';
import { authenticateUser } from '../services/db';

interface LoginViewProps {
  onLoginSuccess: () => void;
  onGoToPublic: () => void;
  isAuthenticated: boolean;
  onLogout: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  onGoToPublic,
  isAuthenticated,
  onLogout,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const user = await authenticateUser(email, password);
      if (user) {
        onLoginSuccess();
      } else {
        setErrorMessage('Credenciais inválidas. Verifique o e-mail e a senha de administrador.');
      }
    } catch (err) {
      console.error('Erro na autenticação:', err);
      setErrorMessage('Erro ao consultar banco de dados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#161920] border border-[#262933] rounded-3xl p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-white uppercase tracking-tight font-sans">
              Você já está autenticado!
            </h2>
            <p className="text-xs text-[#8E9299]">
              Sessão ativa como <strong className="text-white font-mono">jaldrighi@gmail.com</strong>
            </p>
          </div>

          <div className="pt-2 space-y-3">
            <button
              onClick={onLoginSuccess}
              className="w-full py-3.5 bg-[#FF6B1A] hover:bg-[#e05a0f] text-black font-mono font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(255,107,26,0.35)] flex items-center justify-center space-x-2"
            >
              <span>Acessar Painel de Controle</span>
              <ArrowRight className="w-4 h-4 text-black" />
            </button>

            <button
              onClick={onLogout}
              className="w-full py-3 bg-[#0F1115] hover:bg-[#222632] text-[#FF1744] border border-[#262933] hover:border-[#FF1744]/40 font-mono text-xs uppercase font-bold rounded-xl transition-all"
            >
              Encerrar Sessão (Sair)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#161920] border border-[#262933] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Subtle background highlight glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#FF6B1A]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header / Branding */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-[#FF6B1A] to-[#FFC400] flex items-center justify-center shadow-[0_0_25px_rgba(255,107,26,0.4)]">
            <Trophy className="w-8 h-8 text-black" />
          </div>

          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#FF6B1A] block">
              ● ARENA ROMANO CENTRO ESPORTIVO
            </span>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight font-sans">
              Painel do Organizador
            </h1>
            <p className="text-xs text-[#8E9299] mt-1">
              Informe suas credenciais para gerenciar times, súmula ao vivo e classificação.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 bg-[#FF1744]/10 border border-[#FF1744]/30 rounded-2xl flex items-center space-x-2.5 text-xs text-[#FF1744] font-mono">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase font-bold text-[#8E9299] tracking-wider flex items-center space-x-1">
              <Mail className="w-3.5 h-3.5 text-[#FF6B1A]" />
              <span>E-mail do Administrador</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Digite seu e-mail"
              className="w-full bg-[#0F1115] text-white text-xs font-mono rounded-xl px-4 py-3.5 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A] transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase font-bold text-[#8E9299] tracking-wider flex items-center space-x-1">
              <KeyRound className="w-3.5 h-3.5 text-[#FF6B1A]" />
              <span>Senha de Acesso</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full bg-[#0F1115] text-white text-xs font-mono rounded-xl pl-4 pr-11 py-3.5 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-[#8E9299] hover:text-white transition-colors"
                title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-[#FF6B1A] hover:bg-[#e05a0f] text-black font-mono font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(255,107,26,0.35)] flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Entrando...</span>
            ) : (
              <>
                <span>Acessar Painel do Organizador</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </>
            )}
          </button>
        </form>

        {/* Public Portal Spectator Action */}
        <div className="pt-4 border-t border-[#262933] space-y-2 text-center">
          <p className="text-[11px] text-[#8E9299]">Não é administrador? Acompanhe como torcedor:</p>
          <button
            type="button"
            onClick={onGoToPublic}
            className="w-full py-3 px-4 bg-[#0F1115] hover:bg-[#222632] text-[#E0E6ED] hover:text-white border border-[#262933] hover:border-[#FF6B1A]/40 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2"
          >
            <Globe className="w-4 h-4 text-[#FF6B1A]" />
            <span>Acompanhe o Torneio Society (?mode=public)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
