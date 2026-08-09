/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Jogador, POSICOES_MAP, Time } from '../types';
import { query, runQuery } from '../services/db';
import { Users, Plus, Shield, CheckCircle, Clock, Trash2, Edit, DollarSign, Filter } from 'lucide-react';

interface TeamsPlayersViewProps {
  categoriaId: number;
}

export const TeamsPlayersView: React.FC<TeamsPlayersViewProps> = ({ categoriaId }) => {
  const [activeTab, setActiveTab] = useState<'times' | 'jogadores'>('times');
  const [teams, setTeams] = useState<Time[]>([]);
  const [players, setPlayers] = useState<Jogador[]>([]);

  // Modal / Form States
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('#2563EB');
  const [newTeamBadge, setNewTeamBadge] = useState('🛡️');

  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerCamisa, setNewPlayerCamisa] = useState(1);
  const [newPlayerPaid, setNewPlayerPaid] = useState(0);

  useEffect(() => {
    loadData();
  }, [categoriaId]);

  const loadData = async () => {
    const tList = await query<Time>(
      `SELECT t.*, 
         (SELECT COUNT(*) FROM jogadores j WHERE j.time_id = t.id) as jogadores_count
       FROM times t 
       WHERE t.categoria_id = ? 
       ORDER BY t.id ASC;`,
      [categoriaId]
    );
    setTeams(tList);

    const pList = await query<Jogador>(
      `SELECT j.*, t.nome as time_nome, t.cor_hex as time_cor_hex
       FROM jogadores j
       LEFT JOIN times t ON j.time_id = t.id
       WHERE j.categoria_id = ?
       ORDER BY j.camisa_posicao ASC, j.nome ASC;`,
      [categoriaId]
    );
    setPlayers(pList);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    await runQuery(
      `INSERT INTO times (nome, brasao_path, cor_hex, categoria_id)
       VALUES (?, ?, ?, ?);`,
      [newTeamName.trim(), newTeamBadge, newTeamColor, categoriaId]
    );

    setNewTeamName('');
    setShowTeamModal(false);
    loadData();
  };

  const handleDeleteTeam = async (teamId: number) => {
    if (confirm('Deseja excluir este time? Os jogadores ficarão sem time atribuído.')) {
      await runQuery('DELETE FROM times WHERE id = ?;', [teamId]);
      loadData();
    }
  };

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    await runQuery(
      `INSERT INTO jogadores (nome, camisa_posicao, pago, categoria_id)
       VALUES (?, ?, ?, ?);`,
      [newPlayerName.trim(), newPlayerCamisa, newPlayerPaid, categoriaId]
    );

    setNewPlayerName('');
    setShowPlayerModal(false);
    loadData();
  };

  const handleTogglePayment = async (playerId: number, currentPaid: number) => {
    const nextPaid = currentPaid ? 0 : 1;
    await runQuery('UPDATE jogadores SET pago = ? WHERE id = ?;', [nextPaid, playerId]);
    loadData();
  };

  const handleDeletePlayer = async (playerId: number) => {
    if (confirm('Deseja excluir este jogador?')) {
      await runQuery('DELETE FROM jogadores WHERE id = ?;', [playerId]);
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Tabs & Add Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#16191F] p-4 rounded-2xl border border-[#2D3139] shadow-xl">
        <div className="flex space-x-2 bg-[#0F1115] p-1.5 rounded-2xl border border-[#2D3139]">
          <button
            onClick={() => setActiveTab('times')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all ${
              activeTab === 'times'
                ? 'bg-[#00E676] text-black shadow-[0_0_10px_rgba(0,230,118,0.3)]'
                : 'text-[#8E9299] hover:text-white'
            }`}
          >
            Times Cadastrados ({teams.length})
          </button>

          <button
            onClick={() => setActiveTab('jogadores')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all ${
              activeTab === 'jogadores'
                ? 'bg-[#00E676] text-black shadow-[0_0_10px_rgba(0,230,118,0.3)]'
                : 'text-[#8E9299] hover:text-white'
            }`}
          >
            Jogadores Inscritos ({players.length})
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === 'times' ? (
            <button
              onClick={() => setShowTeamModal(true)}
              className="px-4 py-2.5 bg-[#00E676] hover:bg-[#00c853] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,230,118,0.3)] transition-all flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Time</span>
            </button>
          ) : (
            <button
              onClick={() => setShowPlayerModal(true)}
              className="px-4 py-2.5 bg-[#00E676] hover:bg-[#00c853] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,230,118,0.3)] transition-all flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Jogador</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Content: Times */}
      {activeTab === 'times' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((t) => (
            <div
              key={t.id}
              className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-5 hover:border-[#00E676]/40 transition-all shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black shadow-md border border-white/20"
                    style={{ backgroundColor: t.cor_hex }}
                  >
                    {t.brasao_path || '🛡️'}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">{t.nome}</h3>
                    <p className="text-[10px] text-[#8E9299] font-mono">{t.jogadores_count || 0} jogadores sorteados</p>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteTeam(t.id)}
                  className="p-2 text-[#8E9299] hover:text-[#FF1744] transition-colors"
                  title="Excluir time"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content: Jogadores */}
      {activeTab === 'jogadores' && (
        <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0F1115] text-[#8E9299] uppercase font-mono font-bold border-b border-[#2D3139] text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Nome do Atleta</th>
                  <th className="py-3 px-4">Posição / Pote</th>
                  <th className="py-3 px-4">Time Atual</th>
                  <th className="py-3 px-4">Pagamento</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2D3139]">
                {players.map((p) => {
                  const posInfo = POSICOES_MAP[p.camisa_posicao] || { nome: 'Jogador', sigla: 'JOG' };
                  return (
                    <tr key={p.id} className="hover:bg-[#0F1115]/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{p.nome}</td>
                      <td className="py-3 px-4 text-[#E0E6ED]">
                        <span className="px-2 py-0.5 bg-[#0F1115] text-[#00E676] rounded font-mono font-bold text-[10px] border border-[#2D3139]">
                          Pote #{p.camisa_posicao} - {posInfo.nome}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#E0E6ED]">
                        {p.time_nome ? (
                          <div className="flex items-center space-x-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: p.time_cor_hex }}
                            />
                            <span className="uppercase">{p.time_nome}</span>
                          </div>
                        ) : (
                          <span className="text-[#8E9299] font-normal italic">Sem time (Aguardando Draft)</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleTogglePayment(p.id, p.pago)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider transition-all border ${
                            p.pago
                              ? 'bg-[#00E676]/20 text-[#00E676] border-[#00E676]/30'
                              : 'bg-[#FFC400]/20 text-[#FFC400] border-[#FFC400]/30'
                          }`}
                        >
                          {p.pago ? '✓ Inscrição Paga' : '⏳ Pendente'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeletePlayer(p.id)}
                          className="text-[#8E9299] hover:text-[#FF1744] transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Novo Time */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-white uppercase tracking-tight">Cadastrar Novo Time</h3>
            <form onSubmit={handleCreateTeam} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">Nome do Time</label>
                <input
                  type="text"
                  required
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Ex: Real Matismo FC"
                  className="w-full bg-[#0F1115] text-white rounded-xl p-3 border border-[#2D3139] focus:outline-none focus:ring-1 focus:ring-[#00E676]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">Cor Principal (Hex)</label>
                  <input
                    type="color"
                    value={newTeamColor}
                    onChange={(e) => setNewTeamColor(e.target.value)}
                    className="w-full h-10 bg-[#0F1115] rounded-xl p-1 border border-[#2D3139] cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">Brasão (Emoji)</label>
                  <input
                    type="text"
                    value={newTeamBadge}
                    onChange={(e) => setNewTeamBadge(e.target.value)}
                    className="w-full bg-[#0F1115] text-white rounded-xl p-2.5 border border-[#2D3139] text-center font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTeamModal(false)}
                  className="px-4 py-2 bg-[#2D3139] text-[#E0E6ED] hover:bg-[#3D424D] rounded-xl font-mono text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00E676] hover:bg-[#00c853] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,230,118,0.3)]"
                >
                  Salvar Time
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo Jogador */}
      {showPlayerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-white uppercase tracking-tight">Inscrever Novo Jogador</h3>
            <form onSubmit={handleCreatePlayer} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="Ex: Carlos Silva"
                  className="w-full bg-[#0F1115] text-white rounded-xl p-3 border border-[#2D3139] focus:outline-none focus:ring-1 focus:ring-[#00E676]"
                />
              </div>

              <div>
                <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">Camisa / Pote do Sorteio</label>
                <select
                  value={newPlayerCamisa}
                  onChange={(e) => setNewPlayerCamisa(Number(e.target.value))}
                  className="w-full bg-[#0F1115] text-white rounded-xl p-3 border border-[#2D3139] focus:outline-none focus:ring-1 focus:ring-[#00E676]"
                >
                  {Object.entries(POSICOES_MAP).map(([k, v]) => (
                    <option key={k} value={k}>
                      Pote #{k} - {v.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">Status do Pagamento</label>
                <select
                  value={newPlayerPaid}
                  onChange={(e) => setNewPlayerPaid(Number(e.target.value))}
                  className="w-full bg-[#0F1115] text-white rounded-xl p-3 border border-[#2D3139] focus:outline-none focus:ring-1 focus:ring-[#00E676]"
                >
                  <option value={1}>Pago</option>
                  <option value={0}>Pendente</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPlayerModal(false)}
                  className="px-4 py-2 bg-[#2D3139] text-[#E0E6ED] hover:bg-[#3D424D] rounded-xl font-mono text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00E676] hover:bg-[#00c853] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,230,118,0.3)]"
                >
                  Salvar Jogador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
