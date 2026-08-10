/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDb, persistDatabase, query } from './db';
import { Jogador, Time } from '../types';

/**
 * Fisher-Yates shuffle algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface DraftSummary {
  categoria_id: number;
  total_jogadores: number;
  jogadores_sorteados: number;
  times_participantes: number;
  potes_processados: number[];
}

/**
 * Run the Pot-based Draft algorithm for a specific category
 */
export async function executeDraft(categoria_id: number): Promise<DraftSummary> {
  const db = await getDb();

  // 1. Fetch category settings
  const configs = await query<{ num_titulares: number; num_reservas: number }>(
    'SELECT num_titulares, num_reservas FROM configuracoes_categoria WHERE categoria_id = ?;',
    [categoria_id]
  );
  const maxRosterSize = configs[0]
    ? configs[0].num_titulares + configs[0].num_reservas
    : 10;

  // 2. Fetch teams for this category
  const times = await query<Time>(
    'SELECT id, nome, cor_hex, categoria_id FROM times WHERE categoria_id = ? ORDER BY id ASC;',
    [categoria_id]
  );

  if (times.length === 0) {
    throw new Error('Nenhum time cadastrado nesta categoria para realizar o sorteio.');
  }

  // 3. Fetch paid players for this category (pago = 1)
  const jogadores = await query<Jogador>(
    'SELECT id, nome, camisa_posicao, pago FROM jogadores WHERE categoria_id = ? AND pago = 1 ORDER BY camisa_posicao ASC, id ASC;',
    [categoria_id]
  );

  if (jogadores.length === 0) {
    throw new Error('Nenhum jogador com inscrição PAGA encontrado nesta categoria. Apenas atletas com pagamento confirmado entram no sorteio.');
  }

  // Group players by camisa_posicao (pote)
  const potesMap: Map<number, Jogador[]> = new Map();
  jogadores.forEach((j) => {
    if (!potesMap.has(j.camisa_posicao)) {
      potesMap.set(j.camisa_posicao, []);
    }
    potesMap.get(j.camisa_posicao)!.push(j);
  });

  const potesProcessados = Array.from(potesMap.keys()).sort((a, b) => a - b);

  // Track roster count per team
  const teamRosterCount: Map<number, number> = new Map();
  times.forEach((t) => teamRosterCount.set(t.id, 0));

  // SQLite Atomic Transaction
  db.run('BEGIN TRANSACTION;');

  let jogadoresSorteadosCount = 0;

  try {
    // Reset existing assignments first in transaction
    db.run('UPDATE jogadores SET time_id = NULL WHERE categoria_id = ?;', [categoria_id]);

    // For each pot (camisa_posicao), shuffle and distribute to teams
    for (const camisaPos of potesProcessados) {
      const playersInPot = potesMap.get(camisaPos) || [];
      const shuffledPlayers = shuffleArray(playersInPot);

      // Randomize initial team assignment order for each pot to preserve fairness
      const shuffledTeams = shuffleArray(times);

      let teamIdx = 0;
      for (const player of shuffledPlayers) {
        // Find next team that hasn't reached max roster size
        let attempts = 0;
        let selectedTeam: Time | null = null;

        while (attempts < shuffledTeams.length) {
          const t = shuffledTeams[teamIdx % shuffledTeams.length];
          const currentCount = teamRosterCount.get(t.id) || 0;
          if (currentCount < maxRosterSize) {
            selectedTeam = t;
            break;
          }
          teamIdx++;
          attempts++;
        }

        // Fallback: if all reached max size, assign to team with lowest count
        if (!selectedTeam) {
          selectedTeam = [...shuffledTeams].sort(
            (a, b) => (teamRosterCount.get(a.id) || 0) - (teamRosterCount.get(b.id) || 0)
          )[0];
        }

        // Assign player to selectedTeam
        db.run('UPDATE jogadores SET time_id = ? WHERE id = ?;', [selectedTeam.id, player.id]);
        teamRosterCount.set(selectedTeam.id, (teamRosterCount.get(selectedTeam.id) || 0) + 1);
        teamIdx++;
        jogadoresSorteadosCount++;
      }
    }

    db.run('COMMIT;');
    persistDatabase();

    return {
      categoria_id,
      total_jogadores: jogadores.length,
      jogadores_sorteados: jogadoresSorteadosCount,
      times_participantes: times.length,
      potes_processados: potesProcessados,
    };
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }
}

/**
 * Reset player assignments for a category
 */
export async function resetDraft(categoria_id: number): Promise<void> {
  const db = await getDb();
  db.run('UPDATE jogadores SET time_id = NULL WHERE categoria_id = ?;', [categoria_id]);
  persistDatabase();
}
