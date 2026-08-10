/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  Categoria, 
  ClassificacaoItem, 
  ArtilhariaItem, 
  Partida, 
  Time, 
  Jogador, 
  EventoPartida,
  POSICOES_MAP 
} from '../types';
import { query } from '../services/db';
import { 
  Trophy, 
  Flame, 
  Calendar, 
  Users, 
  Award, 
  Activity, 
  Sparkles, 
  ChevronRight, 
  Shield, 
  Search,
  ChevronDown,
  Layers,
  ArrowRight,
  Clock,
  CheckCircle2,
  Share2
} from 'lucide-react';

interface PublicPortalViewProps {
  categoriaId: number;
  categorias: Categoria[];
  onSelectCategoria: (id: number) => void;
}

export const PublicPortalView: React.FC<PublicPortalViewProps> = ({
  categoriaId,
  categorias,
  onSelectCategoria,
}) => {
  const [activeTab, setActiveTab] = useState<'tabela' | 'confrontos' | 'artilharia' | 'times' | 'ao-vivo'>('tabela');
  
  // Data states
  const [standings, setStandings] = useState<ClassificacaoItem[]>([]);
  const [artilharia, setArtilharia] = useState<ArtilhariaItem[]>([]);
  const [matches, setMatches] = useState<Partida[]>([]);
  const [teams, setTeams] = useState<Time[]>([]);
  const [players, setPlayers] = useState<Jogador[]>([]);
  const [matchEvents, setMatchEvents] = useState<Record<number, EventoPartida[]>>({});
  const [selectedTeam, setSelectedTeam] = useState<Time | null>(null);
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<string>('todas');
  const [searchTeamQuery, setSearchTeamQuery] = useState('');
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    loadPublicData();
  }, [categoriaId]);

  const loadPublicData = async () => {
    setLoading(true);
    try {
      // 1. Teams
      const teamList = await query<Time>(
        'SELECT * FROM times WHERE categoria_id = ? ORDER BY nome ASC;',
        [categoriaId]
      );
      setTeams(teamList);

      // 2. Players
      const playerList = await query<Jogador>(
        `SELECT j.*, t.nome as time_nome, t.cor_hex as time_cor_hex 
         FROM jogadores j 
         LEFT JOIN times t ON j.time_id = t.id 
         WHERE j.categoria_id = ? 
         ORDER BY j.nome ASC;`,
        [categoriaId]
      );
      setPlayers(playerList);

      // 3. Matches
      const matchData = await query<Partida>(
        `SELECT p.*, 
                tm.nome as time_mandante_nome, tm.cor_hex as time_mandante_cor, tm.brasao_path as time_mandante_brasao,
                tv.nome as time_visitante_nome, tv.cor_hex as time_visitante_cor, tv.brasao_path as time_visitante_brasao,
                f.nome as fase_nome
         FROM partidas p
         JOIN times tm ON p.time_mandante_id = tm.id
         JOIN times tv ON p.time_visitante_id = tv.id
         JOIN fases f ON p.fase_id = f.id
         WHERE p.categoria_id = ?
         ORDER BY p.rodada ASC, p.id ASC;`,
        [categoriaId]
      );
      setMatches(matchData);

      // 4. Fetch Goal Events for finished or live matches
      const liveOrFinishedMatchIds = matchData
        .filter((m) => m.status !== 'AGENDADO')
        .map((m) => m.id);

      if (liveOrFinishedMatchIds.length > 0) {
        const eventsList = await query<EventoPartida>(
          `SELECT ep.*, j.nome as jogador_nome, t.nome as time_nome 
           FROM eventos_partida ep 
           JOIN jogadores j ON ep.jogador_id = j.id 
           JOIN times t ON ep.time_id = t.id 
           WHERE ep.partida_id IN (${liveOrFinishedMatchIds.join(',')}) AND ep.tipo_evento = 'GOL' 
           ORDER BY ep.minuto_jogo ASC;`
        );

        const eventsGrouped: Record<number, EventoPartida[]> = {};
        eventsList.forEach((ev) => {
          if (!eventsGrouped[ev.partida_id]) eventsGrouped[ev.partida_id] = [];
          eventsGrouped[ev.partida_id].push(ev);
        });
        setMatchEvents(eventsGrouped);
      } else {
        setMatchEvents({});
      }

      // 5. Calculate Standings
      calculateStandings(teamList, matchData);

      // 6. Calculate Top Goalscorers
      const topScorers = await query<ArtilhariaItem>(
        `SELECT j.id as jogador_id, j.nome as jogador_nome, j.camisa_posicao, 
                t.nome as time_nome, t.cor_hex as time_cor_hex, t.brasao_path as time_brasao_path, 
                COUNT(ep.id) as gols
         FROM eventos_partida ep
         JOIN jogadores j ON ep.jogador_id = j.id
         JOIN times t ON ep.time_id = t.id
         WHERE ep.tipo_evento = 'GOL' AND j.categoria_id = ?
         GROUP BY j.id
         ORDER BY gols DESC, j.nome ASC
         LIMIT 15;`,
        [categoriaId]
      );
      setArtilharia(topScorers);

    } catch (err) {
      console.error('Erro ao carregar dados públicos:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStandings = (teamList: Time[], matchData: Partida[]) => {
    const map: Record<number, ClassificacaoItem> = {};

    teamList.forEach((t) => {
      map[t.id] = {
        time_id: t.id,
        time_nome: t.nome,
        time_cor_hex: t.cor_hex,
        time_brasao_path: t.brasao_path,
        jogos: 0,
        vitorias: 0,
        empates: 0,
        derrotas: 0,
        gols_pro: 0,
        gols_contra: 0,
        saldo_gols: 0,
        pontos: 0,
        aproveitamento: 0,
      };
    });

    matchData.forEach((m) => {
      if (m.status === 'FINALIZADO' && m.fase_id === 1) { // Fase de Grupos
        const mandante = map[m.time_mandante_id];
        const visitante = map[m.time_visitante_id];

        if (mandante && visitante) {
          mandante.jogos += 1;
          visitante.jogos += 1;

          mandante.gols_pro += m.gols_mandante;
          mandante.gols_contra += m.gols_visitante;

          visitante.gols_pro += m.gols_visitante;
          visitante.gols_contra += m.gols_mandante;

          if (m.gols_mandante > m.gols_visitante) {
            mandante.vitorias += 1;
            mandante.pontos += 3;
            visitante.derrotas += 1;
          } else if (m.gols_mandante < m.gols_visitante) {
            visitante.vitorias += 1;
            visitante.pontos += 3;
            mandante.derrotas += 1;
          } else {
            mandante.empates += 1;
            mandante.pontos += 1;
            visitante.empates += 1;
            visitante.pontos += 1;
          }
        }
      }
    });

    const items = Object.values(map).map((item) => {
      item.saldo_gols = item.gols_pro - item.gols_contra;
      item.aproveitamento = item.jogos > 0 ? Math.round((item.pontos / (item.jogos * 3)) * 100) : 0;
      return item;
    });

    // Sort by Points DESC, Wins DESC, Goal Difference DESC, Goals Pro DESC
    items.sort((a, b) => {
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
      if (b.saldo_gols !== a.saldo_gols) return b.saldo_gols - a.saldo_gols;
      return b.gols_pro - a.gols_pro;
    });

    setStandings(items);
  };

  const handleShare = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'public');
    navigator.clipboard.writeText(url.toString());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Group matches by round for display
  const roundsMap: Record<number, Partida[]> = {};
  matches.forEach((m) => {
    if (!roundsMap[m.rodada]) roundsMap[m.rodada] = [];
    roundsMap[m.rodada].push(m);
  });

  const availableRounds = Object.keys(roundsMap).map(Number).sort((a, b) => a - b);

  const filteredMatches = matches.filter((m) => {
    if (selectedRoundFilter === 'todas') return true;
    if (selectedRoundFilter === 'ao-vivo') return m.status === 'EM_ANDAMENTO';
    if (selectedRoundFilter === 'finalizados') return m.status === 'FINALIZADO';
    if (selectedRoundFilter === 'agendados') return m.status === 'AGENDADO';
    return m.rodada === Number(selectedRoundFilter);
  });

  const activeCategoryName = categorias.find((c) => c.id === categoriaId)?.nome || 'Torneio';
  const liveMatchesCount = matches.filter((m) => m.status === 'EM_ANDAMENTO').length;
  const totalGoals = matches.reduce((acc, m) => acc + (m.gols_mandante || 0) + (m.gols_visitante || 0), 0);
  const finishedMatchesCount = matches.filter((m) => m.status === 'FINALIZADO').length;

  return (
    <div className="space-y-6">
      {/* Fan Portal Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#161920] via-[#1c202a] to-[#161920] border border-[#262933] rounded-3xl p-6 sm:p-8 shadow-2xl">
        {/* Subtle orange ambient glow behind */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[#FF6B1A]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-[#FFC400]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#FF6B1A]/15 border border-[#FF6B1A]/30 text-[#FF6B1A] text-xs font-mono font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Portal Aberto do Torcedor</span>
              </span>
              {liveMatchesCount > 0 && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-[#FF1744]/20 border border-[#FF1744]/40 text-[#FF1744] text-xs font-mono font-bold animate-pulse uppercase">
                  ● {liveMatchesCount} Jogos Ao Vivo
                </span>
              )}
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight font-sans">
                Acompanhe o Torneio Society
              </h1>
              <p className="text-xs sm:text-sm text-[#8E9299] mt-1 max-w-xl leading-relaxed">
                Resultados em tempo real, classificação atualizada automaticamente, rodadas e artilharia oficial da Arena Romano.
              </p>
            </div>
          </div>

          {/* Share & Category Quick Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={handleShare}
              className="px-4 py-2.5 bg-[#0F1115] hover:bg-[#222632] text-[#E0E6ED] border border-[#262933] hover:border-[#FF6B1A]/50 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 shrink-0 shadow-md"
            >
              <Share2 className="w-4 h-4 text-[#FF6B1A]" />
              <span>{copiedLink ? 'Link Copiado!' : 'Compartilhar Tabela'}</span>
            </button>
          </div>
        </div>

        {/* Category Picker Selector Tabs */}
        <div className="mt-6 pt-6 border-t border-[#262933]/80 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono font-bold uppercase text-[#8E9299] tracking-wider mr-2 flex items-center space-x-1">
            <Layers className="w-3.5 h-3.5 text-[#FF6B1A]" />
            <span>Selecione a Categoria:</span>
          </span>
          {categorias.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectCategoria(c.id)}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-extrabold uppercase tracking-wider transition-all ${
                c.id === categoriaId
                  ? 'bg-[#FF6B1A] text-black shadow-[0_0_15px_rgba(255,107,26,0.35)] scale-105'
                  : 'bg-[#0F1115] text-[#8E9299] hover:text-white border border-[#262933] hover:border-[#FF6B1A]/40'
              }`}
            >
              {c.nome}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#161920] border border-[#262933] rounded-2xl p-4 flex items-center space-x-3.5 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-[#FF6B1A]/10 border border-[#FF6B1A]/30 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-[#FF6B1A]" />
          </div>
          <div>
            <p className="text-[10px] font-mono text-[#8E9299] uppercase font-bold tracking-wider">Times Inscritos</p>
            <p className="text-lg font-black text-white font-mono">{teams.length}</p>
          </div>
        </div>

        <div className="bg-[#161920] border border-[#262933] rounded-2xl p-4 flex items-center space-x-3.5 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-[#FFC400]/10 border border-[#FFC400]/30 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-[#FFC400]" />
          </div>
          <div>
            <p className="text-[10px] font-mono text-[#8E9299] uppercase font-bold tracking-wider">Jogos Realizados</p>
            <p className="text-lg font-black text-white font-mono">{finishedMatchesCount} <span className="text-xs text-[#8E9299] font-normal">/ {matches.length}</span></p>
          </div>
        </div>

        <div className="bg-[#161920] border border-[#262933] rounded-2xl p-4 flex items-center space-x-3.5 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-[#FF1744]/10 border border-[#FF1744]/30 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5 text-[#FF1744]" />
          </div>
          <div>
            <p className="text-[10px] font-mono text-[#8E9299] uppercase font-bold tracking-wider">Gols Marcados</p>
            <p className="text-lg font-black text-white font-mono">{totalGoals}</p>
          </div>
        </div>

        <div className="bg-[#161920] border border-[#262933] rounded-2xl p-4 flex items-center space-x-3.5 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-purple-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-mono text-[#8E9299] uppercase font-bold tracking-wider">Líder do Grupo</p>
            <p className="text-xs font-black text-white truncate uppercase font-mono">
              {standings.length > 0 ? standings[0].time_nome : 'Aguardando'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Fan Navigation Tabs */}
      <div className="flex overflow-x-auto scrollbar-none space-x-2 bg-[#161920] p-2 rounded-2xl border border-[#262933]">
        <button
          onClick={() => setActiveTab('tabela')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'tabela'
              ? 'bg-[#FF6B1A] text-black shadow-[0_0_15px_rgba(255,107,26,0.35)]'
              : 'text-[#8E9299] hover:text-white hover:bg-[#0F1115]'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Tabela de Classificação</span>
        </button>

        <button
          onClick={() => setActiveTab('confrontos')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'confrontos'
              ? 'bg-[#FF6B1A] text-black shadow-[0_0_15px_rgba(255,107,26,0.35)]'
              : 'text-[#8E9299] hover:text-white hover:bg-[#0F1115]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Confrontos & Jogos ({matches.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('artilharia')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'artilharia'
              ? 'bg-[#FF6B1A] text-black shadow-[0_0_15px_rgba(255,107,26,0.35)]'
              : 'text-[#8E9299] hover:text-white hover:bg-[#0F1115]'
          }`}
        >
          <Flame className="w-4 h-4 text-[#FFC400]" />
          <span>Artilharia ({artilharia.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('times')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'times'
              ? 'bg-[#FF6B1A] text-black shadow-[0_0_15px_rgba(255,107,26,0.35)]'
              : 'text-[#8E9299] hover:text-white hover:bg-[#0F1115]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Times & Elencos</span>
        </button>

        {liveMatchesCount > 0 && (
          <button
            onClick={() => setActiveTab('ao-vivo')}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'ao-vivo'
                ? 'bg-[#FF1744] text-white shadow-[0_0_15px_rgba(255,23,68,0.4)] animate-pulse'
                : 'bg-[#FF1744]/10 text-[#FF1744] hover:bg-[#FF1744]/20 border border-[#FF1744]/30'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Súmula Ao Vivo</span>
          </button>
        )}
      </div>

      {/* Tab 1: TABELA DE CLASSIFICAÇÃO */}
      {activeTab === 'tabela' && (
        <div className="bg-[#161920] border border-[#262933] rounded-2xl overflow-hidden shadow-2xl space-y-4 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262933]">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <Trophy className="w-4 h-4 text-[#FFC400]" />
                <span>Classificação Oficial - {activeCategoryName}</span>
              </h3>
              <p className="text-[11px] text-[#8E9299] mt-0.5">
                Classificam-se os melhores times para a fase de mata-mata.
              </p>
            </div>

            <div className="flex items-center space-x-3 text-[10px] font-mono text-[#8E9299] bg-[#0F1115] px-3 py-1.5 rounded-xl border border-[#262933]">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded bg-[#FFC400]" />
                <span>Mata-Mata</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded bg-[#8E9299]" />
                <span>Fase de Grupos</span>
              </span>
            </div>
          </div>

          {standings.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Shield className="w-10 h-10 text-[#8E9299] mx-auto opacity-50" />
              <p className="text-xs font-bold text-white uppercase tracking-wider">Ainda não há jogos nesta categoria</p>
              <p className="text-xs text-[#8E9299]">A tabela será atualizada assim que os jogos forem iniciados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#0F1115] text-[#8E9299] uppercase font-mono font-bold border-b border-[#262933] text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-3 text-center">Pos</th>
                    <th className="py-3 px-4 font-sans">Time</th>
                    <th className="py-3 px-3 text-center text-white bg-[#FF6B1A]/10">PTS</th>
                    <th className="py-3 px-3 text-center">J</th>
                    <th className="py-3 px-3 text-center">V</th>
                    <th className="py-3 px-3 text-center">E</th>
                    <th className="py-3 px-3 text-center">D</th>
                    <th className="py-3 px-3 text-center">GP</th>
                    <th className="py-3 px-3 text-center">GC</th>
                    <th className="py-3 px-3 text-center font-bold text-white">SG</th>
                    <th className="py-3 px-3 text-center">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262933]">
                  {standings.map((st, idx) => {
                    const isQualified = idx < 4; // Top 4 qualify for playoffs
                    return (
                      <tr 
                        key={st.time_id} 
                        className={`hover:bg-[#0F1115]/60 transition-colors ${isQualified ? 'bg-[#FFC400]/5' : ''}`}
                      >
                        <td className="py-3 px-3 text-center">
                          <span className={`w-6 h-6 rounded-lg font-mono font-black text-xs inline-flex items-center justify-center ${
                            idx === 0 ? 'bg-[#FFC400] text-black shadow-[0_0_10px_rgba(255,196,0,0.4)]' :
                            idx === 1 ? 'bg-slate-300 text-black' :
                            idx === 2 ? 'bg-amber-700 text-white' :
                            isQualified ? 'bg-[#0F1115] text-[#FF6B1A] border border-[#FF6B1A]/30' :
                            'bg-[#0F1115] text-[#8E9299]'
                          }`}>
                            {idx + 1}º
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                              style={{ backgroundColor: st.time_cor_hex }}
                            />
                            <span className="font-extrabold text-white uppercase tracking-wide text-xs sm:text-sm">
                              {st.time_nome}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-center font-mono font-black text-sm text-[#FF6B1A] bg-[#FF6B1A]/5">
                          {st.pontos}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-[#E0E6ED]">{st.jogos}</td>
                        <td className="py-3 px-3 text-center font-mono text-[#8E9299]">{st.vitorias}</td>
                        <td className="py-3 px-3 text-center font-mono text-[#8E9299]">{st.empates}</td>
                        <td className="py-3 px-3 text-center font-mono text-[#8E9299]">{st.derrotas}</td>
                        <td className="py-3 px-3 text-center font-mono text-[#8E9299]">{st.gols_pro}</td>
                        <td className="py-3 px-3 text-center font-mono text-[#8E9299]">{st.gols_contra}</td>
                        <td className="py-3 px-3 text-center font-mono font-black text-white">{st.saldo_gols}</td>
                        <td className="py-3 px-3 text-center font-mono text-[#8E9299]">{st.aproveitamento}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="pt-3 border-t border-[#262933] flex flex-wrap items-center justify-between text-[11px] font-mono text-[#8E9299] gap-2">
            <span>Legenda: PTS (Pontos), J (Jogos), V (Vitórias), E (Empates), D (Derrotas), GP (Gols Pró), GC (Gols Contra), SG (Saldo de Gols)</span>
            <span className="text-[#FF6B1A] font-bold">Critérios: Pontos &gt; Vitórias &gt; Saldo de Gols &gt; Gols Pró</span>
          </div>
        </div>
      )}

      {/* Tab 2: CONFRONTOS & JOGOS */}
      {activeTab === 'confrontos' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-[#161920] border border-[#262933] rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-[#FF6B1A]" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Filtrar Rodadas / Fase</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSelectedRoundFilter('todas')}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold uppercase transition-all ${
                  selectedRoundFilter === 'todas'
                    ? 'bg-[#FF6B1A] text-black font-extrabold'
                    : 'bg-[#0F1115] text-[#8E9299] hover:text-white border border-[#262933]'
                }`}
              >
                Todas as Rodadas
              </button>

              {availableRounds.map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRoundFilter(String(r))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold uppercase transition-all ${
                    selectedRoundFilter === String(r)
                      ? 'bg-[#FF6B1A] text-black font-extrabold'
                      : 'bg-[#0F1115] text-[#8E9299] hover:text-white border border-[#262933]'
                  }`}
                >
                  Rodada {r}
                </button>
              ))}
            </div>
          </div>

          {/* Match Cards List */}
          {filteredMatches.length === 0 ? (
            <div className="bg-[#161920] border border-[#262933] rounded-2xl p-10 text-center space-y-2">
              <Calendar className="w-10 h-10 text-[#8E9299] mx-auto opacity-50" />
              <p className="text-xs font-bold text-white uppercase tracking-wider">Nenhum confronto encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMatches.map((m) => {
                const events = matchEvents[m.id] || [];
                const mandanteGoals = events.filter((ev) => ev.time_id === m.time_mandante_id);
                const visitanteGoals = events.filter((ev) => ev.time_id === m.time_visitante_id);

                return (
                  <div
                    key={m.id}
                    className="bg-[#161920] border border-[#262933] rounded-2xl p-5 hover:border-[#FF6B1A]/40 transition-all shadow-xl space-y-4 relative overflow-hidden"
                  >
                    {/* Top Status Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-[#262933] text-xs font-mono">
                      <span className="text-[#8E9299] font-bold uppercase tracking-wider">
                        {m.fase_nome} • Rodada {m.rodada}
                      </span>

                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase border ${
                          m.status === 'EM_ANDAMENTO'
                            ? 'bg-[#FF1744]/20 text-[#FF1744] border-[#FF1744]/30 animate-pulse'
                            : m.status === 'FINALIZADO'
                            ? 'bg-[#FF6B1A]/10 text-[#FF6B1A] border-[#FF6B1A]/30'
                            : 'bg-[#0F1115] text-[#8E9299] border-[#262933]'
                        }`}
                      >
                        {m.status === 'EM_ANDAMENTO' ? '● AO VIVO' : m.status}
                      </span>
                    </div>

                    {/* Match Score Display */}
                    <div className="grid grid-cols-7 items-center gap-2 py-2">
                      {/* Mandante */}
                      <div className="col-span-3 text-right space-y-1">
                        <div className="flex items-center justify-end space-x-2">
                          <span className="font-extrabold text-white text-xs sm:text-sm uppercase tracking-wide truncate">
                            {m.time_mandante_nome}
                          </span>
                          <div
                            className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                            style={{ backgroundColor: m.time_mandante_cor }}
                          />
                        </div>
                      </div>

                      {/* Placar Central */}
                      <div className="col-span-1 text-center">
                        <div className="bg-[#0F1115] py-2 px-2 rounded-xl border border-[#262933] text-center">
                          <span className="text-lg sm:text-xl font-mono font-black text-[#FF6B1A]">
                            {m.gols_mandante} - {m.gols_visitante}
                          </span>
                        </div>
                      </div>

                      {/* Visitante */}
                      <div className="col-span-3 text-left space-y-1">
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                            style={{ backgroundColor: m.time_visitante_cor }}
                          />
                          <span className="font-extrabold text-white text-xs sm:text-sm uppercase tracking-wide truncate">
                            {m.time_visitante_nome}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Goal Scorers breakdown if match played */}
                    {(mandanteGoals.length > 0 || visitanteGoals.length > 0) && (
                      <div className="pt-3 border-t border-[#262933] grid grid-cols-2 gap-3 text-[11px] font-mono text-[#8E9299]">
                        {/* Mandante Goals */}
                        <div className="space-y-1 text-right border-r border-[#262933] pr-2">
                          {mandanteGoals.map((g) => (
                            <p key={g.id} className="truncate">
                              ⚽ <span className="text-white font-semibold">{g.jogador_nome}</span> <span className="text-[#FF6B1A]">({g.minuto_jogo}')</span>
                            </p>
                          ))}
                        </div>

                        {/* Visitante Goals */}
                        <div className="space-y-1 text-left pl-2">
                          {visitanteGoals.map((g) => (
                            <p key={g.id} className="truncate">
                              ⚽ <span className="text-white font-semibold">{g.jogador_nome}</span> <span className="text-[#FF6B1A]">({g.minuto_jogo}')</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: ARTILHARIA & DESTAQUES */}
      {activeTab === 'artilharia' && (
        <div className="bg-[#161920] border border-[#262933] rounded-2xl p-5 sm:p-6 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-[#262933]">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <Flame className="w-4 h-4 text-[#FFC400]" />
                <span>Top Artilheiros do Torneio - {activeCategoryName}</span>
              </h3>
              <p className="text-[11px] text-[#8E9299]">Jogadores com mais gols convertidos na competição.</p>
            </div>
          </div>

          {artilharia.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Flame className="w-10 h-10 text-[#8E9299] mx-auto opacity-50" />
              <p className="text-xs font-bold text-white uppercase tracking-wider">Nenhum gol registrado ainda</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {artilharia.map((art, idx) => {
                const pos = POSICOES_MAP[art.camisa_posicao] || { nome: 'Atleta', sigla: 'ATL' };
                return (
                  <div
                    key={art.jogador_id}
                    className="bg-[#0F1115] p-4 rounded-2xl border border-[#262933] hover:border-[#FF6B1A]/40 transition-all flex items-center justify-between shadow-lg"
                  >
                    <div className="flex items-center space-x-3.5">
                      <span className={`w-8 h-8 font-mono font-black text-xs rounded-xl flex items-center justify-center ${
                        idx === 0 ? 'bg-[#FFC400] text-black shadow-[0_0_12px_rgba(255,196,0,0.4)]' :
                        idx === 1 ? 'bg-slate-300 text-black' :
                        idx === 2 ? 'bg-amber-700 text-white' :
                        'bg-[#161920] text-[#8E9299] border border-[#262933]'
                      }`}>
                        {idx + 1}º
                      </span>

                      <div>
                        <h4 className="font-extrabold text-white text-xs sm:text-sm uppercase tracking-wide">
                          {art.jogador_nome}
                        </h4>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-[10px] text-[#8E9299] font-mono uppercase">{art.time_nome}</span>
                          <span className="text-[9px] px-1.5 py-0.2 bg-[#161920] text-[#FF6B1A] font-mono rounded font-bold border border-[#262933]">
                            {pos.sigla}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xl font-mono font-black text-[#FF6B1A]">{art.gols}</span>
                      <span className="block text-[9px] font-mono text-[#8E9299] uppercase">gols</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: TIMES & ELENCOS */}
      {activeTab === 'times' && (
        <div className="space-y-6">
          <div className="bg-[#161920] border border-[#262933] rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xl">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Users className="w-4 h-4 text-[#FF6B1A]" />
              <span>Times Cadastrados ({teams.length})</span>
            </h3>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8E9299] absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar time ou jogador..."
                value={searchTeamQuery}
                onChange={(e) => setSearchTeamQuery(e.target.value)}
                className="bg-[#0F1115] text-white text-xs rounded-xl pl-8 pr-3 py-2 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A] w-full sm:w-64"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams
              .filter((t) => t.nome.toLowerCase().includes(searchTeamQuery.toLowerCase()))
              .map((t) => {
                const teamRoster = players.filter((p) => p.time_id === t.id);

                return (
                  <div
                    key={t.id}
                    className="bg-[#161920] border border-[#262933] rounded-2xl p-5 hover:border-[#FF6B1A]/40 transition-all shadow-xl space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-[#262933]">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black border border-white/20 shadow-md shrink-0"
                          style={{ backgroundColor: t.cor_hex }}
                        >
                          ⚽
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white uppercase tracking-wider">{t.nome}</h4>
                          <p className="text-[10px] text-[#8E9299] font-mono">
                            {teamRoster.length} atletas sorteados
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Elenco Roster */}
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                      {teamRoster.length === 0 ? (
                        <p className="text-xs text-[#8E9299] text-center py-4">Aguardando sorteio do draft...</p>
                      ) : (
                        teamRoster.map((p) => {
                          const pos = POSICOES_MAP[p.camisa_posicao] || { sigla: 'JOG' };
                          return (
                            <div
                              key={p.id}
                              className="p-2 bg-[#0F1115] border border-[#262933] rounded-xl flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center space-x-2">
                                <span className="w-5 h-5 bg-[#161920] text-[#FF6B1A] font-mono font-bold text-[10px] rounded flex items-center justify-center border border-[#262933]">
                                  {pos.sigla}
                                </span>
                                <span className="font-semibold text-white truncate max-w-[140px]">
                                  {p.nome}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};
