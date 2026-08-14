/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { query, runQuery } from './db';
import { ArtilhariaItem, CartaoItem, ClassificacaoItem, DestaqueItem, GoleiroMenosVazadoItem, Jogador, Partida, Suspensao, Time } from '../types';

export interface StandingsOptions {
  includeLive?: boolean; // if true, also counts matches with status = 'EM_ANDAMENTO'
}

/**
 * Robust, unified calculation of category standings (Classificação)
 * Computes:
 * - Pontos (PTS): Vitórias * 3 + Empates * 1
 * - Jogos (J): Total de partidas computadas
 * - Vitórias (V)
 * - Empates (E)
 * - Derrotas (D)
 * - Gols Pró / Marcados (GP)
 * - Gols Contra / Sofridos (GC)
 * - Saldo de Gols (SG): GP - GC
 * - Aproveitamento (%): (PTS / (J * 3)) * 100
 */
export async function getCategoryStandings(
  categoriaId: number,
  options: StandingsOptions = {}
): Promise<ClassificacaoItem[]> {
  try {
    // 1. Fetch all teams belonging to this category
    const teams = await query<Time>(
      `SELECT id, nome, cor_hex, brasao_path, categoria_id, grupo 
       FROM times 
       WHERE categoria_id = ? 
       ORDER BY nome ASC;`,
      [categoriaId]
    );

    if (!teams || teams.length === 0) {
      return [];
    }

    // 2. Fetch matches with exact goals (prioritizing events if present, or direct match scores)
    const matches = await query<Partida>(
      `SELECT 
         p.id,
         p.categoria_id,
         p.fase_id,
         p.time_mandante_id,
         p.time_visitante_id,
         p.status,
         CASE 
           WHEN (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = p.id AND ep.time_id = p.time_mandante_id AND ep.tipo_evento = 'GOL') > 0
           THEN (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = p.id AND ep.time_id = p.time_mandante_id AND ep.tipo_evento = 'GOL')
           ELSE COALESCE(p.gols_mandante, 0)
         END AS gols_mandante,
         CASE 
           WHEN (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = p.id AND ep.time_id = p.time_visitante_id AND ep.tipo_evento = 'GOL') > 0
           THEN (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = p.id AND ep.time_id = p.time_visitante_id AND ep.tipo_evento = 'GOL')
           ELSE COALESCE(p.gols_visitante, 0)
         END AS gols_visitante
       FROM partidas p
       WHERE p.categoria_id = ?;`,
      [categoriaId]
    );

    // 3. Initialize mapping of all teams
    const tableMap: Record<number, ClassificacaoItem> = {};
    for (const t of teams) {
      tableMap[t.id] = {
        time_id: t.id,
        time_nome: t.nome,
        time_cor_hex: t.cor_hex || '#FF6B1A',
        time_brasao_path: t.brasao_path || '',
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
    }

    // 4. Process each match
    for (const m of matches) {
      const isCountable = options.includeLive
        ? m.status === 'FINALIZADO' || m.status === 'EM_ANDAMENTO'
        : m.status === 'FINALIZADO';

      if (!isCountable) continue;

      const mandante = tableMap[m.time_mandante_id];
      const visitante = tableMap[m.time_visitante_id];

      if (!mandante || !visitante) continue;

      const gm = Number(m.gols_mandante) || 0;
      const gv = Number(m.gols_visitante) || 0;

      // Increment matches played
      mandante.jogos += 1;
      visitante.jogos += 1;

      // Goals For (GP)
      mandante.gols_pro += gm;
      visitante.gols_pro += gv;

      // Goals Against / Conceded (GC - Gols Sofridos)
      mandante.gols_contra += gv;
      visitante.gols_contra += gm;

      // Match Result logic
      if (gm > gv) {
        // Mandante Won
        mandante.vitorias += 1;
        mandante.pontos += 3;
        visitante.derrotas += 1;
      } else if (gm < gv) {
        // Visitante Won
        visitante.vitorias += 1;
        visitante.pontos += 3;
        mandante.derrotas += 1;
      } else {
        // Draw (Empate)
        mandante.empates += 1;
        mandante.pontos += 1;
        visitante.empates += 1;
        visitante.pontos += 1;
      }
    }

    // 5. Finalize calculations: Goal Difference (SG) & Aproveitamento (%)
    const standings = Object.values(tableMap).map((item) => {
      item.saldo_gols = item.gols_pro - item.gols_contra;
      const maxPoints = item.jogos * 3;
      item.aproveitamento = maxPoints > 0 ? Math.round((item.pontos / maxPoints) * 100) : 0;
      return item;
    });

    // 6. Sports Tie-Breaking Sorting Order:
    // 1. Pontos (PTS DESC)
    // 2. Vitórias (V DESC)
    // 3. Saldo de Gols (SG DESC)
    // 4. Gols Pró / Marcados (GP DESC)
    // 5. Menos Gols Contra / Sofridos (GC ASC)
    // 6. Ordem Alfabética (Nome ASC)
    standings.sort((a, b) => {
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
      if (b.saldo_gols !== a.saldo_gols) return b.saldo_gols - a.saldo_gols;
      if (b.gols_pro !== a.gols_pro) return b.gols_pro - a.gols_pro;
      if (a.gols_contra !== b.gols_contra) return a.gols_contra - b.gols_contra;
      return a.time_nome.localeCompare(b.time_nome);
    });

    return standings;
  } catch (err) {
    console.error('[getCategoryStandings Error]:', err);
    return [];
  }
}

/**
 * Fetch Top Scorers (Artilharia) across all recorded match events
 */
export async function getCategoryArtilharia(categoriaId: number, limit = 50): Promise<ArtilhariaItem[]> {
  try {
    return await query<ArtilhariaItem>(
      `SELECT 
         j.id AS jogador_id,
         j.nome AS jogador_nome,
         j.camisa_posicao,
         t.nome AS time_nome,
         t.cor_hex AS time_cor_hex,
         t.brasao_path AS time_brasao_path,
         COUNT(ep.id) AS gols
       FROM eventos_partida ep
       JOIN jogadores j ON ep.jogador_id = j.id
       JOIN times t ON ep.time_id = t.id
       JOIN partidas p ON ep.partida_id = p.id
       WHERE ep.tipo_evento = 'GOL' AND (p.categoria_id = ? OR j.categoria_id = ?)
       GROUP BY j.id, j.nome, j.camisa_posicao, t.nome, t.cor_hex, t.brasao_path
       ORDER BY gols DESC, j.nome ASC
       LIMIT ?;`,
      [categoriaId, categoriaId, limit]
    );
  } catch (err) {
    console.error('[getCategoryArtilharia Error]:', err);
    return [];
  }
}

/**
 * Fetch Goalkeepers with Least Goals Conceded (Goleiro Menos Vazado / Defesa Menos Vazada)
 * Counts exact goals conceded across all matches for each team in the category.
 */
export async function getGoleirosMenosVazados(categoriaId: number): Promise<GoleiroMenosVazadoItem[]> {
  try {
    // 1. Fetch all teams in the category
    const teams = await query<Time>(
      `SELECT id, nome, cor_hex, brasao_path, categoria_id 
       FROM times 
       WHERE categoria_id = ? 
       ORDER BY nome ASC;`,
      [categoriaId]
    );

    if (!teams || teams.length === 0) return [];

    // 2. Fetch matches for category with accurate scores
    const matches = await query<Partida>(
      `SELECT 
         p.id,
         p.time_mandante_id,
         p.time_visitante_id,
         p.status,
         CASE 
           WHEN (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = p.id AND ep.time_id = p.time_mandante_id AND ep.tipo_evento = 'GOL') > 0
           THEN (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = p.id AND ep.time_id = p.time_mandante_id AND ep.tipo_evento = 'GOL')
           ELSE COALESCE(p.gols_mandante, 0)
         END AS gols_mandante,
         CASE 
           WHEN (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = p.id AND ep.time_id = p.time_visitante_id AND ep.tipo_evento = 'GOL') > 0
           THEN (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = p.id AND ep.time_id = p.time_visitante_id AND ep.tipo_evento = 'GOL')
           ELSE COALESCE(p.gols_visitante, 0)
         END AS gols_visitante
       FROM partidas p
       WHERE p.categoria_id = ?;`,
      [categoriaId]
    );

    // 3. Compute goals conceded for each team
    const teamStats: Record<number, { jogos: number; gols_sofridos: number }> = {};
    for (const t of teams) {
      teamStats[t.id] = { jogos: 0, gols_sofridos: 0 };
    }

    for (const m of matches) {
      if (m.status !== 'FINALIZADO' && m.status !== 'EM_ANDAMENTO') continue;

      const gm = Number(m.gols_mandante) || 0;
      const gv = Number(m.gols_visitante) || 0;

      if (teamStats[m.time_mandante_id]) {
        teamStats[m.time_mandante_id].jogos += 1;
        teamStats[m.time_mandante_id].gols_sofridos += gv; // Mandante concedes visitante's goals
      }

      if (teamStats[m.time_visitante_id]) {
        teamStats[m.time_visitante_id].jogos += 1;
        teamStats[m.time_visitante_id].gols_sofridos += gm; // Visitante concedes mandante's goals
      }
    }

    // 4. Fetch all goalkeepers (camisa_posicao = 1) in category
    const goalkeepers = await query<Jogador>(
      `SELECT j.*, t.nome as time_nome, t.cor_hex as time_cor_hex, t.brasao_path as time_brasao_path
       FROM jogadores j
       JOIN times t ON j.time_id = t.id
       WHERE (j.categoria_id = ? OR t.categoria_id = ?) AND j.camisa_posicao = 1
       ORDER BY j.nome ASC;`,
      [categoriaId, categoriaId]
    );

    const gkMap: Record<number, Jogador[]> = {};
    for (const gk of goalkeepers) {
      if (gk.time_id) {
        if (!gkMap[gk.time_id]) gkMap[gk.time_id] = [];
        gkMap[gk.time_id].push(gk);
      }
    }

    // 5. Build full ranking list
    const list: GoleiroMenosVazadoItem[] = teams.map((t) => {
      const gks = gkMap[t.id] || [];
      const primaryGk = gks[0];
      const name = gks.length > 0
        ? gks.map((g) => g.nome).join(' / ')
        : `Defesa do ${t.nome}`;

      const stats = teamStats[t.id] || { jogos: 0, gols_sofridos: 0 };
      const media = stats.jogos > 0 ? Number((stats.gols_sofridos / stats.jogos).toFixed(2)) : 0;

      return {
        jogador_id: primaryGk?.id,
        jogador_nome: name,
        camisa_posicao: 1,
        time_id: t.id,
        time_nome: t.nome,
        time_cor_hex: t.cor_hex || '#FF6B1A',
        time_brasao_path: t.brasao_path || '',
        jogos: stats.jogos,
        gols_sofridos: stats.gols_sofridos,
        media_gols: media,
      };
    });

    // 6. Sort by: Played matches first -> Least goals conceded -> Best average -> Most games played -> Name
    list.sort((a, b) => {
      if (a.jogos > 0 && b.jogos === 0) return -1;
      if (a.jogos === 0 && b.jogos > 0) return 1;
      if (a.gols_sofridos !== b.gols_sofridos) return a.gols_sofridos - b.gols_sofridos;
      if (a.media_gols !== b.media_gols) return a.media_gols - b.media_gols;
      if (b.jogos !== a.jogos) return b.jogos - a.jogos;
      return a.time_nome.localeCompare(b.time_nome);
    });

    return list;
  } catch (err) {
    console.error('[getGoleirosMenosVazados Error]:', err);
    return [];
  }
}

/**
 * Fetch Cards & Discipline Ranking (Cartões Amarelos, Vermelhos e Fair Play)
 */
export async function getCategoryCartoes(categoriaId: number): Promise<CartaoItem[]> {
  try {
    return await query<CartaoItem>(
      `SELECT 
         j.id AS jogador_id,
         j.nome AS jogador_nome,
         j.camisa_posicao,
         t.nome AS time_nome,
         t.cor_hex AS time_cor_hex,
         t.brasao_path AS time_brasao_path,
         SUM(CASE WHEN ep.tipo_evento = 'CARTAO_AMARELO' THEN 1 ELSE 0 END) AS cartoes_amarelos,
         SUM(CASE WHEN ep.tipo_evento = 'CARTAO_VERMELHO' THEN 1 ELSE 0 END) AS cartoes_vermelhos,
         COUNT(ep.id) AS total_cartoes
       FROM eventos_partida ep
       JOIN jogadores j ON ep.jogador_id = j.id
       JOIN times t ON ep.time_id = t.id
       JOIN partidas p ON ep.partida_id = p.id
       WHERE ep.tipo_evento IN ('CARTAO_AMARELO', 'CARTAO_VERMELHO') 
         AND (p.categoria_id = ? OR j.categoria_id = ?)
       GROUP BY j.id, j.nome, j.camisa_posicao, t.nome, t.cor_hex, t.brasao_path
       ORDER BY cartoes_vermelhos DESC, cartoes_amarelos DESC, j.nome ASC;`,
      [categoriaId, categoriaId]
    );
  } catch (err) {
    console.error('[getCategoryCartoes Error]:', err);
    return [];
  }
}

/**
 * Synchronize and ensure all automated suspensions exist without duplicates:
 * 1. 2 Cartões Amarelos na Mesma Partida (Expulsão por 2º amarelo) -> 1 jogo de suspensão automática
 * 2. Cartão Vermelho Direto -> 1 jogo de suspensão automática
 * 3. Acúmulo de Cartões Amarelos (ex: 3 amarelos acumulados) -> 1 jogo de suspensão automática
 */
export async function syncCategorySuspensions(categoriaId?: number): Promise<void> {
  try {
    // 0. Clean up any existing duplicate suspensions in DB
    try {
      await runQuery(`
        DELETE FROM suspensoes 
        WHERE id NOT IN (
          SELECT MIN(id) 
          FROM suspensoes 
          GROUP BY jogador_id, partida_origem_id, CASE WHEN motivo LIKE '%Acúmulo%' THEN motivo ELSE 'EXPULSAO' END
        );
      `);
    } catch (e) {}

    // 1. Fetch category configurations
    const configs = await query<{
      categoria_id: number;
      amarelos_para_expulsao: number;
      amarelos_acumulados_suspensao: number;
      jogos_suspensao_amarelo: number;
      jogos_suspensao_vermelho: number;
    }>(`SELECT * FROM configuracoes_categoria;`);

    const cfgMap: Record<number, {
      amarelos_para_expulsao: number;
      amarelos_acumulados_suspensao: number;
      jogos_suspensao_amarelo: number;
      jogos_suspensao_vermelho: number;
    }> = {};

    for (const c of configs) {
      cfgMap[c.categoria_id] = {
        amarelos_para_expulsao: c.amarelos_para_expulsao || 2,
        amarelos_acumulados_suspensao: c.amarelos_acumulados_suspensao || 3,
        jogos_suspensao_amarelo: c.jogos_suspensao_amarelo || 1,
        jogos_suspensao_vermelho: c.jogos_suspensao_vermelho || 1,
      };
    }

    // 2. Rule: 2 Cartões Amarelos no Mesmo Jogo (Expulsão / 2º Amarelo)
    const doubleYellows = await query<{
      jogador_id: number;
      partida_id: number;
      categoria_id: number;
      amarelos_jogo: number;
    }>(
      `SELECT ep.jogador_id, ep.partida_id, p.categoria_id, COUNT(ep.id) AS amarelos_jogo
       FROM eventos_partida ep
       JOIN partidas p ON ep.partida_id = p.id
       WHERE ep.tipo_evento = 'CARTAO_AMARELO'
       ${categoriaId ? 'AND p.categoria_id = ' + Number(categoriaId) : ''}
       GROUP BY ep.jogador_id, ep.partida_id, p.categoria_id
       HAVING COUNT(ep.id) >= 2;`
    );

    for (const dy of doubleYellows) {
      const catCfg = cfgMap[dy.categoria_id] || { jogos_suspensao_amarelo: 1, jogos_suspensao_vermelho: 1, amarelos_acumulados_suspensao: 3 };
      // Ensure no suspension already exists for this player in this match
      const existing = await query<{ id: number }>(
        `SELECT id FROM suspensoes WHERE jogador_id = ? AND partida_origem_id = ?;`,
        [dy.jogador_id, dy.partida_id]
      );
      if (existing.length === 0) {
        await runQuery(
          `INSERT INTO suspensoes (jogador_id, partida_origem_id, jogos_cumprir, jogos_cumpridos, motivo)
           VALUES (?, ?, ?, 0, 'Expulsão (2º Cartão Amarelo no Jogo)');`,
          [dy.jogador_id, dy.partida_id, catCfg.jogos_suspensao_amarelo]
        );
      }
    }

    // 3. Rule: Cartão Vermelho Direto
    const redCards = await query<{
      jogador_id: number;
      partida_id: number;
      categoria_id: number;
    }>(
      `SELECT DISTINCT ep.jogador_id, ep.partida_id, p.categoria_id
       FROM eventos_partida ep
       JOIN partidas p ON ep.partida_id = p.id
       WHERE ep.tipo_evento = 'CARTAO_VERMELHO'
       ${categoriaId ? 'AND p.categoria_id = ' + Number(categoriaId) : ''};`
    );

    for (const r of redCards) {
      const catCfg = cfgMap[r.categoria_id] || { jogos_suspensao_vermelho: 1, jogos_suspensao_amarelo: 1, amarelos_acumulados_suspensao: 3 };
      // Ensure no suspension already exists for this player in this match (e.g. from 2nd yellow or previous red)
      const existing = await query<{ id: number }>(
        `SELECT id FROM suspensoes WHERE jogador_id = ? AND partida_origem_id = ?;`,
        [r.jogador_id, r.partida_id]
      );
      if (existing.length === 0) {
        await runQuery(
          `INSERT INTO suspensoes (jogador_id, partida_origem_id, jogos_cumprir, jogos_cumpridos, motivo)
           VALUES (?, ?, ?, 0, 'Cartão Vermelho Direto');`,
          [r.jogador_id, r.partida_id, catCfg.jogos_suspensao_vermelho]
        );
      }
    }

    // 4. Rule: Acúmulo de Cartões Amarelos (ex: 3 amarelos em partidas do torneio, desconsiderando partidas de expulsão por 2º amarelo)
    const accumulatedYellows = await query<{
      jogador_id: number;
      categoria_id: number;
      total_amarelos: number;
      partida_recente_id: number;
    }>(
      `SELECT ep.jogador_id, p.categoria_id, COUNT(ep.id) AS total_amarelos, MAX(p.id) AS partida_recente_id
       FROM eventos_partida ep
       JOIN partidas p ON ep.partida_id = p.id
       WHERE ep.tipo_evento = 'CARTAO_AMARELO'
         AND (
           SELECT COUNT(*) 
           FROM eventos_partida ep2 
           WHERE ep2.partida_id = ep.partida_id 
             AND ep2.jogador_id = ep.jogador_id 
             AND ep2.tipo_evento = 'CARTAO_AMARELO'
         ) < 2
       ${categoriaId ? 'AND p.categoria_id = ' + Number(categoriaId) : ''}
       GROUP BY ep.jogador_id, p.categoria_id
       HAVING COUNT(ep.id) >= 3;`
    );

    for (const ay of accumulatedYellows) {
      const catCfg = cfgMap[ay.categoria_id] || { jogos_suspensao_amarelo: 1, amarelos_acumulados_suspensao: 3 };
      const threshold = catCfg.amarelos_acumulados_suspensao || 3;
      const expectedSuspensions = Math.floor(ay.total_amarelos / threshold);

      const existing = await query<{ id: number }>(
        `SELECT id FROM suspensoes WHERE jogador_id = ? AND motivo LIKE '%Acúmulo%';`,
        [ay.jogador_id]
      );

      if (existing.length < expectedSuspensions) {
        const toAdd = expectedSuspensions - existing.length;
        for (let i = 0; i < toAdd; i++) {
          await runQuery(
            `INSERT INTO suspensoes (jogador_id, partida_origem_id, jogos_cumprir, jogos_cumpridos, motivo)
             VALUES (?, ?, ?, 0, ?);`,
            [
              ay.jogador_id,
              ay.partida_recente_id,
              catCfg.jogos_suspensao_amarelo,
              `Acúmulo de ${ay.total_amarelos} Cartões Amarelos`
            ]
          );
        }
      }
    }
  } catch (err) {
    console.error('[syncCategorySuspensions Error]:', err);
  }
}

/**
 * Fetch All Suspensions for Category with complete player & team information
 */
export async function getCategorySuspensoes(categoriaId: number): Promise<Suspensao[]> {
  try {
    await syncCategorySuspensions(categoriaId);

    const rows = await query<Suspensao>(
      `SELECT 
         s.id,
         s.jogador_id,
         s.partida_origem_id,
         s.jogos_cumprir,
         s.jogos_cumpridos,
         s.motivo,
         j.nome AS jogador_nome,
         j.camisa_posicao,
         COALESCE(t.id, 0) AS time_id,
         COALESCE(t.nome, 'Time') AS time_nome,
         COALESCE(t.cor_hex, '#FF6B1A') AS time_cor_hex,
         COALESCE(t.brasao_path, '') AS time_brasao_path,
         COALESCE(j.categoria_id, t.categoria_id) AS categoria_id,
         COALESCE(c.nome, '') AS categoria_nome
       FROM suspensoes s
       JOIN jogadores j ON s.jogador_id = j.id
       LEFT JOIN times t ON j.time_id = t.id
       LEFT JOIN categorias c ON c.id = COALESCE(j.categoria_id, t.categoria_id)
       WHERE (j.categoria_id = ? OR t.categoria_id = ?)
       ORDER BY s.id DESC;`,
      [categoriaId, categoriaId]
    );

    // Safeguard deduplication in JavaScript
    const seenIds = new Set<number>();
    const seenKeys = new Set<string>();
    const uniqueList: Suspensao[] = [];

    for (const row of rows) {
      if (seenIds.has(row.id)) continue;
      
      const key = `${row.jogador_id}_${row.partida_origem_id || 'acc'}_${row.motivo?.includes('Acúmulo') ? 'acc' : 'match'}`;
      if (seenKeys.has(key)) continue;

      seenIds.add(row.id);
      seenKeys.add(key);
      uniqueList.push(row);
    }

    return uniqueList;
  } catch (err) {
    console.error('[getCategorySuspensoes Error]:', err);
    return [];
  }
}

/**
 * Fetch Highlights (Craques da Partida / Destaques)
 */
export async function getCategoryDestaques(categoriaId: number): Promise<DestaqueItem[]> {
  try {
    return await query<DestaqueItem>(
      `SELECT 
         j.id AS jogador_id,
         j.nome AS jogador_nome,
         j.camisa_posicao,
         t.nome AS time_nome,
         t.cor_hex AS time_cor_hex,
         COUNT(ep.id) AS destaques
       FROM eventos_partida ep
       JOIN jogadores j ON ep.jogador_id = j.id
       JOIN times t ON ep.time_id = t.id
       JOIN partidas p ON ep.partida_id = p.id
       WHERE ep.tipo_evento = 'DESTAQUE' AND (p.categoria_id = ? OR j.categoria_id = ?)
       GROUP BY j.id, j.nome, j.camisa_posicao, t.nome, t.cor_hex
       ORDER BY destaques DESC, j.nome ASC;`,
      [categoriaId, categoriaId]
    );
  } catch (err) {
    console.error('[getCategoryDestaques Error]:', err);
    return [];
  }
}


