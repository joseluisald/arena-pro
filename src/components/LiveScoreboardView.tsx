/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { Partida, Categoria, EventoPartida, Jogador, ClassificacaoItem } from '../types';
import { query } from '../services/db';
import { getMatchDetails, getMatchEvents, getMatchRosters } from '../services/matchService';
import { getCategoryStandings } from '../services/standingsService';
import { realtimeService, RealtimeMessage, LiveMatchSnapshot } from '../services/realtime';
import { TeamBadge } from './TeamBadge';
import { 
  Trophy, 
  Activity, 
  Clock, 
  Maximize2, 
  Minimize2, 
  Volume2, 
  VolumeX, 
  Share2, 
  Check, 
  Flame, 
  Radio, 
  Sparkles,
  ChevronDown,
  Layers,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface LiveScoreboardViewProps {
  categoriaId: number;
  categorias: Categoria[];
  onSelectCategoria?: (id: number) => void;
  isStandalone?: boolean;
}

export const LiveScoreboardView: React.FC<LiveScoreboardViewProps> = ({
  categoriaId: initialCategoriaId,
  categorias,
  onSelectCategoria,
  isStandalone = false,
}) => {
  const [currentCategoriaId, setCurrentCategoriaId] = useState<number>(initialCategoriaId);
  const [allMatches, setAllMatches] = useState<Partida[]>([]);
  const [activeMatch, setActiveMatch] = useState<Partida | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [events, setEvents] = useState<EventoPartida[]>([]);
  const [standings, setStandings] = useState<ClassificacaoItem[]>([]);
  
  // Realtime Live States
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [period, setPeriod] = useState<string>('1T');
  const [connectedScreens, setConnectedScreens] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  
  // Audio & Fullscreen & UI controls
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [goalAlert, setGoalAlert] = useState<{ playerName: string; teamName: string; minute: number } | null>(null);
  const [showMatchSelector, setShowMatchSelector] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoDetectPollRef = useRef<NodeJS.Timeout | null>(null);
  const activeMatchIdRef = useRef<number | null>(null);

  useEffect(() => {
    activeMatchIdRef.current = selectedMatchId;
  }, [selectedMatchId]);

  // Audio synthesizer chime for goal celebrations
  const playGoalSound = () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';

      // Fanfare notes: C5 -> E5 -> G5 -> C6
      osc1.frequency.setValueAtTime(523.25, now);
      osc1.frequency.setValueAtTime(659.25, now + 0.15);
      osc1.frequency.setValueAtTime(783.99, now + 0.30);
      osc1.frequency.setValueAtTime(1046.50, now + 0.45);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 1.2);
    } catch (e) {
      console.warn('Audio play failed:', e);
    }
  };

  /**
   * SMART AUTO-DETECTION ENGINE:
   * Finds the currently in-progress match (EM_ANDAMENTO) across ANY category.
   * If NO match is currently live/in-progress, returns null (so the scoreboard shows the waiting/idle screen).
   */
  const findGlobalActiveMatch = async (): Promise<Partida | null> => {
    try {
      // Find ANY match currently in progress across all categories
      const liveMatches = await query<Partida>(
        `SELECT 
           p.*,
           c.nome as categoria_nome,
           f.nome as fase_nome,
           tm.nome as time_mandante_nome, tm.cor_hex as time_mandante_cor, tm.brasao_path as time_mandante_brasao,
           tv.nome as time_visitante_nome, tv.cor_hex as time_visitante_cor, tv.brasao_path as time_visitante_brasao
         FROM partidas p
         JOIN categorias c ON p.categoria_id = c.id
         JOIN fases f ON p.fase_id = f.id
         JOIN times tm ON p.time_mandante_id = tm.id
         JOIN times tv ON p.time_visitante_id = tv.id
         WHERE p.status = 'EM_ANDAMENTO'
         ORDER BY p.id DESC
         LIMIT 1;`
      );

      if (liveMatches && liveMatches.length > 0) {
        return liveMatches[0];
      }

      // No match is currently running
      return null;
    } catch (e) {
      console.error('[Telão Smart Detection Error]:', e);
      return null;
    }
  };

  /**
   * Load list of all matches across all categories for optional manual selection
   */
  const loadAllGlobalMatches = async () => {
    try {
      const list = await query<Partida>(
        `SELECT 
           p.*,
           c.nome as categoria_nome,
           f.nome as fase_nome,
           tm.nome as time_mandante_nome, tm.cor_hex as time_mandante_cor, tm.brasao_path as time_mandante_brasao,
           tv.nome as time_visitante_nome, tv.cor_hex as time_visitante_cor, tv.brasao_path as time_visitante_brasao
         FROM partidas p
         JOIN categorias c ON p.categoria_id = c.id
         JOIN fases f ON p.fase_id = f.id
         JOIN times tm ON p.time_mandante_id = tm.id
         JOIN times tv ON p.time_visitante_id = tv.id
         ORDER BY 
           (p.status = 'EM_ANDAMENTO') DESC,
           c.id ASC,
           p.rodada ASC,
           p.id ASC;`
      );
      setAllMatches(list);
    } catch (e) {
      console.error('[Telão Matches List Error]:', e);
    }
  };

  /**
   * Smart Sync: Detects active matches and updates the scoreboard
   */
  const performSmartSync = async () => {
    const liveMatch = await findGlobalActiveMatch();
    await loadAllGlobalMatches();

    if (liveMatch) {
      if (activeMatchIdRef.current !== liveMatch.id) {
        setSelectedMatchId(liveMatch.id);
        setCurrentCategoriaId(liveMatch.categoria_id);
        if (onSelectCategoria) onSelectCategoria(liveMatch.categoria_id);
      }
    } else {
      // If no match is currently running, clear the live view unless manually forced by user
      if (activeMatch?.status === 'EM_ANDAMENTO' || !selectedMatchId) {
        setSelectedMatchId(null);
        setActiveMatch(null);
        setIsRunning(false);
      }
    }
  };

  // 1. Initial Load & Smart Auto-Discovery
  useEffect(() => {
    performSmartSync();

    // Smart background poll every 3 seconds to catch any newly started or ended game
    autoDetectPollRef.current = setInterval(() => {
      findGlobalActiveMatch().then((live) => {
        if (live) {
          if (live.id !== activeMatchIdRef.current) {
            console.log(`[Telão Smart Auto-Switch] Switched to live match #${live.id} (${live.categoria_nome}): ${live.time_mandante_nome} vs ${live.time_visitante_nome}`);
            setSelectedMatchId(live.id);
            setCurrentCategoriaId(live.categoria_id);
            if (onSelectCategoria) onSelectCategoria(live.categoria_id);
          }
        } else {
          // No live game currently running: if current match was live, clear it out
          if (activeMatchIdRef.current) {
            query<Partida>('SELECT status FROM partidas WHERE id = ?', [activeMatchIdRef.current]).then((rows) => {
              if (rows.length > 0 && rows[0].status !== 'EM_ANDAMENTO') {
                setSelectedMatchId(null);
                setActiveMatch(null);
                setIsRunning(false);
              }
            }).catch(() => {});
          }
        }
      });
    }, 3000);

    return () => {
      if (autoDetectPollRef.current) clearInterval(autoDetectPollRef.current);
    };
  }, []);

  // 2. Load Selected Match Details whenever selectedMatchId changes
  useEffect(() => {
    if (selectedMatchId) {
      loadMatchDetails(selectedMatchId);
    }
  }, [selectedMatchId]);

  // 3. Local clock ticker when isRunning
  useEffect(() => {
    if (isRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning]);

  // 4. Subscribe to Real-Time WebSocket Events
  useEffect(() => {
    setIsConnected(realtimeService.isConnected);
    setConnectedScreens(realtimeService.connectedScreens);

    const unsubscribe = realtimeService.subscribe((msg: RealtimeMessage) => {
      setIsConnected(true);
      if (realtimeService.connectedScreens) {
        setConnectedScreens(realtimeService.connectedScreens);
      }

      if (msg.type === 'INIT_STATE') {
        if (msg.payload?.connectedClients) {
          setConnectedScreens(msg.payload.connectedClients);
        }
        if (msg.payload?.liveState?.matchId) {
          syncWithLiveSnapshot(msg.payload.liveState);
        }
      }

      if (msg.type === 'CLIENT_COUNT') {
        setConnectedScreens(msg.payload?.connectedClients || 1);
      }

      // CRITICAL: When ANY match timer starts or updates in ANY category, switch to it immediately!
      if (msg.type === 'MATCH_TIMER' || msg.type === 'MATCH_UPDATE' || msg.type === 'MATCH_STATE') {
        const payload = msg.payload;
        if (payload?.matchId) {
          const isNewMatch = activeMatchIdRef.current !== payload.matchId;
          if (isNewMatch) {
            setSelectedMatchId(payload.matchId);
            if (payload.categoriaId) {
              setCurrentCategoriaId(payload.categoriaId);
              if (onSelectCategoria) onSelectCategoria(payload.categoriaId);
            }
          }

          if (typeof payload.elapsedSeconds === 'number') {
            setElapsedSeconds((prev) => {
              // Only adjust if drift is greater than 1 second to avoid jumping/skipping
              if (Math.abs(prev - payload.elapsedSeconds) > 1 || isNewMatch) {
                return payload.elapsedSeconds;
              }
              return prev;
            });
          }
          if (typeof payload.isRunning === 'boolean') {
            setIsRunning(payload.isRunning);
          }
          if (payload.period) {
            setPeriod(payload.period);
          }

          // Reload match details only on new match or status changes (NOT every second timer broadcast)
          if (msg.type !== 'MATCH_TIMER' || isNewMatch) {
            loadMatchDetails(payload.matchId);
          }
        }
      }

      if (msg.type === 'MATCH_EVENT' || msg.type === 'MATCH_EVENT_DELETED') {
        const payload = msg.payload;
        if (payload?.matchId) {
          if (activeMatchIdRef.current !== payload.matchId) {
            setSelectedMatchId(payload.matchId);
          }
          loadMatchDetails(payload.matchId);

          // If a new goal happened, trigger celebration!
          if (msg.type === 'MATCH_EVENT' && payload?.event?.tipo_evento === 'GOL') {
            triggerGoalCelebration(payload.event);
          }
        }
      }

      if (msg.type === 'MATCH_FINALIZED') {
        const payload = msg.payload;
        if (payload?.matchId && selectedMatchId === payload.matchId) {
          setIsRunning(false);
          setPeriod('FINALIZADO');
          loadMatchDetails(payload.matchId);
        }
      }
    });

    // Check existing server snapshot
    realtimeService.fetchServerLiveState().then((state) => {
      if (state && state.matchId) syncWithLiveSnapshot(state);
    });

    return () => {
      unsubscribe();
    };
  }, [selectedMatchId]);

  const syncWithLiveSnapshot = (state: LiveMatchSnapshot) => {
    if (state.matchId) {
      setSelectedMatchId(state.matchId);
      if (state.categoriaId) {
        setCurrentCategoriaId(state.categoriaId);
      }
    }
    if (typeof state.elapsedSeconds === 'number') {
      setElapsedSeconds(state.elapsedSeconds);
    }
    if (typeof state.isRunning === 'boolean') {
      setIsRunning(state.isRunning);
    }
    if (state.period) {
      setPeriod(state.period);
    }
  };

  const triggerGoalCelebration = (event: any) => {
    playGoalSound();
    
    // Confetti blast
    confetti({
      particleCount: 140,
      spread: 100,
      origin: { y: 0.4 },
      colors: ['#FF6B1A', '#FFC400', '#FFFFFF', '#00E676'],
    });

    // Goal Banner popup
    setGoalAlert({
      playerName: event.jogador_nome || 'Atleta',
      teamName: event.time_nome || 'Time',
      minute: event.minuto_jogo || Math.floor(elapsedSeconds / 60),
    });

    setTimeout(() => {
      setGoalAlert(null);
    }, 6500);
  };

  const loadMatchDetails = async (mId: number) => {
    try {
      const matchData = await getMatchDetails(mId);
      if (!matchData) return;

      setActiveMatch(matchData);
      setElapsedSeconds(matchData.tempo_decorrido_segundos || 0);
      setIsRunning(matchData.status === 'EM_ANDAMENTO');
      setCurrentCategoriaId(matchData.categoria_id);

      const evs = await getMatchEvents(mId);
      setEvents(evs);

      loadStandings(matchData.categoria_id);
    } catch (e) {
      console.error('[Telão Details Error]:', e);
    }
  };

  const loadStandings = async (catId: number) => {
    try {
      const computed = await getCategoryStandings(catId, { includeLive: true });
      setStandings(computed);
    } catch (e) {
      console.error('[Telão Standings Error]:', e);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleCopyShareLink = () => {
    const origin = window.location.origin;
    const shareUrl = `${origin}/?mode=telao`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    });
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const mandanteGoals = events.filter((e) => e.tipo_evento === 'GOL' && e.time_id === activeMatch?.time_mandante_id);
  const visitanteGoals = events.filter((e) => e.tipo_evento === 'GOL' && e.time_id === activeMatch?.time_visitante_id);

  return (
    <div className="min-h-screen bg-[#07090D] text-[#E0E6ED] flex flex-col justify-between selection:bg-[#FF6B1A] selection:text-black relative overflow-x-hidden p-3 sm:p-6 lg:p-8">
      {/* GOAL CELEBRATION POPUP BANNER */}
      {goalAlert && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-lg px-4 animate-bounce">
          <div className="bg-gradient-to-r from-[#FF6B1A] via-[#FFC400] to-[#FF6B1A] p-1 rounded-3xl shadow-[0_0_80px_rgba(255,107,26,0.9)]">
            <div className="bg-[#111318] rounded-2xl p-6 text-center space-y-2 border border-white/30">
              <div className="inline-flex items-center space-x-2 px-4 py-1.5 bg-[#FF6B1A] text-black font-black text-xs uppercase tracking-widest rounded-full shadow-lg">
                <Flame className="w-5 h-5 animate-pulse" />
                <span>GOOOOOOOOOOL!</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
                {goalAlert.playerName}
              </h2>
              <p className="text-base font-mono font-bold text-[#FFC400] uppercase tracking-wider">
                {goalAlert.teamName} • {goalAlert.minute}' min
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DISCREET FLOATING BROADCAST CONTROLS (Top Right Overlay) */}
      <div className="absolute top-4 right-4 z-40 flex items-center space-x-2 bg-[#111318]/90 backdrop-blur-md border border-[#262933] p-1.5 rounded-2xl shadow-2xl">
        {/* Active screens counter */}
        <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>AO VIVO ({connectedScreens} {connectedScreens === 1 ? 'tela' : 'telas'})</span>
        </div>

        {/* Manual Match Selector Trigger */}
        <div className="relative">
          <button
            onClick={() => setShowMatchSelector(!showMatchSelector)}
            className="px-2.5 py-1.5 bg-[#161920] hover:bg-[#222632] border border-[#262933] text-white rounded-xl text-xs font-mono font-bold transition-all flex items-center space-x-1.5"
            title="Alternar Partida Manualmente"
          >
            <Radio className="w-3.5 h-3.5 text-[#FF6B1A]" />
            <span className="hidden md:inline text-[11px] truncate max-w-[140px]">
              {activeMatch ? `${activeMatch.time_mandante_nome} x ${activeMatch.time_visitante_nome}` : 'Trocar Jogo'}
            </span>
            <ChevronDown className="w-3 h-3 text-[#8E9299]" />
          </button>

          {/* Selector Dropdown Popup */}
          {showMatchSelector && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-[#111318] border border-[#262933] rounded-2xl shadow-2xl p-2 z-50 space-y-1 max-h-80 overflow-y-auto">
              <div className="px-3 py-2 text-[10px] font-mono text-[#8E9299] uppercase font-bold border-b border-[#262933] flex items-center justify-between">
                <span>Jogos do Torneio</span>
                <span className="text-[#FF6B1A]">Auto-detecção ativa</span>
              </div>
              {allMatches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedMatchId(m.id);
                    setShowMatchSelector(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl text-xs font-mono transition-all flex items-center justify-between ${
                    selectedMatchId === m.id
                      ? 'bg-[#FF6B1A] text-black font-extrabold shadow-md'
                      : 'hover:bg-[#161920] text-[#E0E6ED]'
                  }`}
                >
                  <div className="truncate pr-2">
                    <span className="block font-bold uppercase truncate">
                      {m.status === 'EM_ANDAMENTO' ? '🔴 ' : ''} {m.time_mandante_nome} vs {m.time_visitante_nome}
                    </span>
                    <span className={`text-[10px] block ${selectedMatchId === m.id ? 'text-black/80' : 'text-[#8E9299]'}`}>
                      {m.categoria_nome} • {m.fase_nome}
                    </span>
                  </div>
                  {m.status === 'EM_ANDAMENTO' && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white font-black text-[9px] uppercase animate-pulse">
                      Live
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sound Toggle */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`p-2 rounded-xl border text-xs font-mono font-bold transition-all flex items-center ${
            soundEnabled
              ? 'bg-[#FF6B1A]/15 border-[#FF6B1A]/40 text-[#FF6B1A]'
              : 'bg-[#161920] border-[#262933] text-[#8E9299]'
          }`}
          title="Ativar/Desativar Som de Gol"
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>

        {/* Share Link */}
        <button
          onClick={handleCopyShareLink}
          className="p-2 bg-[#161920] hover:bg-[#222632] border border-[#262933] text-white rounded-xl text-xs transition-all"
          title="Copiar link deste telão"
        >
          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-[#FF6B1A]" />}
        </button>

        {/* Fullscreen F11 */}
        <button
          onClick={toggleFullscreen}
          className="p-2 bg-[#FF6B1A] text-black font-black hover:bg-[#FF8533] rounded-xl transition-all shadow-[0_0_15px_rgba(255,107,26,0.3)]"
          title="Tela Cheia (TV / F11)"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* TOP STREAMLINE STADIUM BANNER */}
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between pb-3 pt-1">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-[#FF6B1A] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(255,107,26,0.4)]">
            <Trophy className="w-5 h-5 text-black" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-black text-white uppercase tracking-wider">
                ARENA ROMANO
              </span>
              <span className="text-xs font-mono font-bold text-[#FF6B1A] uppercase tracking-wider">
                • {activeMatch?.categoria_nome || 'CAMPEONATO SOCIETY'}
              </span>
            </div>
            <p className="text-[10px] text-[#8E9299] font-mono">
              Placar Digital Oficial Ao Vivo
            </p>
          </div>
        </div>
      </div>

      {/* MAIN ARENA SCOREBOARD STADIUM HERO */}
      <main className="flex-1 max-w-7xl w-full mx-auto my-auto space-y-6 flex flex-col justify-center">
        {activeMatch ? (
          <div className="space-y-6">
            {/* HERO SCOREBOARD STADIUM CARD */}
            <div className="relative rounded-3xl bg-[#111318] border border-[#262933] p-6 sm:p-10 shadow-[0_0_80px_rgba(0,0,0,0.9)] overflow-hidden">
              {/* Stadium Atmospheric Backlights */}
              <div 
                className="absolute -top-36 -left-36 w-[450px] h-[450px] rounded-full blur-3xl opacity-25 pointer-events-none transition-all duration-1000"
                style={{ backgroundColor: activeMatch.time_mandante_cor || '#FF6B1A' }}
              />
              <div 
                className="absolute -bottom-36 -right-36 w-[450px] h-[450px] rounded-full blur-3xl opacity-25 pointer-events-none transition-all duration-1000"
                style={{ backgroundColor: activeMatch.time_visitante_cor || '#00E676' }}
              />

              {/* Match Header Badge */}
              <div className="relative z-10 flex flex-wrap items-center justify-between pb-6 border-b border-[#262933]/80 gap-3">
                <div className="flex items-center space-x-2">
                  <span className="px-3.5 py-1 bg-[#161920] border border-[#262933] rounded-xl text-xs font-mono font-black text-[#FF6B1A] uppercase tracking-wider">
                    {activeMatch.categoria_nome} • {activeMatch.fase_nome} {activeMatch.rodada ? `(Rodada ${activeMatch.rodada})` : ''}
                  </span>
                  <span className="text-xs font-mono text-[#8E9299]">
                    {activeMatch.data_hora ? new Date(activeMatch.data_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Partida Oficial'}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`px-4 py-1.5 rounded-full text-xs font-mono font-black uppercase tracking-wider flex items-center space-x-2 border shadow-lg ${
                      activeMatch.status === 'EM_ANDAMENTO' || isRunning
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                        : activeMatch.status === 'FINALIZADO'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-[#161920] text-[#8E9299] border-[#262933]'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-current" />
                    <span>{activeMatch.status === 'EM_ANDAMENTO' || isRunning ? 'EM ANDAMENTO (AO VIVO)' : activeMatch.status}</span>
                  </span>
                </div>
              </div>

              {/* CORE SCORE GRID */}
              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-11 items-center gap-6 py-6 sm:py-10">
                {/* MANDANTE TEAM (4 Cols) */}
                <div className="lg:col-span-4 flex flex-col items-center lg:items-end text-center lg:text-right space-y-4">
                  <div className="relative group">
                    <div
                      className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl p-2 flex items-center justify-center shadow-2xl border-2 border-white/20 transition-transform group-hover:scale-105"
                      style={{ backgroundColor: `${activeMatch.time_mandante_cor}25` }}
                    >
                      <TeamBadge
                        badge={activeMatch.time_mandante_brasao}
                        name={activeMatch.time_mandante_nome}
                        className="w-16 h-16 sm:w-24 sm:h-24 text-4xl sm:text-5xl"
                      />
                    </div>
                    <div
                      className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full border-2 border-black shadow-md"
                      style={{ backgroundColor: activeMatch.time_mandante_cor }}
                    />
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-2xl sm:text-3xl lg:text-5xl font-black text-white uppercase tracking-tight">
                      {activeMatch.time_mandante_nome}
                    </h2>
                    <span className="text-xs font-mono font-bold text-[#8E9299] uppercase tracking-wider block">
                      Mandante
                    </span>
                  </div>

                  {/* Mandante Goals Breakdown */}
                  {mandanteGoals.length > 0 && (
                    <div className="space-y-1.5 text-xs sm:text-sm font-mono text-[#8E9299] max-w-xs">
                      {mandanteGoals.map((g) => (
                        <div key={g.id} className="flex items-center justify-center lg:justify-end space-x-2">
                          <span>⚽</span>
                          <span className="text-white font-bold">{g.jogador_nome}</span>
                          <span className="text-[#FF6B1A] font-extrabold">({g.minuto_jogo}')</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* CENTER CLOCK & SCORE (3 Cols) */}
                <div className="lg:col-span-3 flex flex-col items-center justify-center space-y-4">
                  {/* Big LED Placar */}
                  <div className="bg-[#07090D] border-2 border-[#262933] px-8 py-5 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.9)] flex items-center justify-center space-x-6 sm:space-x-8 min-w-[240px]">
                    <span className="text-6xl sm:text-7xl lg:text-8xl font-mono font-black text-white tracking-tighter">
                      {activeMatch.gols_mandante}
                    </span>
                    <span className="text-4xl sm:text-5xl font-mono font-bold text-[#FF6B1A] animate-pulse">
                      :
                    </span>
                    <span className="text-6xl sm:text-7xl lg:text-8xl font-mono font-black text-white tracking-tighter">
                      {activeMatch.gols_visitante}
                    </span>
                  </div>

                  {/* Digital Live Timer Display */}
                  <div className="flex flex-col items-center space-y-2">
                    <div className="flex items-center space-x-2.5 bg-[#161920] px-5 py-2.5 rounded-2xl border border-[#262933] shadow-lg">
                      <Clock className={`w-5 h-5 ${isRunning ? 'text-[#FF6B1A] animate-spin' : 'text-[#8E9299]'}`} />
                      <span className="text-2xl sm:text-4xl font-mono font-black text-[#FF6B1A] tracking-wider">
                        {formatTimer(elapsedSeconds)}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-extrabold uppercase px-3 py-1 rounded-full bg-[#FF6B1A]/10 text-[#FF6B1A] border border-[#FF6B1A]/30">
                        {period}
                      </span>
                      {isRunning && (
                        <span className="text-[11px] font-mono text-emerald-400 font-bold uppercase tracking-wider animate-pulse">
                          ● Cronômetro Rodando
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* VISITANTE TEAM (4 Cols) */}
                <div className="lg:col-span-4 flex flex-col items-center lg:items-start text-center lg:text-left space-y-4">
                  <div className="relative group">
                    <div
                      className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl p-2 flex items-center justify-center shadow-2xl border-2 border-white/20 transition-transform group-hover:scale-105"
                      style={{ backgroundColor: `${activeMatch.time_visitante_cor}25` }}
                    >
                      <TeamBadge
                        badge={activeMatch.time_visitante_brasao}
                        name={activeMatch.time_visitante_nome}
                        className="w-16 h-16 sm:w-24 sm:h-24 text-4xl sm:text-5xl"
                      />
                    </div>
                    <div
                      className="absolute -bottom-2 -left-2 w-7 h-7 rounded-full border-2 border-black shadow-md"
                      style={{ backgroundColor: activeMatch.time_visitante_cor }}
                    />
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-2xl sm:text-3xl lg:text-5xl font-black text-white uppercase tracking-tight">
                      {activeMatch.time_visitante_nome}
                    </h2>
                    <span className="text-xs font-mono font-bold text-[#8E9299] uppercase tracking-wider block">
                      Visitante
                    </span>
                  </div>

                  {/* Visitante Goals Breakdown */}
                  {visitanteGoals.length > 0 && (
                    <div className="space-y-1.5 text-xs sm:text-sm font-mono text-[#8E9299] max-w-xs">
                      {visitanteGoals.map((g) => (
                        <div key={g.id} className="flex items-center justify-center lg:justify-start space-x-2">
                          <span>⚽</span>
                          <span className="text-white font-bold">{g.jogador_nome}</span>
                          <span className="text-[#FF6B1A] font-extrabold">({g.minuto_jogo}')</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* LOWER BENTO: MATCH EVENTS TIMELINE & LIVE STANDINGS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Lances em Tempo Real */}
              <div className="bg-[#111318] border border-[#262933] rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-[#262933]">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-[#FF6B1A]" />
                    <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                      Linha do Tempo de Lances & Cartões
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-[#8E9299]">
                    {events.length} {events.length === 1 ? 'lance' : 'lances'} registrados
                  </span>
                </div>

                {events.length === 0 ? (
                  <div className="py-10 text-center text-[#8E9299] font-mono text-xs space-y-2">
                    <Radio className="w-8 h-8 mx-auto text-[#8E9299] opacity-40 animate-pulse" />
                    <p>Aguardando lances da partida ao vivo...</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {events.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-3 bg-[#0A0C10] border border-[#262933] rounded-2xl flex items-center justify-between gap-3 text-xs font-mono"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="w-7 h-7 rounded-xl bg-[#161920] border border-[#262933] flex items-center justify-center text-sm shrink-0 font-black text-[#FF6B1A]">
                            {ev.tipo_evento === 'GOL' && '⚽'}
                            {ev.tipo_evento === 'CARTAO_AMARELO' && '🟨'}
                            {ev.tipo_evento === 'CARTAO_VERMELHO' && '🟥'}
                            {ev.tipo_evento === 'DESTAQUE' && '⭐'}
                          </span>
                          <div>
                            <span className="font-bold text-white uppercase block">
                              {ev.jogador_nome}
                            </span>
                            <span className="text-[10px] text-[#8E9299]">
                              {ev.time_nome}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded-md bg-[#FF6B1A]/10 text-[#FF6B1A] font-bold text-[10px]">
                            {ev.minuto_jogo}' min
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Classificação ao Vivo da Categoria */}
              <div className="bg-[#111318] border border-[#262933] rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-[#262933]">
                  <div className="flex items-center space-x-2">
                    <Trophy className="w-4 h-4 text-[#FFC400]" />
                    <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                      Tabela de Classificação ({activeMatch.categoria_nome})
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-[#8E9299]">Atualização em tempo real</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#262933] text-[#8E9299] text-[10px] uppercase">
                        <th className="py-2 px-2">#</th>
                        <th className="py-2 px-2">Time</th>
                        <th className="py-2 px-2 text-center text-[#FF6B1A]">PTS</th>
                        <th className="py-2 px-2 text-center">J</th>
                        <th className="py-2 px-2 text-center">V</th>
                        <th className="py-2 px-2 text-center">SG</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262933]/50">
                      {standings.map((st, idx) => (
                        <tr
                          key={st.time_id}
                          className={`hover:bg-[#161920] transition-colors ${
                            st.time_id === activeMatch.time_mandante_id || st.time_id === activeMatch.time_visitante_id
                              ? 'bg-[#FF6B1A]/5 font-bold'
                              : ''
                          }`}
                        >
                          <td className="py-2 px-2 text-[#8E9299]">{idx + 1}º</td>
                          <td className="py-2 px-2">
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full border border-white/20"
                                style={{ backgroundColor: st.time_cor_hex }}
                              />
                              <span className="text-white truncate max-w-[130px] font-sans font-bold uppercase">
                                {st.time_nome}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-center font-black text-[#FF6B1A]">{st.pontos}</td>
                          <td className="py-2 px-2 text-center text-white">{st.jogos}</td>
                          <td className="py-2 px-2 text-center text-[#8E9299]">{st.vitorias}</td>
                          <td className="py-2 px-2 text-center font-bold text-white">{st.saldo_gols}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#111318] border border-[#262933] rounded-3xl p-12 text-center space-y-4 max-w-lg mx-auto shadow-2xl">
            <Radio className="w-12 h-12 text-[#FF6B1A] mx-auto animate-pulse" />
            <h2 className="text-xl font-black text-white uppercase tracking-wider">
              Aguardando Início de Partida
            </h2>
            <p className="text-xs font-mono text-[#8E9299]">
              Assim que você iniciar o cronômetro na Súmula Digital (em qualquer categoria), este telão se conectará automaticamente ao jogo em andamento.
            </p>
          </div>
        )}
      </main>

      {/* DISCREET STADIUM BASE FOOTER */}
      <footer className="w-full max-w-7xl mx-auto pt-3 border-t border-[#262933]/60 text-center text-[10px] font-mono text-[#8E9299] flex flex-wrap items-center justify-between gap-2">
        <span>ARENA ROMANO CENTRO ESPORTIVO • PLACAR DIGITAL AO VIVO</span>
        <span className="text-emerald-400 font-bold">🟢 WEBSOCKET CONECTADO • REPRODUÇÃO EM TEMPO REAL</span>
      </footer>
    </div>
  );
};
