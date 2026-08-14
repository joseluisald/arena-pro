import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import mysql, { Pool } from 'mysql2/promise';
import { DatabaseSync } from 'node:sqlite';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';

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

  // Seed default categories and category configurations
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categorias').get() as { count: number };
  if (catCount.count === 0) {
    db.prepare('INSERT OR IGNORE INTO categorias (id, nome) VALUES (?, ?)').run(1, 'Livre');
    db.prepare('INSERT OR IGNORE INTO categorias (id, nome) VALUES (?, ?)').run(2, 'Master (35+)');
    
    const insertConfig = db.prepare(`
      INSERT OR IGNORE INTO configuracoes_categoria 
      (categoria_id, valor_inscricao, tempo_jogo_minutos, amarelos_para_expulsao, amarelos_acumulados_suspensao, jogos_suspensao_amarelo, jogos_suspensao_vermelho, num_titulares, num_reservas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertConfig.run(1, 150.00, 20, 2, 3, 1, 1, 6, 4);
    insertConfig.run(2, 150.00, 20, 2, 3, 1, 1, 6, 4);
  }

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

  // Resync goals and auto-populate suspensions from match events without losing direct scores
  try {
    db.exec(`
      -- Sync scores where GOL events exist
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

      -- Deduplicate existing suspensions
      DELETE FROM suspensoes 
      WHERE id NOT IN (
        SELECT MIN(id) 
        FROM suspensoes 
        GROUP BY jogador_id, partida_origem_id, CASE WHEN motivo LIKE '%Acúmulo%' THEN motivo ELSE 'EXPULSAO' END
      );

      -- Auto sync suspensions for 2 Yellow Cards in the same match
      INSERT INTO suspensoes (jogador_id, partida_origem_id, jogos_cumprir, jogos_cumpridos, motivo)
      SELECT 
        ep.jogador_id,
        ep.partida_id,
        1,
        0,
        'Expulsão (2º Cartão Amarelo no Jogo)'
      FROM eventos_partida ep
      WHERE ep.tipo_evento = 'CARTAO_AMARELO'
      GROUP BY ep.jogador_id, ep.partida_id
      HAVING COUNT(ep.id) >= 2
      AND NOT EXISTS (
        SELECT 1 FROM suspensoes s 
        WHERE s.jogador_id = ep.jogador_id 
          AND s.partida_origem_id = ep.partida_id
      );

      -- Auto sync suspensions for direct Red Cards (only if no suspension already exists for this match)
      INSERT INTO suspensoes (jogador_id, partida_origem_id, jogos_cumprir, jogos_cumpridos, motivo)
      SELECT DISTINCT
        ep.jogador_id,
        ep.partida_id,
        1,
        0,
        'Cartão Vermelho Direto'
      FROM eventos_partida ep
      WHERE ep.tipo_evento = 'CARTAO_VERMELHO'
      AND NOT EXISTS (
        SELECT 1 FROM suspensoes s 
        WHERE s.jogador_id = ep.jogador_id 
          AND s.partida_origem_id = ep.partida_id
      );
    `);
  } catch (e) {
    console.warn('[SQLite Score & Suspension Resync Check]:', e);
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

async function setupMySQLTables(p: Pool) {
  try {
    const schemaMySQL = `
      CREATE TABLE IF NOT EXISTS usuarios (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nome VARCHAR(255) NOT NULL,
          login VARCHAR(100) UNIQUE,
          email VARCHAR(255) NOT NULL UNIQUE,
          senha VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'ADMIN',
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS categorias (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nome VARCHAR(100) NOT NULL UNIQUE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS configuracoes_categoria (
          id INT AUTO_INCREMENT PRIMARY KEY,
          categoria_id INT NOT NULL UNIQUE,
          valor_inscricao DECIMAL(10,2) DEFAULT 0.00,
          tempo_jogo_minutos INT NOT NULL DEFAULT 20,
          amarelos_para_expulsao INT DEFAULT 2,
          amarelos_acumulados_suspensao INT DEFAULT 3,
          jogos_suspensao_amarelo INT DEFAULT 1,
          jogos_suspensao_vermelho INT DEFAULT 1,
          num_titulares INT NOT NULL DEFAULT 6,
          num_reservas INT NOT NULL DEFAULT 4,
          FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS times (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nome VARCHAR(100) NOT NULL,
          brasao_path TEXT,
          cor_hex VARCHAR(20) DEFAULT '#000000',
          categoria_id INT NOT NULL,
          grupo VARCHAR(5) DEFAULT 'A',
          FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS jogadores (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nome VARCHAR(150) NOT NULL,
          camisa_posicao INT NOT NULL,
          pago TINYINT(1) DEFAULT 0,
          time_id INT NULL,
          categoria_id INT NOT NULL,
          FOREIGN KEY (time_id) REFERENCES times(id) ON DELETE SET NULL,
          FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS fases (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nome VARCHAR(50) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS partidas (
          id INT AUTO_INCREMENT PRIMARY KEY,
          categoria_id INT NOT NULL,
          fase_id INT NOT NULL,
          time_mandante_id INT NOT NULL,
          time_visitante_id INT NOT NULL,
          gols_mandante INT DEFAULT 0,
          gols_visitante INT DEFAULT 0,
          data_hora DATETIME NULL,
          status VARCHAR(30) DEFAULT 'AGENDADO',
          tempo_decorrido_segundos INT DEFAULT 0,
          rodada INT DEFAULT 1,
          grupo VARCHAR(5) DEFAULT NULL,
          FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE,
          FOREIGN KEY (fase_id) REFERENCES fases(id) ON DELETE CASCADE,
          FOREIGN KEY (time_mandante_id) REFERENCES times(id) ON DELETE CASCADE,
          FOREIGN KEY (time_visitante_id) REFERENCES times(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS eventos_partida (
          id INT AUTO_INCREMENT PRIMARY KEY,
          partida_id INT NOT NULL,
          time_id INT NOT NULL,
          jogador_id INT NOT NULL,
          tipo_evento VARCHAR(30) NOT NULL,
          minuto_jogo INT NOT NULL,
          FOREIGN KEY (partida_id) REFERENCES partidas(id) ON DELETE CASCADE,
          FOREIGN KEY (time_id) REFERENCES times(id) ON DELETE CASCADE,
          FOREIGN KEY (jogador_id) REFERENCES jogadores(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS suspensoes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          jogador_id INT NOT NULL,
          partida_origem_id INT NOT NULL,
          jogos_cumprir INT DEFAULT 1,
          jogos_cumpridos INT DEFAULT 0,
          motivo TEXT,
          FOREIGN KEY (jogador_id) REFERENCES jogadores(id) ON DELETE CASCADE,
          FOREIGN KEY (partida_origem_id) REFERENCES partidas(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    // Execute table creations
    await p.query(schemaMySQL);

    // Ensure login column exists if table existed previously without it
    try {
      const [cols]: any = await p.query("SHOW COLUMNS FROM usuarios LIKE 'login'");
      if (!cols || cols.length === 0) {
        await p.query("ALTER TABLE usuarios ADD COLUMN login VARCHAR(100) UNIQUE AFTER nome;");
      }
    } catch (e) {}

    // Seed default fases
    await p.query(`
      INSERT IGNORE INTO fases (id, nome) VALUES 
      (1, 'Fase de Grupos'), 
      (2, 'Quartas de Final'), 
      (3, 'Semifinal'), 
      (4, 'Final');
    `);

    // Seed default categories and configurations
    const [catRows]: any = await p.query('SELECT COUNT(*) as count FROM categorias');
    const catTotal = catRows?.[0]?.count ?? 0;
    if (catTotal === 0) {
      await p.query(`
        INSERT IGNORE INTO categorias (id, nome) VALUES 
        (1, 'Principal'),
        (2, 'Veteranos'),
        (3, 'Sênior'),
        (4, 'Feminino');
      `);
      await p.query(`
        INSERT IGNORE INTO configuracoes_categoria 
        (categoria_id, valor_inscricao, tempo_jogo_minutos, amarelos_para_expulsao, amarelos_acumulados_suspensao, jogos_suspensao_amarelo, jogos_suspensao_vermelho, num_titulares, num_reservas) 
        VALUES
        (1, 150.00, 20, 2, 3, 1, 1, 6, 4),
        (2, 150.00, 20, 2, 3, 1, 1, 6, 4);
      `);
      console.log('[MySQL] Categorias padrão e configurações criadas com sucesso.');
    }

    // Seed default admin user
    const [userRows]: any = await p.query('SELECT COUNT(*) as count FROM usuarios');
    const count = userRows?.[0]?.count ?? 0;
    if (count === 0) {
      await p.query(`
        INSERT IGNORE INTO usuarios (id, nome, login, email, senha, role) 
        VALUES (1, 'Organizador Arena Romano', 'admin', 'jaldrighi@gmail.com', 'teste123A', 'ADMIN');
      `);
      console.log('[MySQL] Usuário administrador padrão (admin / jaldrighi@gmail.com) criado com sucesso.');
    } else {
      await p.query(`
        UPDATE usuarios 
        SET login = 'admin' 
        WHERE (login IS NULL OR login = '') AND email = 'jaldrighi@gmail.com';
      `);
    }

    // Resync goals and auto-populate suspensions in MySQL
    try {
      await p.query(`
        UPDATE partidas p
        SET 
          p.gols_mandante = (
            SELECT COUNT(*) 
            FROM eventos_partida ep 
            WHERE ep.partida_id = p.id 
              AND ep.time_id = p.time_mandante_id 
              AND ep.tipo_evento = 'GOL'
          ),
          p.gols_visitante = (
            SELECT COUNT(*) 
            FROM eventos_partida ep 
            WHERE ep.partida_id = p.id 
              AND ep.time_id = p.time_visitante_id 
              AND ep.tipo_evento = 'GOL'
          )
        WHERE (SELECT COUNT(*) FROM eventos_partida ep WHERE ep.partida_id = p.id AND ep.tipo_evento = 'GOL') > 0;
      `);
    } catch (e) {}

    console.log('[MySQL] Tabelas e sementes iniciais verificadas/criadas com sucesso.');
  } catch (err: any) {
    console.error('[MySQL Setup Error]:', err.message);
  }
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

    // Automatically create all schema tables and insert initial default records
    await setupMySQLTables(p);

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

  // Real-time State & Broadcast REST Endpoints
  let currentLiveState: any = {
    matchId: null,
    categoriaId: null,
    elapsedSeconds: 0,
    isRunning: false,
    period: '1T',
    scoreMandante: 0,
    scoreVisitante: 0,
    updatedAt: Date.now()
  };

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  function broadcastWS(data: any, excludeWs?: WebSocket) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (err) {
          console.error('[WS] Error broadcasting:', err);
        }
      }
    });
  }

  wss.on('connection', (ws) => {
    console.log(`[WS] Client connected. Total screens: ${wss.clients.size}`);

    // Send initial snapshot to newly connected screen
    ws.send(JSON.stringify({
      type: 'INIT_STATE',
      payload: {
        connectedClients: wss.clients.size,
        liveState: currentLiveState,
        serverTime: Date.now()
      }
    }));

    // Broadcast updated client count to all screens
    broadcastWS({
      type: 'CLIENT_COUNT',
      payload: { connectedClients: wss.clients.size }
    });

    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        if (parsed.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', time: Date.now() }));
          return;
        }

        if (parsed.type === 'MATCH_TIMER' || parsed.type === 'MATCH_EVENT' || parsed.type === 'MATCH_UPDATE' || parsed.type === 'MATCH_STATE') {
          if (parsed.payload) {
            currentLiveState = {
              ...currentLiveState,
              ...parsed.payload,
              updatedAt: Date.now()
            };
          }
        }

        // Broadcast to all other screens in real time
        broadcastWS(parsed, ws);
      } catch (e) {
        console.error('[WS] Error processing message:', e);
      }
    });

    ws.on('close', () => {
      console.log(`[WS] Client disconnected. Total screens: ${wss.clients.size}`);
      broadcastWS({
        type: 'CLIENT_COUNT',
        payload: { connectedClients: wss.clients.size }
      });
    });
  });

  app.post('/api/realtime/broadcast', (req, res) => {
    const { type, payload } = req.body || {};
    if (type) {
      if (payload) {
        currentLiveState = {
          ...currentLiveState,
          ...payload,
          updatedAt: Date.now()
        };
      }
      broadcastWS({ type, payload });
    }
    res.json({ success: true, connectedClients: wss.clients.size });
  });

  app.get('/api/realtime/state', (req, res) => {
    res.json({
      connectedClients: wss.clients.size,
      liveState: currentLiveState,
      serverTime: Date.now()
    });
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

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server & WebSocket listening on http://0.0.0.0:${PORT} (WS on /ws)`);
  });
}

startServer();
