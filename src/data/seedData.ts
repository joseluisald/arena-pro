/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SeedData {
  categorias: Array<{ id: number; nome: string }>;
  configuracoes: Array<{
    categoria_id: number;
    valor_inscricao: number;
    tempo_jogo_minutos: number;
    amarelos_para_expulsao: number;
    amarelos_acumulados_suspensao: number;
    jogos_suspensao_amarelo: number;
    jogos_suspensao_vermelho: number;
    num_titulares: number;
    num_reservas: number;
  }>;
  times: Array<{
    id: number;
    nome: string;
    brasao_path: string;
    cor_hex: string;
    categoria_id: number;
  }>;
  jogadores: Array<{
    nome: string;
    camisa_posicao: number;
    pago: number;
    categoria_id: number;
  }>;
}

export const SEED_DATA: SeedData = {
  categorias: [
    { id: 1, nome: 'Principal' },
    { id: 2, nome: 'Veteranos' },
    { id: 3, nome: 'Sênior' },
    { id: 4, nome: 'Feminino' },
  ],
  configuracoes: [
    {
      categoria_id: 1,
      valor_inscricao: 120.00,
      tempo_jogo_minutos: 25,
      amarelos_para_expulsao: 2,
      amarelos_acumulados_suspensao: 3,
      jogos_suspensao_amarelo: 1,
      jogos_suspensao_vermelho: 1,
      num_titulares: 6,
      num_reservas: 4,
    },
    {
      categoria_id: 2,
      valor_inscricao: 100.00,
      tempo_jogo_minutos: 22,
      amarelos_para_expulsao: 2,
      amarelos_acumulados_suspensao: 3,
      jogos_suspensao_amarelo: 1,
      jogos_suspensao_vermelho: 1,
      num_titulares: 6,
      num_reservas: 4,
    },
    {
      categoria_id: 3,
      valor_inscricao: 90.00,
      tempo_jogo_minutos: 20,
      amarelos_para_expulsao: 2,
      amarelos_acumulados_suspensao: 3,
      jogos_suspensao_amarelo: 1,
      jogos_suspensao_vermelho: 1,
      num_titulares: 6,
      num_reservas: 3,
    },
    {
      categoria_id: 4,
      valor_inscricao: 80.00,
      tempo_jogo_minutos: 20,
      amarelos_para_expulsao: 2,
      amarelos_acumulados_suspensao: 3,
      jogos_suspensao_amarelo: 1,
      jogos_suspensao_vermelho: 1,
      num_titulares: 6,
      num_reservas: 4,
    },
  ],
  times: [
    // Category 1: Principal (6 teams)
    { id: 1, nome: 'Real Matismo FC', brasao_path: '⚡', cor_hex: '#DC2626', categoria_id: 1 },
    { id: 2, nome: 'Inter de Limão', brasao_path: '🍋', cor_hex: '#16A34A', categoria_id: 1 },
    { id: 3, nome: 'Boca Juniors da Quadra', brasao_path: '🔷', cor_hex: '#2563EB', categoria_id: 1 },
    { id: 4, nome: 'Resenha & Colegagem', brasao_path: '🍺', cor_hex: '#D97706', categoria_id: 1 },
    { id: 5, nome: 'Galácticos Society', brasao_path: '⭐', cor_hex: '#7C3AED', categoria_id: 1 },
    { id: 6, nome: 'Tira Teima FC', brasao_path: '🎯', cor_hex: '#0284C7', categoria_id: 1 },

    // Category 2: Veteranos (4 teams)
    { id: 7, nome: 'Amigos do Churrasco', brasao_path: '🥩', cor_hex: '#EA580C', categoria_id: 2 },
    { id: 8, nome: 'Canelas de Aço', brasao_path: '🛡️', cor_hex: '#475569', categoria_id: 2 },
    { id: 9, nome: 'Velha Guarda FC', brasao_path: '👑', cor_hex: '#CA8A04', categoria_id: 2 },
    { id: 10, nome: 'Sênior Masters', brasao_path: '🍷', cor_hex: '#9333EA', categoria_id: 2 },

    // Category 3: Sênior (4 teams)
    { id: 11, nome: 'Experiência FC', brasao_path: '🏆', cor_hex: '#2563EB', categoria_id: 3 },
    { id: 12, nome: 'Tradição Society', brasao_path: '🌿', cor_hex: '#059669', categoria_id: 3 },
    { id: 13, nome: 'Lendas da Bola', brasao_path: '🌟', cor_hex: '#EAB308', categoria_id: 3 },
    { id: 14, nome: 'Pura Classe FC', brasao_path: '🎩', cor_hex: '#374151', categoria_id: 3 },

    // Category 4: Feminino (4 teams)
    { id: 15, nome: 'Divas da Bola', brasao_path: '💅', cor_hex: '#EC4899', categoria_id: 4 },
    { id: 16, nome: 'Guerreiras FC', brasao_path: '⚔️', cor_hex: '#8B5CF6', categoria_id: 4 },
    { id: 17, nome: 'Feras do Society', brasao_path: '🐆', cor_hex: '#F59E0B', categoria_id: 4 },
    { id: 18, nome: 'Estrelas FC', brasao_path: '✨', cor_hex: '#06B6D4', categoria_id: 4 },
  ],
  jogadores: [
    // --- CATEGORIA 1: PRINCIPAL (6 times x 8 jogadores = 48 jogadores) ---
    // Camisa 1: Goleiros (6)
    { nome: 'Carlos "Muralha" Silva', camisa_posicao: 1, pago: 1, categoria_id: 1 },
    { nome: 'Rodrigo "Taffarel" Santos', camisa_posicao: 1, pago: 1, categoria_id: 1 },
    { nome: 'Lucas "Mão de Pedra" Costa', camisa_posicao: 1, pago: 1, categoria_id: 1 },
    { nome: 'Fernando "Luva de Pedreiro"', camisa_posicao: 1, pago: 0, categoria_id: 1 },
    { nome: 'Mateus "Catimba" Oliveira', camisa_posicao: 1, pago: 1, categoria_id: 1 },
    { nome: 'Gabriel "Voador" Souza', camisa_posicao: 1, pago: 1, categoria_id: 1 },

    // Camisa 2: Zagueiros (6)
    { nome: 'Gerson "Geromel" Lima', camisa_posicao: 2, pago: 1, categoria_id: 1 },
    { nome: 'Thiago "Bebeto" Rocha', camisa_posicao: 2, pago: 1, categoria_id: 1 },
    { nome: 'Marcelo "Trator" Barbosa', camisa_posicao: 2, pago: 1, categoria_id: 1 },
    { nome: 'Bruno "Xerife" Martins', camisa_posicao: 2, pago: 1, categoria_id: 1 },
    { nome: 'Diego "Parede" Ramos', camisa_posicao: 2, pago: 0, categoria_id: 1 },
    { nome: 'Igor "Marreta" Castro', camisa_posicao: 2, pago: 1, categoria_id: 1 },

    // Camisa 3: Laterais (6)
    { nome: 'Felipe "Cafu" Almeida', camisa_posicao: 3, pago: 1, categoria_id: 1 },
    { nome: 'Renan "Roberto Carlos" Pires', camisa_posicao: 3, pago: 1, categoria_id: 1 },
    { nome: 'Alexandre "Flecha" Duarte', camisa_posicao: 3, pago: 1, categoria_id: 1 },
    { nome: 'Guilherme "Corisco" Ribeiro', camisa_posicao: 3, pago: 1, categoria_id: 1 },
    { nome: 'Vinicius "Turbina" Araujo', camisa_posicao: 3, pago: 1, categoria_id: 1 },
    { nome: 'Fabio "Asa" Fernandes', camisa_posicao: 3, pago: 0, categoria_id: 1 },

    // Camisa 4: Meias/Volantes (12)
    { nome: 'Luciano "Maestro" Nunes', camisa_posicao: 4, pago: 1, categoria_id: 1 },
    { nome: 'Rafael "Mágico" Carvalho', camisa_posicao: 4, pago: 1, categoria_id: 1 },
    { nome: 'Daniel "Pirlo" Mendes', camisa_posicao: 4, pago: 1, categoria_id: 1 },
    { nome: 'Arthur "Camisa 10" Vieira', camisa_posicao: 4, pago: 1, categoria_id: 1 },
    { nome: 'Eduardo "Cérebro" Lopes', camisa_posicao: 4, pago: 1, categoria_id: 1 },
    { nome: 'Caio "Motorzinho" Marques', camisa_posicao: 4, pago: 1, categoria_id: 1 },
    { nome: 'Henrique "Cão de Fila" Dias', camisa_posicao: 4, pago: 0, categoria_id: 1 },
    { nome: 'Sandro "Passe Certo" Teixeira', camisa_posicao: 4, pago: 1, categoria_id: 1 },
    { nome: 'Samuel "Organizador" Farias', camisa_posicao: 4, pago: 1, categoria_id: 1 },
    { nome: 'Vitor "Visão da Quadra" Franco', camisa_posicao: 4, pago: 1, categoria_id: 1 },
    { nome: 'Ramon "Ritmo" Freitas', camisa_posicao: 4, pago: 1, categoria_id: 1 },
    { nome: 'Otavio "Garçom" Campos', camisa_posicao: 4, pago: 1, categoria_id: 1 },

    // Camisa 5: Pivôs/Atacantes (12)
    { nome: 'Matheus "Ronaldo" Silveira', camisa_posicao: 5, pago: 1, categoria_id: 1 },
    { nome: 'Breno "Matador" Santana', camisa_posicao: 5, pago: 1, categoria_id: 1 },
    { nome: 'Leandro "Canhão" Pinheiro', camisa_posicao: 5, pago: 1, categoria_id: 1 },
    { nome: 'Wesley "Artilheiro" Moraes', camisa_posicao: 5, pago: 1, categoria_id: 1 },
    { nome: 'Adriano "Imperador da Quadra"', camisa_posicao: 5, pago: 1, categoria_id: 1 },
    { nome: 'Davi "Tiro Certo" Cardozo', camisa_posicao: 5, pago: 0, categoria_id: 1 },
    { nome: 'Erick "Gaveta" Machado', camisa_posicao: 5, pago: 1, categoria_id: 1 },
    { nome: 'Hugo "Sem Piedade" Nogueira', camisa_posicao: 5, pago: 1, categoria_id: 1 },
    { nome: 'Yuri "Faro de Gol" Aguiar', camisa_posicao: 5, pago: 1, categoria_id: 1 },
    { nome: 'Luan "Chute Forte" Sobral', camisa_posicao: 5, pago: 1, categoria_id: 1 },
    { nome: 'Murilo "Pedrada" Guimarães', camisa_posicao: 5, pago: 1, categoria_id: 1 },
    { nome: 'Enzo "Relâmpago" Rezende', camisa_posicao: 5, pago: 1, categoria_id: 1 },

    // Camisa 6: Coringa / Reservas (6)
    { nome: 'Tales "Reserva Moral" Batista', camisa_posicao: 6, pago: 1, categoria_id: 1 },
    { nome: 'Neymar "Sósia" Peixoto', camisa_posicao: 6, pago: 1, categoria_id: 1 },
    { nome: 'Cássio "Multifunção" Paiva', camisa_posicao: 6, pago: 1, categoria_id: 1 },
    { nome: 'Talles "Gás Novo" Prado', camisa_posicao: 6, pago: 1, categoria_id: 1 },
    { nome: 'Sérgio "Coringa" Leite', camisa_posicao: 6, pago: 1, categoria_id: 1 },
    { nome: 'André "Sem Fôlego" Neves', camisa_posicao: 6, pago: 0, categoria_id: 1 },

    // --- CATEGORIA 2: VETERANOS (4 times x 7 = 28 jogadores) ---
    { nome: 'Mário "Paredão 40+"', camisa_posicao: 1, pago: 1, categoria_id: 2 },
    { nome: 'Milton "Gato Preto"', camisa_posicao: 1, pago: 1, categoria_id: 2 },
    { nome: 'Sebastião "Elasticidade"', camisa_posicao: 1, pago: 1, categoria_id: 2 },
    { nome: 'Gerson "Velha Guarda Goleiro"', camisa_posicao: 1, pago: 1, categoria_id: 2 },

    { nome: 'Valdir "Xerifão 40"', camisa_posicao: 2, pago: 1, categoria_id: 2 },
    { nome: 'Marcos "Chefe da Zaga"', camisa_posicao: 2, pago: 1, categoria_id: 2 },
    { nome: 'Roberto "Corta Vento"', camisa_posicao: 2, pago: 1, categoria_id: 2 },
    { nome: 'Paulo "Sem Falhas"', camisa_posicao: 2, pago: 1, categoria_id: 2 },

    { nome: 'Ademir "Driblador"', camisa_posicao: 4, pago: 1, categoria_id: 2 },
    { nome: 'Edilson "Toque de Classe"', camisa_posicao: 4, pago: 1, categoria_id: 2 },
    { nome: 'Vanderlei "Chuva de Passes"', camisa_posicao: 4, pago: 1, categoria_id: 2 },
    { nome: 'Cláudio "Maestro Master"', camisa_posicao: 4, pago: 1, categoria_id: 2 },

    { nome: 'Ronaldo "Fenômeno Veterano"', camisa_posicao: 5, pago: 1, categoria_id: 2 },
    { nome: 'Cícero "Matador do Asfalto"', camisa_posicao: 5, pago: 1, categoria_id: 2 },
    { nome: 'Gildásio "Chute de Curva"', camisa_posicao: 5, pago: 1, categoria_id: 2 },
    { nome: 'Aloísio "Chulapa do Society"', camisa_posicao: 5, pago: 1, categoria_id: 2 },

    // --- CATEGORIA 4: FEMININO (4 times x 7 = 28 jogadoras) ---
    { nome: 'Marta "Rainha" Silva', camisa_posicao: 5, pago: 1, categoria_id: 4 },
    { nome: 'Formiga "Motorzinho"', camisa_posicao: 4, pago: 1, categoria_id: 4 },
    { nome: 'Cristiane "Matadora"', camisa_posicao: 5, pago: 1, categoria_id: 4 },
    { nome: 'Bárbara "Muralha do Gol"', camisa_posicao: 1, pago: 1, categoria_id: 4 },
    { nome: 'Tamires "Lateralço"', camisa_posicao: 3, pago: 1, categoria_id: 4 },
    { nome: 'Debinha "Liso Dribles"', camisa_posicao: 5, pago: 1, categoria_id: 4 },
    { nome: 'Andressa "Maestrina"', camisa_posicao: 4, pago: 1, categoria_id: 4 },
    { nome: 'Luciana "Defensora Mor"', camisa_posicao: 1, pago: 1, categoria_id: 4 },
    { nome: 'Rafaelle "Líder Zaga"', camisa_posicao: 2, pago: 1, categoria_id: 4 },
    { nome: 'Ary "Visão Espacial"', camisa_posicao: 4, pago: 1, categoria_id: 4 },
    { nome: 'Kerolin "Velocidade Max"', camisa_posicao: 3, pago: 1, categoria_id: 4 },
    { nome: 'Leticia "Aérea"', camisa_posicao: 1, pago: 1, categoria_id: 4 },
  ],
};
