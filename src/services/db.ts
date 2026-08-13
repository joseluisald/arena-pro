/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Usuario } from '../types';

export interface MySQLStatus {
  connected: boolean;
  host?: string;
  port?: number;
  user?: string;
  database?: string;
  hasDatabaseUrl?: boolean;
  error?: string | null;
}

/**
  * Check MySQL live connection status from the backend
  */
export async function getMySQLStatus(): Promise<MySQLStatus> {
  try {
    const res = await fetch('/api/db/status');
    if (res.ok) {
      const data = await res.json();
      return {
        connected: !!data.connected,
        host: data.host,
        port: data.port,
        user: data.user,
        database: data.database,
        hasDatabaseUrl: data.hasDatabaseUrl,
        error: data.error,
      };
    }
  } catch (e: any) {
    return {
      connected: false,
      error: 'Não foi possível conectar ao servidor backend: ' + e.message,
    };
  }
  return { connected: false, error: 'Erro desconhecido ao obter status do MySQL' };
}

/**
 * Execute a SELECT query on MySQL and return array of objects
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  try {
    const res = await fetch('/api/db/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return data.rows as T[];
      throw new Error(data.error || 'Erro na consulta MySQL');
    } else {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Erro HTTP ${res.status}`);
    }
  } catch (e: any) {
    console.error('[MySQL API Query Error]:', e);
    throw e;
  }
}

/**
 * Execute a mutation query (INSERT, UPDATE, DELETE) on MySQL
 */
export async function runQuery(sql: string, params: any[] = []): Promise<{ lastInsertRowid: number; changes: number }> {
  try {
    const res = await fetch('/api/db/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return { lastInsertRowid: data.lastInsertRowid, changes: data.changes };
      }
      throw new Error(data.error || 'Erro na execução MySQL');
    } else {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Erro HTTP ${res.status}`);
    }
  } catch (e: any) {
    console.error('[MySQL API Run Error]:', e);
    throw e;
  }
}

/**
 * Execute a raw multi-statement SQL script
 */
export async function execQuery(sql: string): Promise<void> {
  const res = await fetch('/api/db/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Erro na execução SQL');
  }
}

/**
 * Reset MySQL database to seed state
 */
export async function resetDatabaseToSeed(): Promise<void> {
  const res = await fetch('/api/db/reset', { method: 'POST' });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Falha ao resetar banco MySQL');
  }
}

/**
 * Export MySQL database backup
 */
export async function exportDatabaseBackup(): Promise<Blob> {
  const res = await fetch('/api/db/export');
  if (!res.ok) {
    throw new Error('Falha ao exportar backup do MySQL');
  }
  return await res.blob();
}

/**
 * Legacy aliases for component backward compatibility
 */
export const exportSqliteFile = exportDatabaseBackup;
export const importSqliteFile = async (_file: File): Promise<void> => {
  console.warn('Restauração de arquivo local não suportada diretamente no MySQL. Use o banco configurado no .env.');
};

/**
 * Authenticate user against MySQL usuarios table
 */
export async function authenticateUser(email: string, password: string): Promise<Usuario | null> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();
  const users = await query<Usuario>(
    'SELECT id, nome, email, role, criado_em FROM usuarios WHERE LOWER(email) = ? AND senha = ?;',
    [cleanEmail, cleanPassword]
  );
  return users.length > 0 ? users[0] : null;
}

export async function getUsuarios(): Promise<Usuario[]> {
  return await query<Usuario>('SELECT id, nome, email, role, criado_em FROM usuarios ORDER BY id ASC;');
}

export async function createUsuario(nome: string, email: string, senha: string, role: string = 'ADMIN'): Promise<number> {
  const cleanEmail = email.trim().toLowerCase();
  const res = await runQuery(
    'INSERT INTO usuarios (nome, email, senha, role) VALUES (?, ?, ?, ?);',
    [nome.trim(), cleanEmail, senha.trim(), role]
  );
  return res.lastInsertRowid;
}

/**
 * Category management helpers
 */
export async function createCategoria(nome: string): Promise<number> {
  const cleanNome = nome.trim();
  if (!cleanNome) throw new Error('Nome da categoria não pode ser vazio');

  // Check if category name already exists
  const existing = await query('SELECT id FROM categorias WHERE LOWER(nome) = LOWER(?);', [cleanNome]);
  if (existing.length > 0) {
    throw new Error(`Já existe uma categoria cadastrada com o nome "${cleanNome}".`);
  }

  const res = await runQuery('INSERT INTO categorias (nome) VALUES (?);', [cleanNome]);
  const newCatId = res.lastInsertRowid;

  // Insert default rules and settings for the new category using MySQL INSERT IGNORE
  await runQuery(
    `INSERT IGNORE INTO configuracoes_categoria 
     (categoria_id, valor_inscricao, tempo_jogo_minutos, amarelos_para_expulsao, amarelos_acumulados_suspensao, jogos_suspensao_amarelo, jogos_suspensao_vermelho, num_titulares, num_reservas)
     VALUES (?, 100, 50, 2, 3, 1, 1, 7, 5);`,
    [newCatId]
  );

  return newCatId;
}

export async function updateCategoria(id: number, nome: string): Promise<void> {
  const cleanNome = nome.trim();
  if (!cleanNome) throw new Error('Nome da categoria não pode ser vazio');
  await runQuery('UPDATE categorias SET nome = ? WHERE id = ?;', [cleanNome, id]);
}

export async function deleteCategoria(id: number): Promise<void> {
  await runQuery(`DELETE FROM suspensoes WHERE jogador_id IN (SELECT id FROM jogadores WHERE categoria_id = ?) OR partida_origem_id IN (SELECT id FROM partidas WHERE categoria_id = ?);`, [id, id]);
  await runQuery(`DELETE FROM eventos_partida WHERE jogador_id IN (SELECT id FROM jogadores WHERE categoria_id = ?) OR partida_id IN (SELECT id FROM partidas WHERE categoria_id = ?);`, [id, id]);
  await runQuery(`DELETE FROM partidas WHERE categoria_id = ?;`, [id]);
  await runQuery(`DELETE FROM jogadores WHERE categoria_id = ?;`, [id]);
  await runQuery(`DELETE FROM times WHERE categoria_id = ?;`, [id]);
  await runQuery(`DELETE FROM configuracoes_categoria WHERE categoria_id = ?;`, [id]);
  await runQuery(`DELETE FROM categorias WHERE id = ?;`, [id]);
}
