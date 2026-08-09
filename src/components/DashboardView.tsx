/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ArtilhariaItem, Categoria, ClassificacaoItem, ConfigCategoria, Partida, Time } from '../types';
import { query } from '../services/db';
import { Trophy, Users, DollarSign, Activity, Play, ChevronRight, AlertCircle, ShieldAlert } from 'lucide-react';

interface DashboardViewProps {
  categoriaId: number;
  categorias: Categoria[];
  onNavigateToMatch: (matchId: number) => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  categoriaId,
  categorias,
  onNavigateToMatch,
  onNavigateTab,
}) => {
  const [teamsCount, setTeamsCount] = useState(0);
  const [playersCount, setPlayersCount] = useState(0);
  const [paidCount, setPaidCount] = useState(0);
  const [config, setConfig] = useState<ConfigCategoria | null>(null);
  const [matches, setMatches] = useState<Partida[]>([]);
  const [standings, setStandings] = useState<ClassificacaoItem[]>([]);
  const [artilharia, setArtilharia] = useState<ArtilhariaItem[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [categoriaId]);

  const loadDashboardData = async () => {
    // 1. Teams count
    const tRes = await query<{ count: number }>(
      'SELECT COUNT(*) as count FROM times WHERE categoria_id = ?;',
      [categoriaId]
    );
    setTeamsCount(tRes[0]?.count || 0);

    // 2. Players count & paid count
    const pRes = await query<{ count: number; paid: number }>(
      'SELECT COUNT(*) as count, SUM(CASE WHEN pago = 1 THEN 1 ELSE 0 END) as paid FROM jogadores WHERE categoria_id = ?;',
      [categoriaId]
    );
    setPlayersCount(pRes[0]?.count || 0);
    setPaidCount(pRes[0]?.paid || 0);

    // 3. Category configs
    const cfgRes = await query<ConfigCategoria>(
      'SELECT * FROM configuracoes_categoria WHERE categoria_id = ?;',
      [categoriaId]
    );
    setConfig(cfgRes[0] || null);

    // 4. Matches
    const mRes = await query<Partida>(
      `SELECT 
         p.*,
         f.nome as fase_nome,
         tm.nome as time_mandante_nome, tm.cor_hex as time_mandante_cor, tm.brasao_path as time_mandante_brasao,
         tv.nome as time_visitante_nome, tv.cor_hex as time_visitante_cor, tv.brasao_path as time_visitante_brasao
       FROM partidas p
       JOIN fases f ON p.fase_id = f.id
       JOIN times tm ON p.time_mandante_id = tm.id
       JOIN times tv ON p.time_visitante_id = tv.id
       WHERE p.categoria_id = ?
       ORDER BY p.status DESC, p.id ASC
       LIMIT 6;`,
      [categoriaId]
    );
    setMatches(mRes);

    // 5. Standings top 4
    const stdRes = await query<ClassificacaoItem>(
      `SELECT 
         t.id AS time_id,
         t.nome AS time_nome,
         t.cor_hex AS time_cor_hex,
         t.brasao_path AS time_brasao_path,
         COUNT(CASE WHEN p.status = 'FINALIZADO' AND p.fase_id = 1 THEN p.id END) AS jogos,
         SUM(CASE 
           WHEN p.status = 'FINALIZADO' AND p.fase_id = 1 AND ((p.time_mandante_id = t.id AND p.gols_mandante > p.gols_visitante) OR (p.time_visitante_id = t.id AND p.gols_visitante > p.gols_mandante)) THEN 3
           WHEN p.status = 'FINALIZADO' AND p.fase_id = 1 AND p.gols_mandante = p.gols_visitante THEN 1
           ELSE 0 END) AS pontos,
         SUM(CASE WHEN p.status = 'FINALIZADO' AND p.fase_id = 1 THEN CASE WHEN p.time_mandante_id = t.id THEN p.gols_mandante - p.gols_visitante ELSE p.gols_visitante - p.gols_mandante END END) AS saldo_gols,
         SUM(CASE WHEN p.status = 'FINALIZADO' AND p.fase_id = 1 THEN CASE WHEN p.time_mandante_id = t.id THEN p.gols_mandante ELSE p.gols_visitante END END) AS gols_pro
       FROM times t
       LEFT JOIN partidas p ON (p.time_mandante_id = t.id OR p.time_visitante_id = t.id)
       WHERE t.categoria_id = ?
       GROUP BY t.id, t.nome, t.cor_hex, t.brasao_path
       ORDER BY pontos DESC, saldo_gols DESC, gols_pro DESC
       LIMIT 4;`,
      [categoriaId]
    );
    setStandings(stdRes);

    // 6. Top Goalscorers top 4
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
       ORDER BY gols DESC, j.nome ASC
       LIMIT 4;`,
      [categoriaId]
    );
    setArtilharia(artRes);
  };

  const selectedCat = categorias.find((c) => c.id === categoriaId);
  const totalArrecadado = paidCount * (config?.valor_inscricao || 0);

  return (
    <div className="space-y-6">
      {/* Category Hero Header */}
      <div className="bg-[#16191F] rounded-2xl p-6 border border-[#2D3139] shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00E676]/5 to-transparent pointer-events-none"></div>
        <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center pr-8 pointer-events-none">
          <Trophy className="w-64 h-64 text-[#00E676]" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <span className="px-3 py-1 bg-[#00E676]/10 text-[#00E676] text-[10px] font-mono font-bold rounded-full border border-[#00E676]/30 uppercase tracking-widest">
                Categoria Ativa
              </span>
              <span className="text-[11px] text-[#8E9299] font-mono">
                Regras: {config?.tempo_jogo_minutos || 20}min/tempo | {config?.num_titulares || 6}v{config?.num_titulares || 6}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
              Torneio {selectedCat?.nome || 'Society'}
            </h2>
            <p className="text-[#8E9299] text-xs mt-1 max-w-xl">
              Gerenciamento dinâmico com sorteio individual por pote, chaveamento inteligente e controle de súmula digital em tempo real.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => onNavigateTab('sorteio')}
              className="px-4 py-2.5 bg-[#2D3139] hover:bg-[#3D424D] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center space-x-2"
            >
              <span>Sorteio / Draft</span>
            </button>
            <button
              onClick={() => onNavigateTab('jogos')}
              className="px-5 py-2.5 bg-[#00E676] hover:bg-[#00c853] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(0,230,118,0.3)] transition-all flex items-center space-x-2"
            >
              <span>Gerar Jogos</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Teams */}
        <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-5 hover:border-[#00E676]/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#8E9299] uppercase tracking-widest">Times Cadastrados</span>
            <div className="p-2.5 bg-[#2D3139] text-[#00E676] rounded-xl border border-[#2D3139]">
              <Trophy className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-black font-mono text-white">{teamsCount}</span>
            <span className="text-[11px] text-[#8E9299]">times na categoria</span>
          </div>
        </div>

        {/* Total Players */}
        <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-5 hover:border-[#00E676]/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#8E9299] uppercase tracking-widest">Jogadores Inscritos</span>
            <div className="p-2.5 bg-[#00E676]/10 text-[#00E676] rounded-xl border border-[#00E676]/20">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-black font-mono text-white">{playersCount}</span>
            <span className="text-xs font-bold text-[#00E676] font-mono">{paidCount} pagos</span>
          </div>
        </div>

        {/* Financial Balance */}
        <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-5 hover:border-[#FFC400]/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#8E9299] uppercase tracking-widest">Arrecadação Inscrições</span>
            <div className="p-2.5 bg-[#FFC400]/10 text-[#FFC400] rounded-xl border border-[#FFC400]/20">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black font-mono text-white">
              R$ {totalArrecadado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[10px] text-[#8E9299] mt-1 font-mono">Taxa: R$ {config?.valor_inscricao?.toFixed(2) || '0.00'}/atleta</p>
        </div>

        {/* Matches Status */}
        <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-5 hover:border-[#00E676]/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#8E9299] uppercase tracking-widest">Total de Partidas</span>
            <div className="p-2.5 bg-[#2D3139] text-[#00E676] rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-black font-mono text-white">{matches.length}</span>
            <span className="text-[11px] text-[#8E9299]">
              {matches.filter((m) => m.status === 'FINALIZADO').length} finalizadas
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Next / Live Matches Column (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#8E9299] uppercase tracking-widest flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#00E676]"></span>
              <span>Partidas da Categoria</span>
            </h3>
            <button
              onClick={() => onNavigateTab('jogos')}
              className="text-xs text-[#00E676] hover:underline font-bold flex items-center space-x-1 uppercase tracking-wider"
            >
              <span>Ver tabela completa</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {matches.length === 0 ? (
            <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-8 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-[#8E9299] mx-auto" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Nenhum confronto gerado ainda</h4>
              <p className="text-xs text-[#8E9299]">
                Realize o sorteio dos times e gere a tabela de jogos da fase de grupos.
              </p>
              <button
                onClick={() => onNavigateTab('jogos')}
                className="mt-2 px-5 py-2.5 bg-[#00E676] hover:bg-[#00c853] text-black text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-[0_0_15px_rgba(0,230,118,0.3)]"
              >
                Gerar Confrontos Agora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {matches.map((m) => (
                <div
                  key={m.id}
                  className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-4 hover:border-[#00E676]/40 transition-all flex flex-col sm:flex-row items-center justify-between gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2.5 py-0.5 text-[10px] font-mono font-bold rounded uppercase ${
                        m.status === 'EM_ANDAMENTO'
                          ? 'bg-[#FF1744]/20 text-[#FF1744] border border-[#FF1744]/30 animate-pulse'
                          : m.status === 'FINALIZADO'
                          ? 'bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/30'
                          : 'bg-[#2D3139] text-[#8E9299] border border-[#2D3139]'
                      }`}
                    >
                      {m.status === 'EM_ANDAMENTO' ? '● Em Andamento' : m.status}
                    </span>
                    <span className="text-xs text-[#8E9299] font-medium">{m.fase_nome}</span>
                  </div>

                  {/* Match Scoreboard */}
                  <div className="flex items-center space-x-4 w-full sm:w-auto justify-center">
                    {/* Mandante */}
                    <div className="flex items-center space-x-2 justify-end text-right w-36 sm:w-40">
                      <span className="text-xs font-bold text-white truncate">{m.time_mandante_nome}</span>
                      <div
                        className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0"
                        style={{ backgroundColor: m.time_mandante_cor || '#000' }}
                      />
                    </div>

                    {/* Score */}
                    <div className="bg-[#0F1115] px-4 py-1.5 rounded-xl border border-[#2D3139] font-mono font-black text-sm text-white flex items-center space-x-2">
                      <span className="text-[#00E676]">{m.gols_mandante}</span>
                      <span className="text-[#2D3139] text-xs">:</span>
                      <span className="text-[#00E676]">{m.gols_visitante}</span>
                    </div>

                    {/* Visitante */}
                    <div className="flex items-center space-x-2 text-left w-36 sm:w-40">
                      <div
                        className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0"
                        style={{ backgroundColor: m.time_visitante_cor || '#000' }}
                      />
                      <span className="text-xs font-bold text-white truncate">{m.time_visitante_nome}</span>
                    </div>
                  </div>

                  {/* Live Match Action Button */}
                  <button
                    onClick={() => onNavigateToMatch(m.id)}
                    className="w-full sm:w-auto px-4 py-2 bg-[#2D3139] hover:bg-[#00E676] text-white hover:text-black rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Súmula</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar Column: Standings & Top Scorers Preview */}
        <div className="space-y-6">
          {/* Standings Quick View */}
          <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#2D3139]">
              <h3 className="text-xs font-bold text-[#8E9299] uppercase tracking-widest flex items-center space-x-2">
                <Trophy className="w-4 h-4 text-[#FFC400]" />
                <span>Classificação Parcial</span>
              </h3>
              <button
                onClick={() => onNavigateTab('classificacao')}
                className="text-[10px] text-[#00E676] font-bold uppercase tracking-wider hover:underline"
              >
                Ver tudo
              </button>
            </div>

            {standings.length === 0 ? (
              <p className="text-xs text-[#8E9299] text-center py-4">Nenhum jogo finalizado ainda.</p>
            ) : (
              <div className="space-y-2">
                {standings.map((st, idx) => (
                  <div
                    key={st.time_id}
                    className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139]"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="font-mono font-bold text-[#8E9299] w-4">{idx + 1}º</span>
                      <div
                        className="w-3 h-3 rounded-full border border-white/20"
                        style={{ backgroundColor: st.time_cor_hex }}
                      />
                      <span className="font-semibold text-white truncate max-w-[110px]">{st.time_nome}</span>
                    </div>
                    <div className="flex items-center space-x-3 text-[#8E9299] font-mono text-xs">
                      <span>{st.jogos}j</span>
                      <span className="font-black text-[#00E676]">{st.pontos}p</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Goalscorers Quick View */}
          <div className="bg-[#16191F] border border-[#2D3139] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#2D3139]">
              <h3 className="text-xs font-bold text-[#8E9299] uppercase tracking-widest flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-[#00E676]" />
                <span>Artilharia</span>
              </h3>
              <button
                onClick={() => onNavigateTab('classificacao')}
                className="text-[10px] text-[#00E676] font-bold uppercase tracking-wider hover:underline"
              >
                Ver tudo
              </button>
            </div>

            {artilharia.length === 0 ? (
              <p className="text-xs text-[#8E9299] text-center py-4">Nenhum gol registrado.</p>
            ) : (
              <div className="space-y-2">
                {artilharia.map((art, idx) => (
                  <div
                    key={art.jogador_id}
                    className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-[#0F1115] border border-[#2D3139]"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="font-mono font-bold text-[#8E9299] w-4">{idx + 1}º</span>
                      <div>
                        <p className="font-semibold text-white truncate max-w-[120px]">{art.jogador_nome}</p>
                        <p className="text-[10px] text-[#8E9299]">{art.time_nome}</p>
                      </div>
                    </div>
                    <div className="bg-[#00E676]/10 border border-[#00E676]/30 text-[#00E676] font-mono font-black px-2 py-0.5 rounded text-xs">
                      {art.gols} ⚽
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
