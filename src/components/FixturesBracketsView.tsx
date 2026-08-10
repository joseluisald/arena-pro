/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Partida, Jogador } from '../types';
import { generateGroupStageFixtures, generatePlayoffs } from '../services/fixtureService';
import { query } from '../services/db';
import { Calendar, Play, Trophy, Sparkles, RefreshCw, AlertCircle, ChevronRight, Printer, Layers, X, Shield } from 'lucide-react';

interface FixturesBracketsViewProps {
  categoriaId: number;
  onNavigateToMatch: (matchId: number) => void;
}

interface PrintableMatch extends Partida {
  mandante_jogadores?: Jogador[];
  visitante_jogadores?: Jogador[];
}

export const FixturesBracketsView: React.FC<FixturesBracketsViewProps> = ({
  categoriaId,
  onNavigateToMatch,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'grupos' | 'playoffs'>('grupos');
  const [matches, setMatches] = useState<Partida[]>([]);
  const [playoffMatches, setPlayoffMatches] = useState<Partida[]>([]);
  const [loading, setLoading] = useState(false);

  // Draw Format State
  const [drawFormat, setDrawFormat] = useState<'UNICO' | 'DUAS_CHAVES'>('UNICO');

  // Print Fixtures Modal
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printableMatches, setPrintableMatches] = useState<PrintableMatch[]>([]);
  const [loadingPrintData, setLoadingPrintData] = useState(false);

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
    try {
      setLoading(true);
      await generateGroupStageFixtures(categoriaId, drawFormat);
      await loadFixturesData();
    } catch (e: any) {
      alert(e.message || 'Erro ao gerar rodadas.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPrintModal = async () => {
    setLoadingPrintData(true);
    setShowPrintModal(true);

    try {
      const allPlayers = await query<Jogador>(
        `SELECT j.*, t.nome as time_nome FROM jogadores j JOIN times t ON j.time_id = t.id WHERE t.categoria_id = ?;`,
        [categoriaId]
      );

      const playersByTeam: Record<number, Jogador[]> = {};
      allPlayers.forEach((p) => {
        if (p.time_id) {
          if (!playersByTeam[p.time_id]) playersByTeam[p.time_id] = [];
          playersByTeam[p.time_id].push(p);
        }
      });

      const enriched: PrintableMatch[] = matches.map((m) => ({
        ...m,
        mandante_jogadores: playersByTeam[m.time_mandante_id] || [],
        visitante_jogadores: playersByTeam[m.time_visitante_id] || [],
      }));

      setPrintableMatches(enriched);
    } catch (err) {
      console.error('Erro ao carregar dados para impressão:', err);
    } finally {
      setLoadingPrintData(false);
    }
  };

  const handleGeneratePlayoffs = async () => {
    try {
      setLoading(true);
      await generatePlayoffs(categoriaId);
      await loadFixturesData();
      setActiveSubTab('playoffs');
    } catch (e: any) {
      console.error(e);
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
      {/* Top Banner & Controls */}
      <div className="bg-[#161920] border border-[#262933] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-[#FF6B1A]" />
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Gerador de Confrontos & Mata-Mata</h2>
            </div>
            <p className="text-xs text-[#8E9299] mt-1 max-w-xl">
              Geração de tabela em formato Único (Todos contra Todos) ou Duas Chaves (Grupo A e Grupo B) com impressão detalhada das escalações.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenPrintModal}
              className="px-4 py-2.5 bg-[#0F1115] hover:bg-[#222632] text-[#FF6B1A] border border-[#262933] hover:border-[#FF6B1A]/40 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center space-x-1.5"
            >
              <Printer className="w-4 h-4 text-[#FF6B1A]" />
              <span>Imprimir Confrontos</span>
            </button>

            <button
              onClick={handleGenerateGroupStage}
              disabled={loading}
              className="px-4 py-2.5 bg-[#0F1115] hover:bg-[#222632] text-[#E0E6ED] border border-[#262933] rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center space-x-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Gerar Fase de Grupos</span>
            </button>

            <button
              onClick={handleGeneratePlayoffs}
              disabled={loading}
              className="px-5 py-2.5 bg-[#FF6B1A] hover:bg-[#e05a0f] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(255,107,26,0.3)] transition-all flex items-center space-x-1.5"
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
                Clique no botão acima para gerar automaticamente as rodadas de todos contra todos.
              </p>
            </div>
          ) : (
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
      {/* Modal Impressão de Confrontos */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-2 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static print:block">
          <div className="bg-[#161920] border border-[#262933] rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl print:max-h-none print:overflow-visible print:border-none print:shadow-none print:p-0 print:bg-white print:text-black">
            {/* Modal Header (Non-printable controls) */}
            <div className="flex items-center justify-between border-b border-[#262933] pb-4 print:hidden">
              <div className="flex items-center space-x-2">
                <Printer className="w-5 h-5 text-[#FF6B1A]" />
                <h3 className="text-base font-black text-white uppercase tracking-tight">Tabela de Confrontos & Escalações</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-[#FF6B1A] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(255,107,26,0.3)] flex items-center space-x-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Folha</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 text-[#8E9299] hover:text-white bg-[#0F1115] border border-[#262933] rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loadingPrintData ? (
              <div className="p-12 text-center text-xs font-mono text-[#8E9299] animate-pulse">
                Carregando escalações completas para impressão...
              </div>
            ) : (
              <div className="space-y-8 print:space-y-6">
                {/* Print Sheet Banner */}
                <div className="text-center border-b border-[#262933] pb-4 print:border-black print:pb-2">
                  <div className="flex items-center justify-center space-x-2 mb-1">
                    <Shield className="w-6 h-6 text-[#FF6B1A] print:text-black" />
                    <h1 className="text-2xl font-black text-white uppercase tracking-tight print:text-black">ARENA ROMANO SOCIETY</h1>
                  </div>
                  <h2 className="text-sm font-bold text-[#FF6B1A] uppercase tracking-widest font-mono print:text-black">
                    RELATÓRIO OFICIAL DE CONFRONTOS & ESCALAÇÕES DOS TIMES
                  </h2>
                </div>

                {/* Fixtures List for Print */}
                {printableMatches.length === 0 ? (
                  <p className="text-center text-xs text-[#8E9299] py-8 font-mono">Nenhum confronto disponível para impressão.</p>
                ) : (
                  printableMatches.map((m, index) => (
                    <div
                      key={m.id}
                      className="bg-[#0F1115] border border-[#262933] rounded-2xl p-5 space-y-4 print:bg-white print:border-2 print:border-black print:rounded-none print:p-4 print:break-inside-avoid"
                    >
                      {/* Match Info Bar */}
                      <div className="flex items-center justify-between border-b border-[#262933] pb-2 print:border-black">
                        <span className="text-xs font-black font-mono text-[#FF6B1A] uppercase tracking-wider print:text-black">
                          Jogo #{index + 1} — Rodada {m.rodada} {m.grupo ? `(Chave / Grupo ${m.grupo})` : ''}
                        </span>
                        <span className="text-[10px] font-mono text-[#8E9299] print:text-black font-bold">
                          Data/Hora: {m.data_hora ? new Date(m.data_hora).toLocaleString('pt-BR') : 'A Definir'}
                        </span>
                      </div>

                      {/* Side by side Teams & Players */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Mandante */}
                        <div className="border-r border-[#262933] pr-4 print:border-black space-y-2">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-xl">{m.time_mandante_brasao || '🛡️'}</span>
                            <span className="text-sm font-black text-white uppercase print:text-black">{m.time_mandante_nome}</span>
                            <span className="text-[10px] font-mono text-[#8E9299] print:text-black font-bold">(Mandante)</span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-mono font-bold uppercase text-[#8E9299] print:text-black">Atletas Inscritos:</span>
                            {m.mandante_jogadores && m.mandante_jogadores.length > 0 ? (
                              <ul className="text-xs font-mono text-[#E0E6ED] print:text-black space-y-1">
                                {m.mandante_jogadores.map((j) => (
                                  <li key={j.id} className="flex items-center justify-between bg-[#161920] px-2 py-1 rounded print:bg-gray-100">
                                    <span className="font-semibold">{j.nome}</span>
                                    <span className="text-[10px] text-[#8E9299] print:text-black">Pote #{j.camisa_posicao}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-[11px] text-[#8E9299] italic">Nenhum jogador cadastrado neste time.</p>
                            )}
                          </div>
                        </div>

                        {/* Visitante */}
                        <div className="space-y-2 pl-2">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-xl">{m.time_visitante_brasao || '🛡️'}</span>
                            <span className="text-sm font-black text-white uppercase print:text-black">{m.time_visitante_nome}</span>
                            <span className="text-[10px] font-mono text-[#8E9299] print:text-black font-bold">(Visitante)</span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-mono font-bold uppercase text-[#8E9299] print:text-black">Atletas Inscritos:</span>
                            {m.visitante_jogadores && m.visitante_jogadores.length > 0 ? (
                              <ul className="text-xs font-mono text-[#E0E6ED] print:text-black space-y-1">
                                {m.visitante_jogadores.map((j) => (
                                  <li key={j.id} className="flex items-center justify-between bg-[#161920] px-2 py-1 rounded print:bg-gray-100">
                                    <span className="font-semibold">{j.nome}</span>
                                    <span className="text-[10px] text-[#8E9299] print:text-black">Pote #{j.camisa_posicao}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-[11px] text-[#8E9299] italic">Nenhum jogador cadastrado neste time.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
