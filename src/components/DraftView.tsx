/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Jogador, POSICOES_MAP, Time } from '../types';
import { executeDraft, resetDraft } from '../services/draftService';
import { query } from '../services/db';
import { Shuffle, RotateCcw, Users, ShieldCheck, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface DraftViewProps {
  categoriaId: number;
  onNavigateToGames: () => void;
}

export const DraftView: React.FC<DraftViewProps> = ({ categoriaId, onNavigateToGames }) => {
  const [teams, setTeams] = useState<Time[]>([]);
  const [players, setPlayers] = useState<Jogador[]>([]);
  const [loading, setLoading] = useState(false);
  const [potGrouped, setPotGrouped] = useState<Record<number, Jogador[]>>({});

  useEffect(() => {
    loadDraftData();
  }, [categoriaId]);

  const loadDraftData = async () => {
    // Load teams
    const tList = await query<Time>(
      `SELECT t.*, 
         (SELECT COUNT(*) FROM jogadores j WHERE j.time_id = t.id) as jogadores_count
       FROM times t 
       WHERE t.categoria_id = ? 
       ORDER BY t.id ASC;`,
      [categoriaId]
    );
    setTeams(tList);

    // Load players
    const pList = await query<Jogador>(
      `SELECT j.*, t.nome as time_nome, t.cor_hex as time_cor_hex
       FROM jogadores j
       LEFT JOIN times t ON j.time_id = t.id
       WHERE j.categoria_id = ?
       ORDER BY j.camisa_posicao ASC, j.nome ASC;`,
      [categoriaId]
    );
    setPlayers(pList);

    // Group by pot
    const grouped: Record<number, Jogador[]> = {};
    pList.forEach((p) => {
      if (!grouped[p.camisa_posicao]) grouped[p.camisa_posicao] = [];
      grouped[p.camisa_posicao].push(p);
    });
    setPotGrouped(grouped);
  };

  const handleRunDraft = async () => {
    if (teams.length === 0) {
      alert('Cadastre times na categoria antes de executar o sorteio.');
      return;
    }

    try {
      setLoading(true);
      await executeDraft(categoriaId);
      await loadDraftData();

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (e: any) {
      alert(e.message || 'Erro ao executar sorteio');
    } finally {
      setLoading(false);
    }
  };

  const handleResetDraft = async () => {
    if (confirm('Deseja realmente desfazer o sorteio e liberar todos os jogadores?')) {
      await resetDraft(categoriaId);
      await loadDraftData();
    }
  };

  const isDrafted = players.some((p) => p.time_id !== null);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center space-x-2">
            <Shuffle className="w-5 h-5 text-[#00E676]" />
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Algoritmo de Sorteio por Pote (Draft)</h2>
          </div>
          <p className="text-xs text-[#8E9299] mt-1 max-w-2xl">
            Distribui os atletas proporcionalmente entre os times. O sistema pega os jogadores por Pote/Camisa (1=Goleiro, 2=Zagueiro, etc.), embaralha aleatoriamente e aloca 1 por time sequencialmente.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {isDrafted && (
            <button
              onClick={handleResetDraft}
              className="px-4 py-2.5 bg-[#2D3139] hover:bg-[#3D424D] text-[#E0E6ED] rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center space-x-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Desfazer Sorteio</span>
            </button>
          )}

          <button
            onClick={handleRunDraft}
            disabled={loading}
            className="px-5 py-2.5 bg-[#00E676] hover:bg-[#00c853] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,230,118,0.3)] transition-all flex items-center space-x-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? 'Sorteando...' : isDrafted ? 'Refazer Sorteio' : 'Executar Sorteio'}</span>
          </button>
        </div>
      </div>

      {/* Pots Overview Horizontal Scroll */}
      <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-5 space-y-3">
        <h3 className="text-xs font-bold text-[#8E9299] uppercase tracking-widest flex items-center space-x-2">
          <Users className="w-4 h-4 text-[#00E676]" />
          <span>Potes e Posições para Sorteio</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {Object.entries(POSICOES_MAP).map(([posKey, posData]) => {
            const potNumber = Number(posKey);
            const potPlayers = potGrouped[potNumber] || [];
            return (
              <div
                key={potNumber}
                className="bg-[#0F1115] p-3 rounded-xl border border-[#2D3139] space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-[#8E9299] uppercase">Pote #{potNumber}</span>
                  <span className="text-[10px] font-mono bg-[#2D3139] text-[#00E676] px-1.5 py-0.5 rounded font-bold">
                    {potPlayers.length}
                  </span>
                </div>
                <p className="text-xs font-bold text-white truncate">{posData.nome}</p>
                <p className="text-[10px] text-[#8E9299] font-mono">Sigla: {posData.sigla}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Team Roster Grid post Draft */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-[#8E9299] uppercase tracking-widest">
            Elencos Formados por Time ({teams.length})
          </h3>
          {isDrafted && (
            <button
              onClick={onNavigateToGames}
              className="text-xs text-[#00E676] hover:underline font-bold uppercase tracking-wider flex items-center space-x-1"
            >
              <span>Avançar para Gerar Confrontos →</span>
            </button>
          )}
        </div>

        {teams.length === 0 ? (
          <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-8 text-center space-y-2">
            <AlertCircle className="w-10 h-10 text-[#8E9299] mx-auto" />
            <p className="text-sm font-bold text-white uppercase tracking-wider">Nenhum time cadastrado nesta categoria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => {
              const teamRoster = players.filter((p) => p.time_id === team.id);
              return (
                <div
                  key={team.id}
                  className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-5 space-y-4 hover:border-[#00E676]/40 transition-all shadow-xl"
                >
                  {/* Team Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#2D3139]">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black border border-white/20 shadow-md"
                        style={{ backgroundColor: team.cor_hex }}
                      >
                        {team.brasao_path || '🛡️'}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-wider">{team.nome}</h4>
                        <p className="text-[10px] text-[#8E9299] font-mono">
                          {teamRoster.length} atletas sorteados
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Player List */}
                  {teamRoster.length === 0 ? (
                    <p className="text-xs text-[#8E9299] text-center py-4">Aguardando sorteio...</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                      {teamRoster.map((player) => {
                        const posInfo = POSICOES_MAP[player.camisa_posicao] || {
                          nome: 'Jogador',
                          sigla: 'JOG',
                        };
                        return (
                          <div
                            key={player.id}
                            className="p-2.5 bg-[#0F1115] border border-[#2D3139] rounded-xl flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="w-6 h-6 bg-[#2D3139] text-[#00E676] font-mono font-bold text-[10px] rounded flex items-center justify-center border border-[#2D3139]">
                                {posInfo.sigla}
                              </span>
                              <span className="font-semibold text-white truncate max-w-[140px]">
                                {player.nome}
                              </span>
                            </div>

                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                                player.pago
                                  ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20'
                                  : 'bg-[#FFC400]/10 text-[#FFC400] border border-[#FFC400]/20'
                              }`}
                            >
                              {player.pago ? 'Pago' : 'Pendente'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
