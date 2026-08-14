/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { EventoPartida, Jogador, Partida, TipoEvento } from '../types';
import { TeamBadge } from './TeamBadge';
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
import { realtimeService } from '../services/realtime';
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
  Tv,
  ExternalLink,
  Share2,
  Check,
  Radio
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

  // State for copying telão link
  const [copiedTelaoLink, setCopiedTelaoLink] = useState(false);

  const handleOpenTelaoNewTab = () => {
    const origin = window.location.origin;
    window.open(`${origin}/?mode=telao`, '_blank');
  };

  const handleCopyTelaoLink = () => {
    const origin = window.location.origin;
    navigator.clipboard.writeText(`${origin}/?mode=telao`).then(() => {
      setCopiedTelaoLink(true);
      setTimeout(() => setCopiedTelaoLink(false), 3000);
    });
  };

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
          // Broadcast to real-time WebSocket every second
          if (selectedMatchId) {
            realtimeService.broadcastTimer(selectedMatchId, next, true, period, categoriaId);
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
  }, [isRunning, selectedMatchId, period, categoriaId]);

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

    // Broadcast match status update to all connected screens (Telão / Torcedor)
    realtimeService.send('MATCH_UPDATE', {
      matchId: match.id,
      categoriaId: match.categoria_id,
      categoriaNome: match.categoria_nome,
      status: nextStatus,
      isRunning: nextRunning,
      elapsedSeconds,
      period,
      timeMandanteNome: match.time_mandante_nome,
      timeVisitanteNome: match.time_visitante_nome
    });

    // Broadcast timer toggle immediately
    realtimeService.broadcastTimer(match.id, elapsedSeconds, nextRunning, period, match.categoria_id || categoriaId);
  };

  const handleResetTimer = async () => {
    if (!match) return;
    setIsRunning(false);
    setElapsedSeconds(0);
    await updateMatchTimer(match.id, 0, match.status);
    realtimeService.broadcastTimer(match.id, 0, false, period, categoriaId);
  };

  const handleAddExtraMinutes = (mins: number) => {
    setElapsedSeconds((prev) => {
      const next = Math.max(0, prev + mins * 60);
      if (match) {
        realtimeService.broadcastTimer(match.id, next, isRunning, period, categoriaId);
      }
      return next;
    });
  };

  const handleRegisterEvent = async (type: TipoEvento) => {
    if (!match || !selectedPlayer) return;

    const currentMinute = Math.max(1, Math.floor(elapsedSeconds / 60));
    await addMatchEvent(match.id, selectedPlayer.teamId, selectedPlayer.player.id, type, currentMinute);

    // Refresh match details, rosters & match list
    await loadMatchData(match.id);
    await loadCategoryMatches();

    // Broadcast new event to real-time viewers
    const updatedDetails = await getMatchDetails(match.id);
    realtimeService.broadcastEvent(match.id, {
      tipo_evento: type,
      jogador_nome: selectedPlayer.player.nome,
      time_nome: selectedPlayer.teamId === match.time_mandante_id ? match.time_mandante_nome : match.time_visitante_nome,
      minuto_jogo: currentMinute
    }, {
      scoreMandante: updatedDetails?.gols_mandante || 0,
      scoreVisitante: updatedDetails?.gols_visitante || 0
    });

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
    await loadMatchData(match.id);
    await loadCategoryMatches();

    const updatedDetails = await getMatchDetails(match.id);
    realtimeService.send('MATCH_EVENT_DELETED', {
      matchId: match.id,
      eventId,
      scoreMandante: updatedDetails?.gols_mandante || 0,
      scoreVisitante: updatedDetails?.gols_visitante || 0,
    });
  };

  // Finalize Match modal & status states
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [isFinalizingLoading, setIsFinalizingLoading] = useState(false);
  const [finalizeSuccessMessage, setFinalizeSuccessMessage] = useState<string | null>(null);

  const handleFinalizeMatch = () => {
    if (!match) return;
    setIsFinalizeModalOpen(true);
  };

  const confirmAndFinalizeMatch = async () => {
    if (!match) return;
    try {
      setIsFinalizingLoading(true);
      setIsRunning(false);
      await finalizeMatch(match.id, elapsedSeconds);
      await loadMatchData(match.id);

      realtimeService.broadcastMatchFinalized(match.id, {
        mandante: match.gols_mandante,
        visitante: match.gols_visitante
      });

      onMatchFinalized();
      setIsFinalizeModalOpen(false);
      setFinalizeSuccessMessage('Partida finalizada com sucesso! A classificação da categoria, artilharia e suspensões por cartão foram reprocessadas e salvas.');

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.5 },
      });
    } catch (err: any) {
      console.error('Erro ao finalizar partida:', err);
    } finally {
      setIsFinalizingLoading(false);
    }
  };

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (matchList.length === 0) {
    return (
      <div className="bg-[#161920] border border-[#262933] rounded-2xl p-10 text-center space-y-4">
        <Clock className="w-12 h-12 text-[#8E9299] mx-auto" />
        <h3 className="text-lg font-extrabold text-white uppercase tracking-wide">Nenhuma partida encontrada</h3>
        <p className="text-xs text-[#8E9299] max-w-md mx-auto">
          Você precisa gerar os jogos da categoria para operar a súmula digital em tempo real.
        </p>
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-[#FF6B1A] hover:bg-[#e05a0f] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(255,107,26,0.3)]"
        >
          Voltar e Gerar Tabela
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Notification Banner */}
      {finalizeSuccessMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs text-emerald-400 font-mono space-x-3">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>{finalizeSuccessMessage}</span>
          </div>
          <button
            onClick={() => setFinalizeSuccessMessage(null)}
            className="p-1 hover:bg-emerald-500/20 rounded-lg text-emerald-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#161920] border border-[#262933] p-4 rounded-2xl shadow-xl no-print">
        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={onBack}
            className="p-2 bg-[#0F1115] hover:bg-[#222632] text-[#E0E6ED] border border-[#262933] rounded-xl transition-colors shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-[10px] font-mono font-bold text-[#FF6B1A] uppercase tracking-widest">
              Mesa Operacional / Mesário
            </span>
            <h2 className="text-lg font-black text-white uppercase tracking-tight">Súmula Digital em Tempo Real</h2>
          </div>
        </div>

        <div className="flex flex-row flex-wrap items-center gap-2">
          {/* Realtime Live Indicator */}
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-[10px] font-mono font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>AO VIVO WEBSOCKET</span>
          </div>

          {/* Match Switcher Dropdown */}
          <div className="flex items-center space-x-2 bg-[#0F1115] p-1.5 rounded-xl border border-[#262933] shrink-0">
            <span className="text-[10px] text-[#8E9299] font-mono uppercase tracking-wider pl-2">Partida:</span>
            <select
              value={selectedMatchId || ''}
              onChange={(e) => setSelectedMatchId(Number(e.target.value))}
              className="bg-[#161920] text-[#FF6B1A] text-xs font-bold font-mono rounded-lg px-3 py-2 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A] max-w-[200px] truncate"
            >
              {matchList.map((m) => (
                <option key={m.id} value={m.id}>
                  #{m.id} - {m.time_mandante_nome} x {m.time_visitante_nome} ({m.status})
                </option>
              ))}
            </select>
          </div>

          {/* Open Telão in new tab */}
          <button
            onClick={handleOpenTelaoNewTab}
            className="px-3 py-2 bg-[#FF6B1A] hover:bg-[#FF8533] text-black font-extrabold rounded-xl text-xs flex items-center space-x-1.5 shadow-[0_0_15px_rgba(255,107,26,0.25)] transition-all"
            title="Abrir Telão ao Vivo em Nova Aba para projetar no 2º monitor, TV ou telão LED"
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Abrir Telão (TV / 2º PC)</span>
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
          </button>

          {/* Copy Telão Link for other PC */}
          <button
            onClick={handleCopyTelaoLink}
            className="px-3 py-2 bg-[#0F1115] hover:bg-[#1C202A] text-white border border-[#262933] hover:border-[#FF6B1A]/40 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 transition-all"
            title="Copiar link do Telão para abrir em outro computador ou celular"
          >
            {copiedTelaoLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-[#FF6B1A]" />}
            <span>{copiedTelaoLink ? 'Link Copiado!' : 'Copiar Link Telão'}</span>
          </button>
        </div>
      </div>

      {match && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
          
          {/* Main Scoreboard & Timer Panel (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Scoreboard Card */}
            <div className="bg-[#161920] border border-[#262933] rounded-2xl p-6 relative overflow-hidden shadow-2xl">
              
              {/* Match Status Badge */}
              <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] font-mono font-bold text-[#8E9299] bg-[#0F1115] px-3 py-1 rounded-full border border-[#262933] uppercase tracking-wider">
                  {match.fase_nome} • Rodada {match.rodada}
                </span>

                <span
                  className={`px-3 py-1 text-xs font-mono font-extrabold rounded-full border uppercase tracking-wider ${
                    match.status === 'EM_ANDAMENTO'
                      ? 'bg-[#FF1744]/20 text-[#FF1744] border-[#FF1744]/30 animate-pulse'
                      : match.status === 'FINALIZADO'
                      ? 'bg-[#FF6B1A]/20 text-[#FF6B1A] border-[#FF6B1A]/30'
                      : 'bg-[#0F1115] text-[#8E9299] border-[#262933]'
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
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg border border-white/20 overflow-hidden"
                    style={{ backgroundColor: match.time_mandante_cor || '#000' }}
                  >
                    <TeamBadge badge={match.time_mandante_brasao} name={match.time_mandante_nome} className="w-14 h-14 sm:w-16 sm:h-16" />
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-white max-w-[140px] truncate uppercase">
                    {match.time_mandante_nome}
                  </h3>
                  <span className="text-[10px] text-[#8E9299] font-mono uppercase tracking-widest">Mandante</span>
                </div>

                {/* Score Big Display */}
                <div className="flex flex-col items-center justify-center space-y-1">
                  <div className="bg-[#0F1115] px-6 py-3 rounded-2xl border border-[#262933] text-4xl sm:text-5xl font-mono font-black text-white tracking-widest flex items-center space-x-3 shadow-inner">
                    <span className="text-[#FF6B1A]">{match.gols_mandante}</span>
                    <span className="text-[#262933] text-2xl">:</span>
                    <span className="text-[#FF6B1A]">{match.gols_visitante}</span>
                  </div>
                  <span className="text-[10px] text-[#8E9299] font-mono mt-1">
                    Tempo limite: {categoryMinutes}min
                  </span>
                </div>

                {/* Visitante */}
                <div className="flex flex-col items-center space-y-2">
                  <div
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg border border-white/20 overflow-hidden"
                    style={{ backgroundColor: match.time_visitante_cor || '#000' }}
                  >
                    <TeamBadge badge={match.time_visitante_brasao} name={match.time_visitante_nome} className="w-14 h-14 sm:w-16 sm:h-16" />
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-white max-w-[140px] truncate uppercase">
                    {match.time_visitante_nome}
                  </h3>
                  <span className="text-[10px] text-[#8E9299] font-mono uppercase tracking-widest">Visitante</span>
                </div>
              </div>

              {/* Live Digital Timer Bar */}
              <div className="mt-8 bg-[#0F1115] border border-[#262933] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                
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
                        : 'bg-[#FF6B1A] hover:bg-[#e05a0f] text-black shadow-[0_0_15px_rgba(255,107,26,0.3)]'
                    }`}
                  >
                    {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>{isRunning ? 'Pausar' : 'Iniciar / Retomar'}</span>
                  </button>

                  <button
                    onClick={() => handleAddExtraMinutes(1)}
                    className="px-3 py-2 bg-[#161920] hover:bg-[#222632] text-[#E0E6ED] border border-[#262933] rounded-xl text-xs font-mono font-bold"
                  >
                    +1min
                  </button>

                  <button
                    onClick={handleResetTimer}
                    title="Zerar Cronômetro"
                    className="p-2 bg-[#161920] hover:bg-[#222632] text-[#8E9299] hover:text-white border border-[#262933] rounded-xl"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Action: Finalize Match Button */}
              {match.status !== 'FINALIZADO' && (
                <button
                  onClick={handleFinalizeMatch}
                  className="mt-6 w-full py-3.5 bg-[#FF6B1A] hover:bg-[#e05a0f] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(255,107,26,0.3)] transition-all flex items-center justify-center space-x-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Finalizar Partida e Processar Regras / Suspensões</span>
                </button>
              )}
            </div>

            {/* Rosters & Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Mandante Roster */}
              <div className="bg-[#161920] border border-[#262933] rounded-2xl p-4 space-y-3">
                <div className="flex items-center space-x-2 pb-2 border-b border-[#262933]">
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
                          ? 'bg-[#FF6B1A]/20 border-[#FF6B1A] text-white shadow-[0_0_10px_rgba(255,107,26,0.2)]'
                          : 'bg-[#0F1115] border-[#262933] hover:border-[#FF6B1A]/40 text-[#E0E6ED]'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 bg-[#161920] text-[#FF6B1A] font-mono font-bold text-[10px] rounded flex items-center justify-center border border-[#262933]">
                          {player.camisa_posicao}
                        </span>
                        <span className="text-xs font-semibold text-white truncate max-w-[120px] sm:max-w-[140px]">
                          {player.nome}
                        </span>
                      </div>

                      {/* Stats Pills */}
                      <div className="flex items-center space-x-1">
                        {player.gols! > 0 && (
                          <span className="text-[10px] bg-[#FF6B1A]/20 text-[#FF6B1A] font-mono font-bold px-1.5 py-0.5 rounded border border-[#FF6B1A]/30">
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
              <div className="bg-[#161920] border border-[#262933] rounded-2xl p-4 space-y-3">
                <div className="flex items-center space-x-2 pb-2 border-b border-[#262933]">
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
                          ? 'bg-[#FF6B1A]/20 border-[#FF6B1A] text-white shadow-[0_0_10px_rgba(255,107,26,0.2)]'
                          : 'bg-[#0F1115] border-[#262933] hover:border-[#FF6B1A]/40 text-[#E0E6ED]'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 bg-[#161920] text-[#FF6B1A] font-mono font-bold text-[10px] rounded flex items-center justify-center border border-[#262933]">
                          {player.camisa_posicao}
                        </span>
                        <span className="text-xs font-semibold text-white truncate max-w-[120px] sm:max-w-[140px]">
                          {player.nome}
                        </span>
                      </div>

                      {/* Stats Pills */}
                      <div className="flex items-center space-x-1">
                        {player.gols! > 0 && (
                          <span className="text-[10px] bg-[#FF6B1A]/20 text-[#FF6B1A] font-mono font-bold px-1.5 py-0.5 rounded border border-[#FF6B1A]/30">
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
            <div className="bg-[#161920] border border-[#262933] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#262933]">
                <h3 className="text-xs font-bold text-[#8E9299] uppercase tracking-widest flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-[#FF6B1A]" />
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
                <div className="bg-[#0F1115] p-6 rounded-xl border border-[#262933] text-center">
                  <p className="text-xs text-[#8E9299]">
                    Clique em um jogador na lista para lançar gol ou cartão na súmula.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-[#0F1115] p-3 rounded-xl border border-[#262933] flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">{selectedPlayer.player.nome}</p>
                      <p className="text-[10px] text-[#8E9299] font-mono">Posição: Pote #{selectedPlayer.player.camisa_posicao}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-[#FF6B1A]/20 text-[#FF6B1A] text-[10px] font-mono font-bold rounded border border-[#FF6B1A]/30">
                      Selecionado
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Gol */}
                    <button
                      onClick={() => handleRegisterEvent('GOL')}
                      className="p-2.5 bg-[#FF6B1A]/20 hover:bg-[#FF6B1A] text-[#FF6B1A] hover:text-black border border-[#FF6B1A]/40 rounded-xl text-xs font-bold flex flex-row items-center justify-center space-x-1.5 transition-all uppercase tracking-wider"
                    >
                      <span className="text-base">⚽</span>
                      <span>+ Gol</span>
                    </button>

                    {/* Cartão Amarelo */}
                    <button
                      onClick={() => handleRegisterEvent('CARTAO_AMARELO')}
                      className="p-2.5 bg-[#FFC400]/20 hover:bg-[#FFC400] text-[#FFC400] hover:text-black border border-[#FFC400]/40 rounded-xl text-xs font-bold flex flex-row items-center justify-center space-x-1.5 transition-all uppercase tracking-wider"
                    >
                      <span className="text-base">🟨</span>
                      <span>Amarelo</span>
                    </button>

                    {/* Cartão Vermelho */}
                    <button
                      onClick={() => handleRegisterEvent('CARTAO_VERMELHO')}
                      className="p-2.5 bg-[#FF1744]/20 hover:bg-[#FF1744] text-[#FF1744] hover:text-white border border-[#FF1744]/40 rounded-xl text-xs font-bold flex flex-row items-center justify-center space-x-1.5 transition-all uppercase tracking-wider"
                    >
                      <span className="text-base">🟥</span>
                      <span>Vermelho</span>
                    </button>

                    {/* Destaque */}
                    <button
                      onClick={() => handleRegisterEvent('DESTAQUE')}
                      className="p-2.5 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 rounded-xl text-xs font-bold flex flex-row items-center justify-center space-x-1.5 transition-all uppercase tracking-wider"
                    >
                      <span className="text-base">⭐</span>
                      <span>Craque</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Event Log Timeline */}
            <div className="bg-[#161920] border border-[#262933] rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-bold text-[#8E9299] uppercase tracking-widest border-b border-[#262933] pb-2">
                Linha do Tempo de Eventos ({events.length})
              </h3>

              {events.length === 0 ? (
                <p className="text-xs text-[#8E9299] text-center py-6">Nenhum evento registrado nesta partida.</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {events.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2.5 bg-[#0F1115] border border-[#262933] rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className="font-mono text-[#FF6B1A] text-[11px] font-bold">
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

      {/* Finalize Confirmation Modal */}
      {isFinalizeModalOpen && match && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg bg-[#161920] border border-[#262933] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-[#FF6B1A]/10 border border-[#FF6B1A]/30 rounded-2xl">
                  <CheckCircle className="w-6 h-6 text-[#FF6B1A]" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">
                    Finalizar Partida #{match.id}
                  </h3>
                  <p className="text-xs text-[#8E9299]">
                    Processamento automático de pontos, saldo de gols e suspensões
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFinalizeModalOpen(false)}
                className="p-2 text-[#8E9299] hover:text-white bg-[#0F1115] rounded-xl border border-[#262933]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Match Scoreboard Summary */}
            <div className="bg-[#0F1115] border border-[#262933] rounded-2xl p-4 flex items-center justify-around text-center">
              <div>
                <span className="text-[10px] text-[#8E9299] font-mono uppercase font-bold block">Mandante</span>
                <span className="text-base font-bold text-white max-w-[120px] truncate block">
                  {match.time_mandante_nome}
                </span>
                <span className="text-3xl font-black font-mono text-[#FF6B1A]">{match.gols_mandante}</span>
              </div>

              <div className="text-xs font-mono font-bold text-[#8E9299] uppercase px-2 py-1 bg-[#161920] rounded-lg border border-[#262933]">
                X
              </div>

              <div>
                <span className="text-[10px] text-[#8E9299] font-mono uppercase font-bold block">Visitante</span>
                <span className="text-base font-bold text-white max-w-[120px] truncate block">
                  {match.time_visitante_nome}
                </span>
                <span className="text-3xl font-black font-mono text-[#FF6B1A]">{match.gols_visitante}</span>
              </div>
            </div>

            {/* Checklist of updates */}
            <div className="space-y-2 text-xs text-[#E0E6ED] bg-[#0F1115]/50 border border-[#262933] p-4 rounded-2xl">
              <span className="text-[11px] font-mono font-bold uppercase text-[#FF6B1A] tracking-wider block mb-2">
                O que acontecerá ao confirmar:
              </span>
              <div className="flex items-start space-x-2">
                <span className="text-[#FF6B1A] font-bold">✓</span>
                <span>O status da partida mudará para <strong className="text-white font-mono">FINALIZADO</strong>.</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-[#FF6B1A] font-bold">✓</span>
                <span>Tabela de Classificação será atualizada com os pontos (Vitória: 3, Empate: 1) e saldo de gols.</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-[#FF6B1A] font-bold">✓</span>
                <span>Ranking de Artilharia e destaques serão consolidados.</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-[#FF6B1A] font-bold">✓</span>
                <span>Suspensões por acúmulo de cartões amarelos e cartões vermelhos diretos serão geradas.</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={() => setIsFinalizeModalOpen(false)}
                disabled={isFinalizingLoading}
                className="w-full sm:w-1/2 py-3 bg-[#0F1115] hover:bg-[#222632] text-[#8E9299] hover:text-white border border-[#262933] font-mono text-xs uppercase font-bold rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAndFinalizeMatch}
                disabled={isFinalizingLoading}
                className="w-full sm:w-1/2 py-3 bg-[#FF6B1A] hover:bg-[#e05a0f] text-black font-mono text-xs uppercase font-black tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(255,107,26,0.3)] flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isFinalizingLoading ? (
                  <span>Processando...</span>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirmar e Finalizar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
