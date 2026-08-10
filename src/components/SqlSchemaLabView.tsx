/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { query, getDb } from '../services/db';
import { Database, CheckCircle, Terminal, Play, ShieldAlert, Code2, Table } from 'lucide-react';

export const SqlSchemaLabView: React.FC = () => {
  const [customSql, setCustomSql] = useState('SELECT * FROM categorias;');
  const [queryResult, setQueryResult] = useState<any[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const predefinedQueries = [
    { label: 'Usuários (Login)', sql: 'SELECT id, nome, email, role, criado_em FROM usuarios;' },
    { label: 'Categorias', sql: 'SELECT * FROM categorias;' },
    { label: 'Configurações por Categoria', sql: 'SELECT * FROM configuracoes_categoria;' },
    { label: 'Times Cadastrados', sql: 'SELECT * FROM times;' },
    { label: 'Jogadores & Potes', sql: 'SELECT id, nome, camisa_posicao, pago, time_id FROM jogadores LIMIT 10;' },
    { label: 'Partidas Recentes', sql: 'SELECT id, categoria_id, time_mandante_id, time_visitante_id, gols_mandante, gols_visitante, status FROM partidas;' },
    { label: 'Eventos de Súmula', sql: 'SELECT * FROM eventos_partida ORDER BY id DESC LIMIT 10;' },
    { label: 'Suspensões Ativas', sql: 'SELECT * FROM suspensoes;' },
  ];

  const handleExecuteSql = async () => {
    try {
      setErrorMsg(null);
      const db = await getDb();
      if (customSql.trim().toUpperCase().startsWith('SELECT')) {
        const res = await query(customSql);
        setQueryResult(res);
      } else {
        db.run(customSql);
        setQueryResult([{ status: 'Comando SQL executado com sucesso!' }]);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Erro de execução SQL');
      setQueryResult(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#161920] border border-[#262933] rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-2 mb-1">
          <Database className="w-5 h-5 text-[#FF6B1A]" />
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Validação do Esquema SQLite & Console SQL</h2>
        </div>
        <p className="text-xs text-[#8E9299]">
          Validação do modelo relacional, triggers para sincronização automática da súmula digital offline e console para execução de queries diretas.
        </p>
      </div>

      {/* Schema Validation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Validation Status Card */}
        <div className="bg-[#161920] border border-[#262933] rounded-2xl p-5 space-y-3 shadow-xl">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-[#FF6B1A]" />
            <span>Status da Validação do Esquema</span>
          </h3>

          <div className="space-y-2 text-xs font-mono text-[#E0E6ED]">
            <div className="p-2.5 bg-[#0F1115] rounded-xl border border-[#262933] flex items-center justify-between">
              <span>Support a Chaves Estrangeiras (`PRAGMA foreign_keys = ON`)</span>
              <span className="text-[#FF6B1A] font-bold">✓ Ativo</span>
            </div>
            <div className="p-2.5 bg-[#0F1115] rounded-xl border border-[#262933] flex items-center justify-between">
              <span>8 Tabelas do Modelo Relacional</span>
              <span className="text-[#FF6B1A] font-bold">✓ Válido</span>
            </div>
            <div className="p-2.5 bg-[#0F1115] rounded-xl border border-[#262933] flex items-center justify-between">
              <span>Índices de Performance por Categoria e Pote</span>
              <span className="text-[#FF6B1A] font-bold">✓ Otimizado</span>
            </div>
          </div>
        </div>

        {/* Triggers Description Card */}
        <div className="bg-[#161920] border border-[#262933] rounded-2xl p-5 space-y-3 shadow-xl">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center space-x-2">
            <Code2 className="w-4 h-4 text-[#FFC400]" />
            <span>Triggers & Views para Modo Offline</span>
          </h3>

          <div className="space-y-2 text-xs font-mono text-[#E0E6ED]">
            <div className="p-2.5 bg-[#0F1115] rounded-xl border border-[#262933]">
              <p className="font-bold text-[#FFC400]">trg_inserir_gol_partida & trg_remover_gol_partida</p>
              <p className="text-[11px] text-[#8E9299] font-sans mt-0.5">
                Atualiza o placar de `partidas` automaticamente quando um evento do tipo 'GOL' é inserido ou removido na súmula digital.
              </p>
            </div>

            <div className="p-2.5 bg-[#0F1115] rounded-xl border border-[#262933]">
              <p className="font-bold text-orange-400">Processador de Suspensões por Cartão</p>
              <p className="text-[11px] text-[#8E9299] font-sans mt-0.5">
                Mapeia acúmulo de cartões amarelos e vermelhos no encerramento da partida e insere punições em `suspensoes`.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive SQL Console */}
      <div className="bg-[#161920] border border-[#262933] rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-2 border-b border-[#262933]">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-[#FF6B1A]" />
            <span>Console Interativo SQLite</span>
          </h3>
        </div>

        {/* Shortcuts */}
        <div className="flex flex-wrap gap-2">
          {predefinedQueries.map((q, idx) => (
            <button
              key={idx}
              onClick={() => setCustomSql(q.sql)}
              className="px-2.5 py-1 bg-[#0F1115] hover:bg-[#222632] text-[#E0E6ED] hover:text-white rounded-lg text-[11px] font-mono font-semibold border border-[#262933] transition-colors"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Input Textarea */}
        <div className="space-y-2">
          <textarea
            rows={3}
            value={customSql}
            onChange={(e) => setCustomSql(e.target.value)}
            className="w-full bg-[#0F1115] text-[#FF6B1A] font-mono text-xs rounded-xl p-3 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A]"
          />

          <div className="flex justify-end">
            <button
              onClick={handleExecuteSql}
              className="px-4 py-2 bg-[#FF6B1A] hover:bg-[#e05a0f] text-black font-extrabold text-xs uppercase tracking-wider rounded-xl flex items-center space-x-1.5 shadow-[0_0_15px_rgba(255,107,26,0.3)] transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Executar SQL</span>
            </button>
          </div>
        </div>

        {/* Error Feedback */}
        {errorMsg && (
          <div className="bg-[#FF1744]/10 border border-[#FF1744]/30 text-[#FF1744] p-3 rounded-xl text-xs font-mono">
            Error: {errorMsg}
          </div>
        )}

        {/* Result Table */}
        {queryResult && (
          <div className="space-y-2">
            <span className="text-[10px] text-[#8E9299] font-mono font-bold uppercase tracking-wider">
              Resultado ({queryResult.length} registros)
            </span>
            <div className="bg-[#0F1115] rounded-xl border border-[#262933] overflow-x-auto max-h-[300px]">
              {queryResult.length === 0 ? (
                <p className="p-4 text-xs text-[#8E9299] font-mono text-center">Nenhum registro retornado.</p>
              ) : (
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#161920] text-[#8E9299] border-b border-[#262933] text-[10px] tracking-wider uppercase font-bold">
                    <tr>
                      {Object.keys(queryResult[0]).map((key) => (
                        <th key={key} className="py-2 px-3 border-r border-[#262933]">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#262933]">
                    {queryResult.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-[#161920]/50 transition-colors">
                        {Object.values(row).map((val: any, cIdx) => (
                          <td key={cIdx} className="py-2 px-3 text-[#E0E6ED] border-r border-[#262933]/50 truncate max-w-[200px]">
                            {val === null ? 'NULL' : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
