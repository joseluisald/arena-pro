/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Search, X, Globe, Check, Sparkles } from 'lucide-react';
import { COUNTRIES, CountryInfo } from '../data/countries';

interface FlagPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCountry: (country: CountryInfo) => void;
  selectedFlagUrl?: string;
}

export const FlagPickerModal: React.FC<FlagPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectCountry,
  selectedFlagUrl,
}) => {
  const [search, setSearch] = useState('');
  const [activeContinent, setActiveContinent] = useState<string>('TODOS');

  const continents = ['TODOS', 'América do Sul', 'Europa', 'América do Norte/Central', 'África', 'Ásia & Oceania'];

  const filteredCountries = useMemo(() => {
    return COUNTRIES.filter((c) => {
      const matchesContinent = activeContinent === 'TODOS' || c.continent === activeContinent;
      const matchesSearch =
        search.trim() === '' ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase());
      return matchesContinent && matchesSearch;
    });
  }, [search, activeContinent]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#161920] border border-[#262933] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#262933] flex items-center justify-between bg-[#111318]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#FF6B1A]/10 border border-[#FF6B1A]/30 flex items-center justify-center text-[#FF6B1A]">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider font-sans">
                Biblioteca de Bandeiras & Cores
              </h3>
              <p className="text-[11px] text-[#A0A5B0] font-mono">
                Selecione o país para aplicar automaticamente a bandeira e a cor oficial do time.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8E9299] hover:text-white p-1.5 rounded-lg hover:bg-[#222632] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Continent Filters */}
        <div className="p-4 border-b border-[#262933] space-y-3 bg-[#161920]">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8E9299] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar país ou seleção (ex: Brasil, Argentina, Alemanha)..."
              className="w-full bg-[#0F1115] text-white text-xs font-mono rounded-xl pl-10 pr-4 py-2.5 border border-[#262933] focus:outline-none focus:ring-1 focus:ring-[#FF6B1A]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px] font-mono">
            {continents.map((cont) => (
              <button
                key={cont}
                type="button"
                onClick={() => setActiveContinent(cont)}
                className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all border ${
                  activeContinent === cont
                    ? 'bg-[#FF6B1A] text-black border-[#FF6B1A] shadow-[0_0_10px_rgba(255,107,26,0.3)]'
                    : 'bg-[#0F1115] text-[#8E9299] hover:text-white border-[#262933] hover:border-[#383C4A]'
                }`}
              >
                {cont}
              </button>
            ))}
          </div>
        </div>

        {/* Country Grid */}
        <div className="p-4 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {filteredCountries.length === 0 ? (
            <div className="col-span-full py-12 text-center text-[#8E9299] font-mono text-xs">
              Nenhum país encontrado para "{search}".
            </div>
          ) : (
            filteredCountries.map((c) => {
              const isSelected = selectedFlagUrl === c.flagUrl;
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    onSelectCountry(c);
                    onClose();
                  }}
                  className={`group p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-all relative ${
                    isSelected
                      ? 'bg-[#FF6B1A]/15 border-[#FF6B1A] ring-1 ring-[#FF6B1A]'
                      : 'bg-[#0F1115] hover:bg-[#1C202A] border-[#262933] hover:border-[#FF6B1A]/50'
                  }`}
                >
                  {/* Flag */}
                  <div className="w-10 h-7 rounded border border-white/10 overflow-hidden bg-[#222632] flex items-center justify-center shrink-0 shadow-sm">
                    <img
                      src={c.flagUrl}
                      alt={c.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-black text-white truncate group-hover:text-[#FF6B1A] transition-colors">
                      {c.name}
                    </div>
                    <div className="text-[10px] text-[#8E9299] font-mono flex items-center gap-1.5 mt-0.5">
                      <span className="font-semibold text-white/70">{c.code}</span>
                      <span>•</span>
                      <span className="text-white/60">{c.primaryColor}</span>
                    </div>
                  </div>

                  {/* Colors & Selection */}
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <div
                      className="w-4 h-4 rounded-full border border-black/50 shadow-sm"
                      style={{ backgroundColor: c.primaryColor }}
                      title={`Cor oficial: ${c.primaryColor}`}
                    />
                    {c.secondaryColor && (
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-black/50 shadow-sm -ml-2"
                        style={{ backgroundColor: c.secondaryColor }}
                        title={`Cor secundária: ${c.secondaryColor}`}
                      />
                    )}
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-[#FF6B1A] text-black flex items-center justify-center ml-1">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-[#111318] border-t border-[#262933] flex items-center justify-between text-[11px] font-mono text-[#8E9299]">
          <span className="flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#FF6B1A]" />
            <span>{filteredCountries.length} bandeiras disponíveis</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-[#1C202A] hover:bg-[#262933] text-white rounded-lg text-[10px] uppercase font-bold transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
