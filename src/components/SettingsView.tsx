/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ConfigCategoria } from '../types';
import { query, runQuery } from '../services/db';
import { Settings, Save, AlertCircle, CheckCircle } from 'lucide-react';

interface SettingsViewProps {
  categoriaId: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ categoriaId }) => {
  const [config, setConfig] = useState<ConfigCategoria | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [categoriaId]);

  const loadSettings = async () => {
    const res = await query<ConfigCategoria>(
      'SELECT * FROM configuracoes_categoria WHERE categoria_id = ?;',
      [categoriaId]
    );
    if (res[0]) {
      setConfig(res[0]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    await runQuery(
      `UPDATE configuracoes_categoria
       SET valor_inscricao = ?,
           tempo_jogo_minutos = ?,
           amarelos_para_expulsao = ?,
           amarelos_acumulados_suspensao = ?,
           jogos_suspensao_amarelo = ?,
           jogos_suspensao_vermelho = ?,
           num_titulares = ?,
           num_reservas = ?
       WHERE categoria_id = ?;`,
      [
        config.valor_inscricao,
        config.tempo_jogo_minutos,
        config.amarelos_para_expulsao,
        config.amarelos_acumulados_suspensao,
        config.jogos_suspensao_amarelo,
        config.jogos_suspensao_vermelho,
        config.num_titulares,
        config.num_reservas,
        categoriaId,
      ]
    );

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  if (!config) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-[#161920] border border-[#262933] rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-2 mb-1">
          <Settings className="w-5 h-5 text-[#FF6B1A]" />
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Configurações e Regras do Torneio</h2>
        </div>
        <p className="text-xs text-[#8E9299]">
          Ajuste as regras de jogo, limites de cartões para suspensão automática e valores financeiros para a categoria selecionada.
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-[#161920] border border-[#262933] rounded-2xl p-6 space-y-6 shadow-xl">
        {savedSuccess && (
          <div className="bg-[#FF6B1A]/10 border border-[#FF6B1A]/30 text-[#FF6B1A] p-4 rounded-xl text-xs font-mono font-bold flex items-center space-x-2">
            <CheckCircle className="w-4 h-4" />
            <span>Configurações salvas com sucesso! As novas regras já estão valendo.</span>
          </div>
        )}

        {/* Section 1: Inscrição e Tempo */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-[#FF6B1A] uppercase tracking-widest font-mono">
            1. Formato da Partida & Financeiro
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">Valor da Inscrição (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={config.valor_inscricao}
                onChange={(e) => setConfig({ ...config, valor_inscricao: Number(e.target.value) })}
                className="w-full bg-[#0F1115] text-white rounded-xl p-3 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A]"
              />
            </div>

            <div>
              <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">Tempo de jogo (Minutos por Tempo)</label>
              <input
                type="number"
                required
                value={config.tempo_jogo_minutos}
                onChange={(e) => setConfig({ ...config, tempo_jogo_minutos: Number(e.target.value) })}
                className="w-full bg-[#0F1115] text-white rounded-xl p-3 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A]"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Cartões e Suspensões */}
        <div className="space-y-4 pt-4 border-t border-[#262933]">
          <h3 className="text-xs font-bold text-[#FFC400] uppercase tracking-widest font-mono">
            2. Regras de Cartões & Suspensões Automáticas
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">
                Cartões Amarelos p/ Suspensão
              </label>
              <input
                type="number"
                required
                value={config.amarelos_acumulados_suspensao}
                onChange={(e) => setConfig({ ...config, amarelos_acumulados_suspensao: Number(e.target.value) })}
                className="w-full bg-[#0F1115] text-white rounded-xl p-3 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A]"
              />
              <p className="text-[10px] text-[#8E9299] font-mono mt-1">Ex: 3 amarelos em jogos diferentes gera suspensão automática.</p>
            </div>

            <div>
              <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">Jogos Suspensão (Amarelos)</label>
              <input
                type="number"
                required
                value={config.jogos_suspensao_amarelo}
                onChange={(e) => setConfig({ ...config, jogos_suspensao_amarelo: Number(e.target.value) })}
                className="w-full bg-[#0F1115] text-white rounded-xl p-3 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A]"
              />
            </div>

            <div>
              <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">Jogos Suspensão (Vermelho)</label>
              <input
                type="number"
                required
                value={config.jogos_suspensao_vermelho}
                onChange={(e) => setConfig({ ...config, jogos_suspensao_vermelho: Number(e.target.value) })}
                className="w-full bg-[#0F1115] text-white rounded-xl p-3 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A]"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Tamanho de Elenco */}
        <div className="space-y-4 pt-4 border-t border-[#262933]">
          <h3 className="text-xs font-bold text-orange-400 uppercase tracking-widest font-mono">
            3. Composição de Elenco por Time
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">Número de Titulares em Campo</label>
              <input
                type="number"
                required
                value={config.num_titulares}
                onChange={(e) => setConfig({ ...config, num_titulares: Number(e.target.value) })}
                className="w-full bg-[#0F1115] text-white rounded-xl p-3 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A]"
              />
            </div>

            <div>
              <label className="block text-[#8E9299] font-mono uppercase tracking-wider mb-1">Número de Reservas no Banco</label>
              <input
                type="number"
                required
                value={config.num_reservas}
                onChange={(e) => setConfig({ ...config, num_reservas: Number(e.target.value) })}
                className="w-full bg-[#0F1115] text-white rounded-xl p-3 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A]"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[#262933] flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 bg-[#FF6B1A] hover:bg-[#e05a0f] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(255,107,26,0.3)] flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Regras da Categoria</span>
          </button>
        </div>
      </form>
    </div>
  );
};
