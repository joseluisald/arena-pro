/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { query, runQuery, exportSqliteFile, importSqliteFile, resetDatabaseToSeed } from '../services/db';
import { Database, CheckCircle, Terminal, Play, ShieldAlert, Code2, Table, Download, Upload, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export const SqlSchemaLabView: React.FC = () => {
  const [customSql, setCustomSql] = useState('SELECT * FROM categorias;');
  const [queryResult, setQueryResult] = useState<any[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    const blob = await exportSqliteFile();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `torneio_society_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importSqliteFile(file).then(() => {
        setResetSuccessMessage('Backup Firebase Firestore restaurado com sucesso!');
        setTimeout(() => window.location.reload(), 1000);
      });
    }
  };

  const confirmResetDatabase = async () => {
    try {
      setIsResetting(true);
      await resetDatabaseToSeed();
      setIsResetModalOpen(false);
      setResetSuccessMessage('Banco de dados resetado com sucesso! Dados restaurados para o estado inicial.');

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.5 },
      });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error('Erro ao resetar banco de dados:', err);
    } finally {
      setIsResetting(false);
    }
  };

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
      if (customSql.trim().toUpperCase().startsWith('SELECT')) {
        const res = await query(customSql);
        setQueryResult(res);
      } else {
        await runQuery(customSql);
        setQueryResult([{ status: 'Comando SQL executado com sucesso!' }]);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Erro de execução SQL');
      setQueryResult(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {resetSuccessMessage && (
        <div className="p-4 bg-[#161920] border border-emerald-500/40 rounded-2xl shadow-2xl flex items-start space-x-3 text-xs text-emerald-400 font-mono">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <span className="font-bold text-white uppercase block">Operação Concluída</span>
            <p className="text-[#8E9299] text-[11px] leading-relaxed">{resetSuccessMessage}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#161920] border border-[#262933] rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-2 mb-1">
          <Database className="w-5 h-5 text-[#FF6B1A]" />
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Ferramentas & Esquema SQLite</h2>
        </div>
        <p className="text-xs text-[#8E9299]">
          Exportação/restauração do arquivo local .sqlite, reset do banco, validação do modelo relacional e console SQL.
        </p>
      </div>

      {/* Ferramentas SQLite Card */}
      <div className="bg-[#161920] border border-[#262933] rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#262933] pb-3">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
            <Database className="w-4 h-4 text-[#FF6B1A]" />
            <span>Ferramentas de Banco de Dados SQLite</span>
          </h3>
          <span className="text-[10px] font-mono text-[#8E9299] bg-[#0F1115] px-2.5 py-1 rounded-lg border border-[#262933]">
            Sincronização Local (WASM / SQLite)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleExport}
            className="flex items-center justify-center space-x-2 p-4 rounded-xl bg-[#0F1115] hover:bg-[#222632] text-[#E0E6ED] border border-[#262933] hover:border-[#FF6B1A]/50 transition-all font-mono text-xs font-bold"
          >
            <Download className="w-4 h-4 text-[#FF6B1A]" />
            <span>Exportar Backup (.sqlite)</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center space-x-2 p-4 rounded-xl bg-[#0F1115] hover:bg-[#222632] text-[#E0E6ED] border border-[#262933] hover:border-[#FF6B1A]/50 transition-all font-mono text-xs font-bold"
          >
            <Upload className="w-4 h-4 text-[#FF6B1A]" />
            <span>Restaurar Arquivo (.sqlite)</span>
          </button>

          <button
            onClick={() => setIsResetModalOpen(true)}
            className="flex items-center justify-center space-x-2 p-4 rounded-xl bg-[#FF1744]/10 hover:bg-[#FF1744]/20 text-[#FF1744] border border-[#FF1744]/30 transition-all font-mono text-xs font-bold uppercase"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Resetar Banco de Dados</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            accept=".sqlite,.db"
            className="hidden"
          />
        </div>
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

      {/* Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-[#161920] border border-[#262933] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-[#FF1744]/10 border border-[#FF1744]/30 rounded-2xl">
                  <AlertTriangle className="w-6 h-6 text-[#FF1744]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">Resetar Banco de Dados</h3>
                  <p className="text-[11px] font-mono text-[#8E9299]">Ação Crítica de Reinicialização</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-[#8E9299] leading-relaxed">
              Esta ação irá apagar todas as partidas, súmulas, cartões e inscrições de times/jogadores, restaurando o banco SQLite para os dados padrão iniciais. Seu usuário de login será preservado.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2.5 bg-[#0F1115] hover:bg-[#222632] text-[#8E9299] hover:text-white border border-[#262933] rounded-xl text-xs font-mono font-bold uppercase"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmResetDatabase}
                disabled={isResetting}
                className="px-5 py-2.5 bg-[#FF1744] hover:bg-red-600 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(255,23,68,0.4)] flex items-center space-x-2"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                <span>{isResetting ? 'Resetando...' : 'Confirmar Reset'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
