/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDb, persistDatabase, query, runQuery } from './db';
import { ClassificacaoItem, Partida, Time } from '../types';

export interface FixtureSummary {
  categoria_id: number;
  total_partidas: number;
  rodadas_criadas: number;
}

/**
 * Generate Round-Robin Group Stage matches (Berger / Circle Method)
 */
export async function generateGroupStageFixtures(categoria_id: number): Promise<FixtureSummary> {
  const db = await getDb();

  // 1. Fetch teams for this category
  const times = await query<Time>(
    'SELECT id, nome, cor_hex, categoria_id FROM times WHERE categoria_id = ? ORDER BY id ASC;',
    [categoria_id]
  );

  if (times.length < 2) {
    throw new Error('É necessário ter no mínimo 2 times cadastrados na categoria para gerar os jogos.');
  }

  // Clear existing fixtures for this category in transaction
  db.run('BEGIN TRANSACTION;');

  try {
    // Delete existing events & matches for this category
    db.run(
      `DELETE FROM eventos_partida WHERE partida_id IN (SELECT id FROM partidas WHERE categoria_id = ?);`,
      [categoria_id]
    );
    db.run(`DELETE FROM partidas WHERE categoria_id = ?;`, [categoria_id]);

    let teamList: (number | null)[] = times.map((t) => t.id);

    // If odd number of teams, add a dummy BYE (null) team
    const isOdd = teamList.length % 2 !== 0;
    if (isOdd) {
      teamList.push(null);
    }

    const totalTeams = teamList.length;
    const numRounds = totalTeams - 1;
    const matchesPerRound = totalTeams / 2;

    let matchCount = 0;
    const baseDate = new Date();

    for (let round = 1; round <= numRounds; round++) {
      for (let matchIdx = 0; matchIdx < matchesPerRound; matchIdx++) {
        const home = teamList[matchIdx];
        const away = teamList[totalTeams - 1 - matchIdx];

        // Skip BYE matches
        if (home !== null && away !== null) {
          // Alternate home/away based on round for fairness
          const isFlipped = (round + matchIdx) % 2 === 0;
          const mandanteId = isFlipped ? away : home;
          const visitanteId = isFlipped ? home : away;

          // Schedule date offset by round and match
          const matchDate = new Date(baseDate.getTime() + (round - 1) * 7 * 86400000 + matchIdx * 3600000);
          const isoDate = matchDate.toISOString().replace('T', ' ').substring(0, 19);

          db.run(
            `INSERT INTO partidas 
             (categoria_id, fase_id, time_mandante_id, time_visitante_id, gols_mandante, gols_visitante, data_hora, status, tempo_decorrido_segundos, rodada)
             VALUES (?, 1, ?, ?, 0, 0, ?, 'AGENDADO', 0, ?);`,
            [categoria_id, mandanteId, visitanteId, isoDate, round]
          );

          matchCount++;
        }
      }

      // Rotate array for next round (keep first team fixed)
      const lastTeam = teamList.pop()!;
      teamList.splice(1, 0, lastTeam);
    }

    db.run('COMMIT;');
    persistDatabase();

    return {
      categoria_id,
      total_partidas: matchCount,
      rodadas_criadas: numRounds,
    };
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }
}

/**
 * Generate Playoff Bracket (Quartas, Semifinal, Final) based on current Group Standings
 */
export async function generatePlayoffs(categoria_id: number): Promise<void> {
  const db = await getDb();

  // Get current standings for Group Stage
  const standings = await query<ClassificacaoItem>(
    `SELECT 
       t.id AS time_id,
       t.nome AS time_nome,
       COALESCE(COUNT(CASE WHEN p.status = 'FINALIZADO' AND p.fase_id = 1 THEN p.id END), 0) AS jogos,
       COALESCE(SUM(CASE 
         WHEN p.status = 'FINALIZADO' AND p.fase_id = 1 AND ((p.time_mandante_id = t.id AND p.gols_mandante > p.gols_visitante) OR (p.time_visitante_id = t.id AND p.gols_visitante > p.gols_mandante)) THEN 3
         WHEN p.status = 'FINALIZADO' AND p.fase_id = 1 AND p.gols_mandante = p.gols_visitante THEN 1
         ELSE 0 END), 0) AS pontos,
       COALESCE(SUM(CASE WHEN p.status = 'FINALIZADO' AND p.fase_id = 1 THEN CASE WHEN p.time_mandante_id = t.id THEN p.gols_mandante - p.gols_visitante ELSE p.gols_visitante - p.gols_mandante END END), 0) AS saldo_gols,
       COALESCE(SUM(CASE WHEN p.status = 'FINALIZADO' AND p.fase_id = 1 THEN CASE WHEN p.time_mandante_id = t.id THEN p.gols_mandante ELSE p.gols_visitante END END), 0) AS gols_pro
     FROM times t
     LEFT JOIN partidas p ON (p.time_mandante_id = t.id OR p.time_visitante_id = t.id)
     WHERE t.categoria_id = ?
     GROUP BY t.id, t.nome
     ORDER BY pontos DESC, saldo_gols DESC, gols_pro DESC, t.nome ASC;`,
    [categoria_id]
  );

  if (standings.length < 2) {
    throw new Error('Classificação insuficiente para gerar o mata-mata.');
  }

  db.run('BEGIN TRANSACTION;');

  try {
    // Delete existing playoff matches for this category
    db.run(
      `DELETE FROM eventos_partida WHERE partida_id IN (SELECT id FROM partidas WHERE categoria_id = ? AND fase_id > 1);`,
      [categoria_id]
    );
    db.run(`DELETE FROM partidas WHERE categoria_id = ? AND fase_id > 1;`, [categoria_id]);

    const numTeams = standings.length;
    const nowISO = new Date().toISOString().replace('T', ' ').substring(0, 19);

    if (numTeams >= 6) {
      // 8 / 6 Teams standard system:
      // Top 2 (1º and 2º) bye directly to Semifinal
      // Quartas / Repescagem: 3º vs 6º (Q1) and 4º vs 5º (Q2)
      const t3 = standings[2].time_id;
      const t4 = standings[3].time_id;
      const t5 = standings[4].time_id;
      const t6 = standings[5] ? standings[5].time_id : standings[4].time_id;

      // Quartas Match 1: 3º vs 6º
      db.run(
        `INSERT INTO partidas 
         (categoria_id, fase_id, time_mandante_id, time_visitante_id, data_hora, status, rodada)
         VALUES (?, 2, ?, ?, ?, 'AGENDADO', 1);`,
        [categoria_id, t3, t6, nowISO]
      );

      // Quartas Match 2: 4º vs 5º
      db.run(
        `INSERT INTO partidas 
         (categoria_id, fase_id, time_mandante_id, time_visitante_id, data_hora, status, rodada)
         VALUES (?, 2, ?, ?, ?, 'AGENDADO', 1);`,
        [categoria_id, t4, t5, nowISO]
      );
    } else {
      // Direct Semifinal for 4 teams: 1º vs 4º and 2º vs 3º
      const t1 = standings[0].time_id;
      const t2 = standings[1].time_id;
      const t3 = standings[2] ? standings[2].time_id : standings[1].time_id;
      const t4 = standings[3] ? standings[3].time_id : standings[0].time_id;

      // Semi 1: 1º vs 4º
      db.run(
        `INSERT INTO partidas 
         (categoria_id, fase_id, time_mandante_id, time_visitante_id, data_hora, status, rodada)
         VALUES (?, 3, ?, ?, ?, 'AGENDADO', 1);`,
        [categoria_id, t1, t4, nowISO]
      );

      // Semi 2: 2º vs 3º
      db.run(
        `INSERT INTO partidas 
         (categoria_id, fase_id, time_mandante_id, time_visitante_id, data_hora, status, rodada)
         VALUES (?, 3, ?, ?, ?, 'AGENDADO', 1);`,
        [categoria_id, t2, t3, nowISO]
      );
    }

    db.run('COMMIT;');
    persistDatabase();
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }
}
