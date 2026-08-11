/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { query, runQuery } from './db';
import { ClassificacaoItem, Partida, Time } from '../types';

export interface FixtureSummary {
  categoria_id: number;
  total_partidas: number;
  rodadas_criadas: number;
}

/**
 * Generate Round-Robin Group Stage matches (Berger / Circle Method)
 */
export async function generateGroupStageFixtures(
  categoria_id: number,
  format: 'UNICO' | 'DUAS_CHAVES' = 'UNICO'
): Promise<FixtureSummary> {
  // 1. Fetch teams for this category
  const times = await query<Time>(
    'SELECT id, nome, cor_hex, categoria_id FROM times WHERE categoria_id = ? ORDER BY id ASC;',
    [categoria_id]
  );

  if (times.length < 2) {
    throw new Error('É necessário ter no mínimo 2 times cadastrados na categoria para gerar os jogos.');
  }

  if (format === 'DUAS_CHAVES' && times.length < 4) {
    throw new Error('É necessário ter no mínimo 4 times cadastrados para dividir o torneio em Duas Chaves (Grupo A e Grupo B).');
  }

  // Delete existing suspensions, events & matches for this category
  await runQuery(
    `DELETE FROM suspensoes WHERE partida_origem_id IN (SELECT id FROM partidas WHERE categoria_id = ?);`,
    [categoria_id]
  );
  await runQuery(
    `DELETE FROM eventos_partida WHERE partida_id IN (SELECT id FROM partidas WHERE categoria_id = ?);`,
    [categoria_id]
  );
  await runQuery(`DELETE FROM partidas WHERE categoria_id = ?;`, [categoria_id]);

  let matchCount = 0;
  let maxRounds = 0;
  const baseDate = new Date();

  if (format === 'DUAS_CHAVES') {
    // Split teams evenly into Group A and Group B
    const half = Math.ceil(times.length / 2);
    const groupATeams = times.slice(0, half);
    const groupBTeams = times.slice(half);

    // Update group assignments in DB
    for (const t of groupATeams) {
      await runQuery('UPDATE times SET grupo = ? WHERE id = ?;', ['A', t.id]);
    }
    for (const t of groupBTeams) {
      await runQuery('UPDATE times SET grupo = ? WHERE id = ?;', ['B', t.id]);
    }

    // Helper function to generate round-robin for a group
    const generateForSubGroup = async (groupLabel: string, subTimes: Time[]) => {
      let teamList: (number | null)[] = subTimes.map((t) => t.id);
      if (teamList.length % 2 !== 0) teamList.push(null); // BYE

      const totalTeams = teamList.length;
      const numRounds = totalTeams - 1;
      const matchesPerRound = totalTeams / 2;

      if (numRounds > maxRounds) maxRounds = numRounds;

      for (let round = 1; round <= numRounds; round++) {
        for (let matchIdx = 0; matchIdx < matchesPerRound; matchIdx++) {
          const home = teamList[matchIdx];
          const away = teamList[totalTeams - 1 - matchIdx];

          if (home !== null && away !== null) {
            const isFlipped = (round + matchIdx) % 2 === 0;
            const mandanteId = isFlipped ? away : home;
            const visitanteId = isFlipped ? home : away;

            const matchDate = new Date(baseDate.getTime() + (round - 1) * 7 * 86400000 + matchIdx * 3600000);
            const isoDate = matchDate.toISOString().replace('T', ' ').substring(0, 19);

            await runQuery(
              `INSERT INTO partidas 
               (categoria_id, fase_id, time_mandante_id, time_visitante_id, gols_mandante, gols_visitante, data_hora, status, tempo_decorrido_segundos, rodada, grupo)
               VALUES (?, 1, ?, ?, 0, 0, ?, 'AGENDADO', 0, ?, ?);`,
              [categoria_id, mandanteId, visitanteId, isoDate, round, groupLabel]
            );
            matchCount++;
          }
        }
        const lastTeam = teamList.pop()!;
        teamList.splice(1, 0, lastTeam);
      }
    };

    await generateForSubGroup('A', groupATeams);
    await generateForSubGroup('B', groupBTeams);
  } else {
    // UNICO Mode (Single Group)
    for (const t of times) {
      await runQuery('UPDATE times SET grupo = ? WHERE id = ?;', ['A', t.id]);
    }

    let teamList: (number | null)[] = times.map((t) => t.id);
    if (teamList.length % 2 !== 0) teamList.push(null);

    const totalTeams = teamList.length;
    const numRounds = totalTeams - 1;
    const matchesPerRound = totalTeams / 2;
    maxRounds = numRounds;

    for (let round = 1; round <= numRounds; round++) {
      for (let matchIdx = 0; matchIdx < matchesPerRound; matchIdx++) {
        const home = teamList[matchIdx];
        const away = teamList[totalTeams - 1 - matchIdx];

        if (home !== null && away !== null) {
          const isFlipped = (round + matchIdx) % 2 === 0;
          const mandanteId = isFlipped ? away : home;
          const visitanteId = isFlipped ? home : away;

          const matchDate = new Date(baseDate.getTime() + (round - 1) * 7 * 86400000 + matchIdx * 3600000);
          const isoDate = matchDate.toISOString().replace('T', ' ').substring(0, 19);

          await runQuery(
            `INSERT INTO partidas 
             (categoria_id, fase_id, time_mandante_id, time_visitante_id, gols_mandante, gols_visitante, data_hora, status, tempo_decorrido_segundos, rodada, grupo)
             VALUES (?, 1, ?, ?, 0, 0, ?, 'AGENDADO', 0, ?, 'A');`,
            [categoria_id, mandanteId, visitanteId, isoDate, round]
          );
          matchCount++;
        }
      }
      const lastTeam = teamList.pop()!;
      teamList.splice(1, 0, lastTeam);
    }
  }

  return {
    categoria_id,
    total_partidas: matchCount,
    rodadas_criadas: maxRounds,
  };
}

/**
 * Generate Playoff Bracket (Quartas, Semifinal, Final) based on current Group Standings
 */
export async function generatePlayoffs(categoria_id: number): Promise<void> {
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
    throw new Error('É necessário ter no mínimo 2 times cadastrados na categoria para gerar a fase de mata-mata.');
  }

  // Delete existing playoff matches for this category
  await runQuery(
    `DELETE FROM suspensoes WHERE partida_origem_id IN (SELECT id FROM partidas WHERE categoria_id = ? AND fase_id > 1);`,
    [categoria_id]
  );
  await runQuery(
    `DELETE FROM eventos_partida WHERE partida_id IN (SELECT id FROM partidas WHERE categoria_id = ? AND fase_id > 1);`,
    [categoria_id]
  );
  await runQuery(`DELETE FROM partidas WHERE categoria_id = ? AND fase_id > 1;`, [categoria_id]);

  const numTeams = standings.length;
  const nowISO = new Date().toISOString().replace('T', ' ').substring(0, 19);

  if (numTeams === 2) {
    // 2 teams: Direct Final between 1st and 2nd
    const t1 = standings[0].time_id;
    const t2 = standings[1].time_id;
    await runQuery(
      `INSERT INTO partidas 
       (categoria_id, fase_id, time_mandante_id, time_visitante_id, data_hora, status, rodada)
       VALUES (?, 4, ?, ?, ?, 'AGENDADO', 1);`,
      [categoria_id, t1, t2, nowISO]
    );
  } else if (numTeams >= 6) {
    // 6+ Teams: Quartas (3º vs 6º and 4º vs 5º; 1º and 2º bye directly to Semifinals)
    const t3 = standings[2].time_id;
    const t4 = standings[3].time_id;
    const t5 = standings[4].time_id;
    const t6 = standings[5].time_id;

    await runQuery(
      `INSERT INTO partidas 
       (categoria_id, fase_id, time_mandante_id, time_visitante_id, data_hora, status, rodada)
       VALUES (?, 2, ?, ?, ?, 'AGENDADO', 1);`,
      [categoria_id, t3, t6, nowISO]
    );

    await runQuery(
      `INSERT INTO partidas 
       (categoria_id, fase_id, time_mandante_id, time_visitante_id, data_hora, status, rodada)
       VALUES (?, 2, ?, ?, ?, 'AGENDADO', 1);`,
      [categoria_id, t4, t5, nowISO]
    );
  } else {
    // 3, 4, or 5 teams
    const t1 = standings[0].time_id;
    const t2 = standings[1].time_id;
    const t3 = standings[2].time_id;

    if (numTeams === 3) {
      // 3 teams: Semifinal (2º vs 3º)
      await runQuery(
        `INSERT INTO partidas 
         (categoria_id, fase_id, time_mandante_id, time_visitante_id, data_hora, status, rodada)
         VALUES (?, 3, ?, ?, ?, 'AGENDADO', 1);`,
        [categoria_id, t2, t3, nowISO]
      );
    } else {
      // 4 or 5 teams: Semifinals (1º vs 4º and 2º vs 3º)
      const t4 = standings[3].time_id;
      await runQuery(
        `INSERT INTO partidas 
         (categoria_id, fase_id, time_mandante_id, time_visitante_id, data_hora, status, rodada)
         VALUES (?, 3, ?, ?, ?, 'AGENDADO', 1);`,
        [categoria_id, t1, t4, nowISO]
      );

      await runQuery(
        `INSERT INTO partidas 
         (categoria_id, fase_id, time_mandante_id, time_visitante_id, data_hora, status, rodada)
         VALUES (?, 3, ?, ?, ?, 'AGENDADO', 1);`,
        [categoria_id, t2, t3, nowISO]
      );
    }
  }
}
