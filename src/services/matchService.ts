/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { query, runQuery } from './db';
import { EventoPartida, Jogador, Partida, Suspensao, TipoEvento } from '../types';
import { syncCategorySuspensions } from './standingsService';

/**
 * Calculate and persist the exact goals for all matches based on registered GOL events
 */
export async function syncAllMatchesScores(): Promise<void> {
  try {
    await runQuery(`
      UPDATE partidas
      SET 
        gols_mandante = (
          SELECT COUNT(*) 
          FROM eventos_partida ep 
          WHERE ep.partida_id = partidas.id 
            AND ep.time_id = partidas.time_mandante_id 
            AND ep.tipo_evento = 'GOL'
        ),
        gols_visitante = (
          SELECT COUNT(*) 
          FROM eventos_partida ep 
          WHERE ep.partida_id = partidas.id 
            AND ep.time_id = partidas.time_visitante_id 
            AND ep.tipo_evento = 'GOL'
        )
      WHERE (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = partidas.id AND ep.tipo_evento = 'GOL') > 0;
    `);
  } catch (err) {
    console.error('[syncAllMatchesScores Error]:', err);
  }
}

/**
 * Calculate and persist the exact goals for mandante and visitante based on registered GOL events
 */
export async function updateMatchScoreFromEvents(partida_id: number): Promise<{ gols_mandante: number; gols_visitante: number }> {
  try {
    // 1. Calculate live goals directly from eventos_partida table
    const counts = await query<{ gols_mandante: number; gols_visitante: number }>(
      `SELECT 
         COALESCE((SELECT COUNT(*) FROM eventos_partida WHERE partida_id = p.id AND time_id = p.time_mandante_id AND tipo_evento = 'GOL'), 0) AS gols_mandante,
         COALESCE((SELECT COUNT(*) FROM eventos_partida WHERE partida_id = p.id AND time_id = p.time_visitante_id AND tipo_evento = 'GOL'), 0) AS gols_visitante
       FROM partidas p
       WHERE p.id = ?;`,
      [partida_id]
    );

    const totalEvents = await query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM eventos_partida WHERE partida_id = ? AND tipo_evento = 'GOL';`,
      [partida_id]
    );

    if ((totalEvents[0]?.total || 0) > 0) {
      const gols_mandante = counts[0]?.gols_mandante ?? 0;
      const gols_visitante = counts[0]?.gols_visitante ?? 0;

      // 2. Persist updated score into partidas table
      await runQuery(
        `UPDATE partidas SET gols_mandante = ?, gols_visitante = ? WHERE id = ?;`,
        [gols_mandante, gols_visitante, partida_id]
      );

      return { gols_mandante, gols_visitante };
    }

    const currentMatch = await query<{ gols_mandante: number; gols_visitante: number }>(
      `SELECT gols_mandante, gols_visitante FROM partidas WHERE id = ?;`,
      [partida_id]
    );

    return {
      gols_mandante: currentMatch[0]?.gols_mandante ?? 0,
      gols_visitante: currentMatch[0]?.gols_visitante ?? 0
    };
  } catch (err) {
    console.error('[updateMatchScoreFromEvents Error]:', err);
    return { gols_mandante: 0, gols_visitante: 0 };
  }
}

/**
 * Fetch detailed match data with joined teams, category info and computed live score
 */
export async function getMatchDetails(partida_id: number): Promise<Partida | null> {
  // Sync score first to ensure absolute consistency
  await updateMatchScoreFromEvents(partida_id);

  const matches = await query<Partida>(
    `SELECT 
       p.*,
       CASE 
         WHEN (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = p.id AND ep.time_id = p.time_mandante_id AND ep.tipo_evento = 'GOL') > 0
         THEN (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = p.id AND ep.time_id = p.time_mandante_id AND ep.tipo_evento = 'GOL')
         ELSE COALESCE(p.gols_mandante, 0)
       END AS gols_mandante,
       CASE 
         WHEN (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = p.id AND ep.time_id = p.time_visitante_id AND ep.tipo_evento = 'GOL') > 0
         THEN (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = p.id AND ep.time_id = p.time_visitante_id AND ep.tipo_evento = 'GOL')
         ELSE COALESCE(p.gols_visitante, 0)
       END AS gols_visitante,
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
 * Automatically updates and syncs partidas score and automated suspensions!
 */
export async function addMatchEvent(
  partida_id: number,
  time_id: number,
  jogador_id: number,
  tipo_evento: TipoEvento,
  minuto_jogo: number
): Promise<{ gols_mandante: number; gols_visitante: number }> {
  await runQuery(
    `INSERT INTO eventos_partida (partida_id, time_id, jogador_id, tipo_evento, minuto_jogo)
     VALUES (?, ?, ?, ?, ?);`,
    [partida_id, time_id, jogador_id, tipo_evento, minuto_jogo]
  );

  // If card event, sync suspensions immediately
  if (tipo_evento === 'CARTAO_AMARELO' || tipo_evento === 'CARTAO_VERMELHO') {
    const match = await query<{ categoria_id: number }>('SELECT categoria_id FROM partidas WHERE id = ?;', [partida_id]);
    if (match[0]?.categoria_id) {
      await syncCategorySuspensions(match[0].categoria_id);
    }
  }

  return await updateMatchScoreFromEvents(partida_id);
}

/**
 * Delete / Undo a match event and recalculate match score
 */
export async function deleteMatchEvent(evento_id: number): Promise<{ gols_mandante: number; gols_visitante: number }> {
  const ev = await query<{ partida_id: number; tipo_evento: string; jogador_id: number }>(
    'SELECT partida_id, tipo_evento, jogador_id FROM eventos_partida WHERE id = ?;',
    [evento_id]
  );
  const partida_id = ev[0]?.partida_id;
  const tipo = ev[0]?.tipo_evento;
  const jogador_id = ev[0]?.jogador_id;

  await runQuery('DELETE FROM eventos_partida WHERE id = ?;', [evento_id]);

  if (partida_id) {
    if (tipo === 'CARTAO_AMARELO' || tipo === 'CARTAO_VERMELHO') {
      const match = await query<{ categoria_id: number }>('SELECT categoria_id FROM partidas WHERE id = ?;', [partida_id]);
      if (match[0]?.categoria_id) {
        // Clean up any double yellow suspension if player no longer has 2 yellow cards
        if (tipo === 'CARTAO_AMARELO' && jogador_id) {
          const remainingYellows = await query<{ count: number }>(
            `SELECT COUNT(*) AS count FROM eventos_partida WHERE partida_id = ? AND jogador_id = ? AND tipo_evento = 'CARTAO_AMARELO';`,
            [partida_id, jogador_id]
          );
          if ((remainingYellows[0]?.count || 0) < 2) {
            await runQuery(
              `DELETE FROM suspensoes WHERE jogador_id = ? AND partida_origem_id = ? AND motivo LIKE '%2º Cartão Amarelo%';`,
              [jogador_id, partida_id]
            );
          }
        } else if (tipo === 'CARTAO_VERMELHO' && jogador_id) {
          await runQuery(
            `DELETE FROM suspensoes WHERE jogador_id = ? AND partida_origem_id = ? AND motivo LIKE '%Vermelho%';`,
            [jogador_id, partida_id]
          );
        }

        await syncCategorySuspensions(match[0].categoria_id);
      }
    }

    return await updateMatchScoreFromEvents(partida_id);
  }
  return { gols_mandante: 0, gols_visitante: 0 };
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
  const match = await getMatchDetails(partida_id);
  if (!match) return;

  // Mark match status as FINALIZADO
  await runQuery(
    `UPDATE partidas SET status = 'FINALIZADO', tempo_decorrido_segundos = ? WHERE id = ?;`,
    [tempo_decorrido_segundos, partida_id]
  );

  // Sync and generate all automatic suspensions
  await syncCategorySuspensions(match.categoria_id);
}
