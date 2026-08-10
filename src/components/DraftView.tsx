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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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
      setErrorMsg('Cadastre times na categoria antes de executar o sorteio.');
      return;
    }

    try {
      setErrorMsg(null);
      setLoading(true);
      await executeDraft(categoriaId);
      await loadDraftData();

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (e: any) {
      setErrorMsg(e.message || 'Erro ao executar sorteio');
    } finally {
      setLoading(false);
    }
  };

  const handleResetDraft = async () => {
    await resetDraft(categoriaId);
    await loadDraftData();
  };

  const isDrafted = players.some((p) => p.time_id !== null);

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 bg-[#FF1744]/10 border border-[#FF1744]/30 rounded-2xl flex items-center justify-between text-xs text-[#FF1744] font-mono">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="font-bold underline uppercase ml-2">
            Fechar
          </button>
        </div>
      )}
      {/* Header Banner */}
      <div className="bg-[#161920] border border-[#262933] rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Shuffle className="w-5 h-5 text-[#FF6B1A] shrink-0" />
            <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">Algoritmo de Sorteio por Pote (Draft)</h2>
          </div>
          <p className="text-xs text-[#8E9299] max-w-2xl leading-relaxed">
            Distribui os atletas proporcionalmente entre os times por Pote/Posição (1=Goleiro, 2=Zagueiro, etc.).
          </p>
          <div className="inline-flex items-center space-x-2 bg-[#FF6B1A]/10 border border-[#FF6B1A]/30 px-3 py-1 rounded-lg mt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#FF6B1A] shrink-0" />
            <span className="text-[11px] font-mono font-bold text-[#FF6B1A] uppercase">
              Apenas atletas com pagamento PAGO participam do sorteio
            </span>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto">
          {isDrafted && (
            <button
              onClick={handleResetDraft}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-[#0F1115] hover:bg-[#222632] text-[#E0E6ED] border border-[#262933] rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center space-x-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Desfazer Sorteio</span>
            </button>
          )}

          <button
            onClick={handleRunDraft}
            disabled={loading}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-[#FF6B1A] hover:bg-[#e05a0f] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(255,107,26,0.3)] transition-all flex items-center justify-center space-x-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? 'Sorteando...' : isDrafted ? 'Refazer Sorteio' : 'Executar Sorteio'}</span>
          </button>
        </div>
      </div>

      {/* Pots Overview Grid */}
      <div className="bg-[#161920] border border-[#262933] rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-[#8E9299] uppercase tracking-widest flex items-center space-x-2">
            <Users className="w-4 h-4 text-[#FF6B1A]" />
            <span>Potes e Atletas Elegíveis (Pagos)</span>
          </h3>
          <span className="text-[10px] font-mono text-[#FF6B1A] bg-[#FF6B1A]/10 px-2 py-0.5 rounded border border-[#FF6B1A]/30 font-bold">
            {players.filter((p) => p.pago).length} Atletas Elegíveis
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          {Object.entries(POSICOES_MAP).map(([posKey, posData]) => {
            const potNumber = Number(posKey);
            const potPlayers = potGrouped[potNumber] || [];
            const paidInPot = potPlayers.filter((p) => p.pago).length;
            return (
              <div
                key={potNumber}
                className="bg-[#0F1115] p-3 rounded-xl border border-[#262933] space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-[#8E9299] uppercase">Pote #{potNumber}</span>
                  <span className="text-[10px] font-mono bg-[#161920] text-[#FF6B1A] px-1.5 py-0.5 rounded font-bold border border-[#262933]">
                    {paidInPot} pagos
                  </span>
                </div>
                <p className="text-xs font-bold text-white truncate">{posData.nome}</p>
                <p className="text-[10px] text-[#8E9299] font-mono">{potPlayers.length} inscritos no total</p>
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
              className="text-xs text-[#FF6B1A] hover:underline font-bold uppercase tracking-wider flex items-center space-x-1"
            >
              <span>Avançar para Gerar Confrontos →</span>
            </button>
          )}
        </div>

        {teams.length === 0 ? (
          <div className="bg-[#161920] border border-[#262933] rounded-2xl p-8 text-center space-y-2">
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
                  className="bg-[#161920] border border-[#262933] rounded-2xl p-5 space-y-4 hover:border-[#FF6B1A]/40 transition-all shadow-xl"
                >
                  {/* Team Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#262933]">
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
                            className="p-2.5 bg-[#0F1115] border border-[#262933] rounded-xl flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="w-6 h-6 bg-[#161920] text-[#FF6B1A] font-mono font-bold text-[10px] rounded flex items-center justify-center border border-[#262933]">
                                {posInfo.sigla}
                              </span>
                              <span className="font-semibold text-white truncate max-w-[140px]">
                                {player.nome}
                              </span>
                            </div>

                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                                player.pago
                                  ? 'bg-[#FF6B1A]/10 text-[#FF6B1A] border border-[#FF6B1A]/30'
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
