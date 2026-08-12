import React from 'react';
import { EventoPartida, Jogador, Partida } from '../types';

interface SumulaA4PrintDocumentProps {
  match: Partida;
  mandanteRoster: Jogador[];
  visitanteRoster: Jogador[];
  events: EventoPartida[];
  categoryName?: string;
}

export const SumulaA4PrintDocument: React.FC<SumulaA4PrintDocumentProps> = ({
  match,
  mandanteRoster,
  visitanteRoster,
  events,
  categoryName = 'Campeonato Arena Romano',
}) => {
  const matchMinutes = Math.floor((match.tempo_decorrido_segundos || 0) / 60);

  return (
    <div className="w-full bg-white text-black font-sans p-6 text-xs leading-tight border border-gray-300 print:border-none print:p-0 select-text">
      {/* Header Banner */}
      <div className="border-b-2 border-black pb-3 mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-black text-white rounded-lg flex items-center justify-center font-black text-xl border border-black">
            AR
          </div>
          <div>
            <h1 className="text-base font-black uppercase tracking-tight text-black">
              ARENA ROMANO SOCIETY
            </h1>
            <p className="text-[11px] font-bold uppercase text-gray-800">
              Súmula Oficial de Jogo • {categoryName}
            </p>
          </div>
        </div>
        <div className="text-right text-[10px] font-mono font-bold space-y-0.5">
          <p className="text-xs font-black text-black">SÚMULA Nº #{match.id}</p>
          <p className="text-gray-700">FASE: {match.fase_nome.toUpperCase()}</p>
          <p className="text-gray-700">RODADA: {match.rodada}ª RODADA</p>
          <p className="text-gray-700">STATUS: {match.status}</p>
        </div>
      </div>

      {/* Info Bar */}
      <div className="grid grid-cols-4 gap-2 bg-gray-100 p-2 border border-gray-300 rounded mb-4 text-[10px] font-bold">
        <div>
          <span className="text-gray-500 uppercase block font-mono text-[9px]">Data / Horário:</span>
          <span>{match.data_hora || '___/___/2026 às ____:____'}</span>
        </div>
        <div>
          <span className="text-gray-500 uppercase block font-mono text-[9px]">Local:</span>
          <span>Campo 1 - Arena Romano</span>
        </div>
        <div>
          <span className="text-gray-500 uppercase block font-mono text-[9px]">Chave / Grupo:</span>
          <span>Grupo {match.grupo || 'A'}</span>
        </div>
        <div>
          <span className="text-gray-500 uppercase block font-mono text-[9px]">Tempo Decorrido:</span>
          <span>{matchMinutes} minutos</span>
        </div>
      </div>

      {/* Scoreboard Box */}
      <div className="border-2 border-black rounded p-3 mb-4 bg-gray-50 text-center">
        <div className="grid grid-cols-3 items-center">
          {/* Mandante */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">MANDANTE</span>
            <span className="text-sm font-black uppercase text-black max-w-[180px] truncate">
              {match.time_mandante_nome}
            </span>
          </div>

          {/* Placar Big */}
          <div className="flex flex-col items-center">
            <div className="inline-flex items-center space-x-3 bg-black text-white px-4 py-1.5 rounded text-2xl font-black font-mono">
              <span>{match.gols_mandante}</span>
              <span className="text-gray-400 text-lg">x</span>
              <span>{match.gols_visitante}</span>
            </div>
            <span className="text-[9px] font-mono text-gray-600 mt-1 uppercase font-bold">
              Placar Final / Em Andamento
            </span>
          </div>

          {/* Visitante */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">VISITANTE</span>
            <span className="text-sm font-black uppercase text-black max-w-[180px] truncate">
              {match.time_visitante_nome}
            </span>
          </div>
        </div>
      </div>

      {/* Rosters Section - 2 Columns */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Mandante Roster */}
        <div className="border border-black rounded p-2 bg-white">
          <div className="bg-black text-white px-2 py-1 text-[11px] font-black uppercase flex justify-between items-center mb-1.5 rounded-sm">
            <span>MANDANTE: {match.time_mandante_nome}</span>
            <span className="font-mono text-[10px]">GOLS: {match.gols_mandante}</span>
          </div>
          <table className="w-full text-left text-[10px] border-collapse">
            <thead>
              <tr className="border-b border-black bg-gray-200 font-bold uppercase text-[9px]">
                <th className="p-1 w-6 text-center">Nº</th>
                <th className="p-1">Nome do Jogador</th>
                <th className="p-1 w-8 text-center">Gol</th>
                <th className="p-1 w-6 text-center">🟨</th>
                <th className="p-1 w-6 text-center">🟥</th>
                <th className="p-1 w-20 text-center">Visto/Ass.</th>
              </tr>
            </thead>
            <tbody>
              {mandanteRoster.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-2 text-center text-gray-500 italic">
                    Nenhum jogador inscrito.
                  </td>
                </tr>
              ) : (
                mandanteRoster.map((p) => (
                  <tr key={p.id} className="border-b border-gray-200">
                    <td className="p-1 font-mono font-bold text-center border-r border-gray-200">{p.camisa_posicao}</td>
                    <td className="p-1 font-semibold truncate max-w-[110px]">{p.nome}</td>
                    <td className="p-1 font-mono text-center font-bold border-l border-gray-200">{p.gols || 0}</td>
                    <td className="p-1 font-mono text-center border-l border-gray-200">{p.cartoes_amarelos || 0}</td>
                    <td className="p-1 font-mono text-center border-l border-gray-200">{p.cartoes_vermelhos || 0}</td>
                    <td className="p-1 border-l border-gray-200">
                      <div className="border-b border-gray-400 w-full h-3"></div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Visitante Roster */}
        <div className="border border-black rounded p-2 bg-white">
          <div className="bg-black text-white px-2 py-1 text-[11px] font-black uppercase flex justify-between items-center mb-1.5 rounded-sm">
            <span>VISITANTE: {match.time_visitante_nome}</span>
            <span className="font-mono text-[10px]">GOLS: {match.gols_visitante}</span>
          </div>
          <table className="w-full text-left text-[10px] border-collapse">
            <thead>
              <tr className="border-b border-black bg-gray-200 font-bold uppercase text-[9px]">
                <th className="p-1 w-6 text-center">Nº</th>
                <th className="p-1">Nome do Jogador</th>
                <th className="p-1 w-8 text-center">Gol</th>
                <th className="p-1 w-6 text-center">🟨</th>
                <th className="p-1 w-6 text-center">🟥</th>
                <th className="p-1 w-20 text-center">Visto/Ass.</th>
              </tr>
            </thead>
            <tbody>
              {visitanteRoster.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-2 text-center text-gray-500 italic">
                    Nenhum jogador inscrito.
                  </td>
                </tr>
              ) : (
                visitanteRoster.map((p) => (
                  <tr key={p.id} className="border-b border-gray-200">
                    <td className="p-1 font-mono font-bold text-center border-r border-gray-200">{p.camisa_posicao}</td>
                    <td className="p-1 font-semibold truncate max-w-[110px]">{p.nome}</td>
                    <td className="p-1 font-mono text-center font-bold border-l border-gray-200">{p.gols || 0}</td>
                    <td className="p-1 font-mono text-center border-l border-gray-200">{p.cartoes_amarelos || 0}</td>
                    <td className="p-1 font-mono text-center border-l border-gray-200">{p.cartoes_vermelhos || 0}</td>
                    <td className="p-1 border-l border-gray-200">
                      <div className="border-b border-gray-400 w-full h-3"></div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Events Timeline Log */}
      <div className="border border-black rounded p-2 mb-4 bg-white">
        <div className="bg-gray-200 text-black px-2 py-1 text-[10px] font-black uppercase mb-1.5 border-b border-black flex justify-between">
          <span>RELATÓRIO DE EVENTOS DA PARTIDA ({events.length} REGISTROS)</span>
          <span className="font-mono text-[9px]">CRONOLOGIA DIGITAL</span>
        </div>
        {events.length === 0 ? (
          <div className="p-2 text-center text-gray-500 italic text-[10px]">
            Nenhum evento registrado digitalmente.
          </div>
        ) : (
          <table className="w-full text-left text-[10px] border-collapse">
            <thead>
              <tr className="border-b border-gray-400 bg-gray-100 font-bold uppercase text-[9px]">
                <th className="p-1 w-12 text-center">Minuto</th>
                <th className="p-1 w-28">Equipe</th>
                <th className="p-1">Atleta</th>
                <th className="p-1 w-36 text-center">Tipo de Evento</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-gray-200">
                  <td className="p-1 font-mono font-bold text-center border-r border-gray-200">{ev.minuto_jogo}'</td>
                  <td className="p-1 font-bold border-r border-gray-200">{ev.time_nome}</td>
                  <td className="p-1 font-semibold">{ev.jogador_nome}</td>
                  <td className="p-1 font-bold text-center border-l border-gray-200 uppercase text-[9px]">
                    {ev.tipo_evento === 'GOL' && '⚽ GOL'}
                    {ev.tipo_evento === 'CARTAO_AMARELO' && '🟨 CARTÃO AMARELO'}
                    {ev.tipo_evento === 'CARTAO_VERMELHO' && '🟥 CARTÃO VERMELHO'}
                    {ev.tipo_evento === 'DESTAQUE' && '⭐ CRAQUE DO JOGO'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Observations Box */}
      <div className="border border-black rounded p-2.5 mb-6 bg-white space-y-1">
        <span className="text-[10px] font-black uppercase text-black block">
          OBSERVAÇÕES DA ARBITRAGEM / RELATÓRIO DISCIPLINAR:
        </span>
        <div className="border-b border-gray-300 h-4"></div>
        <div className="border-b border-gray-300 h-4"></div>
        <div className="border-b border-gray-300 h-4"></div>
      </div>

      {/* Signatures Grid */}
      <div className="grid grid-cols-4 gap-4 text-center pt-4 border-t border-gray-400">
        <div>
          <div className="border-b border-black mb-1 w-3/4 mx-auto"></div>
          <span className="text-[9px] font-black uppercase block">ÁRBITRO PRINCIPAL</span>
          <span className="text-[8px] text-gray-500 font-mono block">Assinatura</span>
        </div>
        <div>
          <div className="border-b border-black mb-1 w-3/4 mx-auto"></div>
          <span className="text-[9px] font-black uppercase block">MESÁRIO / ANOTADOR</span>
          <span className="text-[8px] text-gray-500 font-mono block">Assinatura</span>
        </div>
        <div>
          <div className="border-b border-black mb-1 w-3/4 mx-auto"></div>
          <span className="text-[9px] font-black uppercase block">CAPITÃO MANDANTE</span>
          <span className="text-[8px] text-gray-500 font-mono block">{match.time_mandante_nome}</span>
        </div>
        <div>
          <div className="border-b border-black mb-1 w-3/4 mx-auto"></div>
          <span className="text-[9px] font-black uppercase block">CAPITÃO VISITANTE</span>
          <span className="text-[8px] text-gray-500 font-mono block">{match.time_visitante_nome}</span>
        </div>
      </div>
    </div>
  );
};
