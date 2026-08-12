/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query as fsQuery,
  where,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { Usuario, Categoria, ConfigCategoria, Time, Jogador, Partida, EventoPartida, Suspensao } from '../types';

export async function getDb(): Promise<any> {
  await seedFasesIfEmpty();
  await seedUsersIfEmpty();
  return db;
}

export async function seedFasesIfEmpty(): Promise<void> {
  try {
    const snapshot = await getDocs(collection(db, 'fases'));
    if (snapshot.empty) {
      const fases = [
        { id: 1, nome: 'Fase de Grupos' },
        { id: 2, nome: 'Quartas de Final' },
        { id: 3, nome: 'Semifinal' },
        { id: 4, nome: 'Final' },
      ];
      for (const f of fases) {
        await setDoc(doc(db, 'fases', String(f.id)), f);
      }
    }
  } catch (e) {
    console.error('Error seeding fases:', e);
  }
}

export async function seedUsersIfEmpty(): Promise<void> {
  try {
    const snapshot = await getDocs(collection(db, 'usuarios'));
    if (snapshot.empty) {
      const defaultUser: Usuario = {
        id: 1,
        nome: 'Organizador Arena Romano',
        email: 'jaldrighi@gmail.com',
        senha: 'teste123A',
        role: 'ADMIN',
        criado_em: new Date().toISOString(),
      };
      await setDoc(doc(db, 'usuarios', '1'), defaultUser);
    }
  } catch (e) {
    console.error('Error seeding users:', e);
  }
}

export async function authenticateUser(emailStr: string, senhaStr: string): Promise<Usuario | null> {
  try {
    await seedUsersIfEmpty();
    const q = fsQuery(
      collection(db, 'usuarios'),
      where('email', '==', emailStr.trim().toLowerCase())
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const user = snap.docs[0].data() as Usuario;
      if (user.senha === senhaStr) {
        return user;
      }
    }
    // Fallback: check all users if lowercased
    const allUsersSnap = await getDocs(collection(db, 'usuarios'));
    for (const d of allUsersSnap.docs) {
      const u = d.data() as Usuario;
      if (u.email.toLowerCase() === emailStr.trim().toLowerCase() && u.senha === senhaStr) {
        return u;
      }
    }
    return null;
  } catch (e) {
    console.error('Error authenticating user:', e);
    return null;
  }
}

export async function createCategoria(nome: string): Promise<Categoria> {
  const cleanNome = nome.trim();
  const catSnap = await getDocs(collection(db, 'categorias'));
  let maxId = 0;
  for (const d of catSnap.docs) {
    const cat = d.data() as Categoria;
    if (cat.nome.toLowerCase() === cleanNome.toLowerCase()) {
      throw new Error(`A categoria '${cleanNome}' já existe.`);
    }
    if (Number(cat.id) > maxId) maxId = Number(cat.id);
  }

  const newId = maxId + 1;
  const newCat: Categoria = { id: newId, nome: cleanNome };
  await setDoc(doc(db, 'categorias', String(newId)), newCat);

  // Initialize default configs for this category
  const configId = await getNextId('configuracoes_categoria');
  const defaultConfig: ConfigCategoria = {
    id: configId,
    categoria_id: newId,
    valor_inscricao: 0.0,
    tempo_jogo_minutos: 20,
    amarelos_para_expulsao: 2,
    amarelos_acumulados_suspensao: 3,
    jogos_suspensao_amarelo: 1,
    jogos_suspensao_vermelho: 1,
    num_titulares: 6,
    num_reservas: 4,
  };
  await setDoc(doc(db, 'configuracoes_categoria', String(configId)), defaultConfig);

  return newCat;
}

export async function updateCategoria(id: number, nome: string): Promise<void> {
  const cleanNome = nome.trim();
  const catRef = doc(db, 'categorias', String(id));
  await updateDoc(catRef, { nome: cleanNome });
}

export async function deleteCategoria(id: number): Promise<void> {
  const catId = Number(id);

  // Helper to delete docs matching category_id
  const deleteByCatId = async (collName: string) => {
    const snap = await getDocs(collection(db, collName));
    for (const d of snap.docs) {
      const data = d.data();
      if (Number(data.categoria_id) === catId) {
        await deleteDoc(d.ref);
      }
    }
  };

  await deleteByCatId('suspensoes');
  await deleteByCatId('eventos_partida');
  await deleteByCatId('partidas');
  await deleteByCatId('jogadores');
  await deleteByCatId('times');
  await deleteByCatId('configuracoes_categoria');

  await deleteDoc(doc(db, 'categorias', String(catId)));
}

export async function resetDatabaseToSeed(): Promise<void> {
  const collectionsList = [
    'suspensoes',
    'eventos_partida',
    'partidas',
    'jogadores',
    'times',
    'configuracoes_categoria',
    'fases',
    'categorias',
  ];

  for (const col of collectionsList) {
    const snap = await getDocs(collection(db, col));
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
  }

  await seedFasesIfEmpty();
  await seedUsersIfEmpty();
}

export async function exportSqliteFile(): Promise<Blob> {
  const collectionsList = [
    'usuarios',
    'categorias',
    'configuracoes_categoria',
    'times',
    'jogadores',
    'fases',
    'partidas',
    'eventos_partida',
    'suspensoes',
  ];

  const exportData: Record<string, any[]> = {};
  for (const col of collectionsList) {
    const snap = await getDocs(collection(db, col));
    exportData[col] = snap.docs.map((d) => d.data());
  }

  const jsonString = JSON.stringify(exportData, null, 2);
  return new Blob([jsonString], { type: 'application/json' });
}

export async function importSqliteFile(file: File): Promise<void> {
  const text = await file.text();
  const importedData = JSON.parse(text);

  if (typeof importedData !== 'object') {
    throw new Error('Formato de arquivo inválido.');
  }

  for (const [colName, docs] of Object.entries(importedData)) {
    if (Array.isArray(docs)) {
      // Clear existing col
      const snap = await getDocs(collection(db, colName));
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
      // Re-insert
      for (const item of docs) {
        const itemObj = item as any;
        const docId = itemObj.id ? String(itemObj.id) : doc(collection(db, colName)).id;
        await setDoc(doc(db, colName, docId), itemObj);
      }
    }
  }
}

async function getNextId(collectionName: string): Promise<number> {
  const snap = await getDocs(collection(db, collectionName));
  let maxId = 0;
  snap.forEach((d) => {
    const data = d.data();
    const idVal = Number(data.id);
    if (!isNaN(idVal) && idVal > maxId) {
      maxId = idVal;
    }
  });
  return maxId + 1;
}

/**
 * Universal SQL-compatible Query Translator for Firebase Firestore
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  await seedFasesIfEmpty();
  await seedUsersIfEmpty();

  const cleanSql = sql.trim();
  const lowerSql = cleanSql.toLowerCase();

  // Identify collection name safely by checking compound names first
  let targetCollection = '';
  if (lowerSql.includes('configuracoes_categoria')) targetCollection = 'configuracoes_categoria';
  else if (lowerSql.includes('eventos_partida')) targetCollection = 'eventos_partida';
  else if (lowerSql.includes('suspensoes')) targetCollection = 'suspensoes';
  else if (lowerSql.includes('usuarios')) targetCollection = 'usuarios';
  else if (lowerSql.includes('categorias')) targetCollection = 'categorias';
  else if (lowerSql.includes('times')) targetCollection = 'times';
  else if (lowerSql.includes('jogadores')) targetCollection = 'jogadores';
  else if (lowerSql.includes('partidas')) targetCollection = 'partidas';
  else if (lowerSql.includes('fases')) targetCollection = 'fases';

  if (!targetCollection) {
    return [] as T[];
  }

  const snap = await getDocs(collection(db, targetCollection));
  let items: any[] = snap.docs.map((d) => ({ ...d.data() }));

  let paramIdx = 0;
  const getNextParam = () => params[paramIdx++];

  // 1. Filter by category_id if present
  if (lowerSql.includes('categoria_id = ?') || lowerSql.includes('category_id = ?')) {
    const catId = Number(getNextParam());
    items = items.filter((x) => Number(x.categoria_id) === catId);
  }

  // 2. Filter by id if present
  if (lowerSql.includes('id = ?') || lowerSql.includes('where p.id = ?') || lowerSql.includes('where id = ?') || lowerSql.includes('where j.id = ?') || lowerSql.includes('where t.id = ?')) {
    if (params.length > paramIdx) {
      const targetId = Number(getNextParam());
      items = items.filter((x) => Number(x.id) === targetId);
    }
  }

  // 3. Filter by time_id or partida_id or pago
  if (lowerSql.includes('time_id = ?') && params.length > paramIdx) {
    const tId = Number(getNextParam());
    items = items.filter((x) => Number(x.time_id) === tId);
  }

  if (lowerSql.includes('partida_id = ?') && params.length > paramIdx) {
    const pId = Number(getNextParam());
    items = items.filter((x) => Number(x.partida_id) === pId);
  }

  if (lowerSql.includes('pago = 1')) {
    items = items.filter((x) => Number(x.pago) === 1);
  }

  if (lowerSql.includes('pago = ?') && params.length > paramIdx) {
    const pagoVal = Number(getNextParam());
    items = items.filter((x) => Number(x.pago) === pagoVal);
  }

  if (lowerSql.includes('lower(nome) = lower(?)') && params.length > paramIdx) {
    const nomeVal = String(getNextParam()).toLowerCase();
    items = items.filter((x) => String(x.nome || '').toLowerCase() === nomeVal);
  }

  // Aggregation handling
  if (lowerSql.includes('count(*) as count') && lowerSql.includes('paid')) {
    const totalCount = items.length;
    const paidCount = items.filter((x) => Number(x.pago) === 1).length;
    return [{ count: totalCount, paid: paidCount }] as any[];
  }

  if (lowerSql.includes('count(*) as count')) {
    return [{ count: items.length }] as any[];
  }

  // Enrichments for JOINS
  if (targetCollection === 'times') {
    if (lowerSql.includes('jogadores_count')) {
      const jogSnap = await getDocs(collection(db, 'jogadores'));
      const counts: Record<number, number> = {};
      jogSnap.forEach((d) => {
        const j = d.data();
        if (j.time_id) {
          const tid = Number(j.time_id);
          counts[tid] = (counts[tid] || 0) + 1;
        }
      });
      items = items.map((t) => ({
        ...t,
        jogadores_count: counts[Number(t.id)] || 0,
      }));
    }
  }

  if (targetCollection === 'partidas') {
    const [fasesSnap, timesSnap, catSnap] = await Promise.all([
      getDocs(collection(db, 'fases')),
      getDocs(collection(db, 'times')),
      getDocs(collection(db, 'categorias')),
    ]);

    const fasesMap: Record<number, string> = {};
    fasesSnap.forEach((d) => {
      const f = d.data();
      fasesMap[Number(f.id)] = f.nome;
    });

    const timesMap: Record<number, any> = {};
    timesSnap.forEach((d) => {
      const t = d.data();
      timesMap[Number(t.id)] = t;
    });

    const catMap: Record<number, string> = {};
    catSnap.forEach((d) => {
      const c = d.data();
      catMap[Number(c.id)] = c.nome;
    });

    items = items.map((p) => {
      const tm = timesMap[Number(p.time_mandante_id)];
      const tv = timesMap[Number(p.time_visitante_id)];
      return {
        ...p,
        fase_nome: fasesMap[Number(p.fase_id)] || 'Fase',
        categoria_nome: catMap[Number(p.categoria_id)] || '',
        time_mandante_nome: tm?.nome || 'Mandante',
        time_mandante_cor: tm?.cor_hex || '#000000',
        time_mandante_brasao: tm?.brasao_path || null,
        time_visitante_nome: tv?.nome || 'Visitante',
        time_visitante_cor: tv?.cor_hex || '#000000',
        time_visitante_brasao: tv?.brasao_path || null,
      };
    });
  }

  if (targetCollection === 'jogadores') {
    const timesSnap = await getDocs(collection(db, 'times'));
    const timesMap: Record<number, any> = {};
    timesSnap.forEach((d) => {
      const t = d.data();
      timesMap[Number(t.id)] = t;
    });

    let eventosItems: any[] = [];
    if (lowerSql.includes('eventos_partida')) {
      const evSnap = await getDocs(collection(db, 'eventos_partida'));
      eventosItems = evSnap.docs.map((d) => d.data());
    }

    items = items.map((j) => {
      const t = timesMap[Number(j.time_id)];
      const jId = Number(j.id);
      
      let gols = 0;
      let cartoes_amarelos = 0;
      let cartoes_vermelhos = 0;
      let destaques = 0;

      if (eventosItems.length > 0) {
        eventosItems.forEach((ev) => {
          if (Number(ev.jogador_id) === jId) {
            if (ev.tipo_evento === 'GOL') gols++;
            if (ev.tipo_evento === 'CARTAO_AMARELO') cartoes_amarelos++;
            if (ev.tipo_evento === 'CARTAO_VERMELHO') cartoes_vermelhos++;
            if (ev.tipo_evento === 'DESTAQUE') destaques++;
          }
        });
      }

      return {
        ...j,
        time_nome: t?.nome || null,
        time_cor_hex: t?.cor_hex || '#000000',
        gols,
        cartoes_amarelos,
        cartoes_vermelhos,
        destaques,
      };
    });
  }

  if (targetCollection === 'eventos_partida') {
    const [jogadoresSnap, timesSnap] = await Promise.all([
      getDocs(collection(db, 'jogadores')),
      getDocs(collection(db, 'times')),
    ]);

    const jogMap: Record<number, any> = {};
    jogadoresSnap.forEach((d) => {
      const j = d.data();
      jogMap[Number(j.id)] = j;
    });

    const timeMap: Record<number, any> = {};
    timesSnap.forEach((d) => {
      const t = d.data();
      timeMap[Number(t.id)] = t;
    });

    items = items.map((ep) => {
      const j = jogMap[Number(ep.jogador_id)];
      const t = timeMap[Number(ep.time_id)];
      return {
        ...ep,
        jogador_nome: j?.nome || 'Jogador',
        camisa_posicao: j?.camisa_posicao || 0,
        time_nome: t?.nome || 'Time',
        time_cor_hex: t?.cor_hex || '#000000',
      };
    });
  }

  // Sorting
  if (lowerSql.includes('order by')) {
    if (lowerSql.includes('rodada asc')) {
      items.sort((a, b) => Number(a.rodada || 0) - Number(b.rodada || 0) || Number(a.id) - Number(b.id));
    } else if (lowerSql.includes('camisa_posicao asc')) {
      items.sort((a, b) => Number(a.camisa_posicao || 0) - Number(b.camisa_posicao || 0) || String(a.nome).localeCompare(String(b.nome)));
    } else if (lowerSql.includes('nome asc')) {
      items.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
    } else if (lowerSql.includes('order by ep.id desc') || lowerSql.includes('order by id desc')) {
      items.sort((a, b) => Number(b.id) - Number(a.id));
    } else {
      items.sort((a, b) => Number(a.id) - Number(b.id));
    }
  }

  return items as T[];
}

/**
 * Mutation runner for INSERT, UPDATE, DELETE on Firestore
 */
export async function runQuery(
  sql: string,
  params: any[] = []
): Promise<{ lastInsertRowid: number; changes: number }> {
  const cleanSql = sql.trim();
  const lowerSql = cleanSql.toLowerCase();

  // 1. INSERT INTO
  if (lowerSql.startsWith('insert into')) {
    let tableName = '';
    const matchTable = lowerSql.match(/insert\s+into\s+([a-z0-9_]+)/i);
    if (matchTable) tableName = matchTable[1];

    if (!tableName) return { lastInsertRowid: 0, changes: 0 };

    const newId = await getNextId(tableName);
    let newDoc: any = { id: newId };

    // Try parsing columns: INSERT INTO table (col1, col2, ...) VALUES (?, ?, ...)
    const colsMatch = cleanSql.match(/insert\s+into\s+[a-z0-9_]+\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
    if (colsMatch) {
      const cols = colsMatch[1].split(',').map((c) => c.trim().toLowerCase());
      let paramIdx = 0;

      cols.forEach((col) => {
        if (paramIdx < params.length) {
          const val = params[paramIdx++];
          newDoc[col] = val !== undefined ? val : null;
        }
      });
    } else {
      // Positional fallback by table
      if (tableName === 'categorias') {
        newDoc.nome = params[0];
      } else if (tableName === 'configuracoes_categoria') {
        newDoc.categoria_id = Number(params[0]);
        newDoc.valor_inscricao = Number(params[1] ?? 0);
        newDoc.tempo_jogo_minutos = Number(params[2] ?? 20);
        newDoc.amarelos_para_expulsao = Number(params[3] ?? 2);
        newDoc.amarelos_acumulados_suspensao = Number(params[4] ?? 3);
        newDoc.jogos_suspensao_amarelo = Number(params[5] ?? 1);
        newDoc.jogos_suspensao_vermelho = Number(params[6] ?? 1);
        newDoc.num_titulares = Number(params[7] ?? 6);
        newDoc.num_reservas = Number(params[8] ?? 4);
      } else if (tableName === 'times') {
        newDoc.nome = params[0];
        newDoc.brasao_path = params[1] || null;
        newDoc.cor_hex = params[2] || '#000000';
        newDoc.categoria_id = Number(params[3]);
        newDoc.grupo = params[4] || 'A';
      } else if (tableName === 'jogadores') {
        newDoc.nome = params[0];
        newDoc.camisa_posicao = Number(params[1]);
        newDoc.pago = Number(params[2] ?? 0);
        newDoc.time_id = params[3] ? Number(params[3]) : null;
        newDoc.categoria_id = Number(params[4]);
      } else if (tableName === 'partidas') {
        newDoc.categoria_id = Number(params[0]);
        newDoc.fase_id = Number(params[1]);
        newDoc.time_mandante_id = Number(params[2]);
        newDoc.time_visitante_id = Number(params[3]);
        newDoc.gols_mandante = Number(params[4] ?? 0);
        newDoc.gols_visitante = Number(params[5] ?? 0);
        newDoc.data_hora = params[6] || null;
        newDoc.status = params[7] || 'AGENDADO';
        newDoc.tempo_decorrido_segundos = Number(params[8] ?? 0);
        newDoc.rodada = Number(params[9] ?? 1);
        newDoc.grupo = params[10] || null;
      } else if (tableName === 'eventos_partida') {
        newDoc.partida_id = Number(params[0]);
        newDoc.time_id = Number(params[1]);
        newDoc.jogador_id = Number(params[2]);
        newDoc.tipo_evento = params[3];
        newDoc.minuto_jogo = Number(params[4] ?? 0);
      } else if (tableName === 'suspensoes') {
        newDoc.jogador_id = Number(params[0]);
        newDoc.partida_origem_id = Number(params[1]);
        newDoc.jogos_cumprir = Number(params[2] ?? 1);
        newDoc.jogos_cumpridos = Number(params[3] ?? 0);
        newDoc.motivo = params[4] || 'CARTÃO';
      } else if (tableName === 'fases') {
        newDoc.id = Number(params[0]);
        newDoc.nome = params[1];
      } else if (tableName === 'usuarios') {
        newDoc.nome = params[0];
        newDoc.email = params[1];
        newDoc.senha = params[2];
        newDoc.role = params[3] || 'ADMIN';
        newDoc.criado_em = new Date().toISOString();
      }
    }

    await setDoc(doc(db, tableName, String(newDoc.id)), newDoc);
    return { lastInsertRowid: newDoc.id, changes: 1 };
  }

  // 2. UPDATE
  if (lowerSql.startsWith('update')) {
    let tableName = '';
    const matchTable = lowerSql.match(/update\s+([a-z0-9_]+)/i);
    if (matchTable) tableName = matchTable[1];

    if (!tableName) return { lastInsertRowid: 0, changes: 0 };

    const snap = await getDocs(collection(db, tableName));
    let updatedCount = 0;

    for (const d of snap.docs) {
      const data = d.data();
      let matchesCondition = true;

      if (lowerSql.includes('where id = ?') && params.length > 0) {
        const targetId = Number(params[params.length - 1]);
        if (Number(data.id) !== targetId) matchesCondition = false;
      } else if (lowerSql.includes('where categoria_id = ?') && params.length > 0) {
        const catId = Number(params[params.length - 1]);
        if (Number(data.categoria_id) !== catId) matchesCondition = false;
      } else if (lowerSql.includes('where time_id = ?') && params.length > 0) {
        const tId = Number(params[params.length - 1]);
        if (Number(data.time_id) !== tId) matchesCondition = false;
      }

      if (matchesCondition) {
        const updateFields: Record<string, any> = {};

        if (tableName === 'times') {
          if (lowerSql.includes('grupo = ?')) {
            updateFields.grupo = params[0];
          }
          if (lowerSql.includes('nome = ?')) {
            updateFields.nome = params[0];
            updateFields.brasao_path = params[1];
            updateFields.cor_hex = params[2];
            updateFields.grupo = params[3];
          }
        } else if (tableName === 'jogadores') {
          if (lowerSql.includes('time_id = null')) {
            updateFields.time_id = null;
          } else if (lowerSql.includes('time_id = ?')) {
            updateFields.time_id = params[0] ? Number(params[0]) : null;
          }
          if (lowerSql.includes('pago = ?')) {
            updateFields.pago = Number(params[0]);
          }
        } else if (tableName === 'partidas') {
          if (lowerSql.includes('gols_mandante') || lowerSql.includes('status')) {
            if (params.length >= 4) {
              updateFields.gols_mandante = Number(params[0]);
              updateFields.gols_visitante = Number(params[1]);
              updateFields.status = params[2];
              updateFields.tempo_decorrido_segundos = Number(params[3]);
            }
          }
        } else if (tableName === 'categorias') {
          if (lowerSql.includes('nome = ?')) {
            updateFields.nome = params[0];
          }
        } else if (tableName === 'configuracoes_categoria') {
          if (params.length >= 8) {
            updateFields.valor_inscricao = Number(params[0]);
            updateFields.tempo_jogo_minutos = Number(params[1]);
            updateFields.amarelos_para_expulsao = Number(params[2]);
            updateFields.amarelos_acumulados_suspensao = Number(params[3]);
            updateFields.jogos_suspensao_amarelo = Number(params[4]);
            updateFields.jogos_suspensao_vermelho = Number(params[5]);
            updateFields.num_titulares = Number(params[6]);
            updateFields.num_reservas = Number(params[7]);
          }
        }

        if (Object.keys(updateFields).length > 0) {
          await updateDoc(d.ref, updateFields);
          updatedCount++;
        }
      }
    }

    return { lastInsertRowid: 0, changes: updatedCount };
  }

  // 3. DELETE FROM
  if (lowerSql.startsWith('delete from')) {
    let tableName = '';
    const matchTable = lowerSql.match(/delete\s+from\s+([a-z0-9_]+)/i);
    if (matchTable) tableName = matchTable[1];

    if (!tableName) return { lastInsertRowid: 0, changes: 0 };

    const snap = await getDocs(collection(db, tableName));
    let deletedCount = 0;

    for (const d of snap.docs) {
      const data = d.data();
      let shouldDelete = false;

      if (!lowerSql.includes('where')) {
        shouldDelete = true;
      } else if (lowerSql.includes('where id = ?')) {
        const targetId = Number(params[0]);
        if (Number(data.id) === targetId) shouldDelete = true;
      } else if (lowerSql.includes('where categoria_id = ?')) {
        const catId = Number(params[0]);
        if (Number(data.categoria_id) === catId) shouldDelete = true;
      } else if (lowerSql.includes('where jogador_id = ?')) {
        const jogId = Number(params[0]);
        if (Number(data.jogador_id) === jogId) shouldDelete = true;
      } else if (lowerSql.includes('where partida_id = ?')) {
        const pId = Number(params[0]);
        if (Number(data.partida_id) === pId) shouldDelete = true;
      } else if (lowerSql.includes('where time_id = ?')) {
        const tId = Number(params[0]);
        if (Number(data.time_id) === tId) shouldDelete = true;
      } else if (lowerSql.includes('fase_id > 1')) {
        if (Number(data.fase_id) > 1) shouldDelete = true;
      } else if (lowerSql.includes('partida_origem_id in') || lowerSql.includes('time_mandante_id = ?')) {
        shouldDelete = true;
      }

      if (shouldDelete) {
        await deleteDoc(d.ref);
        deletedCount++;
      }
    }

    return { lastInsertRowid: 0, changes: deletedCount };
  }

  return { lastInsertRowid: 0, changes: 0 };
}
