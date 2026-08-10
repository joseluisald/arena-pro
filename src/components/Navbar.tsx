/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Categoria } from '../types';
import { 
  Trophy, 
  Users, 
  Calendar, 
  PlayCircle, 
  BarChart3, 
  Settings, 
  Database, 
  Shuffle, 
  Download, 
  Upload, 
  RotateCcw,
  Menu,
  X,
  ChevronRight,
  Layers,
  Globe,
  Lock,
  LogOut,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Plus
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { exportSqliteFile, importSqliteFile, resetDatabaseToSeed } from '../services/db';
import { CategoryManagerModal } from './CategoryManagerModal';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  categorias: Categoria[];
  selectedCategoriaId: number;
  setSelectedCategoriaId: (id: number) => void;
  onRefreshData: () => void;
  isAdminAuthenticated: boolean;
  onOpenLoginModal: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  categorias,
  selectedCategoriaId,
  setSelectedCategoriaId,
  onRefreshData,
  isAdminAuthenticated,
  onOpenLoginModal,
  onLogout,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    const blob = await exportSqliteFile();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `torneio_society_backup_${new Date().toISOString().slice(0, 10)}.sqlite`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importSqliteFile(file).then(() => {
        onRefreshData();
      });
    }
  };

  const handleResetClick = () => {
    setIsResetModalOpen(true);
  };

  const confirmResetDatabase = async () => {
    try {
      setIsResetting(true);
      await resetDatabaseToSeed();
      await onRefreshData();
      setIsResetModalOpen(false);
      setResetSuccessMessage('Banco de dados resetado com sucesso! Dados restaurados sem afetar seu usuário.');

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.5 },
      });
    } catch (err) {
      console.error('Erro ao resetar banco de dados:', err);
    } finally {
      setIsResetting(false);
    }
  };

  const navItems = [
    { id: 'publico', label: 'Portal do Torcedor', icon: Globe, badge: 'Público' },
    { id: 'dashboard', label: 'Painel Geral', icon: BarChart3, badge: null },
    { id: 'sumula', label: 'Súmula Digital', icon: PlayCircle, badge: 'Ao Vivo' },
    { id: 'sorteio', label: 'Draft / Sorteio', icon: Shuffle, badge: null },
    { id: 'jogos', label: 'Jogos & Mata-Mata', icon: Calendar, badge: null },
    { id: 'classificacao', label: 'Tabela & Artilharia', icon: Trophy, badge: null },
    { id: 'times', label: 'Times & Jogadores', icon: Users, badge: null },
    { id: 'regras', label: 'Regras da Categoria', icon: Settings, badge: null },
    { id: 'sql-lab', label: 'SQLite & Schema Lab', icon: Database, badge: 'Dev' },
  ];

  const handleSelectTab = (id: string) => {
    if (id !== 'publico' && !isAdminAuthenticated) {
      setActiveTab('login');
      setMobileMenuOpen(false);
      return;
    }
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Floating Success Notification Toast */}
      {resetSuccessMessage && (
        <div className="fixed top-4 right-4 z-50 max-w-md p-4 bg-[#161920] border border-emerald-500/40 rounded-2xl shadow-2xl flex items-start space-x-3 text-xs text-emerald-400 font-mono animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <span className="font-bold text-white uppercase block">Operação Concluída</span>
            <p className="text-[#8E9299] text-[11px] leading-relaxed">{resetSuccessMessage}</p>
          </div>
          <button
            onClick={() => setResetSuccessMessage(null)}
            className="p-1 hover:bg-emerald-500/20 rounded-lg text-emerald-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mobile Top Header */}
      <header className="lg:hidden bg-[#161920] border-b border-[#262933] px-4 py-3 sticky top-0 z-50 flex items-center justify-between shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-[#FF6B1A] rounded-xl flex items-center justify-center shadow-[0_0_12px_rgba(255,107,26,0.4)]">
            <Trophy className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-wider uppercase text-white">Arena Romano</h1>
            <p className="text-[9px] text-[#FF6B1A] font-mono tracking-widest uppercase font-bold">Centro Esportivo</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={selectedCategoriaId}
            onChange={(e) => setSelectedCategoriaId(Number(e.target.value))}
            className="bg-[#0F1115] text-[#FF6B1A] text-xs font-mono font-bold rounded-lg px-2.5 py-1.5 focus:outline-none border border-[#262933] uppercase"
          >
            {categorias.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#161920] text-white">
                {c.nome}
              </option>
            ))}
          </select>

          {isAdminAuthenticated && (
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="p-1.5 bg-[#FF6B1A]/10 text-[#FF6B1A] hover:bg-[#FF6B1A] hover:text-black border border-[#FF6B1A]/30 rounded-lg transition-all"
              title="Gerenciar / Cadastrar Categoria"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 bg-[#0F1115] text-white rounded-lg border border-[#262933] hover:border-[#FF6B1A] transition-colors"
            aria-label="Alternar Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Vertical Sidebar Layout (Desktop Fixed / Mobile Slide-over) */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-40 lg:z-30 h-screen lg:h-screen w-72 bg-[#161920] border-r border-[#262933]
          flex flex-col justify-between p-5 transition-transform duration-300 ease-in-out shrink-0 overflow-y-auto scrollbar-none shadow-2xl
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Top Section: Branding & Category Picker */}
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#FF6B1A] rounded-xl flex items-center justify-center shadow-[0_0_18px_rgba(255,107,26,0.45)]">
                <Trophy className="w-5 h-5 text-black" />
              </div>
              <div>
                <h1 className="text-sm font-black tracking-tight uppercase text-white">Arena Romano</h1>
                <p className="text-[10px] text-[#FF6B1A] font-mono tracking-widest uppercase font-bold">Centro Esportivo</p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              {isAdminAuthenticated ? (
                <button
                  onClick={onLogout}
                  className="p-2 text-[#FF1744] hover:bg-[#FF1744]/10 rounded-xl transition-colors flex items-center space-x-1 text-[10px] font-mono uppercase font-bold border border-[#FF1744]/20"
                  title="Encerrar Sessão de Admin"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => handleSelectTab('login')}
                  className="p-2 text-[#FF6B1A] hover:bg-[#FF6B1A]/10 rounded-xl transition-colors border border-[#FF6B1A]/20"
                  title="Entrar como Organizador"
                >
                  <Lock className="w-4 h-4" />
                </button>
              )}

              {/* Mobile close button */}
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="lg:hidden p-1.5 text-[#8E9299] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Category Selector Card */}
          <div className="space-y-1.5 bg-[#0F1115] p-3 rounded-2xl border border-[#262933]">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono uppercase font-bold text-[#8E9299] tracking-wider flex items-center space-x-1">
                <Layers className="w-3 h-3 text-[#FF6B1A]" />
                <span>Categoria Ativa</span>
              </label>
              {isAdminAuthenticated && (
                <button
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="text-[10px] font-mono font-bold text-[#FF6B1A] hover:underline flex items-center space-x-0.5"
                  title="Cadastrar ou editar categorias"
                >
                  <Plus className="w-3 h-3" />
                  <span>Gerenciar</span>
                </button>
              )}
            </div>
            <select
              value={selectedCategoriaId}
              onChange={(e) => setSelectedCategoriaId(Number(e.target.value))}
              className="w-full bg-[#161920] text-[#FF6B1A] text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#FF6B1A] border border-[#262933] uppercase tracking-wide cursor-pointer"
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#161920] text-white">
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Navigation Links */}
          <div className="space-y-1">
            <p className="px-2 pb-2 text-[10px] font-mono font-bold uppercase tracking-widest text-[#8E9299]">
              Menu do Torneio
            </p>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all group ${
                      isActive
                        ? 'bg-[#FF6B1A] text-black shadow-[0_0_15px_rgba(255,107,26,0.35)]'
                        : 'text-[#8E9299] hover:text-white hover:bg-[#0F1115] border border-transparent hover:border-[#262933]'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-black' : 'text-[#8E9299] group-hover:text-[#FF6B1A]'}`} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge ? (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        isActive
                          ? 'bg-black text-[#FF6B1A]'
                          : 'bg-[#FF6B1A]/10 text-[#FF6B1A] border border-[#FF6B1A]/30'
                      }`}>
                        {item.badge}
                      </span>
                    ) : (
                      <ChevronRight className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'text-black opacity-100' : 'text-[#8E9299]'}`} />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Section: Database Management Actions */}
        <div className="pt-4 border-t border-[#262933] space-y-3 mt-6">
          <p className="px-1 text-[10px] font-mono font-bold uppercase tracking-widest text-[#8E9299]">
            Ferramentas SQLite
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={handleExport}
              title="Exportar backup .sqlite"
              className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-[#0F1115] hover:bg-[#222632] text-[#8E9299] hover:text-white border border-[#262933] hover:border-[#FF6B1A]/40 transition-all font-mono text-[11px] font-bold"
            >
              <Download className="w-3.5 h-3.5 text-[#FF6B1A]" />
              <span>Exportar</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              title="Importar backup .sqlite"
              className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-[#0F1115] hover:bg-[#222632] text-[#8E9299] hover:text-white border border-[#262933] hover:border-[#FF6B1A]/40 transition-all font-mono text-[11px] font-bold"
            >
              <Upload className="w-3.5 h-3.5 text-[#FF6B1A]" />
              <span>Restaurar</span>
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            accept=".sqlite,.db"
            className="hidden"
          />

          <button
            onClick={handleResetClick}
            title="Limpar e resetar dados do torneio"
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-[#FF1744]/10 hover:bg-[#FF1744]/20 text-[#FF1744] border border-[#FF1744]/30 transition-all font-mono text-[11px] font-extrabold uppercase tracking-wider"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Resetar Banco</span>
          </button>
        </div>
      </aside>

      {/* Overlay Backdrop for Mobile Menu */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-[#161920] border border-[#262933] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-[#FF1744]/10 border border-[#FF1744]/30 rounded-2xl shadow-[0_0_15px_rgba(255,23,68,0.2)]">
                  <AlertTriangle className="w-6 h-6 text-[#FF1744]" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">
                    Resetar Banco de Dados
                  </h3>
                  <p className="text-xs text-[#8E9299]">
                    Limpeza total (TRUNCATE) de dados do torneio
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResetting}
                className="p-2 text-[#8E9299] hover:text-white bg-[#0F1115] rounded-xl border border-[#262933]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Warning Body */}
            <div className="space-y-3">
              <p className="text-xs text-[#E0E6ED] leading-relaxed">
                Tem certeza de que deseja <strong className="text-[#FF1744]">limpar e resetar todo o banco de dados</strong>?
              </p>
              
              <div className="p-3.5 bg-[#0F1115] border border-[#262933] rounded-2xl text-[11px] text-[#8E9299] space-y-2 font-mono">
                <div className="flex items-start space-x-2 text-[#FF1744]">
                  <span>✖</span>
                  <span>Apagará partidas, súmulas ao vivo, gols, cartões e suspensões.</span>
                </div>
                <div className="flex items-start space-x-2 text-[#FF1744]">
                  <span>✖</span>
                  <span>Apagará alterações de times, jogadores e tabelas.</span>
                </div>
                <div className="pt-2 border-t border-[#262933] flex items-center space-x-2 text-emerald-400 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Seu usuário e sessão de Administrador NÃO serão afetados.</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResetting}
                className="w-full sm:w-1/2 py-3 bg-[#0F1115] hover:bg-[#222632] text-[#8E9299] hover:text-white border border-[#262933] font-mono text-xs uppercase font-bold rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmResetDatabase}
                disabled={isResetting}
                className="w-full sm:w-1/2 py-3 bg-[#FF1744] hover:bg-[#d50000] text-white font-mono text-xs uppercase font-black tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(255,23,68,0.35)] flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isResetting ? (
                  <span>Resetando...</span>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Sim, Resetar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categorias={categorias}
        onRefreshData={async () => {
          await onRefreshData();
        }}
        onSelectCategoria={(newId) => {
          setSelectedCategoriaId(newId);
        }}
      />
    </>
  );
};

