/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { ArtilhariaItem, ClassificacaoItem, DestaqueItem, Suspensao } from '../types';
import { query } from '../services/db';
import { Trophy, ShieldAlert, Award, AlertTriangle, Users, Flame, Share2, Download, Sparkles, X, Shield, Image, Printer } from 'lucide-react';

interface StandingsArtilhariaViewProps {
  categoriaId: number;
}

export const StandingsArtilhariaView: React.FC<StandingsArtilhariaViewProps> = ({ categoriaId }) => {
  const [activeTab, setActiveTab] = useState<'classificacao' | 'artilharia' | 'suspensoes' | 'destaques'>('classificacao');
  const [standings, setStandings] = useState<ClassificacaoItem[]>([]);
  const [artilharia, setArtilharia] = useState<ArtilhariaItem[]>([]);
  const [suspensoes, setSuspensoes] = useState<Suspensao[]>([]);
  const [destaques, setDestaques] = useState<DestaqueItem[]>([]);

  // Social Post Modal State
  const [showPostModal, setShowPostModal] = useState(false);
  const [isExportingPost, setIsExportingPost] = useState(false);
  const postCardRef = useRef<HTMLDivElement>(null);

  const handleDownloadPostImage = () => {
    window.print();
  };

  useEffect(() => {
    loadData();
  }, [categoriaId]);

  const loadData = async () => {
    // 1. Standings
    const stdRes = await query<ClassificacaoItem>(
      `SELECT 
         t.id AS time_id,
         t.nome AS time_nome,
         t.cor_hex AS time_cor_hex,
         t.brasao_path AS time_brasao_path,
         COALESCE(COUNT(CASE WHEN p.status = 'FINALIZADO' AND p.fase_id = 1 THEN p.id END), 0) AS jogos,
         COALESCE(SUM(CASE 
           WHEN p.status = 'FINALIZADO' AND p.fase_id = 1 AND ((p.time_mandante_id = t.id AND p.gols_mandante > p.gols_visitante) OR (p.time_visitante_id = t.id AND p.gols_visitante > p.gols_mandante)) THEN 1
           ELSE 0 END), 0) AS vitorias,
         COALESCE(SUM(CASE 
           WHEN p.status = 'FINALIZADO' AND p.fase_id = 1 AND p.gols_mandante = p.gols_visitante THEN 1
           ELSE 0 END), 0) AS empates,
         COALESCE(SUM(CASE 
           WHEN p.status = 'FINALIZADO' AND p.fase_id = 1 AND ((p.time_mandante_id = t.id AND p.gols_mandante < p.gols_visitante) OR (p.time_visitante_id = t.id AND p.gols_visitante < p.gols_mandante)) THEN 1
           ELSE 0 END), 0) AS derrotas,
         COALESCE(SUM(CASE WHEN p.status = 'FINALIZADO' AND p.fase_id = 1 THEN CASE WHEN p.time_mandante_id = t.id THEN p.gols_mandante ELSE p.gols_visitante END END), 0) AS gols_pro,
         COALESCE(SUM(CASE WHEN p.status = 'FINALIZADO' AND p.fase_id = 1 THEN CASE WHEN p.time_mandante_id = t.id THEN p.gols_visitante ELSE p.gols_mandante END END), 0) AS gols_contra,
         COALESCE(SUM(CASE WHEN p.status = 'FINALIZADO' AND p.fase_id = 1 THEN CASE WHEN p.time_mandante_id = t.id THEN p.gols_mandante - p.gols_visitante ELSE p.gols_visitante - p.gols_mandante END END), 0) AS saldo_gols,
         COALESCE(SUM(CASE 
           WHEN p.status = 'FINALIZADO' AND p.fase_id = 1 AND ((p.time_mandante_id = t.id AND p.gols_mandante > p.gols_visitante) OR (p.time_visitante_id = t.id AND p.gols_visitante > p.gols_mandante)) THEN 3
           WHEN p.status = 'FINALIZADO' AND p.fase_id = 1 AND p.gols_mandante = p.gols_visitante THEN 1
           ELSE 0 END), 0) AS pontos
       FROM times t
       LEFT JOIN partidas p ON (p.time_mandante_id = t.id OR p.time_visitante_id = t.id)
       WHERE t.categoria_id = ?
       GROUP BY t.id, t.nome, t.cor_hex, t.brasao_path
       ORDER BY pontos DESC, vitorias DESC, saldo_gols DESC, gols_pro DESC;`,
      [categoriaId]
    );

    // Calculate percentage
    const processedStandings = stdRes.map((s) => ({
      ...s,
      aproveitamento: s.jogos > 0 ? Math.round((s.pontos / (s.jogos * 3)) * 100) : 0,
    }));
    setStandings(processedStandings);

    // 2. Artilharia
    const artRes = await query<ArtilhariaItem>(
      `SELECT 
         j.id AS jogador_id,
         j.nome AS jogador_nome,
         j.camisa_posicao,
         t.nome AS time_nome,
         t.cor_hex AS time_cor_hex,
         t.brasao_path AS time_brasao_path,
         COUNT(ep.id) AS gols
       FROM jogadores j
       JOIN times t ON j.time_id = t.id
       JOIN eventos_partida ep ON ep.jogador_id = j.id AND ep.tipo_evento = 'GOL'
       JOIN partidas p ON ep.partida_id = p.id AND p.status = 'FINALIZADO'
       WHERE j.categoria_id = ?
       GROUP BY j.id, j.nome, j.camisa_posicao, t.nome, t.cor_hex, t.brasao_path
       ORDER BY gols DESC, j.nome ASC;`,
      [categoriaId]
    );
    setArtilharia(artRes);

    // 3. Suspensões
    const suspRes = await query<Suspensao>(
      `SELECT 
         s.*,
         j.nome AS jogador_nome,
         t.nome AS time_nome,
         t.cor_hex AS time_cor_hex,
         c.nome AS categoria_nome
       FROM suspensoes s
       JOIN jogadores j ON s.jogador_id = j.id
       JOIN times t ON j.time_id = t.id
       JOIN categorias c ON j.categoria_id = c.id
       WHERE j.categoria_id = ?
       ORDER BY s.id DESC;`,
      [categoriaId]
    );
    setSuspensoes(suspRes);

    // 4. Destaques
    const destRes = await query<DestaqueItem>(
      `SELECT 
         j.id AS jogador_id,
         j.nome AS jogador_nome,
         j.camisa_posicao,
         t.nome AS time_nome,
         t.cor_hex AS time_cor_hex,
         COUNT(ep.id) AS destaques
       FROM jogadores j
       JOIN times t ON j.time_id = t.id
       JOIN eventos_partida ep ON ep.jogador_id = j.id AND ep.tipo_evento = 'DESTAQUE'
       JOIN partidas p ON ep.partida_id = p.id
       WHERE j.categoria_id = ?
       GROUP BY j.id, j.nome, j.camisa_posicao, t.nome, t.cor_hex
       ORDER BY destaques DESC;`,
      [categoriaId]
    );
    setDestaques(destRes);
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
          <span>Artilharia</span>
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
          <div className="p-4 border-b border-[#262933] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center space-x-2">
              <Trophy className="w-4 h-4 text-[#FFC400]" />
              <span>Tabela Oficial de Classificação</span>
            </h3>

            <button
              onClick={() => setShowPostModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-[#FF6B1A] to-[#FFC400] hover:from-[#e05a0f] hover:to-[#e0ab00] text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-[0_0_15px_rgba(255,107,26,0.3)] transition-all flex items-center space-x-2 shrink-0"
            >
              <Share2 className="w-4 h-4 text-black" />
              <span>Gerar Post Social (Feeds)</span>
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
                        <div
                          className="w-3.5 h-3.5 rounded-full border border-white/20"
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
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Artilharia */}
      {activeTab === 'artilharia' && (
        <div className="bg-[#161920] border border-[#262933] rounded-2xl p-5 space-y-4 shadow-xl">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center space-x-2">
            <Flame className="w-4 h-4 text-[#FFC400]" />
            <span>Ranking de Artilheiros da Categoria</span>
          </h3>

          {artilharia.length === 0 ? (
            <p className="text-xs text-[#8E9299] text-center py-8">Nenhum gol registrado até o momento.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {artilharia.map((art, idx) => (
                <div
                  key={art.jogador_id}
                  className="bg-[#0F1115] p-4 rounded-xl border border-[#262933] flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-7 h-7 bg-[#161920] text-[#FFC400] font-mono font-black text-xs rounded-lg flex items-center justify-center border border-[#262933]">
                      {idx + 1}º
                    </span>
                    <div>
                      <p className="font-bold text-white text-xs">{art.jogador_nome}</p>
                      <p className="text-[10px] text-[#8E9299]">{art.time_nome}</p>
                    </div>
                  </div>

                  <div className="bg-[#FF6B1A]/10 border border-[#FF6B1A]/30 text-[#FF6B1A] px-3 py-1 rounded-xl font-mono font-black text-xs">
                    {art.gols} Gols ⚽
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
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-[#FF1744]" />
            <span>Punições e Suspensões Automáticas</span>
          </h3>

          {suspensoes.length === 0 ? (
            <p className="text-xs text-[#8E9299] text-center py-8">Nenhum jogador suspenso nesta categoria.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {suspensoes.map((susp) => (
                <div
                  key={susp.id}
                  className="bg-[#0F1115] p-4 rounded-xl border border-[#FF1744]/30 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-bold text-white text-xs">{susp.jogador_nome}</p>
                    <p className="text-[10px] text-[#8E9299]">{susp.time_nome}</p>
                    <span className="inline-block px-2 py-0.5 bg-[#FF1744]/20 text-[#FF1744] text-[10px] font-mono font-bold rounded">
                      {susp.motivo}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-mono font-extrabold text-[#FF1744]">
                      {susp.jogos_cumprir - susp.jogos_cumpridos} jogo(s) suspenso
                    </span>
                  </div>
                </div>
              ))}
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

      {/* Modal Gerador de Post para Redes Sociais */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-y-auto">
          <div className="relative bg-[#161920] border border-[#262933] rounded-3xl w-full max-w-lg p-6 space-y-6 shadow-2xl">
            {/* Modal Controls Header */}
            <div className="flex items-center justify-between border-b border-[#262933] pb-3">
              <div className="flex items-center space-x-2">
                <Image className="w-5 h-5 text-[#FF6B1A]" />
                <h3 className="text-sm font-black text-white uppercase tracking-tight">Gerador de Card para Redes Sociais</h3>
              </div>
              <button
                onClick={() => setShowPostModal(false)}
                className="p-1.5 text-[#8E9299] hover:text-white bg-[#0F1115] border border-[#262933] rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Social Post Visual Card Container (Targeted by html-to-image) */}
            <div
              ref={postCardRef}
              className="bg-gradient-to-br from-[#0F1115] via-[#161920] to-[#0D0E12] border-2 border-[#FF6B1A]/40 rounded-3xl p-6 space-y-6 shadow-[0_0_30px_rgba(255,107,26,0.2)] text-white relative overflow-hidden"
              style={{ width: '100%' }}
            >
              {/* Background Decorative Element */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF6B1A]/10 rounded-full blur-2xl pointer-events-none" />

              {/* Arena Logo & Header Banner */}
              <div className="flex items-center justify-between border-b border-[#262933] pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FF6B1A] to-[#FFC400] flex items-center justify-center shadow-[0_0_15px_rgba(255,107,26,0.4)]">
                    <Shield className="w-7 h-7 text-black fill-black" />
                  </div>
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-white uppercase font-sans">ARENA ROMANO</h1>
                    <p className="text-[10px] font-mono text-[#FF6B1A] uppercase font-bold tracking-widest">Torneio Society Oficial</p>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span className="px-2.5 py-1 bg-[#FF6B1A]/20 text-[#FF6B1A] border border-[#FF6B1A]/40 rounded-lg text-[10px] font-extrabold uppercase">
                    CLASSIFICAÇÃO
                  </span>
                </div>
              </div>

              {/* Standings Rankings Table */}
              <div className="space-y-2">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#262933] text-[10px] text-[#8E9299] uppercase font-bold">
                      <th className="py-2 px-2">#</th>
                      <th className="py-2 px-2 font-sans">TIME</th>
                      <th className="py-2 px-2 text-center text-[#FF6B1A]">PTS</th>
                      <th className="py-2 px-2 text-center">J</th>
                      <th className="py-2 px-2 text-center">V</th>
                      <th className="py-2 px-2 text-center">SG</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#262933]/60">
                    {standings.slice(0, 6).map((st, idx) => (
                      <tr key={st.time_id} className={idx < 2 ? 'bg-[#FF6B1A]/5' : ''}>
                        <td className="py-2.5 px-2 font-black text-[#FF6B1A]">{idx + 1}º</td>
                        <td className="py-2.5 px-2 font-bold font-sans uppercase truncate max-w-[140px]">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">{st.time_brasao_path || '🛡️'}</span>
                            <span className="truncate">{st.time_nome}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center font-black text-[#FFC400] text-sm">{st.pontos}</td>
                        <td className="py-2.5 px-2 text-center font-bold">{st.jogos}</td>
                        <td className="py-2.5 px-2 text-center text-[#8E9299]">{st.vitorias}</td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-white">{st.saldo_gols}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Top Scorer Spotlight Footer */}
              {artilharia.length > 0 && (
                <div className="bg-[#0F1115] border border-[#262933] rounded-2xl p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-[#FFC400]/10 border border-[#FFC400]/30 rounded-xl">
                      <Flame className="w-5 h-5 text-[#FFC400]" />
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-[#8E9299] font-bold uppercase">Artilheiro do Torneio</p>
                      <p className="text-xs font-bold text-white font-sans">{artilharia[0].jogador_nome}</p>
                      <p className="text-[10px] text-[#8E9299]">{artilharia[0].time_nome}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-[#FF6B1A] font-mono">{artilharia[0].gols} GOLS</span>
                  </div>
                </div>
              )}

              {/* Footer Hashtag & Brand */}
              <div className="pt-2 border-t border-[#262933] flex items-center justify-between text-[9px] font-mono text-[#8E9299]">
                <span>#ArenaRomano #FutebolSociety</span>
                <span>arena-romano.com</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPostModal(false)}
                className="px-4 py-2.5 bg-[#0F1115] hover:bg-[#222632] text-[#8E9299] border border-[#262933] rounded-xl text-xs font-mono font-bold uppercase"
              >
                Fechar
              </button>

              <button
                type="button"
                onClick={handleDownloadPostImage}
                disabled={isExportingPost}
                className="px-5 py-2.5 bg-gradient-to-r from-[#FF6B1A] to-[#FFC400] hover:from-[#e05a0f] hover:to-[#e0ab00] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(255,107,26,0.4)] flex items-center space-x-2"
              >
                <Download className={`w-4 h-4 ${isExportingPost ? 'animate-bounce' : ''}`} />
                <span>{isExportingPost ? 'Gerando Imagem...' : 'Baixar Imagem (PNG)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
