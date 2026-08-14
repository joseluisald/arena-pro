/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Categoria } from './types';
import { query, runQuery } from './services/db';
import { syncAllMatchesScores } from './services/matchService';
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
import { LiveScoreboardView } from './components/LiveScoreboardView';
import { LoginView } from './components/LoginView';
import { Lock, Trophy } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('login');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<number>(1);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [isPublicStandaloneMode, setIsPublicStandaloneMode] = useState<boolean>(false);
  const [isTelaoStandaloneMode, setIsTelaoStandaloneMode] = useState<boolean>(false);
  
  // Admin authentication state
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('arena_romano_admin') === 'true';
  });

  useEffect(() => {
    // Check if URL specifies public mode or telao mode
    const params = new URLSearchParams(window.location.search);
    const isTelaoParam = 
      params.get('mode') === 'telao' || 
      params.get('view') === 'telao' || 
      params.get('telao') === 'true' ||
      window.location.hash.includes('telao');

    const isPublicParam = 
      params.get('mode') === 'public' || 
      params.get('view') === 'public' || 
      params.get('publico') === 'true';

    if (isTelaoParam) {
      setIsTelaoStandaloneMode(true);
      setActiveTab('telao');
    } else if (isPublicParam) {
      setIsPublicStandaloneMode(true);
      setActiveTab('publico');
    } else if (localStorage.getItem('arena_romano_admin') === 'true') {
      setActiveTab('dashboard');
    } else {
      setActiveTab('login');
    }

    loadCategorias();
    syncAllMatchesScores();
  }, []);

  const loadCategorias = async () => {
    try {
      let list = await query<Categoria>('SELECT * FROM categorias ORDER BY id ASC;');
      if (list.length === 0) {
        await runQuery("INSERT IGNORE INTO categorias (id, nome) VALUES (1, 'Livre'), (2, 'Master (35+)');");
        await runQuery(`
          INSERT IGNORE INTO configuracoes_categoria 
          (categoria_id, valor_inscricao, tempo_jogo_minutos, amarelos_para_expulsao, amarelos_acumulados_suspensao, jogos_suspensao_amarelo, jogos_suspensao_vermelho, num_titulares, num_reservas) 
          VALUES (1, 150.00, 20, 2, 3, 1, 1, 6, 4), (2, 150.00, 20, 2, 3, 1, 1, 6, 4);
        `);
        list = await query<Categoria>('SELECT * FROM categorias ORDER BY id ASC;');
      }
      setCategorias(list);
      if (list.length > 0) {
        const stillValid = list.some((c) => c.id === selectedCategoriaId);
        if (!stillValid) {
          setSelectedCategoriaId(list[0].id);
        }
      }
    } catch (e) {
      console.error('Erro ao carregar categorias:', e);
    }
  };

  const handleNavigateToMatch = (matchId: number) => {
    setSelectedMatchId(matchId);
    setActiveTab('sumula');
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
    localStorage.setItem('arena_romano_admin', 'true');
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
    setActiveTab('login');
  };

  const togglePublicMode = (enablePublic: boolean) => {
    setIsPublicStandaloneMode(enablePublic);
    if (enablePublic) {
      setActiveTab('publico');
      const url = new URL(window.location.href);
      url.searchParams.set('mode', 'public');
      window.history.replaceState({}, '', url.toString());
    } else {
      setIsPublicStandaloneMode(false);
      const url = new URL(window.location.href);
      url.searchParams.delete('mode');
      window.history.replaceState({}, '', url.toString());

      if (isAdminAuthenticated) {
        setActiveTab('dashboard');
      } else {
        setActiveTab('login');
      }
    }
  };

  // IF TELÃO STANDALONE MODE: Render only the scoreboard without admin sidebar
  if (isTelaoStandaloneMode) {
    return (
      <LiveScoreboardView
        isStandalone={true}
        categoriaId={selectedCategoriaId}
        categorias={categorias}
        onSelectCategoria={setSelectedCategoriaId}
      />
    );
  }

  // IF PUBLIC STANDALONE MODE: Render only the spectator page without admin sidebar or top header
  if (isPublicStandaloneMode) {
    return (
      <div className="min-h-screen bg-[#0F1115] text-[#E0E6ED] font-sans flex flex-col">
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

  // STANDARD LAYOUT WITH SIDEBAR
  return (
    <div className="min-h-screen bg-[#0F1115] text-[#E0E6ED] font-sans selection:bg-[#FF6B1A] selection:text-black flex flex-col lg:flex-row">
      {/* Mobile Top Header Status (Hidden on Login screen) */}
      {activeTab !== 'login' && (
        <div className="lg:hidden bg-[#161920] border-b border-[#262933] px-4 py-2 flex items-center justify-between text-xs">
          <span className="text-[#FF6B1A] font-mono font-bold uppercase text-[10px]">
            ● Arena Romano {isAdminAuthenticated ? '(Admin Autenticado)' : '(Não Autenticado)'}
          </span>
          {!isAdminAuthenticated && activeTab !== 'login' && (
            <button
              onClick={() => setActiveTab('login')}
              className="px-2.5 py-1 bg-[#FF6B1A] text-black font-mono font-black rounded-lg text-[10px] uppercase"
            >
              Entrar Admin
            </button>
          )}
        </div>
      )}

      {/* Sidebar Navigation (Hidden on Login screen) */}
      {activeTab !== 'login' && (
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          categorias={categorias}
          selectedCategoriaId={selectedCategoriaId}
          setSelectedCategoriaId={setSelectedCategoriaId}
          onRefreshData={loadCategorias}
          isAdminAuthenticated={isAdminAuthenticated}
          onOpenLoginModal={() => setActiveTab('login')}
          onLogout={handleLogout}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Unauthenticated Protection Fallback */}
          {!isAdminAuthenticated && activeTab !== 'publico' && activeTab !== 'telao' ? (
            <LoginView
              onLoginSuccess={handleAdminLoginSuccess}
              onGoToPublic={() => togglePublicMode(true)}
              isAuthenticated={isAdminAuthenticated}
              onLogout={handleLogout}
            />
          ) : (
            <>
              {activeTab === 'login' && (
                <LoginView
                  onLoginSuccess={handleAdminLoginSuccess}
                  onGoToPublic={() => togglePublicMode(true)}
                  isAuthenticated={isAdminAuthenticated}
                  onLogout={handleLogout}
                />
              )}

              {activeTab === 'publico' && (
                <PublicPortalView
                  categoriaId={selectedCategoriaId}
                  categorias={categorias}
                  onSelectCategoria={setSelectedCategoriaId}
                />
              )}

              {activeTab === 'telao' && (
                <LiveScoreboardView
                  categoriaId={selectedCategoriaId}
                  categorias={categorias}
                  onSelectCategoria={setSelectedCategoriaId}
                />
              )}

              {isAdminAuthenticated && (
                <>
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
                      onNavigateTab={setActiveTab}
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
                </>
              )}
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-[#262933] bg-[#161920] py-4 text-center text-[11px] text-[#8E9299]">
          <p className="font-mono tracking-wider text-[#8E9299]">
            ARENA ROMANO CENTRO ESPORTIVO • TORNEIO SOCIETY
          </p>
        </footer>
      </div>
    </div>
  );
}
