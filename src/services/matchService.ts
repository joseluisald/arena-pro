/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDb, persistDatabase, query, runQuery } from './db';
import { EventoPartida, Jogador, Partida, Suspensao, TipoEvento } from '../types';

/**
 * Fetch detailed match data with joined teams and category info
 */
export async function getMatchDetails(partida_id: number): Promise<Partida | null> {
  const matches = await query<Partida>(
    `SELECT 
       p.*,
       f.nome AS fase_nome,
       c.nome AS categoria_nome,
       tm.nome AS time_mandante_nome,
       tm.cor_hex AS time_mandante_cor,
       tm.brasao_path AS time_mandante_brasao,
       tv.nome AS time_visitante_nome,
       tv.cor_hex AS time_visitante_cor,
       tv.brasao_path AS time_visitante_brasao
     FROM partidas p
     JOIN fases f ON p.fase_id = f.id
     JOIN categorias c ON p.categoria_id = c.id
     JOIN times tm ON p.time_mandante_id = tm.id
     JOIN times tv ON p.time_visitante_id = tv.id
     WHERE p.id = ?;`,
    [partida_id]
  );
  return matches[0] || null;
}

/**
 * Fetch players for home and away teams with current match cards & goals
 */
export async function getMatchRosters(
  partida_id: number,
  time_mandante_id: number,
  time_visitante_id: number
): Promise<{ mandante: Jogador[]; visitante: Jogador[] }> {
  // Fetch active players for mandante
  const mandante = await query<Jogador>(
    `SELECT 
       j.*,
       t.nome AS time_nome,
       t.cor_hex AS time_cor_hex,
       (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = ? AND ep.jogador_id = j.id AND ep.tipo_evento = 'GOL') AS gols,
       (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = ? AND ep.jogador_id = j.id AND ep.tipo_evento = 'CARTAO_AMARELO') AS cartoes_amarelos,
       (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = ? AND ep.jogador_id = j.id AND ep.tipo_evento = 'CARTAO_VERMELHO') AS cartoes_vermelhos,
       (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = ? AND ep.jogador_id = j.id AND ep.tipo_evento = 'DESTAQUE') AS destaques
     FROM jogadores j
     JOIN times t ON j.time_id = t.id
     WHERE j.time_id = ?
     ORDER BY j.camisa_posicao ASC, j.nome ASC;`,
    [partida_id, partida_id, partida_id, partida_id, time_mandante_id]
  );

  // Fetch active players for visitante
  const visitante = await query<Jogador>(
    `SELECT 
       j.*,
       t.nome AS time_nome,
       t.cor_hex AS time_cor_hex,
       (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = ? AND ep.jogador_id = j.id AND ep.tipo_evento = 'GOL') AS gols,
       (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = ? AND ep.jogador_id = j.id AND ep.tipo_evento = 'CARTAO_AMARELO') AS cartoes_amarelos,
       (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = ? AND ep.jogador_id = j.id AND ep.tipo_evento = 'CARTAO_VERMELHO') AS cartoes_vermelhos,
       (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = ? AND ep.jogador_id = j.id AND ep.tipo_evento = 'DESTAQUE') AS destaques
     FROM jogadores j
     JOIN times t ON j.time_id = t.id
     WHERE j.time_id = ?
     ORDER BY j.camisa_posicao ASC, j.nome ASC;`,
    [partida_id, partida_id, partida_id, partida_id, time_visitante_id]
  );

  return { mandante, visitante };
}

/**
 * Fetch chronological match events
 */
export async function getMatchEvents(partida_id: number): Promise<EventoPartida[]> {
  return await query<EventoPartida>(
    `SELECT 
       ep.*,
       j.nome AS jogador_nome,
       j.camisa_posicao,
       t.nome AS time_nome,
       t.cor_hex AS time_cor_hex
     FROM eventos_partida ep
     JOIN jogadores j ON ep.jogador_id = j.id
     JOIN times t ON ep.time_id = t.id
     WHERE ep.partida_id = ?
     ORDER BY ep.id DESC;`,
    [partida_id]
  );
}

/**
 * Add a match event (Gol, Yellow Card, Red Card, Highlight)
 * Trigger automatically updates partidas score if event is 'GOL'!
 */
export async function addMatchEvent(
  partida_id: number,
  time_id: number,
  jogador_id: number,
  tipo_evento: TipoEvento,
  minuto_jogo: number
): Promise<void> {
  await runQuery(
    `INSERT INTO eventos_partida (partida_id, time_id, jogador_id, tipo_evento, minuto_jogo)
     VALUES (?, ?, ?, ?, ?);`,
    [partida_id, time_id, jogador_id, tipo_evento, minuto_jogo]
  );
}

/**
 * Delete / Undo a match event
 */
export async function deleteMatchEvent(evento_id: number): Promise<void> {
  await runQuery('DELETE FROM eventos_partida WHERE id = ?;', [evento_id]);
}

/**
 * Update match timer / status
 */
export async function updateMatchTimer(
  partida_id: number,
  tempo_decorrido_segundos: number,
  status: 'AGENDADO' | 'EM_ANDAMENTO' | 'FINALIZADO'
): Promise<void> {
  await runQuery(
    `UPDATE partidas 
     SET tempo_decorrido_segundos = ?, status = ?
     WHERE id = ?;`,
    [tempo_decorrido_segundos, status, partida_id]
  );
}

/**
 * Finalize match and calculate automatic card suspensions
 */
export async function finalizeMatch(partida_id: number, tempo_decorrido_segundos: number): Promise<void> {
  const db = await getDb();
  const match = await getMatchDetails(partida_id);
  if (!match) return;

  // 1. Fetch category settings
  const configs = await query<{
    amarelos_acumulados_suspensao: number;
    jogos_suspensao_amarelo: number;
    jogos_suspensao_vermelho: number;
  }>(
    `SELECT amarelos_acumulados_suspensao, jogos_suspensao_amarelo, jogos_suspensao_vermelho 
     FROM configuracoes_categoria 
     WHERE categoria_id = ?;`,
    [match.categoria_id]
  );

  const cfg = configs[0] || {
    amarelos_acumulados_suspensao: 3,
    jogos_suspensao_amarelo: 1,
    jogos_suspensao_vermelho: 1,
  };

  db.run('BEGIN TRANSACTION;');

  try {
    // Mark match status as FINALIZADO
    db.run(
      `UPDATE partidas SET status = 'FINALIZADO', tempo_decorrido_segundos = ? WHERE id = ?;`,
      [tempo_decorrido_segundos, partida_id]
    );

    // 2. Process Red Cards given in this match
    const redCardEvents = await query<{ jogador_id: number }>(
      `SELECT DISTINCT jogador_id FROM eventos_partida 
       WHERE partida_id = ? AND tipo_evento = 'CARTAO_VERMELHO';`,
      [partida_id]
    );

    for (const r of redCardEvents) {
      db.run(
        `INSERT INTO suspensoes (jogador_id, partida_origem_id, jogos_cumprir, jogos_cumpridos, motivo)
         VALUES (?, ?, ?, 0, 'Cartão Vermelho Direto');`,
        [r.jogador_id, partida_id, cfg.jogos_suspensao_vermelho]
      );
    }

    // 3. Process Yellow Cards accumulation across finished matches in category
    const yellowCardPlayers = await query<{ jogador_id: number }>(
      `SELECT DISTINCT jogador_id FROM eventos_partida 
       WHERE partida_id = ? AND tipo_evento = 'CARTAO_AMARELO';`,
      [partida_id]
    );

    for (const y of yellowCardPlayers) {
      // Calculate total yellow cards in category for this player
      const cardStats = await query<{ total_amarelos: number }>(
        `SELECT COUNT(*) AS total_amarelos 
         FROM eventos_partida ep
         JOIN partidas p ON ep.partida_id = p.id
         WHERE ep.jogador_id = ? AND ep.tipo_evento = 'CARTAO_AMARELO' AND p.categoria_id = ? AND p.status = 'FINALIZADO';`,
        [y.jogador_id, match.categoria_id]
      );

      const totalAmarelos = cardStats[0]?.total_amarelos || 0;

      // Check if threshold reached
      if (totalAmarelos > 0 && totalAmarelos % cfg.amarelos_acumulados_suspensao === 0) {
        db.run(
          `INSERT INTO suspensoes (jogador_id, partida_origem_id, jogos_cumprir, jogos_cumpridos, motivo)
           VALUES (?, ?, ?, 0, ?);`,
          [
            y.jogador_id,
            partida_id,
            cfg.jogos_suspensao_amarelo,
            `Acúmulo de ${totalAmarelos} Cartões Amarelos`,
          ]
        );
      }
    }

    db.run('COMMIT;');
    persistDatabase();
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }
}
