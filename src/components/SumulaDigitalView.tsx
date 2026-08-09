/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { EventoPartida, Jogador, Partida, TipoEvento } from '../types';
import {
  getMatchDetails,
  getMatchRosters,
  getMatchEvents,
  addMatchEvent,
  deleteMatchEvent,
  updateMatchTimer,
  finalizeMatch,
} from '../services/matchService';
import { query } from '../services/db';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  Clock,
  Plus,
  Trash2,
  Award,
  AlertTriangle,
  ChevronLeft,
  X,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SumulaDigitalViewProps {
  matchId: number | null;
  categoriaId: number;
  onBack: () => void;
  onMatchFinalized: () => void;
}

export const SumulaDigitalView: React.FC<SumulaDigitalViewProps> = ({
  matchId,
  categoriaId,
  onBack,
  onMatchFinalized,
}) => {
  const [matchList, setMatchList] = useState<Partida[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(matchId);
  const [match, setMatch] = useState<Partida | null>(null);
  const [mandanteRoster, setMandanteRoster] = useState<Jogador[]>([]);
  const [visitanteRoster, setVisitanteRoster] = useState<Jogador[]>([]);
  const [events, setEvents] = useState<EventoPartida[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<{ player: Jogador; teamId: number } | null>(null);

  // Timer states
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [period, setPeriod] = useState<'1T' | 'INTERVALO' | '2T' | 'FINALIZADO'>('1T');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Category timer duration limit in minutes
  const [categoryMinutes, setCategoryMinutes] = useState(20);

  useEffect(() => {
    loadCategoryMatches();
  }, [categoriaId]);

  useEffect(() => {
    if (selectedMatchId) {
      loadMatchData(selectedMatchId);
    }
  }, [selectedMatchId]);

  // Timer interval effect
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          // Periodically save timer every 10 seconds
          if (next % 10 === 0 && selectedMatchId) {
            updateMatchTimer(selectedMatchId, next, 'EM_ANDAMENTO');
          }
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, selectedMatchId]);

  const loadCategoryMatches = async () => {
    const list = await query<Partida>(
      `SELECT 
         p.*,
         f.nome as fase_nome,
         tm.nome as time_mandante_nome, tm.cor_hex as time_mandante_cor,
         tv.nome as time_visitante_nome, tv.cor_hex as time_visitante_cor
       FROM partidas p
       JOIN fases f ON p.fase_id = f.id
       JOIN times tm ON p.time_mandante_id = tm.id
       JOIN times tv ON p.time_visitante_id = tv.id
       WHERE p.categoria_id = ?
       ORDER BY p.id DESC;`,
      [categoriaId]
    );
    setMatchList(list);

    if (!selectedMatchId && list.length > 0) {
      setSelectedMatchId(list[0].id);
    }
  };

  const loadMatchData = async (mId: number) => {
    const details = await getMatchDetails(mId);
    if (!details) return;

    setMatch(details);
    setElapsedSeconds(details.tempo_decorrido_segundos || 0);
    setIsRunning(details.status === 'EM_ANDAMENTO');

    // Load Category time limit
    const cfg = await query<{ tempo_jogo_minutos: number }>(
      'SELECT tempo_jogo_minutos FROM configuracoes_categoria WHERE categoria_id = ?;',
      [details.categoria_id]
    );
    if (cfg[0]) {
      setCategoryMinutes(cfg[0].tempo_jogo_minutos);
    }

    const rosters = await getMatchRosters(mId, details.time_mandante_id, details.time_visitante_id);
    setMandanteRoster(rosters.mandante);
    setVisitanteRoster(rosters.visitante);

    const evs = await getMatchEvents(mId);
    setEvents(evs);
  };

  const handleToggleTimer = async () => {
    if (!match) return;
    const nextRunning = !isRunning;
    setIsRunning(nextRunning);
    const nextStatus = nextRunning ? 'EM_ANDAMENTO' : match.status === 'FINALIZADO' ? 'FINALIZADO' : 'AGENDADO';
    await updateMatchTimer(match.id, elapsedSeconds, nextStatus);
    setMatch((prev) => (prev ? { ...prev, status: nextStatus } : null));
  };

  const handleResetTimer = async () => {
    if (!match) return;
    setIsRunning(false);
    setElapsedSeconds(0);
    await updateMatchTimer(match.id, 0, match.status);
  };

  const handleAddExtraMinutes = (mins: number) => {
    setElapsedSeconds((prev) => Math.max(0, prev + mins * 60));
  };

  const handleRegisterEvent = async (type: TipoEvento) => {
    if (!match || !selectedPlayer) return;

    const currentMinute = Math.max(1, Math.floor(elapsedSeconds / 60));
    await addMatchEvent(match.id, selectedPlayer.teamId, selectedPlayer.player.id, type, currentMinute);

    // Refresh match details & rosters
    loadMatchData(match.id);
    setSelectedPlayer(null);

    // Confetti effect on goal
    if (type === 'GOL') {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    if (!match) return;
    await deleteMatchEvent(eventId);
    loadMatchData(match.id);
  };

  const handleFinalizeMatch = async () => {
    if (!match) return;
    if (confirm('Deseja realmente finalizar a partida? Esta ação atualizará automaticamente a classificação, artilharia e suspensões por cartão.')) {
      setIsRunning(false);
      await finalizeMatch(match.id, elapsedSeconds);
      loadMatchData(match.id);
      onMatchFinalized();
      alert('Partida finalizada com sucesso! Súmula e regras atualizadas.');
    }
  };

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (matchList.length === 0) {
    return (
      <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-10 text-center space-y-4">
        <Clock className="w-12 h-12 text-[#8E9299] mx-auto" />
        <h3 className="text-lg font-extrabold text-white uppercase tracking-wide">Nenhuma partida encontrada</h3>
        <p className="text-xs text-[#8E9299] max-w-md mx-auto">
          Você precisa gerar os jogos da categoria para operar a súmula digital em tempo real.
        </p>
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-[#00E676] hover:bg-[#00c853] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,230,118,0.3)]"
        >
          Voltar e Gerar Tabela
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Selector & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#16191F] border border-[#2D3139] p-4 rounded-2xl shadow-xl">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 bg-[#2D3139] hover:bg-[#3D424D] text-[#E0E6ED] rounded-xl transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-[10px] font-mono font-bold text-[#00E676] uppercase tracking-widest">
              Mesa Operacional / Mesário
            </span>
            <h2 className="text-lg font-black text-white uppercase tracking-tight">Súmula Digital em Tempo Real</h2>
          </div>
        </div>

        {/* Match Switcher Dropdown */}
        <div className="flex items-center space-x-2 bg-[#0F1115] p-1.5 rounded-xl border border-[#2D3139]">
          <span className="text-[10px] text-[#8E9299] font-mono uppercase tracking-wider pl-2">Partida:</span>
          <select
            value={selectedMatchId || ''}
            onChange={(e) => setSelectedMatchId(Number(e.target.value))}
            className="bg-[#16191F] text-[#00E676] text-xs font-bold font-mono rounded-lg px-3 py-2 border border-[#2D3139] focus:outline-none focus:ring-1 focus:ring-[#00E676] max-w-[220px] truncate"
          >
            {matchList.map((m) => (
              <option key={m.id} value={m.id}>
                #{m.id} - {m.time_mandante_nome} x {m.time_visitante_nome} ({m.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {match && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Scoreboard & Timer Panel (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Scoreboard Card */}
            <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-6 relative overflow-hidden shadow-2xl">
              
              {/* Match Status Badge */}
              <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] font-mono font-bold text-[#8E9299] bg-[#0F1115] px-3 py-1 rounded-full border border-[#2D3139] uppercase tracking-wider">
                  {match.fase_nome} • Rodada {match.rodada}
                </span>

                <span
                  className={`px-3 py-1 text-xs font-mono font-extrabold rounded-full border uppercase tracking-wider ${
                    match.status === 'EM_ANDAMENTO'
                      ? 'bg-[#FF1744]/20 text-[#FF1744] border-[#FF1744]/30 animate-pulse'
                      : match.status === 'FINALIZADO'
                      ? 'bg-[#00E676]/20 text-[#00E676] border-[#00E676]/30'
                      : 'bg-[#2D3139] text-[#8E9299] border-[#2D3139]'
                  }`}
                >
                  {match.status === 'EM_ANDAMENTO' ? '● Em Andamento' : match.status}
                </span>
              </div>

              {/* Teams & Score Display */}
              <div className="grid grid-cols-3 items-center text-center my-4">
                
                {/* Mandante */}
                <div className="flex flex-col items-center space-y-2">
                  <div
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg border border-white/20"
                    style={{ backgroundColor: match.time_mandante_cor || '#000' }}
                  >
                    {match.time_mandante_brasao || '🛡️'}
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-white max-w-[140px] truncate uppercase">
                    {match.time_mandante_nome}
                  </h3>
                  <span className="text-[10px] text-[#8E9299] font-mono uppercase tracking-widest">Mandante</span>
                </div>

                {/* Score Big Display */}
                <div className="flex flex-col items-center justify-center space-y-1">
                  <div className="bg-[#0F1115] px-6 py-3 rounded-2xl border border-[#2D3139] text-4xl sm:text-5xl font-mono font-black text-white tracking-widest flex items-center space-x-3 shadow-inner">
                    <span className="text-[#00E676]">{match.gols_mandante}</span>
                    <span className="text-[#2D3139] text-2xl">:</span>
                    <span className="text-[#00E676]">{match.gols_visitante}</span>
                  </div>
                  <span className="text-[10px] text-[#8E9299] font-mono mt-1">
                    Tempo limite: {categoryMinutes}min
                  </span>
                </div>

                {/* Visitante */}
                <div className="flex flex-col items-center space-y-2">
                  <div
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg border border-white/20"
                    style={{ backgroundColor: match.time_visitante_cor || '#000' }}
                  >
                    {match.time_visitante_brasao || '🛡️'}
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-white max-w-[140px] truncate uppercase">
                    {match.time_visitante_nome}
                  </h3>
                  <span className="text-[10px] text-[#8E9299] font-mono uppercase tracking-widest">Visitante</span>
                </div>
              </div>

              {/* Live Digital Timer Bar */}
              <div className="mt-8 bg-[#0F1115] border border-[#2D3139] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                
                {/* Digital Clock display */}
                <div className="flex items-center space-x-3">
                  <Clock className={`w-6 h-6 ${isRunning ? 'text-[#FF1744] animate-spin' : 'text-[#8E9299]'}`} />
                  <div>
                    <span className="text-3xl font-black font-mono text-white tracking-wider">
                      {formatTimer(elapsedSeconds)}
                    </span>
                    <span className="text-xs text-[#8E9299] font-mono ml-2 font-bold">({period})</span>
                  </div>
                </div>

                {/* Timer Controls */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleToggleTimer}
                    className={`px-4 py-2 rounded-xl text-xs font-mono font-extrabold uppercase tracking-wider flex items-center space-x-2 transition-all ${
                      isRunning
                        ? 'bg-[#FFC400] hover:bg-[#e6b000] text-black shadow-[0_0_15px_rgba(255,196,0,0.3)]'
                        : 'bg-[#00E676] hover:bg-[#00c853] text-black shadow-[0_0_15px_rgba(0,230,118,0.3)]'
                    }`}
                  >
                    {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>{isRunning ? 'Pausar' : 'Iniciar / Retomar'}</span>
                  </button>

                  <button
                    onClick={() => handleAddExtraMinutes(1)}
                    className="px-3 py-2 bg-[#2D3139] hover:bg-[#3D424D] text-[#E0E6ED] rounded-xl text-xs font-mono font-bold"
                  >
                    +1min
                  </button>

                  <button
                    onClick={handleResetTimer}
                    title="Zerar Cronômetro"
                    className="p-2 bg-[#2D3139] hover:bg-[#3D424D] text-[#8E9299] hover:text-white rounded-xl"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Action: Finalize Match Button */}
              {match.status !== 'FINALIZADO' && (
                <button
                  onClick={handleFinalizeMatch}
                  className="mt-6 w-full py-3.5 bg-[#00E676] hover:bg-[#00c853] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(0,230,118,0.3)] transition-all flex items-center justify-center space-x-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Finalizar Partida e Processar Regras / Suspensões</span>
                </button>
              )}
            </div>

            {/* Rosters & Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Mandante Roster */}
              <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-4 space-y-3">
                <div className="flex items-center space-x-2 pb-2 border-b border-[#2D3139]">
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white/20"
                    style={{ backgroundColor: match.time_mandante_cor }}
                  />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider truncate">{match.time_mandante_nome}</h4>
                </div>

                <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                  {mandanteRoster.map((player) => (
                    <div
                      key={player.id}
                      onClick={() => setSelectedPlayer({ player, teamId: match.time_mandante_id })}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        selectedPlayer?.player.id === player.id
                          ? 'bg-[#00E676]/20 border-[#00E676] text-white shadow-[0_0_10px_rgba(0,230,118,0.2)]'
                          : 'bg-[#0F1115] border-[#2D3139] hover:border-[#3D424D] text-[#E0E6ED]'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 bg-[#2D3139] text-[#00E676] font-mono font-bold text-[10px] rounded flex items-center justify-center">
                          {player.camisa_posicao}
                        </span>
                        <span className="text-xs font-semibold text-white truncate max-w-[120px] sm:max-w-[140px]">
                          {player.nome}
                        </span>
                      </div>

                      {/* Stats Pills */}
                      <div className="flex items-center space-x-1">
                        {player.gols! > 0 && (
                          <span className="text-[10px] bg-[#00E676]/20 text-[#00E676] font-mono font-bold px-1.5 py-0.5 rounded border border-[#00E676]/30">
                            ⚽ {player.gols}
                          </span>
                        )}
                        {player.cartoes_amarelos! > 0 && (
                          <span className="text-[10px] bg-[#FFC400]/20 text-[#FFC400] font-mono font-bold px-1.5 py-0.5 rounded border border-[#FFC400]/30">
                            🟨 {player.cartoes_amarelos}
                          </span>
                        )}
                        {player.cartoes_vermelhos! > 0 && (
                          <span className="text-[10px] bg-[#FF1744]/20 text-[#FF1744] font-mono font-bold px-1.5 py-0.5 rounded border border-[#FF1744]/30">
                            🟥 {player.cartoes_vermelhos}
                          </span>
                        )}
                        {player.destaques! > 0 && (
                          <span className="text-[10px] bg-purple-500/20 text-purple-400 font-bold px-1.5 py-0.5 rounded border border-purple-500/30">
                            ⭐
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visitante Roster */}
              <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-4 space-y-3">
                <div className="flex items-center space-x-2 pb-2 border-b border-[#2D3139]">
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white/20"
                    style={{ backgroundColor: match.time_visitante_cor }}
                  />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider truncate">{match.time_visitante_nome}</h4>
                </div>

                <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                  {visitanteRoster.map((player) => (
                    <div
                      key={player.id}
                      onClick={() => setSelectedPlayer({ player, teamId: match.time_visitante_id })}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        selectedPlayer?.player.id === player.id
                          ? 'bg-[#00E676]/20 border-[#00E676] text-white shadow-[0_0_10px_rgba(0,230,118,0.2)]'
                          : 'bg-[#0F1115] border-[#2D3139] hover:border-[#3D424D] text-[#E0E6ED]'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 bg-[#2D3139] text-[#00E676] font-mono font-bold text-[10px] rounded flex items-center justify-center">
                          {player.camisa_posicao}
                        </span>
                        <span className="text-xs font-semibold text-white truncate max-w-[120px] sm:max-w-[140px]">
                          {player.nome}
                        </span>
                      </div>

                      {/* Stats Pills */}
                      <div className="flex items-center space-x-1">
                        {player.gols! > 0 && (
                          <span className="text-[10px] bg-[#00E676]/20 text-[#00E676] font-mono font-bold px-1.5 py-0.5 rounded border border-[#00E676]/30">
                            ⚽ {player.gols}
                          </span>
                        )}
                        {player.cartoes_amarelos! > 0 && (
                          <span className="text-[10px] bg-[#FFC400]/20 text-[#FFC400] font-mono font-bold px-1.5 py-0.5 rounded border border-[#FFC400]/30">
                            🟨 {player.cartoes_amarelos}
                          </span>
                        )}
                        {player.cartoes_vermelhos! > 0 && (
                          <span className="text-[10px] bg-[#FF1744]/20 text-[#FF1744] font-mono font-bold px-1.5 py-0.5 rounded border border-[#FF1744]/30">
                            🟥 {player.cartoes_vermelhos}
                          </span>
                        )}
                        {player.destaques! > 0 && (
                          <span className="text-[10px] bg-purple-500/20 text-purple-400 font-bold px-1.5 py-0.5 rounded border border-purple-500/30">
                            ⭐
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Right Sidebar: Quick Event Action Drawer & Match Timeline */}
          <div className="space-y-6">
            
            {/* Quick Action Box for Selected Player */}
            <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#2D3139]">
                <h3 className="text-xs font-bold text-[#8E9299] uppercase tracking-widest flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-[#00E676]" />
                  <span>Ação Rápida de Campo</span>
                </h3>
                {selectedPlayer && (
                  <button
                    onClick={() => setSelectedPlayer(null)}
                    className="text-[10px] text-[#8E9299] hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {!selectedPlayer ? (
                <div className="bg-[#0F1115] p-6 rounded-xl border border-[#2D3139] text-center">
                  <p className="text-xs text-[#8E9299]">
                    Clique em um jogador na lista para lançar gol ou cartão na súmula.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-[#0F1115] p-3 rounded-xl border border-[#2D3139] flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">{selectedPlayer.player.nome}</p>
                      <p className="text-[10px] text-[#8E9299] font-mono">Posição: Pote #{selectedPlayer.player.camisa_posicao}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-[#00E676]/20 text-[#00E676] text-[10px] font-mono font-bold rounded">
                      Selecionado
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Gol */}
                    <button
                      onClick={() => handleRegisterEvent('GOL')}
                      className="p-3 bg-[#00E676]/20 hover:bg-[#00E676] text-[#00E676] hover:text-black border border-[#00E676]/40 rounded-xl text-xs font-bold flex flex-col items-center space-y-1 transition-all uppercase tracking-wider"
                    >
                      <span className="text-lg">⚽</span>
                      <span>+ Gol</span>
                    </button>

                    {/* Cartão Amarelo */}
                    <button
                      onClick={() => handleRegisterEvent('CARTAO_AMARELO')}
                      className="p-3 bg-[#FFC400]/20 hover:bg-[#FFC400] text-[#FFC400] hover:text-black border border-[#FFC400]/40 rounded-xl text-xs font-bold flex flex-col items-center space-y-1 transition-all uppercase tracking-wider"
                    >
                      <span className="text-lg">🟨</span>
                      <span>Cartão Amarelo</span>
                    </button>

                    {/* Cartão Vermelho */}
                    <button
                      onClick={() => handleRegisterEvent('CARTAO_VERMELHO')}
                      className="p-3 bg-[#FF1744]/20 hover:bg-[#FF1744] text-[#FF1744] hover:text-white border border-[#FF1744]/40 rounded-xl text-xs font-bold flex flex-col items-center space-y-1 transition-all uppercase tracking-wider"
                    >
                      <span className="text-lg">🟥</span>
                      <span>Cartão Vermelho</span>
                    </button>

                    {/* Destaque */}
                    <button
                      onClick={() => handleRegisterEvent('DESTAQUE')}
                      className="p-3 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 rounded-xl text-xs font-bold flex flex-col items-center space-y-1 transition-all uppercase tracking-wider"
                    >
                      <span className="text-lg">⭐</span>
                      <span>Craque do Jogo</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Event Log Timeline */}
            <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-bold text-[#8E9299] uppercase tracking-widest border-b border-[#2D3139] pb-2">
                Linha do Tempo de Eventos ({events.length})
              </h3>

              {events.length === 0 ? (
                <p className="text-xs text-[#8E9299] text-center py-6">Nenhum evento registrado nesta partida.</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {events.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2.5 bg-[#0F1115] border border-[#2D3139] rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className="font-mono text-[#00E676] text-[11px] font-bold">
                          {ev.minuto_jogo}'
                        </span>
                        <div
                          className="w-2.5 h-2.5 rounded-full border border-white/20"
                          style={{ backgroundColor: ev.time_cor_hex }}
                        />
                        <div>
                          <p className="font-semibold text-white">{ev.jogador_nome}</p>
                          <p className="text-[10px] text-[#8E9299]">{ev.time_nome}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-sm">
                          {ev.tipo_evento === 'GOL' && '⚽'}
                          {ev.tipo_evento === 'CARTAO_AMARELO' && '🟨'}
                          {ev.tipo_evento === 'CARTAO_VERMELHO' && '🟥'}
                          {ev.tipo_evento === 'DESTAQUE' && '⭐'}
                        </span>
                        <button
                          onClick={() => handleDeleteEvent(ev.id)}
                          title="Excluir lançamento"
                          className="p-1 text-[#8E9299] hover:text-[#FF1744] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      )}
    </div>
  );
};
