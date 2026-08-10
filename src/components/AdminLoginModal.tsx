/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Lock, ShieldCheck, KeyRound, Mail, AlertCircle, X, ArrowRight, Eye, EyeOff } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (cleanEmail === 'jaldrighi@gmail.com' && cleanPassword === 'teste123A') {
      onSuccess();
      setEmail('');
      setPassword('');
    } else {
      setErrorMessage('Credenciais inválidas. Verifique o e-mail e a senha digitados.');
    }
  };

  const handleFillCredentials = () => {
    setEmail('jaldrighi@gmail.com');
    setPassword('teste123A');
    setErrorMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-[#161920] border border-[#262933] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-[#8E9299] hover:text-white bg-[#0F1115] rounded-xl border border-[#262933] hover:border-[#FF6B1A]/40 transition-all"
          aria-label="Fechar modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FF6B1A]/10 border border-[#FF6B1A]/30 flex items-center justify-center shadow-[0_0_20px_rgba(255,107,26,0.25)]">
            <Lock className="w-7 h-7 text-[#FF6B1A]" />
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight font-sans">
            Acesso Restrito
          </h2>
          <p className="text-xs text-[#8E9299]">
            Painel Administrativo para Gerenciamento do Torneio
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 bg-[#FF1744]/10 border border-[#FF1744]/30 rounded-2xl flex items-center space-x-2.5 text-xs text-[#FF1744] font-mono">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
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
              placeholder="jaldrighi@gmail.com"
              className="w-full bg-[#0F1115] text-white text-xs font-mono rounded-xl px-3.5 py-3 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A] transition-all"
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
                placeholder="••••••••••"
                className="w-full bg-[#0F1115] text-white text-xs font-mono rounded-xl pl-3.5 pr-10 py-3 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-[#8E9299] hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Fill Shortcut */}
          <div className="flex justify-between items-center text-[10px] font-mono text-[#8E9299] pt-1">
            <span>Credenciais do Organizador</span>
            <button
              type="button"
              onClick={handleFillCredentials}
              className="text-[#FF6B1A] hover:underline font-bold uppercase tracking-wider"
            >
              [Preencher Senha]
            </button>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-[#FF6B1A] hover:bg-[#e05a0f] text-black font-mono font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(255,107,26,0.35)] flex items-center justify-center space-x-2"
          >
            <span>Entrar no Painel</span>
            <ArrowRight className="w-4 h-4 text-black" />
          </button>
        </form>

        <div className="pt-3 border-t border-[#262933] text-center">
          <p className="text-[10px] text-[#8E9299] font-mono">
            Torcedores e visitantes não precisam de login. Navegue pelo <button onClick={onClose} className="text-[#FF6B1A] underline">Portal do Torcedor</button>.
          </p>
        </div>
      </div>
    </div>
  );
};
