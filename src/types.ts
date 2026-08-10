/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  senha?: string;
  role: 'ADMIN' | 'ORGANIZADOR' | 'TORCEDOR';
  criado_em?: string;
}

export interface Categoria {
  id: number;
  nome: string;
}

export interface ConfigCategoria {
  id: number;
  categoria_id: number;
  valor_inscricao: number;
  tempo_jogo_minutos: number;
  amarelos_para_expulsao: number;
  amarelos_acumulados_suspensao: number;
  jogos_suspensao_amarelo: number;
  jogos_suspensao_vermelho: number;
  num_titulares: number;
  num_reservas: number;
}

export interface Time {
  id: number;
  nome: string;
  brasao_path?: string;
  cor_hex: string;
  categoria_id: number;
  grupo?: string; // 'A', 'B', etc.
  jogadores_count?: number;
}

export interface Jogador {
  id: number;
  nome: string;
  camisa_posicao: number; // 1 = Goleiro, 2 = Zagueiro, 3 = Meia, 4 = Atacante, etc.
  pago: number; // 0 or 1
  time_id: number | null;
  categoria_id: number;
  time_nome?: string;
  time_cor_hex?: string;
  time_brasao_path?: string;
  gols?: number;
  cartoes_amarelos?: number;
  cartoes_vermelhos?: number;
  destaques?: number;
  suspenso?: boolean;
  motivo_suspensao?: string;
}

export interface Fase {
  id: number;
  nome: string;
}

export interface Partida {
  id: number;
  categoria_id: number;
  fase_id: number;
  time_mandante_id: number;
  time_visitante_id: number;
  gols_mandante: number;
  gols_visitante: number;
  data_hora: string;
  status: 'AGENDADO' | 'EM_ANDAMENTO' | 'FINALIZADO';
  tempo_decorrido_segundos: number;
  rodada: number;
  grupo?: string; // 'A', 'B', etc.
  
  // Joined fields for display
  time_mandante_nome?: string;
  time_mandante_cor?: string;
  time_mandante_brasao?: string;
  time_visitante_nome?: string;
  time_visitante_cor?: string;
  time_visitante_brasao?: string;
  fase_nome?: string;
  categoria_nome?: string;
}

export type TipoEvento = 'GOL' | 'CARTAO_AMARELO' | 'CARTAO_VERMELHO' | 'DESTAQUE';

export interface EventoPartida {
  id: number;
  partida_id: number;
  time_id: number;
  jogador_id: number;
  tipo_evento: TipoEvento;
  minuto_jogo: number;
  
  // Joined display fields
  jogador_nome?: string;
  camisa_posicao?: number;
  time_nome?: string;
  time_cor_hex?: string;
}

export interface Suspensao {
  id: number;
  jogador_id: number;
  partida_origem_id: number;
  jogos_cumprir: number;
  jogos_cumpridos: number;
  motivo: string;
  
  // Joined display fields
  jogador_nome?: string;
  time_nome?: string;
  time_cor_hex?: string;
  categoria_nome?: string;
}

export interface ClassificacaoItem {
  time_id: number;
  time_nome: string;
  time_cor_hex: string;
  time_brasao_path?: string;
  grupo?: string;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  gols_pro: number;
  gols_contra: number;
  saldo_gols: number;
  pontos: number;
  aproveitamento: number;
}

export interface ArtilhariaItem {
  jogador_id: number;
  jogador_nome: string;
  camisa_posicao: number;
  time_nome: string;
  time_cor_hex: string;
  time_brasao_path?: string;
  gols: number;
}

export interface DestaqueItem {
  jogador_id: number;
  jogador_nome: string;
  camisa_posicao: number;
  time_nome: string;
  time_cor_hex: string;
  destaques: number;
}

export const POSICOES_MAP: Record<number, { nome: string; sigla: string }> = {
  1: { nome: 'Goleiro', sigla: 'GOL' },
  2: { nome: 'Zagueiro', sigla: 'ZAG' },
  3: { nome: 'Lateral', sigla: 'LAT' },
  4: { nome: 'Meia / Volante', sigla: 'MEI' },
  5: { nome: 'Pivô / Atacante', sigla: 'ATA' },
  6: { nome: 'Coringa / Reserva', sigla: 'RES' },
};
