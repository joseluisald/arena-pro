/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// @ts-ignore
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
// @ts-ignore
import sqlite3WasmUrl from '@sqlite.org/sqlite-wasm/sqlite3.wasm?url';
import { Usuario } from '../types';

let sqlite3Instance: any = null;
let dbInstance: any = null;

const DB_STORAGE_KEY = 'torneio_society_db_v1';

async function initSqliteInstance(): Promise<any> {
  if (sqlite3Instance) return sqlite3Instance;
  // @ts-ignore
  sqlite3Instance = await sqlite3InitModule({
    locateFile: (file: string) => {
      if (file.endsWith('.wasm')) {
        return sqlite3WasmUrl;
      }
      return file;
    },
  });
  return sqlite3Instance;
}

function patchDbMethods(db: any) {
  if (!db.run) {
    db.run = (sql: string, bind: any[] = []) => {
      db.exec({ sql, bind });
    };
  }
}

function createDbFromBytes(sqlite3: any, bytes: Uint8Array) {
  const p = sqlite3.wasm.allocFromTypedArray(bytes);
  const db = new sqlite3.oo1.DB();
  sqlite3.capi.sqlite3_deserialize(
    db.pointer,
    'main',
    p,
    bytes.byteLength,
    bytes.byteLength,
    sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE
  );
  patchDbMethods(db);
  return db;
}

export async function getDb(): Promise<any> {
  if (dbInstance) return dbInstance;

  const sqlite3 = await initSqliteInstance();

  // Check if we have a saved database in localStorage
  const savedDbBase64 = localStorage.getItem(DB_STORAGE_KEY);
  if (savedDbBase64) {
    try {
      const binaryString = atob(savedDbBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      dbInstance = createDbFromBytes(sqlite3, bytes);
      dbInstance.exec('PRAGMA foreign_keys = ON;');
      await initDatabaseSchema(dbInstance);
      await seedUsersIfEmpty(dbInstance);
      return dbInstance;
    } catch (e) {
      console.warn('Failed to restore database from localStorage, initializing fresh:', e);
    }
  }

  // Initialize fresh database
  dbInstance = new sqlite3.oo1.DB();
  patchDbMethods(dbInstance);
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  await initDatabaseSchema(dbInstance);
  await seedFasesIfEmpty();
  await seedUsersIfEmpty(dbInstance);
  persistDatabase();

  return dbInstance;
}

export function persistDatabase() {
  if (!dbInstance || !sqlite3Instance) return;
  try {
    const bytes = sqlite3Instance.capi.sqlite3_js_db_export(dbInstance);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    localStorage.setItem(DB_STORAGE_KEY, base64);
  } catch (e) {
    console.error('Error persisting SQLite database:', e);
  }
}

export async function resetDatabaseToSeed(): Promise<any> {
  try {
    const res = await fetch('/api/db/reset', { method: 'POST' });
    if (res.ok) return;
  } catch (e) {
    console.warn('Failed to reset server database, resetting locally:', e);
  }

  const db = await getDb();
  
  db.run('PRAGMA foreign_keys = OFF;');
  db.run('DELETE FROM suspensoes;');
  db.run('DELETE FROM eventos_partida;');
  db.run('DELETE FROM partidas;');
  db.run('DELETE FROM jogadores;');
  db.run('DELETE FROM times;');
  db.run('DELETE FROM configuracoes_categoria;');
  db.run('DELETE FROM fases;');
  db.run('DELETE FROM categorias;');
  try {
    db.run('DELETE FROM sqlite_sequence;');
  } catch (e) {
    // ignore if sequence table does not exist
  }
  db.run('PRAGMA foreign_keys = ON;');

  await seedFasesIfEmpty();
  await seedUsersIfEmpty(db);
  persistDatabase();
  return db;
}

export async function exportSqliteFile(): Promise<Blob> {
  try {
    const res = await fetch('/api/db/export');
    if (res.ok) {
      return await res.blob();
    }
  } catch (e) {
    console.warn('Failed to fetch database.sqlite from server:', e);
  }

  const db = await getDb();
  const bytes = sqlite3Instance.capi.sqlite3_js_db_export(db);
  return new Blob([bytes], { type: 'application/x-sqlite3' });
}

export async function importSqliteFile(file: File): Promise<void> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    const res = await fetch('/api/db/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sqlite3' },
      body: arrayBuffer,
    });
    if (res.ok) return;
  } catch (e) {
    console.warn('Failed to import database.sqlite to server:', e);
  }

  const bytes = new Uint8Array(arrayBuffer);
  const sqlite3 = await initSqliteInstance();

  if (dbInstance) {
    dbInstance.close();
  }

  dbInstance = createDbFromBytes(sqlite3, bytes);
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  await initDatabaseSchema(dbInstance);
  await seedUsersIfEmpty(dbInstance);
  persistDatabase();
}

/**
 * Initialize all tables, views, and triggers required by the tournament system
 */
export async function initDatabaseSchema(db: any) {
  const schemaSQL = `
    PRAGMA foreign_keys = ON;

    -- 0. USUÁRIOS
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        senha TEXT NOT NULL,
        role TEXT DEFAULT 'ADMIN',
        criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 1. CATEGORIAS
    CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL UNIQUE
    );

    -- 2. CONFIGURAÇÕES DO TORNEIO (por Categoria)
    CREATE TABLE IF NOT EXISTS configuracoes_categoria (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        categoria_id INTEGER NOT NULL UNIQUE,
        valor_inscricao REAL DEFAULT 0.00,
        tempo_jogo_minutos INTEGER NOT NULL DEFAULT 20,
        amarelos_para_expulsao INTEGER DEFAULT 2,
        amarelos_acumulados_suspensao INTEGER DEFAULT 3,
        jogos_suspensao_amarelo INTEGER DEFAULT 1,
        jogos_suspensao_vermelho INTEGER DEFAULT 1,
        num_titulares INTEGER NOT NULL DEFAULT 6,
        num_reservas INTEGER NOT NULL DEFAULT 4,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE
    );

    -- 3. TIMES
    CREATE TABLE IF NOT EXISTS times (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        brasao_path TEXT,
        cor_hex TEXT DEFAULT '#000000',
        categoria_id INTEGER NOT NULL,
        grupo TEXT DEFAULT 'A',
        FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE
    );

    -- 4. JOGADORES
    CREATE TABLE IF NOT EXISTS jogadores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        camisa_posicao INTEGER NOT NULL,
        pago INTEGER DEFAULT 0,
        time_id INTEGER NULL,
        categoria_id INTEGER NOT NULL,
        FOREIGN KEY (time_id) REFERENCES times(id) ON DELETE SET NULL,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE
    );

    -- 5. FASES DO TORNEIO
    CREATE TABLE IF NOT EXISTS fases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL
    );

    -- 6. PARTIDAS / CONFRONTOS
    CREATE TABLE IF NOT EXISTS partidas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        categoria_id INTEGER NOT NULL,
        fase_id INTEGER NOT NULL,
        time_mandante_id INTEGER NOT NULL,
        time_visitante_id INTEGER NOT NULL,
        gols_mandante INTEGER DEFAULT 0,
        gols_visitante INTEGER DEFAULT 0,
        data_hora TEXT,
        status TEXT DEFAULT 'AGENDADO',
        tempo_decorrido_segundos INTEGER DEFAULT 0,
        rodada INTEGER DEFAULT 1,
        grupo TEXT DEFAULT NULL,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE,
        FOREIGN KEY (fase_id) REFERENCES fases(id) ON DELETE CASCADE,
        FOREIGN KEY (time_mandante_id) REFERENCES times(id) ON DELETE CASCADE,
        FOREIGN KEY (time_visitante_id) REFERENCES times(id) ON DELETE CASCADE
    );

    -- 7. EVENTOS DO JOGO (Súmula Digital)
    CREATE TABLE IF NOT EXISTS eventos_partida (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        partida_id INTEGER NOT NULL,
        time_id INTEGER NOT NULL,
        jogador_id INTEGER NOT NULL,
        tipo_evento TEXT NOT NULL,
        minuto_jogo INTEGER NOT NULL,
        FOREIGN KEY (partida_id) REFERENCES partidas(id) ON DELETE CASCADE,
        FOREIGN KEY (time_id) REFERENCES times(id) ON DELETE CASCADE,
        FOREIGN KEY (jogador_id) REFERENCES jogadores(id) ON DELETE CASCADE
    );

    -- 8. SUSPENSÕES E PUNIÇÕES
    CREATE TABLE IF NOT EXISTS suspensoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jogador_id INTEGER NOT NULL,
        partida_origem_id INTEGER NOT NULL,
        jogos_cumprir INTEGER DEFAULT 1,
        jogos_cumpridos INTEGER DEFAULT 0,
        motivo TEXT,
        FOREIGN KEY (jogador_id) REFERENCES jogadores(id) ON DELETE CASCADE,
        FOREIGN KEY (partida_origem_id) REFERENCES partidas(id) ON DELETE CASCADE
    );

    -- INDEXES for fast querying
    CREATE INDEX IF NOT EXISTS idx_jogadores_cat_camisa ON jogadores(categoria_id, camisa_posicao);
    CREATE INDEX IF NOT EXISTS idx_partidas_cat_status ON partidas(categoria_id, status);
    CREATE INDEX IF NOT EXISTS idx_eventos_partida ON eventos_partida(partida_id);

    -- TRIGGERS for real-time score sync on eventos_partida insertion
    CREATE TRIGGER IF NOT EXISTS trg_inserir_gol_partida
    AFTER INSERT ON eventos_partida
    WHEN NEW.tipo_evento = 'GOL'
    BEGIN
      UPDATE partidas 
      SET gols_mandante = gols_mandante + CASE WHEN NEW.time_id = time_mandante_id THEN 1 ELSE 0 END,
          gols_visitante = gols_visitante + CASE WHEN NEW.time_id = time_visitante_id THEN 1 ELSE 0 END
      WHERE id = NEW.partida_id;
    END;

    CREATE TRIGGER IF NOT EXISTS trg_remover_gol_partida
    AFTER DELETE ON eventos_partida
    WHEN OLD.tipo_evento = 'GOL'
    BEGIN
      UPDATE partidas 
      SET gols_mandante = gols_mandante - CASE WHEN OLD.time_id = time_mandante_id THEN 1 ELSE 0 END,
          gols_visitante = gols_visitante - CASE WHEN OLD.time_id = time_visitante_id THEN 1 ELSE 0 END
      WHERE id = OLD.partida_id;
    END;
  `;

  db.exec(schemaSQL);

  try {
    db.exec("ALTER TABLE times ADD COLUMN grupo TEXT DEFAULT 'A';");
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE partidas ADD COLUMN grupo TEXT DEFAULT NULL;");
  } catch (e) {
    // Column already exists
  }
}

/**
 * Seed initial tournament match phases
 */
export async function seedFasesIfEmpty(): Promise<void> {
  try {
    await runQuery("INSERT OR IGNORE INTO fases (id, nome) VALUES (1, 'Fase de Grupos');");
    await runQuery("INSERT OR IGNORE INTO fases (id, nome) VALUES (2, 'Quartas de Final');");
    await runQuery("INSERT OR IGNORE INTO fases (id, nome) VALUES (3, 'Semifinal');");
    await runQuery("INSERT OR IGNORE INTO fases (id, nome) VALUES (4, 'Final');");
  } catch (e) {
    console.error('Erro ao inicializar fases:', e);
  }
}

/**
 * Seed initial admin user if usuarios table is empty
 */
export async function seedUsersIfEmpty(db: any) {
  try {
    const res = await query<{ count: number }>('SELECT COUNT(*) as count FROM usuarios;');
    const count = (res[0]?.count as number) || 0;
    if (count === 0) {
      db.run(
        'INSERT INTO usuarios (nome, email, senha, role) VALUES (?, ?, ?, ?);',
        ['Organizador Arena Romano', 'jaldrighi@gmail.com', 'teste123A', 'ADMIN']
      );
    }
  } catch (e) {
    console.error('Erro ao verificar/popular usuários:', e);
  }
}

/**
 * Authenticate user against SQLite usuarios table
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

  // Insert default rules and settings for the new category (safely using INSERT OR IGNORE)
  await runQuery(
    `INSERT OR IGNORE INTO configuracoes_categoria 
     (categoria_id, valor_inscricao, tempo_jogo_minutos, amarelos_para_expulsao, amarelos_acumulados_suspensao, jogos_suspensao_amarelo, jogos_suspensao_vermelho, num_titulares, num_reservas)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [newCatId, 100, 50, 2, 3, 1, 1, 7, 5]
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

/**
 * Execute a SQL query and return array of mapped objects
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
    }
  } catch (e) {
    console.warn('API query error, using local fallback:', e);
  }

  const db = await getDb();
  const results: T[] = [];
  db.exec({
    sql,
    bind: params,
    rowMode: 'object',
    callback: (row: any) => {
      results.push(row as T);
    },
  });
  return results;
}

/**
 * Execute a mutation query (INSERT, UPDATE, DELETE) and persist DB
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
    }
  } catch (e) {
    console.warn('API runQuery error, using local fallback:', e);
  }

  const db = await getDb();
  db.exec({ sql, bind: params });
  persistDatabase();

  let lastInsertRowid = 0;
  let changes = 0;
  db.exec({
    sql: 'SELECT last_insert_rowid() as id, changes() as changes;',
    rowMode: 'object',
    callback: (row: any) => {
      lastInsertRowid = row.id || 0;
      changes = row.changes || 0;
    },
  });

  return { lastInsertRowid, changes };
}
