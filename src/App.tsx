/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Categoria } from './types';
import { query } from './services/db';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { SumulaDigitalView } from './components/SumulaDigitalView';
import { DraftView } from './components/DraftView';
import { FixturesBracketsView } from './components/FixturesBracketsView';
import { StandingsArtilhariaView } from './components/StandingsArtilhariaView';
import { TeamsPlayersView } from './components/TeamsPlayersView';
import { SettingsView } from './components/SettingsView';
import { SqlSchemaLabView } from './components/SqlSchemaLabView';
import { PublicPortalView } from './components/PublicPortalView';
import { AdminLoginModal } from './components/AdminLoginModal';
import { Globe, Lock, LogOut, ShieldCheck, Trophy } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('publico');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<number>(1);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [isPublicStandaloneMode, setIsPublicStandaloneMode] = useState<boolean>(false);
  
  // Admin authentication state
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('arena_romano_admin') === 'true';
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  useEffect(() => {
    // Check if URL specifies public mode (e.g. ?mode=public or ?view=public)
    const params = new URLSearchParams(window.location.search);
    const isPublicParam = 
      params.get('mode') === 'public' || 
      params.get('view') === 'public' || 
      params.get('publico') === 'true';

    if (isPublicParam) {
      setIsPublicStandaloneMode(true);
      setActiveTab('publico');
    } else if (localStorage.getItem('arena_romano_admin') === 'true') {
      setActiveTab('dashboard');
    } else {
      setActiveTab('publico');
    }

    loadCategorias();
  }, []);

  const loadCategorias = async () => {
    const list = await query<Categoria>('SELECT * FROM categorias ORDER BY id ASC;');
    setCategorias(list);
    if (list.length > 0 && !selectedCategoriaId) {
      setSelectedCategoriaId(list[0].id);
    }
  };

  const handleNavigateToMatch = (matchId: number) => {
    setSelectedMatchId(matchId);
    setActiveTab('sumula');
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
    localStorage.setItem('arena_romano_admin', 'true');
    setIsLoginModalOpen(false);
    if (isPublicStandaloneMode) {
      setIsPublicStandaloneMode(false);
      const url = new URL(window.location.href);
      url.searchParams.delete('mode');
      window.history.replaceState({}, '', url.toString());
    }
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    setIsAdminAuthenticated(false);
    localStorage.removeItem('arena_romano_admin');
    setActiveTab('publico');
  };

  const handleRequestAdminAccess = () => {
    if (isAdminAuthenticated) {
      setIsPublicStandaloneMode(false);
      setActiveTab('dashboard');
      const url = new URL(window.location.href);
      url.searchParams.delete('mode');
      window.history.replaceState({}, '', url.toString());
    } else {
      setIsLoginModalOpen(true);
    }
  };

  const togglePublicMode = (enablePublic: boolean) => {
    setIsPublicStandaloneMode(enablePublic);
    if (enablePublic) {
      setActiveTab('publico');
      // Update browser URL query param without full reload
      const url = new URL(window.location.href);
      url.searchParams.set('mode', 'public');
      window.history.replaceState({}, '', url.toString());
    } else {
      if (isAdminAuthenticated) {
        setActiveTab('dashboard');
        const url = new URL(window.location.href);
        url.searchParams.delete('mode');
        window.history.replaceState({}, '', url.toString());
      } else {
        setIsLoginModalOpen(true);
      }
    }
  };

  // IF PUBLIC STANDALONE MODE: Render only the spectator page without admin sidebar
  if (isPublicStandaloneMode) {
    return (
      <div className="min-h-screen bg-[#0F1115] text-[#E0E6ED] font-sans flex flex-col">
        {/* Admin Login Modal */}
        <AdminLoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onSuccess={handleAdminLoginSuccess}
        />

        {/* Spectator Top Header */}
        <header className="bg-[#161920] border-b border-[#262933] sticky top-0 z-50 shadow-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF6B1A] to-[#FFC400] flex items-center justify-center font-black text-black shadow-[0_0_15px_rgba(255,107,26,0.4)]">
                <Trophy className="w-5 h-5 text-black" />
              </div>
              <div>
                <span className="text-sm font-black text-white uppercase tracking-wider block font-sans">
                  Arena Romano
                </span>
                <span className="text-[10px] text-[#FF6B1A] font-mono font-bold uppercase tracking-widest block">
                  ● Portal do Torcedor (Público)
                </span>
              </div>
            </div>

            {/* Organizer Login / Switch Back Button */}
            <button
              onClick={() => togglePublicMode(false)}
              className="px-3.5 py-2 bg-[#0F1115] hover:bg-[#222632] text-[#8E9299] hover:text-white border border-[#262933] hover:border-[#FF6B1A]/40 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center space-x-2"
              title="Acessar painel de gerenciamento do organizador"
            >
              <Lock className="w-3.5 h-3.5 text-[#FF6B1A]" />
              <span className="hidden sm:inline">Painel do Organizador</span>
            </button>
          </div>
        </header>

        {/* Public Portal View */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <PublicPortalView
            categoriaId={selectedCategoriaId}
            categorias={categorias}
            onSelectCategoria={setSelectedCategoriaId}
          />
        </main>

        {/* Public Footer */}
        <footer className="border-t border-[#262933] bg-[#161920] py-4 text-center text-[11px] text-[#8E9299]">
          <p className="font-mono tracking-wider text-[#8E9299]">
            ARENA ROMANO CENTRO ESPORTIVO • PORTAL DO TORCEDOR
          </p>
        </footer>
      </div>
    );
  }

  // ADMIN MODE: Full sidebar navigation & dashboard controls
  return (
    <div className="min-h-screen bg-[#0F1115] text-[#E0E6ED] font-sans selection:bg-[#FF6B1A] selection:text-black flex flex-col lg:flex-row">
      {/* Login Modal */}
      <AdminLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={handleAdminLoginSuccess}
      />

      {/* Spectator Top Bar in Admin preview */}
      <div className="lg:hidden bg-[#161920] border-b border-[#262933] px-4 py-2 flex items-center justify-between text-xs">
        <span className="text-[#FF6B1A] font-mono font-bold uppercase text-[10px]">
          ● Arena Romano {isAdminAuthenticated ? '(Admin)' : '(Público)'}
        </span>
        {!isAdminAuthenticated && (
          <button
            onClick={() => setIsLoginModalOpen(true)}
            className="px-2.5 py-1 bg-[#FF6B1A] text-black font-mono font-black rounded-lg text-[10px] uppercase"
          >
            Entrar Admin
          </button>
        )}
      </div>

      {/* Sidebar Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        categorias={categorias}
        selectedCategoriaId={selectedCategoriaId}
        setSelectedCategoriaId={setSelectedCategoriaId}
        onRefreshData={loadCategorias}
        isAdminAuthenticated={isAdminAuthenticated}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {activeTab === 'publico' && (
            <div className="space-y-4">
              {/* Information banner in Admin mode */}
              <div className="bg-[#FF6B1A]/10 border border-[#FF6B1A]/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-3">
                  <Globe className="w-5 h-5 text-[#FF6B1A] shrink-0" />
                  <div>
                    <p className="font-bold text-white uppercase tracking-wider">
                      Modo de Pré-visualização do Torcedor
                    </p>
                    <p className="text-[#8E9299] text-[11px] mt-0.5">
                      Esta é a tela pública. Ao compartilhar o link com os torcedores, eles verão apenas este portal limpo sem os menus do organizador.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => togglePublicMode(true)}
                  className="px-3 py-1.5 bg-[#FF6B1A] hover:bg-[#e05a0f] text-black font-mono font-black rounded-xl text-[11px] uppercase tracking-wider transition-all shrink-0"
                >
                  Testar Visão do Torcedor (Link Público)
                </button>
              </div>

              <PublicPortalView
                categoriaId={selectedCategoriaId}
                categorias={categorias}
                onSelectCategoria={setSelectedCategoriaId}
              />
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              categoriaId={selectedCategoriaId}
              categorias={categorias}
              onNavigateToMatch={handleNavigateToMatch}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'sumula' && (
            <SumulaDigitalView
              matchId={selectedMatchId}
              categoriaId={selectedCategoriaId}
              onBack={() => setActiveTab('jogos')}
              onMatchFinalized={() => {}}
            />
          )}

          {activeTab === 'sorteio' && (
            <DraftView
              categoriaId={selectedCategoriaId}
              onNavigateToGames={() => setActiveTab('jogos')}
            />
          )}

          {activeTab === 'jogos' && (
            <FixturesBracketsView
              categoriaId={selectedCategoriaId}
              onNavigateToMatch={handleNavigateToMatch}
            />
          )}

          {activeTab === 'classificacao' && (
            <StandingsArtilhariaView categoriaId={selectedCategoriaId} />
          )}

          {activeTab === 'times' && (
            <TeamsPlayersView categoriaId={selectedCategoriaId} />
          )}

          {activeTab === 'regras' && (
            <SettingsView categoriaId={selectedCategoriaId} />
          )}

          {activeTab === 'sql-lab' && <SqlSchemaLabView />}
        </main>

        {/* Footer */}
        <footer className="border-t border-[#262933] bg-[#161920] py-4 text-center text-[11px] text-[#8E9299]">
          <p className="font-mono tracking-wider text-[#8E9299]">
            ARENA ROMANO CENTRO ESPORTIVO • TORNEIO SOCIETY v2.4 • SQLITE SYNC ENGINE
          </p>
        </footer>
      </div>
    </div>
  );
}
