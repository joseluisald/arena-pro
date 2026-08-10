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
  ShieldCheck
} from 'lucide-react';
import { exportSqliteFile, importSqliteFile, resetDatabaseToSeed } from '../services/db';

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

  const handleReset = async () => {
    await resetDatabaseToSeed();
    onRefreshData();
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
      onOpenLoginModal();
      setMobileMenuOpen(false);
      return;
    }
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <>
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

            {/* Mobile close button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 text-[#8E9299] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Status Badge */}
          <div className="flex items-center justify-between bg-[#0F1115] px-3 py-2 rounded-xl border border-[#262933]">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#FF6B1A] animate-pulse"></span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white">SQLite Sync Engine</span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#FF6B1A]/10 text-[#FF6B1A] border border-[#FF6B1A]/30 font-bold">
              OFFLINE OK
            </span>
          </div>

          {/* Admin Auth Status Card */}
          <div className="bg-[#0F1115] p-3 rounded-2xl border border-[#262933] space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider">
              <span className="text-[#8E9299] flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#FF6B1A]" />
                <span>Status do Acesso</span>
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                isAdminAuthenticated 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-[#FFC400]/10 text-[#FFC400] border border-[#FFC400]/30'
              }`}>
                {isAdminAuthenticated ? 'Admin Autenticado' : 'Visitante / Público'}
              </span>
            </div>

            {isAdminAuthenticated ? (
              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-[11px] text-white font-mono truncate font-semibold">
                  jaldrighi@gmail.com
                </span>
                <button
                  onClick={onLogout}
                  className="p-1 text-[#FF1744] hover:bg-[#FF1744]/10 rounded-lg transition-colors flex items-center space-x-1 text-[10px] font-mono uppercase font-bold"
                  title="Encerrar Sessão de Admin"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair</span>
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLoginModal}
                className="w-full py-1.5 bg-[#FF6B1A]/10 hover:bg-[#FF6B1A]/20 text-[#FF6B1A] border border-[#FF6B1A]/30 rounded-xl text-[10px] font-mono uppercase font-black tracking-wider transition-all flex items-center justify-center space-x-1.5"
              >
                <Lock className="w-3 h-3" />
                <span>Entrar como Organizador</span>
              </button>
            )}
          </div>

          {/* Category Selector Card */}
          <div className="space-y-1.5 bg-[#0F1115] p-3 rounded-2xl border border-[#262933]">
            <label className="text-[10px] font-mono uppercase font-bold text-[#8E9299] tracking-wider flex items-center space-x-1">
              <Layers className="w-3 h-3 text-[#FF6B1A]" />
              <span>Categoria Ativa</span>
            </label>
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
            onClick={handleReset}
            title="Restaurar banco com dados padrão"
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
    </>
  );
};

