import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import mysql, { Pool } from 'mysql2/promise';
import { DatabaseSync } from 'node:sqlite';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const PORT = 3000;
const SQLITE_DB_PATH = path.resolve(process.cwd(), 'database.sqlite');

// MySQL configuration from environment variables
const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
const MYSQL_PORT = parseInt(process.env.MYSQL_PORT || '3306', 10);
const MYSQL_USER = process.env.MYSQL_USER || 'root';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || '';
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'torneio_society';
const DATABASE_URL = process.env.DATABASE_URL || process.env.MYSQL_URL;

let pool: Pool | null = null;
let isMySQLConnected = false;
let mySQLError: string | null = null;
let sqliteDb: DatabaseSync | null = null;

function setupSqliteTables(db: DatabaseSync) {
  db.exec('PRAGMA foreign_keys = ON;');

  const schemaSQL = `
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        login TEXT UNIQUE,
        email TEXT NOT NULL UNIQUE,
        senha TEXT NOT NULL,
        role TEXT DEFAULT 'ADMIN',
        criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL UNIQUE
    );

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

    CREATE TABLE IF NOT EXISTS times (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        brasao_path TEXT,
        cor_hex TEXT DEFAULT '#000000',
        categoria_id INTEGER NOT NULL,
        grupo TEXT DEFAULT 'A',
        FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE
    );

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

    CREATE TABLE IF NOT EXISTS fases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL
    );

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

    CREATE INDEX IF NOT EXISTS idx_jogadores_cat_camisa ON jogadores(categoria_id, camisa_posicao);
    CREATE INDEX IF NOT EXISTS idx_partidas_cat_status ON partidas(categoria_id, status);
    CREATE INDEX IF NOT EXISTS idx_eventos_partida ON eventos_partida(partida_id);

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

  // Migration: ensure login column exists in SQLite table
  try {
    const tableInfo = db.prepare("PRAGMA table_info(usuarios)").all() as { name: string }[];
    const hasLogin = tableInfo.some((c) => c.name === 'login');
    if (!hasLogin) {
      db.exec('ALTER TABLE usuarios ADD COLUMN login TEXT;');
      db.exec("UPDATE usuarios SET login = 'admin' WHERE login IS NULL OR login = '';");
    }
  } catch (e) {
    console.warn('[SQLite Migration Check]:', e);
  }

  // Seed default fases
  const insertFase = db.prepare('INSERT OR IGNORE INTO fases (id, nome) VALUES (?, ?)');
  const fases = ['Fase de Grupos', 'Quartas de Final', 'Semifinal', 'Final'];
  fases.forEach((nome, idx) => {
    insertFase.run(idx + 1, nome);
  });

  // Seed default admin user
  const userCount = db.prepare('SELECT COUNT(*) as count FROM usuarios').get() as { count: number };
  if (userCount.count === 0) {
    db.prepare('INSERT INTO usuarios (nome, login, email, senha, role) VALUES (?, ?, ?, ?, ?)').run(
      'Organizador Arena Romano',
      'admin',
      'jaldrighi@gmail.com',
      'teste123A',
      'ADMIN'
    );
  } else {
    try {
      db.prepare("UPDATE usuarios SET login = 'admin' WHERE (login IS NULL OR login = '') AND email = 'jaldrighi@gmail.com'").run();
    } catch (e) {}
  }
}

function initSqliteDb(): DatabaseSync {
  if (!sqliteDb) {
    try {
      sqliteDb = new DatabaseSync(SQLITE_DB_PATH);
      setupSqliteTables(sqliteDb);
    } catch (err: any) {
      console.warn('[SQLite Init Error, resetting corrupt database file]:', err.message);
      try {
        if (fs.existsSync(SQLITE_DB_PATH)) {
          fs.unlinkSync(SQLITE_DB_PATH);
        }
      } catch (unlinkErr) {
        console.error('[SQLite Unlink Error]:', unlinkErr);
      }
      sqliteDb = new DatabaseSync(SQLITE_DB_PATH);
      setupSqliteTables(sqliteDb);
    }
  }
  return sqliteDb;
}

function getMySQLPool(): Pool {
  if (!pool) {
    if (DATABASE_URL) {
      pool = mysql.createPool({
        uri: DATABASE_URL,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        multipleStatements: true,
        decimalNumbers: true,
      });
    } else {
      pool = mysql.createPool({
        host: MYSQL_HOST,
        port: MYSQL_PORT,
        user: MYSQL_USER,
        password: MYSQL_PASSWORD,
        database: MYSQL_DATABASE,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        multipleStatements: true,
        decimalNumbers: true,
      });
    }
  }
  return pool;
}

async function tryConnectMySQL(): Promise<boolean> {
  const hasConfig = !!DATABASE_URL || (MYSQL_HOST !== 'localhost' && MYSQL_HOST !== '127.0.0.1' && process.env.MYSQL_HOST) || (process.env.MYSQL_PASSWORD && process.env.MYSQL_HOST);
  if (!hasConfig) {
    isMySQLConnected = false;
    mySQLError = 'MySQL remoto não configurado no .env. Utilizando banco local SQLite.';
    return false;
  }

  try {
    const p = getMySQLPool();
    await p.query('SELECT 1');
    isMySQLConnected = true;
    mySQLError = null;
    console.log(`[MySQL] Conectado ao MySQL com sucesso.`);

    // Ensure MySQL schema has login column
    try {
      const [cols]: any = await p.query("SHOW COLUMNS FROM usuarios LIKE 'login'");
      if (!cols || cols.length === 0) {
        await p.query("ALTER TABLE usuarios ADD COLUMN login VARCHAR(100) UNIQUE AFTER nome;");
        await p.query("UPDATE usuarios SET login = 'admin' WHERE login IS NULL OR login = '';");
      }
    } catch (e: any) {
      // Table may not exist yet or warning
    }

    return true;
  } catch (err: any) {
    isMySQLConnected = false;
    mySQLError = `Falha ao conectar no MySQL (${err.message}). Utilizando banco local SQLite.`;
    return false;
  }
}

// Adapt SQL query for SQLite fallback if needed
function adaptSqlForSqlite(sql: string): string {
  return sql
    .replace(/INSERT\s+IGNORE\s+INTO/gi, 'INSERT OR IGNORE INTO')
    .replace(/SET\s+FOREIGN_KEY_CHECKS\s*=\s*[01];?/gi, '')
    .replace(/TRUNCATE\s+TABLE\s+(\w+);?/gi, 'DELETE FROM $1;');
}

async function startServer() {
  // Initialize local SQLite
  initSqliteDb();

  // Test MySQL connection
  await tryConnectMySQL();

  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Status check endpoint
  app.get('/api/db/status', async (req, res) => {
    res.json({
      success: true,
      engine: isMySQLConnected ? 'mysql' : 'sqlite',
      connected: isMySQLConnected,
      host: MYSQL_HOST,
      port: MYSQL_PORT,
      user: MYSQL_USER,
      database: MYSQL_DATABASE,
      hasDatabaseUrl: !!DATABASE_URL,
      error: mySQLError,
    });
  });

  // Query Endpoint (SELECT)
  app.post('/api/db/query', async (req, res) => {
    try {
      const { sql, params = [] } = req.body;
      if (isMySQLConnected) {
        try {
          const p = getMySQLPool();
          const [rows] = await p.query(sql, params);
          return res.json({ success: true, rows });
        } catch (mysqlErr: any) {
          console.warn('[MySQL Query error, falling back to SQLite]:', mysqlErr.message);
        }
      }

      // SQLite Fallback
      const sDb = initSqliteDb();
      const adaptedSql = adaptSqlForSqlite(sql);
      const stmt = sDb.prepare(adaptedSql);
      const rows = stmt.all(...params);
      res.json({ success: true, rows });
    } catch (err: any) {
      console.error('[DB Query Error]:', err.message, req.body);
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Run/Mutation Endpoint (INSERT, UPDATE, DELETE)
  app.post('/api/db/run', async (req, res) => {
    try {
      const { sql, params = [] } = req.body;
      if (isMySQLConnected) {
        try {
          const p = getMySQLPool();
          const [result]: any = await p.query(sql, params);
          return res.json({
            success: true,
            lastInsertRowid: result.insertId || 0,
            changes: result.affectedRows || 0,
          });
        } catch (mysqlErr: any) {
          console.warn('[MySQL Run error, falling back to SQLite]:', mysqlErr.message);
        }
      }

      // SQLite Fallback
      const sDb = initSqliteDb();
      const adaptedSql = adaptSqlForSqlite(sql);
      const stmt = sDb.prepare(adaptedSql);
      const info = stmt.run(...params);
      res.json({
        success: true,
        lastInsertRowid: info.lastInsertRowid ? Number(info.lastInsertRowid) : 0,
        changes: info.changes || 0,
      });
    } catch (err: any) {
      console.error('[DB Run Error]:', err.message, req.body);
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Exec / Multi-query Endpoint
  app.post('/api/db/exec', async (req, res) => {
    try {
      const { sql } = req.body;
      if (isMySQLConnected) {
        try {
          const p = getMySQLPool();
          await p.query(sql);
          return res.json({ success: true });
        } catch (mysqlErr: any) {
          console.warn('[MySQL Exec error, falling back to SQLite]:', mysqlErr.message);
        }
      }

      // SQLite Fallback
      const sDb = initSqliteDb();
      const adaptedSql = adaptSqlForSqlite(sql);
      sDb.exec(adaptedSql);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[DB Exec Error]:', err.message);
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Reset database endpoint
  app.post('/api/db/reset', async (req, res) => {
    try {
      if (isMySQLConnected) {
        try {
          const p = getMySQLPool();
          await p.query('SET FOREIGN_KEY_CHECKS = 0;');
          await p.query('TRUNCATE TABLE suspensoes;');
          await p.query('TRUNCATE TABLE eventos_partida;');
          await p.query('TRUNCATE TABLE partidas;');
          await p.query('TRUNCATE TABLE jogadores;');
          await p.query('TRUNCATE TABLE times;');
          await p.query('TRUNCATE TABLE configuracoes_categoria;');
          await p.query('TRUNCATE TABLE fases;');
          await p.query('TRUNCATE TABLE categorias;');
          await p.query('SET FOREIGN_KEY_CHECKS = 1;');

          await p.query(`
            INSERT IGNORE INTO fases (id, nome) VALUES 
            (1, 'Fase de Grupos'), 
            (2, 'Quartas de Final'), 
            (3, 'Semifinal'), 
            (4, 'Final');
          `);
          return res.json({ success: true, message: 'Banco MySQL resetado com sucesso' });
        } catch (e: any) {
          console.warn('[MySQL Reset error, resetting SQLite]:', e.message);
        }
      }

      // SQLite Reset
      const sDb = initSqliteDb();
      sDb.exec('PRAGMA foreign_keys = OFF;');
      sDb.exec('DELETE FROM suspensoes;');
      sDb.exec('DELETE FROM eventos_partida;');
      sDb.exec('DELETE FROM partidas;');
      sDb.exec('DELETE FROM jogadores;');
      sDb.exec('DELETE FROM times;');
      sDb.exec('DELETE FROM configuracoes_categoria;');
      sDb.exec('DELETE FROM fases;');
      sDb.exec('DELETE FROM categorias;');
      try {
        sDb.exec('DELETE FROM sqlite_sequence;');
      } catch (e) {}
      sDb.exec('PRAGMA foreign_keys = ON;');

      const fases = ['Fase de Grupos', 'Quartas de Final', 'Semifinal', 'Final'];
      const insertFase = sDb.prepare('INSERT OR IGNORE INTO fases (id, nome) VALUES (?, ?)');
      fases.forEach((nome, idx) => {
        insertFase.run(idx + 1, nome);
      });

      const userCount = sDb.prepare('SELECT COUNT(*) as count FROM usuarios').get() as { count: number };
      if (userCount.count === 0) {
        sDb.prepare('INSERT INTO usuarios (nome, login, email, senha, role) VALUES (?, ?, ?, ?, ?)').run(
          'Organizador Arena Romano',
          'admin',
          'jaldrighi@gmail.com',
          'teste123A',
          'ADMIN'
        );
      }

      res.json({ success: true, message: 'Banco resetado com sucesso' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Export JSON backup
  app.get('/api/db/export', async (req, res) => {
    try {
      const tables = ['usuarios', 'categorias', 'configuracoes_categoria', 'times', 'jogadores', 'fases', 'partidas', 'eventos_partida', 'suspensoes'];
      const backupData: Record<string, any[]> = {};

      if (isMySQLConnected) {
        const p = getMySQLPool();
        for (const table of tables) {
          const [rows]: any = await p.query(`SELECT * FROM ${table}`);
          backupData[table] = rows;
        }
      } else {
        const sDb = initSqliteDb();
        for (const table of tables) {
          const rows = sDb.prepare(`SELECT * FROM ${table}`).all();
          backupData[table] = rows;
        }
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="torneio_society_backup_${new Date().toISOString().slice(0, 10)}.json"`);
      res.send(JSON.stringify(backupData, null, 2));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite Middleware in dev or static serving in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
