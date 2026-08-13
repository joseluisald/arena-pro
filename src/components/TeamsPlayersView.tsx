/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Jogador, POSICOES_MAP, Time } from '../types';
import { query, runQuery } from '../services/db';
import { Users, Plus, Shield, CheckCircle, Clock, Trash2, Edit, DollarSign, Filter } from 'lucide-react';
import { TeamBadge } from './TeamBadge';

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

  // Edit Team & Edit Player States
  const [editingTeam, setEditingTeam] = useState<Time | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamColor, setEditTeamColor] = useState('#2563EB');
  const [editTeamBadge, setEditTeamBadge] = useState('🛡️');

  const [editingPlayer, setEditingPlayer] = useState<Jogador | null>(null);
  const [editPlayerName, setEditPlayerName] = useState('');
  const [editPlayerCamisa, setEditPlayerCamisa] = useState(1);
  const [editPlayerTeamId, setEditPlayerTeamId] = useState<number | null>(null);
  const [editPlayerPaid, setEditPlayerPaid] = useState(0);

  const handleOpenEditTeam = (team: Time) => {
    setEditingTeam(team);
    setEditTeamName(team.nome);
    setEditTeamColor(team.cor_hex || '#2563EB');
    setEditTeamBadge(team.brasao_path || '🛡️');
  };

  const handleSaveEditTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam || !editTeamName.trim()) return;

    await runQuery(
      `UPDATE times SET nome = ?, brasao_path = ?, cor_hex = ? WHERE id = ?;`,
      [editTeamName.trim(), editTeamBadge.trim(), editTeamColor, editingTeam.id]
    );

    setEditingTeam(null);
    loadData();
  };

  const handleOpenEditPlayer = (player: Jogador) => {
    setEditingPlayer(player);
    setEditPlayerName(player.nome);
    setEditPlayerCamisa(player.camisa_posicao);
    setEditPlayerTeamId(player.time_id);
    setEditPlayerPaid(player.pago);
  };

  const handleSaveEditPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer || !editPlayerName.trim()) return;

    // Ensure valid team ID or explicit null
    const validTeamId = editPlayerTeamId && Number(editPlayerTeamId) > 0 ? Number(editPlayerTeamId) : null;

    await runQuery(
      `UPDATE jogadores SET nome = ?, camisa_posicao = ?, time_id = ?, pago = ? WHERE id = ?;`,
      [editPlayerName.trim(), editPlayerCamisa, validTeamId, editPlayerPaid, editingPlayer.id]
    );

    setEditingPlayer(null);
    loadData();
  };

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
    try {
      await runQuery(`DELETE FROM suspensoes WHERE partida_origem_id IN (SELECT id FROM partidas WHERE time_mandante_id = ? OR time_visitante_id = ?);`, [teamId, teamId]);
      await runQuery(`DELETE FROM eventos_partida WHERE time_id = ? OR partida_id IN (SELECT id FROM partidas WHERE time_mandante_id = ? OR time_visitante_id = ?);`, [teamId, teamId, teamId]);
      await runQuery(`DELETE FROM partidas WHERE time_mandante_id = ? OR time_visitante_id = ?;`, [teamId, teamId]);
      await runQuery(`UPDATE jogadores SET time_id = NULL WHERE time_id = ?;`, [teamId]);
      await runQuery(`DELETE FROM times WHERE id = ?;`, [teamId]);
    } catch (e) {
      console.error('Erro ao deletar time:', e);
    }
    loadData();
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
    try {
      await runQuery(`DELETE FROM suspensoes WHERE jogador_id = ?;`, [playerId]);
      await runQuery(`DELETE FROM eventos_partida WHERE jogador_id = ?;`, [playerId]);
      await runQuery(`DELETE FROM jogadores WHERE id = ?;`, [playerId]);
    } catch (e) {
      console.error('Erro ao deletar jogador:', e);
    }
    loadData();
  };

  return (
    <div className="space-y-6">
      {/* Top Tabs & Add Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#161920] p-4 rounded-2xl border border-[#262933] shadow-xl">
        <div className="flex space-x-2 bg-[#0F1115] p-1.5 rounded-2xl border border-[#262933]">
          <button
            onClick={() => setActiveTab('times')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all ${
              activeTab === 'times'
                ? 'bg-[#FF6B1A] text-black shadow-[0_0_10px_rgba(255,107,26,0.3)]'
                : 'text-[#8E9299] hover:text-white'
            }`}
          >
            Times Cadastrados ({teams.length})
          </button>

          <button
            onClick={() => setActiveTab('jogadores')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all ${
              activeTab === 'jogadores'
                ? 'bg-[#FF6B1A] text-black shadow-[0_0_10px_rgba(255,107,26,0.3)]'
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
              className="px-4 py-2.5 bg-[#FF6B1A] hover:bg-[#e05a0f] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(255,107,26,0.3)] transition-all flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Time</span>
            </button>
          ) : (
            <button
              onClick={() => setShowPlayerModal(true)}
              className="px-4 py-2.5 bg-[#FF6B1A] hover:bg-[#e05a0f] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(255,107,26,0.3)] transition-all flex items-center space-x-1.5"
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
              className="bg-[#161920] border border-[#262933] rounded-2xl p-5 hover:border-[#FF6B1A]/40 transition-all shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black shadow-md border border-white/20 overflow-hidden"
                    style={{ backgroundColor: t.cor_hex }}
                  >
                    <TeamBadge badge={t.brasao_path} name={t.nome} className="w-12 h-12" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">{t.nome}</h3>
                    <p className="text-[10px] text-[#8E9299] font-mono">{t.jogadores_count || 0} jogadores sorteados</p>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleOpenEditTeam(t)}
                    className="p-2 text-[#8E9299] hover:text-[#FF6B1A] transition-colors"
                    title="Editar nome e brasão do time"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTeam(t.id)}
                    className="p-2 text-[#8E9299] hover:text-[#FF1744] transition-colors"
                    title="Excluir time"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content: Jogadores */}
      {activeTab === 'jogadores' && (
        <div className="bg-[#161920] border border-[#262933] rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0F1115] text-[#8E9299] uppercase font-mono font-bold border-b border-[#262933] text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Nome do Atleta</th>
                  <th className="py-3 px-4">Posição / Pote</th>
                  <th className="py-3 px-4">Time Atual</th>
                  <th className="py-3 px-4">Pagamento</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262933]">
                {players.map((p) => {
                  const posInfo = POSICOES_MAP[p.camisa_posicao] || { nome: 'Jogador', sigla: 'JOG' };
                  return (
                    <tr key={p.id} className="hover:bg-[#0F1115]/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{p.nome}</td>
                      <td className="py-3 px-4 text-[#E0E6ED]">
                        <span className="px-2 py-0.5 bg-[#0F1115] text-[#FF6B1A] rounded font-mono font-bold text-[10px] border border-[#262933]">
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
                              ? 'bg-[#FF6B1A]/20 text-[#FF6B1A] border-[#FF6B1A]/30'
                              : 'bg-[#FFC400]/20 text-[#FFC400] border-[#FFC400]/30'
                          }`}
                        >
                          {p.pago ? '✓ Inscrição Paga' : '⏳ Pendente'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleOpenEditPlayer(p)}
                            className="text-[#8E9299] hover:text-[#FF6B1A] transition-colors p-1"
                            title="Editar jogador e atrelar ao time"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePlayer(p.id)}
                            className="text-[#8E9299] hover:text-[#FF1744] transition-colors p-1"
                            title="Excluir jogador"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
          <div className="bg-[#161920] border border-[#262933] rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
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
                  className="w-full bg-[#0F1115] text-white rounded-xl p-3 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A]"
                />
              </div>

              <div>
                <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">Cor Principal (Hex)</label>
                <input
                  type="color"
                  value={newTeamColor}
                  onChange={(e) => setNewTeamColor(e.target.value)}
                  className="w-full h-10 bg-[#0F1115] rounded-xl p-1 border border-[#262933] cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">
                  Brasão (Emoji ou URL de Imagem)
                </label>
                <div className="flex items-center space-x-2">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center border border-[#262933] shrink-0 overflow-hidden text-lg"
                    style={{ backgroundColor: newTeamColor }}
                  >
                    <TeamBadge badge={newTeamBadge} name={newTeamName} className="w-10 h-10" />
                  </div>
                  <input
                    type="text"
                    value={newTeamBadge}
                    onChange={(e) => setNewTeamBadge(e.target.value)}
                    placeholder="🛡️ ou https://..."
                    className="w-full bg-[#0F1115] text-white rounded-xl p-2.5 border border-[#262933] font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#FF6B1A]"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTeamModal(false)}
                  className="px-4 py-2 bg-[#0F1115] text-[#E0E6ED] hover:bg-[#222632] border border-[#262933] rounded-xl font-mono text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FF6B1A] hover:bg-[#e05a0f] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(255,107,26,0.3)]"
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
          <div className="bg-[#161920] border border-[#262933] rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
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
                  className="w-full bg-[#0F1115] text-white rounded-xl p-3 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A]"
                />
              </div>

              <div>
                <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">Camisa / Pote do Sorteio</label>
                <select
                  value={newPlayerCamisa}
                  onChange={(e) => setNewPlayerCamisa(Number(e.target.value))}
                  className="w-full bg-[#0F1115] text-white rounded-xl p-3 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A]"
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
                  className="w-full bg-[#0F1115] text-white rounded-xl p-3 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A]"
                >
                  <option value={1}>Pago</option>
                  <option value={0}>Pendente</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPlayerModal(false)}
                  className="px-4 py-2 bg-[#0F1115] text-[#E0E6ED] hover:bg-[#222632] border border-[#262933] rounded-xl font-mono text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FF6B1A] hover:bg-[#e05a0f] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(255,107,26,0.3)]"
                >
                  Salvar Jogador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Time */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#161920] border border-[#262933] rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-white uppercase tracking-tight">Editar Time</h3>
            <form onSubmit={handleSaveEditTeam} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">Nome do Time</label>
                <input
                  type="text"
                  required
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  className="w-full bg-[#0F1115] text-white rounded-xl p-3 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A]"
                />
              </div>

              <div>
                <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">Cor Principal</label>
                <input
                  type="color"
                  value={editTeamColor}
                  onChange={(e) => setEditTeamColor(e.target.value)}
                  className="w-full h-10 bg-[#0F1115] rounded-xl p-1 border border-[#262933] cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">
                  Brasão (Emoji ou URL de Imagem)
                </label>
                <div className="flex items-center space-x-2">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center border border-[#262933] shrink-0 overflow-hidden text-lg"
                    style={{ backgroundColor: editTeamColor }}
                  >
                    <TeamBadge badge={editTeamBadge} name={editTeamName} className="w-10 h-10" />
                  </div>
                  <input
                    type="text"
                    value={editTeamBadge}
                    onChange={(e) => setEditTeamBadge(e.target.value)}
                    placeholder="🛡️ ou https://..."
                    className="w-full bg-[#0F1115] text-white rounded-xl p-2.5 border border-[#262933] font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#FF6B1A]"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTeam(null)}
                  className="px-4 py-2 bg-[#0F1115] text-[#E0E6ED] hover:bg-[#222632] border border-[#262933] rounded-xl font-mono text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FF6B1A] hover:bg-[#e05a0f] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(255,107,26,0.3)]"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Jogador */}
      {editingPlayer && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#161920] border border-[#262933] rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-white uppercase tracking-tight">Editar Atleta</h3>
            <form onSubmit={handleSaveEditPlayer} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">Nome do Jogador</label>
                <input
                  type="text"
                  required
                  value={editPlayerName}
                  onChange={(e) => setEditPlayerName(e.target.value)}
                  className="w-full bg-[#0F1115] text-white rounded-xl p-3 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A]"
                />
              </div>

              <div>
                <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">Posição / Pote no Sorteio</label>
                <select
                  value={editPlayerCamisa}
                  onChange={(e) => setEditPlayerCamisa(Number(e.target.value))}
                  className="w-full bg-[#0F1115] text-white rounded-xl p-3 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A]"
                >
                  {Object.entries(POSICOES_MAP).map(([k, v]) => (
                    <option key={k} value={k}>
                      Pote #{k} - {v.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">Time Atribuído</label>
                <select
                  value={editPlayerTeamId ?? ''}
                  onChange={(e) => setEditPlayerTeamId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-[#0F1115] text-white rounded-xl p-3 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A]"
                >
                  <option value="">Sem time (Livre / Aguardando Draft)</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.brasao_path || '🛡️'} {t.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">Status do Pagamento</label>
                <select
                  value={editPlayerPaid}
                  onChange={(e) => setEditPlayerPaid(Number(e.target.value))}
                  className="w-full bg-[#0F1115] text-white rounded-xl p-3 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A]"
                >
                  <option value={1}>Pago (Inscrição Confirmada)</option>
                  <option value={0}>Pendente</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPlayer(null)}
                  className="px-4 py-2 bg-[#0F1115] text-[#E0E6ED] hover:bg-[#222632] border border-[#262933] rounded-xl font-mono text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FF6B1A] hover:bg-[#e05a0f] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(255,107,26,0.3)]"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
