/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Partida } from '../types';
import { generateGroupStageFixtures, generatePlayoffs } from '../services/fixtureService';
import { query } from '../services/db';
import { Calendar, Play, Trophy, Sparkles, RefreshCw, AlertCircle, ChevronRight } from 'lucide-react';

interface FixturesBracketsViewProps {
  categoriaId: number;
  onNavigateToMatch: (matchId: number) => void;
}

export const FixturesBracketsView: React.FC<FixturesBracketsViewProps> = ({
  categoriaId,
  onNavigateToMatch,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'grupos' | 'playoffs'>('grupos');
  const [matches, setMatches] = useState<Partida[]>([]);
  const [playoffMatches, setPlayoffMatches] = useState<Partida[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFixturesData();
  }, [categoriaId]);

  const loadFixturesData = async () => {
    // Group stage matches
    const gList = await query<Partida>(
      `SELECT 
         p.*,
         f.nome as fase_nome,
         tm.nome as time_mandante_nome, tm.cor_hex as time_mandante_cor, tm.brasao_path as time_mandante_brasao,
         tv.nome as time_visitante_nome, tv.cor_hex as time_visitante_cor, tv.brasao_path as time_visitante_brasao
       FROM partidas p
       JOIN fases f ON p.fase_id = f.id
       JOIN times tm ON p.time_mandante_id = tm.id
       JOIN times tv ON p.time_visitante_id = tv.id
       WHERE p.categoria_id = ? AND p.fase_id = 1
       ORDER BY p.rodada ASC, p.id ASC;`,
      [categoriaId]
    );
    setMatches(gList);

    // Playoff matches
    const pList = await query<Partida>(
      `SELECT 
         p.*,
         f.nome as fase_nome,
         tm.nome as time_mandante_nome, tm.cor_hex as time_mandante_cor, tm.brasao_path as time_mandante_brasao,
         tv.nome as time_visitante_nome, tv.cor_hex as time_visitante_cor, tv.brasao_path as time_visitante_brasao
       FROM partidas p
       JOIN fases f ON p.fase_id = f.id
       JOIN times tm ON p.time_mandante_id = tm.id
       JOIN times tv ON p.time_visitante_id = tv.id
       WHERE p.categoria_id = ? AND p.fase_id > 1
       ORDER BY p.fase_id ASC, p.id ASC;`,
      [categoriaId]
    );
    setPlayoffMatches(pList);
  };

  const handleGenerateGroupStage = async () => {
    if (confirm('Deseja realmente gerar a tabela da Fase de Grupos? Isso substituirá os jogos atuais da categoria.')) {
      try {
        setLoading(true);
        const summary = await generateGroupStageFixtures(categoriaId);
        await loadFixturesData();
        alert(`Sucesso! ${summary.total_partidas} partidas geradas em ${summary.rodadas_criadas} rodadas.`);
      } catch (e: any) {
        alert(e.message || 'Erro ao gerar jogos.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleGeneratePlayoffs = async () => {
    try {
      setLoading(true);
      await generatePlayoffs(categoriaId);
      await loadFixturesData();
      setActiveSubTab('playoffs');
      alert('Chaveamento do Mata-Mata gerado com base na classificação atual!');
    } catch (e: any) {
      alert(e.message || 'Erro ao gerar mata-mata.');
    } finally {
      setLoading(false);
    }
  };

  // Group matches by round
  const matchesByRound: Record<number, Partida[]> = {};
  matches.forEach((m) => {
    if (!matchesByRound[m.rodada]) matchesByRound[m.rodada] = [];
    matchesByRound[m.rodada].push(m);
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Controls */}
      <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-[#00E676]" />
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Gerador de Confrontos & Mata-Mata</h2>
          </div>
          <p className="text-xs text-[#8E9299] mt-1 max-w-xl">
            Criação de tabela "todos contra todos" na fase de grupos (Algoritmo de Berger) e classificação flexível para Repescagem, Quartas, Semifinal e Final.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleGenerateGroupStage}
            disabled={loading}
            className="px-4 py-2.5 bg-[#2D3139] hover:bg-[#3D424D] text-[#E0E6ED] rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center space-x-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Gerar Fase de Grupos</span>
          </button>

          <button
            onClick={handleGeneratePlayoffs}
            disabled={loading}
            className="px-5 py-2.5 bg-[#00E676] hover:bg-[#00c853] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,230,118,0.3)] transition-all flex items-center space-x-1.5"
          >
            <Trophy className="w-4 h-4" />
            <span>Gerar Mata-Mata</span>
          </button>
        </div>
      </div>

      {/* Subtab Toggle */}
      <div className="flex space-x-2 bg-[#0F1115] p-1.5 rounded-2xl border border-[#2D3139] w-fit">
        <button
          onClick={() => setActiveSubTab('grupos')}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-extrabold uppercase tracking-wider transition-all ${
            activeSubTab === 'grupos'
              ? 'bg-[#00E676] text-black shadow-[0_0_10px_rgba(0,230,118,0.3)]'
              : 'text-[#8E9299] hover:text-white'
          }`}
        >
          Fase de Grupos ({matches.length} jogos)
        </button>

        <button
          onClick={() => setActiveSubTab('playoffs')}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-extrabold uppercase tracking-wider transition-all ${
            activeSubTab === 'playoffs'
              ? 'bg-[#00E676] text-black shadow-[0_0_10px_rgba(0,230,118,0.3)]'
              : 'text-[#8E9299] hover:text-white'
          }`}
        >
          Chaveamento Mata-Mata ({playoffMatches.length} jogos)
        </button>
      </div>

      {/* Subtab Content: Fase de Grupos */}
      {activeSubTab === 'grupos' && (
        <div className="space-y-6">
          {Object.keys(matchesByRound).length === 0 ? (
            <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-10 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-[#8E9299] mx-auto" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Nenhum confronto criado na Fase de Grupos</h3>
              <p className="text-xs text-[#8E9299] max-w-md mx-auto">
                Clique no botão acima para gerar automaticamente as rodadas de todos contra todos.
              </p>
            </div>
          ) : (
            Object.entries(matchesByRound).map(([roundNum, roundMatches]) => (
              <div key={roundNum} className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#2D3139]">
                  <h3 className="text-xs font-bold text-[#00E676] font-mono uppercase tracking-widest flex items-center space-x-2">
                    <span>Rodada {roundNum}</span>
                    <span className="text-[#8E9299] font-normal text-xs">({roundMatches.length} partidas)</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {roundMatches.map((m) => (
                    <div
                      key={m.id}
                      className="bg-[#0F1115] p-4 rounded-xl border border-[#2D3139] hover:border-[#00E676]/40 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        {/* Mandante */}
                        <div className="flex items-center space-x-2 flex-1 justify-end text-right">
                          <span className="text-xs font-bold text-white truncate">{m.time_mandante_nome}</span>
                          <div
                            className="w-3.5 h-3.5 rounded-full border border-white/20 flex-shrink-0"
                            style={{ backgroundColor: m.time_mandante_cor }}
                          />
                        </div>

                        {/* Placar */}
                        <div className="bg-[#16191F] px-3 py-1 rounded-lg border border-[#2D3139] font-mono font-black text-xs text-white">
                          {m.gols_mandante} x {m.gols_visitante}
                        </div>

                        {/* Visitante */}
                        <div className="flex items-center space-x-2 flex-1 text-left">
                          <div
                            className="w-3.5 h-3.5 rounded-full border border-white/20 flex-shrink-0"
                            style={{ backgroundColor: m.time_visitante_cor }}
                          />
                          <span className="text-xs font-bold text-white truncate">{m.time_visitante_nome}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => onNavigateToMatch(m.id)}
                        className="p-2 bg-[#2D3139] hover:bg-[#00E676] text-[#E0E6ED] hover:text-black rounded-lg transition-colors"
                        title="Abrir Súmula Digital"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Subtab Content: Mata-Mata Playoffs */}
      {activeSubTab === 'playoffs' && (
        <div className="space-y-6">
          {playoffMatches.length === 0 ? (
            <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-10 text-center space-y-3">
              <Trophy className="w-10 h-10 text-[#8E9299] mx-auto" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Nenhum mata-mata gerado ainda</h3>
              <p className="text-xs text-[#8E9299] max-w-md mx-auto">
                Conclua os jogos da fase de grupos e clique em "Gerar Mata-Mata" para calcular a repescagem, quartas, semi e final.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {playoffMatches.map((m) => (
                <div key={m.id} className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#2D3139]">
                    <span className="text-xs font-mono font-bold text-[#00E676] uppercase tracking-wider">{m.fase_nome}</span>
                    <span className="text-[10px] font-mono text-[#8E9299] font-bold bg-[#0F1115] px-2 py-0.5 rounded border border-[#2D3139]">
                      {m.status}
                    </span>
                  </div>

                  <div className="bg-[#0F1115] p-4 rounded-xl border border-[#2D3139] text-center space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate max-w-[100px]">
                        {m.time_mandante_nome}
                      </span>
                      <span className="text-lg font-mono font-black text-[#00E676]">{m.gols_mandante}</span>
                    </div>

                    <div className="text-[10px] text-[#8E9299] font-mono font-bold uppercase tracking-widest">VS</div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate max-w-[100px]">
                        {m.time_visitante_nome}
                      </span>
                      <span className="text-lg font-mono font-black text-[#00E676]">{m.gols_visitante}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onNavigateToMatch(m.id)}
                    className="w-full py-2 bg-[#2D3139] hover:bg-[#00E676] text-[#E0E6ED] hover:text-black rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center space-x-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Súmula Digital</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
