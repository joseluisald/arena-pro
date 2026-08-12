import express from 'express';
import path from 'path';
import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const DB_PATH = path.resolve(process.cwd(), 'database.sqlite');

let db: DatabaseSync;

function initDb() {
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON;');

  const schemaSQL = `
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
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

  try {
    db.exec("ALTER TABLE times ADD COLUMN grupo TEXT DEFAULT 'A';");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE partidas ADD COLUMN grupo TEXT DEFAULT NULL;");
  } catch (e) {}

  // Seed default fases
  const insertFase = db.prepare('INSERT OR IGNORE INTO fases (id, nome) VALUES (?, ?)');
  const fases = ['Fase de Grupos', 'Quartas de Final', 'Semifinal', 'Final'];
  fases.forEach((nome, idx) => {
    insertFase.run(idx + 1, nome);
  });

  // Seed usuarios if empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM usuarios').get() as { count: number };
  if (userCount.count === 0) {
    db.prepare('INSERT INTO usuarios (nome, email, senha, role) VALUES (?, ?, ?, ?)').run(
      'Organizador Arena Romano',
      'jaldrighi@gmail.com',
      'teste123A',
      'ADMIN'
    );
  }

  console.log(`[SQLite] Database successfully loaded at: ${DB_PATH}`);
}

async function startServer() {
  initDb();

  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.raw({ type: 'application/x-sqlite3', limit: '50mb' }));

  // API Routes
  app.post('/api/db/query', (req, res) => {
    try {
      const { sql, params = [] } = req.body;
      const stmt = db.prepare(sql);
      const rows = stmt.all(...params);
      res.json({ success: true, rows });
    } catch (err: any) {
      console.error('[DB Query Error]:', err.message, req.body);
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/db/run', (req, res) => {
    try {
      const { sql, params = [] } = req.body;
      const stmt = db.prepare(sql);
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

  app.post('/api/db/exec', (req, res) => {
    try {
      const { sql } = req.body;
      db.exec(sql);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[DB Exec Error]:', err.message);
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/db/export', (req, res) => {
    try {
      if (fs.existsSync(DB_PATH)) {
        res.setHeader('Content-Type', 'application/x-sqlite3');
        res.setHeader('Content-Disposition', 'attachment; filename="database.sqlite"');
        const fileStream = fs.createReadStream(DB_PATH);
        fileStream.pipe(res);
      } else {
        res.status(404).json({ error: 'database.sqlite file not found' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/db/import', (req, res) => {
    try {
      const buffer = req.body;
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty database buffer' });
      }
      db.close();
      fs.writeFileSync(DB_PATH, buffer);
      initDb();
      res.json({ success: true, message: 'Database imported successfully' });
    } catch (err: any) {
      console.error('[DB Import Error]:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/db/reset', (req, res) => {
    try {
      db.exec('PRAGMA foreign_keys = OFF;');
      db.exec('DELETE FROM suspensoes;');
      db.exec('DELETE FROM eventos_partida;');
      db.exec('DELETE FROM partidas;');
      db.exec('DELETE FROM jogadores;');
      db.exec('DELETE FROM times;');
      db.exec('DELETE FROM configuracoes_categoria;');
      db.exec('DELETE FROM fases;');
      db.exec('DELETE FROM categorias;');
      try {
        db.exec('DELETE FROM sqlite_sequence;');
      } catch (e) {}
      db.exec('PRAGMA foreign_keys = ON;');

      const fases = ['Fase de Grupos', 'Quartas de Final', 'Semifinal', 'Final'];
      const insertFase = db.prepare('INSERT OR IGNORE INTO fases (id, nome) VALUES (?, ?)');
      fases.forEach((nome, idx) => {
        insertFase.run(idx + 1, nome);
      });

      const userCount = db.prepare('SELECT COUNT(*) as count FROM usuarios').get() as { count: number };
      if (userCount.count === 0) {
        db.prepare('INSERT INTO usuarios (nome, email, senha, role) VALUES (?, ?, ?, ?)').run(
          'Organizador Arena Romano',
          'jaldrighi@gmail.com',
          'teste123A',
          'ADMIN'
        );
      }

      res.json({ success: true, message: 'Database reset to seed state' });
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
