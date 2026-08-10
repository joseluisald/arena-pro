/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Layers, Plus, Trash2, Edit3, X, Check, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Categoria } from '../types';
import { createCategoria, updateCategoria, deleteCategoria } from '../services/db';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categorias: Categoria[];
  onRefreshData: () => Promise<void>;
  onSelectCategoria: (id: number) => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categorias,
  onRefreshData,
  onSelectCategoria,
}) => {
  const [newCatName, setNewCatName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      setErrorMsg('Informe o nome da categoria.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const newId = await createCategoria(newCatName.trim());
      await onRefreshData();
      onSelectCategoria(newId);
      setNewCatName('');
      setSuccessMsg(`Categoria "${newCatName.trim()}" cadastrada com sucesso!`);

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });

      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erro ao cadastrar categoria.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (cat: Categoria) => {
    setEditingId(cat.id);
    setEditingName(cat.nome);
  };

  const handleSaveEdit = async (id: number) => {
    if (!editingName.trim()) return;
    try {
      setIsSubmitting(true);
      await updateCategoria(id, editingName.trim());
      await onRefreshData();
      setEditingId(null);
      setSuccessMsg('Nome da categoria atualizado.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Erro ao atualizar categoria.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      setIsSubmitting(true);
      await deleteCategoria(id);
      await onRefreshData();
      setDeleteConfirmId(null);
      setSuccessMsg('Categoria removida do banco de dados.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Erro ao remover categoria.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#161920] border border-[#262933] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#262933] pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-[#FF6B1A]/10 border border-[#FF6B1A]/30 rounded-2xl shadow-[0_0_15px_rgba(255,107,26,0.2)]">
              <Layers className="w-6 h-6 text-[#FF6B1A]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">
                Cadastro de Categorias
              </h3>
              <p className="text-xs text-[#8E9299]">
                Crie e gerencie as categorias do torneio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#8E9299] hover:text-white bg-[#0F1115] rounded-xl border border-[#262933] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-3 bg-[#FF1744]/10 border border-[#FF1744]/30 rounded-xl text-xs text-[#FF1744] font-mono flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 font-mono flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form: Nova Categoria */}
        <form onSubmit={handleCreate} className="p-4 bg-[#0F1115] border border-[#262933] rounded-2xl space-y-3">
          <label className="block text-xs font-mono uppercase font-bold text-[#FF6B1A] tracking-wider">
            + Cadastrar Nova Categoria
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ex: Livre, Sub-17, Sênior 40+, Feminino"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="flex-1 bg-[#161920] text-white text-xs px-3.5 py-2.5 rounded-xl border border-[#262933] focus:outline-none focus:border-[#FF6B1A] font-sans"
            />
            <button
              type="submit"
              disabled={isSubmitting || !newCatName.trim()}
              className="px-4 py-2.5 bg-[#FF6B1A] hover:bg-[#e05a0f] text-black font-mono text-xs font-black uppercase rounded-xl transition-all shadow-[0_0_15px_rgba(255,107,26,0.3)] flex items-center space-x-1.5 disabled:opacity-50 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar</span>
            </button>
          </div>
        </form>

        {/* List of Existing Categories */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          <label className="block text-[11px] font-mono uppercase font-bold text-[#8E9299] tracking-wider mb-2">
            Categorias Cadastradas ({categorias.length})
          </label>

          {categorias.length === 0 ? (
            <p className="text-xs text-[#8E9299] italic p-4 text-center">Nenhuma categoria cadastrada.</p>
          ) : (
            categorias.map((cat) => (
              <div
                key={cat.id}
                className="p-3 bg-[#0F1115] border border-[#262933] rounded-2xl flex items-center justify-between gap-2 hover:border-[#FF6B1A]/40 transition-colors"
              >
                {editingId === cat.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 bg-[#161920] text-white text-xs px-3 py-1.5 rounded-lg border border-[#FF6B1A] focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEdit(cat.id)}
                      className="p-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg border border-emerald-500/40"
                      title="Salvar"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-2 bg-[#161920] text-[#8E9299] rounded-lg border border-[#262933]"
                      title="Cancelar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center space-x-3">
                      <span className="text-[10px] font-mono font-bold text-[#FF6B1A] bg-[#FF6B1A]/10 border border-[#FF6B1A]/20 px-2 py-0.5 rounded-md">
                        #{cat.id}
                      </span>
                      <span className="text-xs font-bold text-white uppercase tracking-wide">
                        {cat.nome}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleStartEdit(cat)}
                        className="p-1.5 text-[#8E9299] hover:text-white hover:bg-[#161920] rounded-lg transition-colors"
                        title="Editar nome"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {deleteConfirmId === cat.id ? (
                        <div className="flex items-center space-x-1 bg-[#FF1744]/10 p-1 rounded-lg border border-[#FF1744]/30">
                          <button
                            onClick={() => handleDelete(cat.id)}
                            className="px-2 py-0.5 bg-[#FF1744] text-white text-[10px] font-mono font-bold rounded"
                          >
                            Excluir
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="p-0.5 text-[#8E9299] hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(cat.id)}
                          className="p-1.5 text-[#8E9299] hover:text-[#FF1744] hover:bg-[#FF1744]/10 rounded-lg transition-colors"
                          title="Excluir Categoria"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-[#262933] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#0F1115] hover:bg-[#222632] text-[#8E9299] hover:text-white border border-[#262933] text-xs font-mono font-bold uppercase rounded-xl transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
