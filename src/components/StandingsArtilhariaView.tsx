/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ArtilhariaItem, CartaoItem, ClassificacaoItem, DestaqueItem, GoleiroMenosVazadoItem, Suspensao } from '../types';
import { query, runQuery } from '../services/db';
import { getCategoryArtilharia, getCategoryCartoes, getCategoryDestaques, getCategoryStandings, getCategorySuspensoes, getGoleirosMenosVazados } from '../services/standingsService';
import { Trophy, Award, AlertTriangle, Flame, Shield, ShieldAlert, Sparkles, RefreshCw, CheckCircle2, RotateCcw } from 'lucide-react';
import { TeamBadge } from './TeamBadge';

interface StandingsArtilhariaViewProps {
  categoriaId: number;
}

export const StandingsArtilhariaView: React.FC<StandingsArtilhariaViewProps> = ({ categoriaId }) => {
  const [activeTab, setActiveTab] = useState<'classificacao' | 'artilharia' | 'goleiros' | 'cartoes' | 'suspensoes' | 'destaques'>('classificacao');
  const [standings, setStandings] = useState<ClassificacaoItem[]>([]);
  const [artilharia, setArtilharia] = useState<ArtilhariaItem[]>([]);
  const [goleiros, setGoleiros] = useState<GoleiroMenosVazadoItem[]>([]);
  const [cartoes, setCartoes] = useState<CartaoItem[]>([]);
  const [suspensoes, setSuspensoes] = useState<Suspensao[]>([]);
  const [destaques, setDestaques] = useState<DestaqueItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [categoriaId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Standings calculated using the unified, sports-standard engine
      const processedStandings = await getCategoryStandings(categoriaId, { includeLive: true });
      setStandings(processedStandings);

      // 2. Artilharia (all recorded goals in category)
      const artRes = await getCategoryArtilharia(categoriaId);
      setArtilharia(artRes);

      // 3. Goleiro Menos Vazado / Defesa Menos Vazada
      const gks = await getGoleirosMenosVazados(categoriaId);
      setGoleiros(gks);

      // 4. Cartões & Disciplina
      const cardsRes = await getCategoryCartoes(categoriaId);
      setCartoes(cardsRes);

      // 5. Suspensões Automáticas
      const suspRes = await getCategorySuspensoes(categoriaId);
      setSuspensoes(suspRes);

      // 6. Destaques
      const destRes = await getCategoryDestaques(categoriaId);
      setDestaques(destRes);
    } catch (err) {
      console.error('[StandingsArtilhariaView loadData Error]:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSuspensao = async (susp: Suspensao) => {
    try {
      const novoCumpridos = (susp.jogos_cumpridos || 0) >= (susp.jogos_cumprir || 1) ? 0 : (susp.jogos_cumprir || 1);
      await runQuery(`UPDATE suspensoes SET jogos_cumpridos = ? WHERE id = ?;`, [novoCumpridos, susp.id]);
      await loadData();
    } catch (err) {
      console.error('[handleToggleSuspensao Error]:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Tabs */}
      <div className="flex overflow-x-auto scrollbar-none gap-2 bg-[#161920] p-2 rounded-2xl border border-[#262933]">
        <button
          onClick={() => setActiveTab('classificacao')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'classificacao'
              ? 'bg-[#FF6B1A] text-black shadow-[0_0_15px_rgba(255,107,26,0.3)]'
              : 'text-[#8E9299] hover:text-white'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Classificação</span>
        </button>

        <button
          onClick={() => setActiveTab('artilharia')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'artilharia'
              ? 'bg-[#FF6B1A] text-black shadow-[0_0_15px_rgba(255,107,26,0.3)]'
              : 'text-[#8E9299] hover:text-white'
          }`}
        >
          <Flame className="w-4 h-4 text-[#FFC400]" />
          <span>Artilharia ({artilharia.reduce((acc, a) => acc + a.gols, 0)} gols)</span>
        </button>

        <button
          onClick={() => setActiveTab('goleiros')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'goleiros'
              ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]'
              : 'text-[#8E9299] hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4 text-blue-300" />
          <span>Goleiro Menos Vazado</span>
        </button>

        <button
          onClick={() => setActiveTab('cartoes')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'cartoes'
              ? 'bg-[#FFC400] text-black shadow-[0_0_15px_rgba(255,196,0,0.3)]'
              : 'text-[#8E9299] hover:text-white'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Cartões & Disciplina</span>
        </button>

        <button
          onClick={() => setActiveTab('suspensoes')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'suspensoes'
              ? 'bg-[#FF1744] text-white shadow-[0_0_15px_rgba(255,23,68,0.3)]'
              : 'text-[#8E9299] hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-[#FF1744]" />
          <span>Suspensões ({suspensoes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('destaques')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'destaques'
              ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]'
              : 'text-[#8E9299] hover:text-white'
          }`}
        >
          <Award className="w-4 h-4 text-purple-300" />
          <span>Craques</span>
        </button>
      </div>

      {/* Tab: Classificação Table */}
      {activeTab === 'classificacao' && (
        <div className="bg-[#161920] border border-[#262933] rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-[#262933] flex items-center justify-between gap-3">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center space-x-2">
              <Trophy className="w-4 h-4 text-[#FFC400]" />
              <span>Tabela Oficial de Classificação</span>
            </h3>
            <button
              onClick={loadData}
              className="p-1.5 hover:bg-[#0F1115] text-[#8E9299] hover:text-white rounded-lg transition-colors"
              title="Atualizar Tabela"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0F1115] text-[#8E9299] uppercase font-bold border-b border-[#262933] text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Pos</th>
                  <th className="py-3 px-4 font-sans">Time</th>
                  <th className="py-3 px-3 text-center text-[#FF6B1A] font-bold">P</th>
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
                {standings.map((st, idx) => (
                  <tr key={st.time_id} className="hover:bg-[#0F1115]/50 transition-colors">
                    <td className="py-3 px-4 font-black text-[#8E9299]">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        idx === 0 ? 'bg-[#FFC400]/20 text-[#FFC400] border border-[#FFC400]/30' :
                        idx === 1 ? 'bg-slate-300/20 text-slate-300 border border-slate-300/30' :
                        idx === 2 ? 'bg-amber-700/20 text-amber-500 border border-amber-700/30' : ''
                      }`}>
                        {idx + 1}º
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-white font-sans">
                      <div className="flex items-center space-x-2.5">
                        <TeamBadge badge={st.time_brasao_path} name={st.time_nome} className="w-5 h-5 text-sm" />
                        <div
                          className="w-2.5 h-2.5 rounded-full border border-white/20"
                          style={{ backgroundColor: st.time_cor_hex }}
                        />
                        <span className="truncate max-w-[160px] uppercase">{st.time_nome}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-black text-sm text-[#FF6B1A]">{st.pontos}</td>
                    <td className="py-3 px-3 text-center font-bold text-[#E0E6ED]">{st.jogos}</td>
                    <td className="py-3 px-3 text-center text-[#8E9299]">{st.vitorias}</td>
                    <td className="py-3 px-3 text-center text-[#8E9299]">{st.empates}</td>
                    <td className="py-3 px-3 text-center text-[#8E9299]">{st.derrotas}</td>
                    <td className="py-3 px-3 text-center text-[#8E9299]">{st.gols_pro}</td>
                    <td className="py-3 px-3 text-center text-[#8E9299]">{st.gols_contra}</td>
                    <td className="py-3 px-3 text-center font-bold text-white">{st.saldo_gols}</td>
                    <td className="py-3 px-3 text-center text-[#8E9299]">{st.aproveitamento}%</td>
                  </tr>
                ))}
                {standings.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-xs text-[#8E9299]">
                      Nenhum time cadastrado nesta categoria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Artilharia */}
      {activeTab === 'artilharia' && (
        <div className="bg-[#161920] border border-[#262933] rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#262933] pb-3">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center space-x-2">
              <Flame className="w-4 h-4 text-[#FFC400]" />
              <span>Ranking de Artilheiros da Categoria</span>
            </h3>
            <span className="text-[10px] font-mono text-[#8E9299]">{artilharia.length} goleador(es)</span>
          </div>

          {artilharia.length === 0 ? (
            <p className="text-xs text-[#8E9299] text-center py-8">Nenhum gol registrado até o momento.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {artilharia.map((art, idx) => (
                <div
                  key={art.jogador_id}
                  className="bg-[#0F1115] p-4 rounded-xl border border-[#262933] flex items-center justify-between hover:border-[#FF6B1A]/40 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className={`w-7 h-7 font-mono font-black text-xs rounded-lg flex items-center justify-center border ${
                      idx === 0 ? 'bg-[#FFC400]/20 text-[#FFC400] border-[#FFC400]/40' :
                      idx === 1 ? 'bg-slate-300/20 text-slate-300 border-slate-300/40' :
                      idx === 2 ? 'bg-amber-700/20 text-amber-500 border-amber-700/40' :
                      'bg-[#161920] text-[#8E9299] border-[#262933]'
                    }`}>
                      {idx + 1}º
                    </span>
                    <div>
                      <p className="font-bold text-white text-xs">{art.jogador_nome}</p>
                      <div className="flex items-center space-x-1.5 text-[10px] text-[#8E9299] mt-0.5">
                        <TeamBadge badge={art.time_brasao_path} name={art.time_nome} className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[120px]">{art.time_nome}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#FF6B1A]/10 border border-[#FF6B1A]/30 text-[#FF6B1A] px-3 py-1 rounded-xl font-mono font-black text-xs">
                    {art.gols} {art.gols === 1 ? 'Gol' : 'Gols'} ⚽
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Goleiro Menos Vazado */}
      {activeTab === 'goleiros' && (
        <div className="bg-[#161920] border border-[#262933] rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#262933] pb-3">
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <Shield className="w-4 h-4 text-blue-400" />
                <span>Troféu Goleiro Menos Vazado / Melhor Defesa</span>
              </h3>
              <p className="text-[10px] text-[#8E9299] mt-0.5">
                Classificado pelo menor número de gols sofridos e melhor média por jogo disputado.
              </p>
            </div>
          </div>

          {goleiros.length === 0 ? (
            <p className="text-xs text-[#8E9299] text-center py-8">Nenhum dado defensivo registrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#0F1115] text-[#8E9299] uppercase font-bold border-b border-[#262933] text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Pos</th>
                    <th className="py-3 px-4 font-sans">Goleiro / Defesa</th>
                    <th className="py-3 px-4 font-sans">Time</th>
                    <th className="py-3 px-3 text-center">Jogos (J)</th>
                    <th className="py-3 px-3 text-center text-blue-400 font-bold">Gols Sofridos (GC)</th>
                    <th className="py-3 px-3 text-center text-white font-bold">Média / Jogo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262933]">
                  {goleiros.map((gk, idx) => (
                    <tr key={gk.time_id} className="hover:bg-[#0F1115]/50 transition-colors">
                      <td className="py-3 px-4 font-black text-[#8E9299]">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          idx === 0 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' :
                          idx === 1 ? 'bg-slate-300/20 text-slate-300 border border-slate-300/30' :
                          idx === 2 ? 'bg-amber-700/20 text-amber-500 border border-amber-700/30' : ''
                        }`}>
                          {idx + 1}º
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-white font-sans flex items-center space-x-2">
                        <span className="w-6 h-6 bg-blue-900/30 text-blue-300 rounded-lg flex items-center justify-center text-[10px] font-mono border border-blue-700/30">
                          🧤
                        </span>
                        <span>{gk.jogador_nome}</span>
                      </td>
                      <td className="py-3 px-4 font-bold text-[#E0E6ED] font-sans">
                        <div className="flex items-center space-x-2">
                          <TeamBadge badge={gk.time_brasao_path} name={gk.time_nome} className="w-4 h-4" />
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: gk.time_cor_hex }}
                          />
                          <span className="truncate max-w-[150px] uppercase">{gk.time_nome}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-[#E0E6ED]">{gk.jogos}</td>
                      <td className="py-3 px-3 text-center font-black text-sm text-blue-400">
                        {gk.gols_sofridos}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-white">
                        {gk.media_gols.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Cartões & Disciplina */}
      {activeTab === 'cartoes' && (
        <div className="bg-[#161920] border border-[#262933] rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#262933] pb-3">
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-[#FFC400]" />
                <span>Quadro de Cartões & Disciplina</span>
              </h3>
              <p className="text-[10px] text-[#8E9299] mt-0.5">
                Controle geral de advertências e punições da categoria.
              </p>
            </div>
          </div>

          {cartoes.length === 0 ? (
            <p className="text-xs text-[#8E9299] text-center py-8">Nenhum cartão aplicado nesta categoria.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {cartoes.map((c, idx) => (
                <div
                  key={c.jogador_id}
                  className="bg-[#0F1115] p-4 rounded-xl border border-[#262933] flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 bg-[#161920] text-[#8E9299] font-mono font-bold text-xs rounded flex items-center justify-center border border-[#262933]">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-bold text-white text-xs">{c.jogador_nome}</p>
                      <div className="flex items-center space-x-1.5 text-[10px] text-[#8E9299]">
                        <TeamBadge badge={c.time_brasao_path} name={c.time_nome} className="w-3.5 h-3.5" />
                        <span>{c.time_nome}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {c.cartoes_amarelos > 0 && (
                      <span className="px-2 py-0.5 bg-[#FFC400]/20 border border-[#FFC400]/40 text-[#FFC400] font-mono font-black text-[11px] rounded flex items-center space-x-1">
                        <span className="w-2.5 h-3.5 bg-[#FFC400] rounded-xs inline-block shadow-sm"></span>
                        <span>{c.cartoes_amarelos}</span>
                      </span>
                    )}
                    {c.cartoes_vermelhos > 0 && (
                      <span className="px-2 py-0.5 bg-[#FF1744]/20 border border-[#FF1744]/40 text-[#FF1744] font-mono font-black text-[11px] rounded flex items-center space-x-1">
                        <span className="w-2.5 h-3.5 bg-[#FF1744] rounded-xs inline-block shadow-sm"></span>
                        <span>{c.cartoes_vermelhos}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Suspensões */}
      {activeTab === 'suspensoes' && (
        <div className="bg-[#161920] border border-[#262933] rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-[#FF1744]" />
              <span>Punições e Suspensões Automáticas</span>
            </h3>
            <span className="text-[11px] font-mono text-[#8E9299]">
              {suspensoes.filter(s => (s.jogos_cumprir - s.jogos_cumpridos) > 0).length} ativas / {suspensoes.length} total
            </span>
          </div>

          <div className="p-3 bg-[#0F1115] rounded-xl border border-[#262933] text-[11px] text-[#8E9299] space-y-1">
            <p className="font-semibold text-white">⚙️ Regras do Regulamento:</p>
            <p>• <strong>2 Amarelos no mesmo jogo:</strong> Suspensão automática de 1 partida.</p>
            <p>• <strong>Vermelho Direto:</strong> Suspensão automática de 1 partida.</p>
            <p>• <strong>Acúmulo de Cartões Amarelos:</strong> Conforme regulamento da categoria.</p>
          </div>

          {suspensoes.length === 0 ? (
            <p className="text-xs text-[#8E9299] text-center py-8">Nenhum jogador suspenso nesta categoria.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {suspensoes.map((susp) => {
                const pendente = (susp.jogos_cumprir - susp.jogos_cumpridos) > 0;
                return (
                  <div
                    key={susp.id}
                    className={`bg-[#0F1115] p-4 rounded-xl border flex items-center justify-between transition-all ${
                      pendente ? 'border-[#FF1744]/40 bg-[#161214]' : 'border-emerald-500/30 opacity-70'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-bold text-white text-xs">{susp.jogador_nome}</p>
                        {susp.camisa_posicao && (
                          <span className="text-[10px] font-mono text-[#8E9299]">#{susp.camisa_posicao}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#8E9299]">{susp.time_nome}</p>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                            pendente ? 'bg-[#FF1744]/20 text-[#FF1744]' : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {susp.motivo}
                        </span>
                      </div>
                    </div>

                    <div className="text-right space-y-2">
                      <div>
                        {pendente ? (
                          <span className="text-xs font-mono font-extrabold text-[#FF1744]">
                            {susp.jogos_cumprir - susp.jogos_cumpridos} jogo(s) a cumprir
                          </span>
                        ) : (
                          <span className="text-xs font-mono font-bold text-emerald-400 flex items-center justify-end space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Cumprida</span>
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleToggleSuspensao(susp)}
                        className={`text-[10px] font-mono px-2 py-1 rounded transition-colors flex items-center space-x-1 ml-auto ${
                          pendente
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                        title={pendente ? 'Marcar como cumprida' : 'Reabrir suspensão'}
                      >
                        {pendente ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Cumprir</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3 h-3" />
                            <span>Reabrir</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Destaques */}
      {activeTab === 'destaques' && (
        <div className="bg-[#161920] border border-[#262933] rounded-2xl p-5 space-y-4 shadow-xl">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center space-x-2">
            <Award className="w-4 h-4 text-purple-400" />
            <span>Craques da Rodada / Eleição da Galera</span>
          </h3>

          {destaques.length === 0 ? (
            <p className="text-xs text-[#8E9299] text-center py-8">Nenhum destaque eleito ainda.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {destaques.map((dest, idx) => (
                <div
                  key={dest.jogador_id}
                  className="bg-[#0F1115] p-4 rounded-xl border border-purple-500/30 flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-white text-xs">{dest.jogador_nome}</p>
                    <p className="text-[10px] text-[#8E9299]">{dest.time_nome}</p>
                  </div>

                  <div className="bg-purple-500/20 border border-purple-500/40 text-purple-300 px-3 py-1 rounded-xl font-mono font-extrabold text-xs">
                    {dest.destaques}x Craque ⭐
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
