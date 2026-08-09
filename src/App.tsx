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

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<number>(1);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);

  useEffect(() => {
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

  return (
    <div className="min-h-screen bg-[#0F1115] text-[#E0E6ED] font-sans selection:bg-[#00E676] selection:text-black flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        categorias={categorias}
        selectedCategoriaId={selectedCategoriaId}
        setSelectedCategoriaId={setSelectedCategoriaId}
        onRefreshData={loadCategorias}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
        <footer className="border-t border-[#2D3139] bg-[#16191F] py-4 text-center text-[11px] text-[#8E9299]">
          <p className="font-mono tracking-wider">
            ARENA PRO MANAGER • TORNEIO SOCIETY v2.4 • SQLITE SYNC ENGINE
          </p>
        </footer>
      </div>
    </div>
  );
}
