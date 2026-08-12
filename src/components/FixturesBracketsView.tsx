/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Partida } from '../types';
import { generateGroupStageFixtures, generatePlayoffs } from '../services/fixtureService';
import { query } from '../services/db';
import { Calendar, Play, Trophy, Sparkles, RefreshCw, AlertCircle, ChevronRight, Layers, X, Shield } from 'lucide-react';

interface FixturesBracketsViewProps {
  categoriaId: number;
  onNavigateToMatch: (matchId: number) => void;
  onNavigateTab?: (tab: string) => void;
}

export const FixturesBracketsView: React.FC<FixturesBracketsViewProps> = ({
  categoriaId,
  onNavigateToMatch,
  onNavigateTab,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'grupos' | 'playoffs'>('grupos');
  const [matches, setMatches] = useState<Partida[]>([]);
  const [playoffMatches, setPlayoffMatches] = useState<Partida[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Draw Format State
  const [drawFormat, setDrawFormat] = useState<'UNICO' | 'DUAS_CHAVES'>('UNICO');



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
    if (gList.some((m) => m.grupo === 'B')) {
      setDrawFormat('DUAS_CHAVES');
    }

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
    setActionError(null);
    try {
      setLoading(true);
      await generateGroupStageFixtures(categoriaId, drawFormat);
      await loadFixturesData();
    } catch (e: any) {
      setActionError(e?.message || 'Erro ao gerar rodadas da fase de grupos.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePlayoffs = async () => {
    setActionError(null);
    try {
      setLoading(true);
      await generatePlayoffs(categoriaId);
      await loadFixturesData();
      setActiveSubTab('playoffs');
    } catch (e: any) {
      setActionError(e?.message || 'Erro ao gerar rodadas do mata-mata.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Check if matches belong to two groups
  const isTwoGroups = drawFormat === 'DUAS_CHAVES' || matches.some((m) => m.grupo === 'B');

  // Group matches by round for Single Group
  const matchesByRound: Record<number, Partida[]> = {};
  matches.forEach((m) => {
    if (!matchesByRound[m.rodada]) matchesByRound[m.rodada] = [];
    matchesByRound[m.rodada].push(m);
  });

  // Group matches by round for Chave A & Chave B
  const groupAMatches = matches.filter((m) => m.grupo === 'A' || !m.grupo);
  const groupBMatches = matches.filter((m) => m.grupo === 'B');

  const groupAMatchesByRound: Record<number, Partida[]> = {};
  groupAMatches.forEach((m) => {
    if (!groupAMatchesByRound[m.rodada]) groupAMatchesByRound[m.rodada] = [];
    groupAMatchesByRound[m.rodada].push(m);
  });

  const groupBMatchesByRound: Record<number, Partida[]> = {};
  groupBMatches.forEach((m) => {
    if (!groupBMatchesByRound[m.rodada]) groupBMatchesByRound[m.rodada] = [];
    groupBMatchesByRound[m.rodada].push(m);
  });

  return (
    <div className="space-y-6">
      {/* Action Error Alert Banner */}
      {actionError && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200 shadow-lg">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-300 uppercase tracking-wide">Atenção ao Gerar Confrontos</h4>
              <p className="text-xs text-amber-200/90 mt-0.5 font-mono font-semibold">{actionError}</p>
              <p className="text-[11px] text-amber-300/70 mt-1">
                Cadastre os times da categoria ou utilize o sorteio de atletas (Draft) para distribuir os jogadores nos times.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('times')}
                className="px-3.5 py-1.5 bg-[#FF6B1A] hover:bg-[#e05a0f] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all shadow-[0_0_10px_rgba(255,107,26,0.2)]"
              >
                Gerenciar Times
              </button>
            )}
            <button
              onClick={() => setActionError(null)}
              className="p-1.5 text-amber-400 hover:text-white bg-amber-500/20 hover:bg-amber-500/40 rounded-xl transition-colors"
              title="Fechar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Banner & Controls */}
      <div className="bg-[#161920] border border-[#262933] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-[#FF6B1A]" />
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Gerador de Confrontos & Mata-Mata</h2>
            </div>
            <p className="text-xs text-[#8E9299] mt-1 max-w-xl">
              Geração de tabela em formato Único (Todos contra Todos) ou Duas Chaves (Grupo A e Grupo B).
            </p>
          </div>

          <div className="flex flex-row flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleGenerateGroupStage}
              disabled={loading}
              className="px-3.5 py-2.5 bg-[#0F1115] hover:bg-[#222632] text-[#E0E6ED] border border-[#262933] rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center space-x-1.5 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Gerar Fase de Grupos</span>
            </button>

            <button
              onClick={handleGeneratePlayoffs}
              disabled={loading}
              className="px-4 py-2.5 bg-[#FF6B1A] hover:bg-[#e05a0f] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(255,107,26,0.3)] transition-all flex items-center space-x-1.5 shrink-0"
            >
              <Trophy className="w-4 h-4" />
              <span>Gerar Mata-Mata</span>
            </button>
          </div>
        </div>

        {/* Format Selector Bar */}
        <div className="pt-3 border-t border-[#262933] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <span className="font-mono text-[#8E9299] uppercase font-bold flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#FF6B1A]" />
            <span>Formato do Sorteio da Fase de Grupos:</span>
          </span>

          <div className="flex items-center space-x-2 bg-[#0F1115] p-1 rounded-xl border border-[#262933]">
            <button
              onClick={() => setDrawFormat('UNICO')}
              className={`px-3 py-1.5 rounded-lg font-mono font-bold text-[11px] uppercase transition-all ${
                drawFormat === 'UNICO'
                  ? 'bg-[#FF6B1A] text-black shadow-[0_0_10px_rgba(255,107,26,0.3)]'
                  : 'text-[#8E9299] hover:text-white'
              }`}
            >
              Chave Única (Todos vs Todos)
            </button>

            <button
              onClick={() => setDrawFormat('DUAS_CHAVES')}
              className={`px-3 py-1.5 rounded-lg font-mono font-bold text-[11px] uppercase transition-all ${
                drawFormat === 'DUAS_CHAVES'
                  ? 'bg-[#FF6B1A] text-black shadow-[0_0_10px_rgba(255,107,26,0.3)]'
                  : 'text-[#8E9299] hover:text-white'
              }`}
            >
              Duas Chaves (Grupo A & Grupo B)
            </button>
          </div>
        </div>
      </div>

      {/* Subtab Toggle */}
      <div className="flex overflow-x-auto scrollbar-none space-x-2 bg-[#0F1115] p-1.5 rounded-2xl border border-[#262933] w-full sm:w-fit">
        <button
          onClick={() => setActiveSubTab('grupos')}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-extrabold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
            activeSubTab === 'grupos'
              ? 'bg-[#FF6B1A] text-black shadow-[0_0_10px_rgba(255,107,26,0.3)]'
              : 'text-[#8E9299] hover:text-white'
          }`}
        >
          Fase de Grupos ({matches.length} jogos)
        </button>

        <button
          onClick={() => setActiveSubTab('playoffs')}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-extrabold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
            activeSubTab === 'playoffs'
              ? 'bg-[#FF6B1A] text-black shadow-[0_0_10px_rgba(255,107,26,0.3)]'
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
            <div className="bg-[#161920] border border-[#262933] rounded-2xl p-10 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-[#8E9299] mx-auto" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Nenhum confronto criado na Fase de Grupos</h3>
              <p className="text-xs text-[#8E9299] max-w-md mx-auto">
                Clique no botão acima para gerar automaticamente as rodadas da fase de grupos.
              </p>
            </div>
          ) : isTwoGroups ? (
            /* Duas Chaves - Layout em 2 Colunas (Chave A e Chave B) */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Coluna Chave A */}
              <div className="space-y-4">
                <div className="bg-[#161920] border-2 border-[#FF6B1A]/40 rounded-2xl p-4 flex items-center justify-between shadow-xl">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-5 h-5 text-[#FF6B1A]" />
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">CHAVE A (GRUPO A)</h3>
                  </div>
                  <span className="px-2.5 py-1 bg-[#FF6B1A]/10 text-[#FF6B1A] border border-[#FF6B1A]/30 rounded-lg text-xs font-mono font-bold">
                    {groupAMatches.length} Partidas
                  </span>
                </div>

                {Object.keys(groupAMatchesByRound).length === 0 ? (
                  <div className="bg-[#161920] border border-[#262933] rounded-2xl p-6 text-center text-xs text-[#8E9299]">
                    Nenhum confronto na Chave A.
                  </div>
                ) : (
                  Object.entries(groupAMatchesByRound).map(([roundNum, rMatches]) => (
                    <div key={roundNum} className="bg-[#161920] border border-[#262933] rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-[#262933]">
                        <h4 className="text-xs font-bold text-[#FF6B1A] font-mono uppercase tracking-wider flex items-center space-x-2">
                          <span>Rodada {roundNum}</span>
                          <span className="text-[#8E9299] text-[11px] font-normal">({rMatches.length} jogos)</span>
                        </h4>
                      </div>

                      <div className="space-y-2">
                        {rMatches.map((m) => (
                          <div
                            key={m.id}
                            className="bg-[#0F1115] p-3 rounded-xl border border-[#262933] hover:border-[#FF6B1A]/40 transition-all flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                              {/* Mandante */}
                              <div className="flex items-center space-x-1.5 flex-1 justify-end text-right min-w-0">
                                <span className="text-xs font-bold text-white truncate">{m.time_mandante_nome}</span>
                                <div
                                  className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0"
                                  style={{ backgroundColor: m.time_mandante_cor }}
                                />
                              </div>

                              {/* Placar */}
                              <div className="bg-[#161920] px-2.5 py-1 rounded-lg border border-[#262933] font-mono font-black text-xs text-white shrink-0">
                                {m.gols_mandante} x {m.gols_visitante}
                              </div>

                              {/* Visitante */}
                              <div className="flex items-center space-x-1.5 flex-1 text-left min-w-0">
                                <div
                                  className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0"
                                  style={{ backgroundColor: m.time_visitante_cor }}
                                />
                                <span className="text-xs font-bold text-white truncate">{m.time_visitante_nome}</span>
                              </div>
                            </div>

                            <button
                              onClick={() => onNavigateToMatch(m.id)}
                              className="p-1.5 bg-[#161920] hover:bg-[#FF6B1A] text-[#E0E6ED] hover:text-black border border-[#262933] hover:border-[#FF6B1A] rounded-lg transition-colors shrink-0"
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

              {/* Coluna Chave B */}
              <div className="space-y-4">
                <div className="bg-[#161920] border-2 border-[#FFC400]/40 rounded-2xl p-4 flex items-center justify-between shadow-xl">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-5 h-5 text-[#FFC400]" />
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">CHAVE B (GRUPO B)</h3>
                  </div>
                  <span className="px-2.5 py-1 bg-[#FFC400]/10 text-[#FFC400] border border-[#FFC400]/30 rounded-lg text-xs font-mono font-bold">
                    {groupBMatches.length} Partidas
                  </span>
                </div>

                {Object.keys(groupBMatchesByRound).length === 0 ? (
                  <div className="bg-[#161920] border border-[#262933] rounded-2xl p-6 text-center text-xs text-[#8E9299]">
                    Nenhum confronto na Chave B.
                  </div>
                ) : (
                  Object.entries(groupBMatchesByRound).map(([roundNum, rMatches]) => (
                    <div key={roundNum} className="bg-[#161920] border border-[#262933] rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-[#262933]">
                        <h4 className="text-xs font-bold text-[#FFC400] font-mono uppercase tracking-wider flex items-center space-x-2">
                          <span>Rodada {roundNum}</span>
                          <span className="text-[#8E9299] text-[11px] font-normal">({rMatches.length} jogos)</span>
                        </h4>
                      </div>

                      <div className="space-y-2">
                        {rMatches.map((m) => (
                          <div
                            key={m.id}
                            className="bg-[#0F1115] p-3 rounded-xl border border-[#262933] hover:border-[#FFC400]/40 transition-all flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                              {/* Mandante */}
                              <div className="flex items-center space-x-1.5 flex-1 justify-end text-right min-w-0">
                                <span className="text-xs font-bold text-white truncate">{m.time_mandante_nome}</span>
                                <div
                                  className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0"
                                  style={{ backgroundColor: m.time_mandante_cor }}
                                />
                              </div>

                              {/* Placar */}
                              <div className="bg-[#161920] px-2.5 py-1 rounded-lg border border-[#262933] font-mono font-black text-xs text-white shrink-0">
                                {m.gols_mandante} x {m.gols_visitante}
                              </div>

                              {/* Visitante */}
                              <div className="flex items-center space-x-1.5 flex-1 text-left min-w-0">
                                <div
                                  className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0"
                                  style={{ backgroundColor: m.time_visitante_cor }}
                                />
                                <span className="text-xs font-bold text-white truncate">{m.time_visitante_nome}</span>
                              </div>
                            </div>

                            <button
                              onClick={() => onNavigateToMatch(m.id)}
                              className="p-1.5 bg-[#161920] hover:bg-[#FFC400] text-[#E0E6ED] hover:text-black border border-[#262933] hover:border-[#FFC400] rounded-lg transition-colors shrink-0"
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
            </div>
          ) : (
            /* Chave Única - Layout Padrão por Rodada */
            Object.entries(matchesByRound).map(([roundNum, roundMatches]) => (
              <div key={roundNum} className="bg-[#161920] border border-[#262933] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#262933]">
                  <h3 className="text-xs font-bold text-[#FF6B1A] font-mono uppercase tracking-widest flex items-center space-x-2">
                    <span>Rodada {roundNum}</span>
                    <span className="text-[#8E9299] font-normal text-xs">({roundMatches.length} partidas)</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {roundMatches.map((m) => (
                    <div
                      key={m.id}
                      className="bg-[#0F1115] p-4 rounded-xl border border-[#262933] hover:border-[#FF6B1A]/40 transition-all flex items-center justify-between gap-3"
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
                        <div className="bg-[#161920] px-3 py-1 rounded-lg border border-[#262933] font-mono font-black text-xs text-white">
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
                        className="p-2 bg-[#161920] hover:bg-[#FF6B1A] text-[#E0E6ED] hover:text-black border border-[#262933] hover:border-[#FF6B1A] rounded-lg transition-colors"
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
            <div className="bg-[#161920] border border-[#262933] rounded-2xl p-10 text-center space-y-3">
              <Trophy className="w-10 h-10 text-[#8E9299] mx-auto" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Nenhum mata-mata gerado ainda</h3>
              <p className="text-xs text-[#8E9299] max-w-md mx-auto">
                Conclua os jogos da fase de grupos e clique em "Gerar Mata-Mata" para calcular a repescagem, quartas, semi e final.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {playoffMatches.map((m) => (
                <div key={m.id} className="bg-[#161920] border border-[#262933] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#262933]">
                    <span className="text-xs font-mono font-bold text-[#FF6B1A] uppercase tracking-wider">{m.fase_nome}</span>
                    <span className="text-[10px] font-mono text-[#8E9299] font-bold bg-[#0F1115] px-2 py-0.5 rounded border border-[#262933]">
                      {m.status}
                    </span>
                  </div>

                  <div className="bg-[#0F1115] p-4 rounded-xl border border-[#262933] text-center space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate max-w-[100px]">
                        {m.time_mandante_nome}
                      </span>
                      <span className="text-lg font-mono font-black text-[#FF6B1A]">{m.gols_mandante}</span>
                    </div>

                    <div className="text-[10px] text-[#8E9299] font-mono font-bold uppercase tracking-widest">VS</div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate max-w-[100px]">
                        {m.time_visitante_nome}
                      </span>
                      <span className="text-lg font-mono font-black text-[#FF6B1A]">{m.gols_visitante}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onNavigateToMatch(m.id)}
                    className="w-full py-2 bg-[#0F1115] hover:bg-[#FF6B1A] text-[#E0E6ED] hover:text-black border border-[#262933] hover:border-[#FF6B1A] rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center space-x-1.5"
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
