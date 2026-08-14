/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CountryInfo {
  code: string;
  name: string;
  emoji: string;
  flagUrl: string;
  primaryColor: string;
  secondaryColor?: string;
  continent: 'América do Sul' | 'Europa' | 'América do Norte/Central' | 'África' | 'Ásia & Oceania';
}

export const COUNTRIES: CountryInfo[] = [
  // América do Sul
  { code: 'BR', name: 'Brasil', emoji: '🇧🇷', flagUrl: 'https://flagcdn.com/w160/br.png', primaryColor: '#009B3A', secondaryColor: '#FFDF00', continent: 'América do Sul' },
  { code: 'AR', name: 'Argentina', emoji: '🇦🇷', flagUrl: 'https://flagcdn.com/w160/ar.png', primaryColor: '#74ACDF', secondaryColor: '#FFFFFF', continent: 'América do Sul' },
  { code: 'UY', name: 'Uruguai', emoji: '🇺🇾', flagUrl: 'https://flagcdn.com/w160/uy.png', primaryColor: '#0038A8', secondaryColor: '#FFFFFF', continent: 'América do Sul' },
  { code: 'CO', name: 'Colômbia', emoji: '🇨🇴', flagUrl: 'https://flagcdn.com/w160/co.png', primaryColor: '#FCD116', secondaryColor: '#003893', continent: 'América do Sul' },
  { code: 'CL', name: 'Chile', emoji: '🇨🇱', flagUrl: 'https://flagcdn.com/w160/cl.png', primaryColor: '#D52B1E', secondaryColor: '#0039A6', continent: 'América do Sul' },
  { code: 'PE', name: 'Peru', emoji: '🇵🇪', flagUrl: 'https://flagcdn.com/w160/pe.png', primaryColor: '#D91023', secondaryColor: '#FFFFFF', continent: 'América do Sul' },
  { code: 'EC', name: 'Equador', emoji: '🇪🇨', flagUrl: 'https://flagcdn.com/w160/ec.png', primaryColor: '#FFD100', secondaryColor: '#003893', continent: 'América do Sul' },
  { code: 'PY', name: 'Paraguai', emoji: '🇵🇾', flagUrl: 'https://flagcdn.com/w160/py.png', primaryColor: '#D52B1E', secondaryColor: '#0038A8', continent: 'América do Sul' },
  { code: 'VE', name: 'Venezuela', emoji: '🇻🇪', flagUrl: 'https://flagcdn.com/w160/ve.png', primaryColor: '#7A1C30', secondaryColor: '#FFCC00', continent: 'América do Sul' },
  { code: 'BO', name: 'Bolívia', emoji: '🇧🇴', flagUrl: 'https://flagcdn.com/w160/bo.png', primaryColor: '#007934', secondaryColor: '#D52B1E', continent: 'América do Sul' },

  // Europa
  { code: 'DE', name: 'Alemanha', emoji: '🇩🇪', flagUrl: 'https://flagcdn.com/w160/de.png', primaryColor: '#18181B', secondaryColor: '#FFCC00', continent: 'Europa' },
  { code: 'FR', name: 'França', emoji: '🇫🇷', flagUrl: 'https://flagcdn.com/w160/fr.png', primaryColor: '#002395', secondaryColor: '#ED2939', continent: 'Europa' },
  { code: 'ES', name: 'Espanha', emoji: '🇪🇸', flagUrl: 'https://flagcdn.com/w160/es.png', primaryColor: '#C60B1E', secondaryColor: '#FFC400', continent: 'Europa' },
  { code: 'IT', name: 'Itália', emoji: '🇮🇹', flagUrl: 'https://flagcdn.com/w160/it.png', primaryColor: '#0064AA', secondaryColor: '#008C45', continent: 'Europa' },
  { code: 'PT', name: 'Portugal', emoji: '🇵🇹', flagUrl: 'https://flagcdn.com/w160/pt.png', primaryColor: '#046A38', secondaryColor: '#DA291C', continent: 'Europa' },
  { code: 'NL', name: 'Holanda (Países Baixos)', emoji: '🇳🇱', flagUrl: 'https://flagcdn.com/w160/nl.png', primaryColor: '#FF4F00', secondaryColor: '#21468B', continent: 'Europa' },
  { code: 'GB', name: 'Inglaterra', emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', flagUrl: 'https://flagcdn.com/w160/gb-eng.png', primaryColor: '#CE1126', secondaryColor: '#FFFFFF', continent: 'Europa' },
  { code: 'BE', name: 'Bélgica', emoji: '🇧🇪', flagUrl: 'https://flagcdn.com/w160/be.png', primaryColor: '#ED2939', secondaryColor: '#000000', continent: 'Europa' },
  { code: 'HR', name: 'Croácia', emoji: '🇭🇷', flagUrl: 'https://flagcdn.com/w160/hr.png', primaryColor: '#FF0000', secondaryColor: '#171796', continent: 'Europa' },
  { code: 'SE', name: 'Suécia', emoji: '🇸🇪', flagUrl: 'https://flagcdn.com/w160/se.png', primaryColor: '#006AA7', secondaryColor: '#FECC00', continent: 'Europa' },
  { code: 'CH', name: 'Suíça', emoji: '🇨🇭', flagUrl: 'https://flagcdn.com/w160/ch.png', primaryColor: '#D52B1E', secondaryColor: '#FFFFFF', continent: 'Europa' },
  { code: 'DK', name: 'Dinamarca', emoji: '🇩🇰', flagUrl: 'https://flagcdn.com/w160/dk.png', primaryColor: '#C8102E', secondaryColor: '#FFFFFF', continent: 'Europa' },
  { code: 'NO', name: 'Noruega', emoji: '🇳🇴', flagUrl: 'https://flagcdn.com/w160/no.png', primaryColor: '#BA0C2F', secondaryColor: '#00205B', continent: 'Europa' },
  { code: 'PL', name: 'Polônia', emoji: '🇵🇱', flagUrl: 'https://flagcdn.com/w160/pl.png', primaryColor: '#DC143C', secondaryColor: '#FFFFFF', continent: 'Europa' },
  { code: 'TR', name: 'Turquia', emoji: '🇹🇷', flagUrl: 'https://flagcdn.com/w160/tr.png', primaryColor: '#E30A17', secondaryColor: '#FFFFFF', continent: 'Europa' },
  { code: 'GR', name: 'Grécia', emoji: '🇬🇷', flagUrl: 'https://flagcdn.com/w160/gr.png', primaryColor: '#0D5EAF', secondaryColor: '#FFFFFF', continent: 'Europa' },
  { code: 'AT', name: 'Áustria', emoji: '🇦🇹', flagUrl: 'https://flagcdn.com/w160/at.png', primaryColor: '#ED2939', secondaryColor: '#FFFFFF', continent: 'Europa' },
  { code: 'CZ', name: 'Tchéquia', emoji: '🇨🇿', flagUrl: 'https://flagcdn.com/w160/cz.png', primaryColor: '#11457E', secondaryColor: '#D7141A', continent: 'Europa' },
  { code: 'RS', name: 'Sérvia', emoji: '🇷🇸', flagUrl: 'https://flagcdn.com/w160/rs.png', primaryColor: '#C6363C', secondaryColor: '#0C4076', continent: 'Europa' },
  { code: 'IE', name: 'Irlanda', emoji: '🇮🇪', flagUrl: 'https://flagcdn.com/w160/ie.png', primaryColor: '#169B62', secondaryColor: '#FF883E', continent: 'Europa' },
  { code: 'IS', name: 'Islândia', emoji: '🇮🇸', flagUrl: 'https://flagcdn.com/w160/is.png', primaryColor: '#02529C', secondaryColor: '#DC1E35', continent: 'Europa' },
  { code: 'UA', name: 'Ucrânia', emoji: '🇺🇦', flagUrl: 'https://flagcdn.com/w160/ua.png', primaryColor: '#005BBB', secondaryColor: '#FFD500', continent: 'Europa' },
  { code: 'RO', name: 'Romênia', emoji: '🇷🇴', flagUrl: 'https://flagcdn.com/w160/ro.png', primaryColor: '#002B7F', secondaryColor: '#FCD116', continent: 'Europa' },
  { code: 'HU', name: 'Hungria', emoji: '🇭🇺', flagUrl: 'https://flagcdn.com/w160/hu.png', primaryColor: '#CE2939', secondaryColor: '#477050', continent: 'Europa' },

  // América do Norte e Central
  { code: 'US', name: 'Estados Unidos', emoji: '🇺🇸', flagUrl: 'https://flagcdn.com/w160/us.png', primaryColor: '#0A3161', secondaryColor: '#B31942', continent: 'América do Norte/Central' },
  { code: 'MX', name: 'México', emoji: '🇲🇽', flagUrl: 'https://flagcdn.com/w160/mx.png', primaryColor: '#006847', secondaryColor: '#CE1126', continent: 'América do Norte/Central' },
  { code: 'CA', name: 'Canadá', emoji: '🇨🇦', flagUrl: 'https://flagcdn.com/w160/ca.png', primaryColor: '#C8102E', secondaryColor: '#FFFFFF', continent: 'América do Norte/Central' },
  { code: 'CR', name: 'Costa Rica', emoji: '🇨🇷', flagUrl: 'https://flagcdn.com/w160/cr.png', primaryColor: '#002B7F', secondaryColor: '#CE1126', continent: 'América do Norte/Central' },
  { code: 'PA', name: 'Panamá', emoji: '🇵🇦', flagUrl: 'https://flagcdn.com/w160/pa.png', primaryColor: '#DA121A', secondaryColor: '#072357', continent: 'América do Norte/Central' },
  { code: 'JM', name: 'Jamaica', emoji: '🇯🇲', flagUrl: 'https://flagcdn.com/w160/jm.png', primaryColor: '#009B3A', secondaryColor: '#FED100', continent: 'América do Norte/Central' },

  // África
  { code: 'SN', name: 'Senegal', emoji: '🇸🇳', flagUrl: 'https://flagcdn.com/w160/sn.png', primaryColor: '#00853F', secondaryColor: '#FDEF42', continent: 'África' },
  { code: 'MA', name: 'Marrocos', emoji: '🇲🇦', flagUrl: 'https://flagcdn.com/w160/ma.png', primaryColor: '#C1272D', secondaryColor: '#006233', continent: 'África' },
  { code: 'CM', name: 'Camarões', emoji: '🇨🇲', flagUrl: 'https://flagcdn.com/w160/cm.png', primaryColor: '#007A5E', secondaryColor: '#CE1126', continent: 'África' },
  { code: 'GH', name: 'Gana', emoji: '🇬🇭', flagUrl: 'https://flagcdn.com/w160/gh.png', primaryColor: '#006B3F', secondaryColor: '#FCD116', continent: 'África' },
  { code: 'NG', name: 'Nigéria', emoji: '🇳🇬', flagUrl: 'https://flagcdn.com/w160/ng.png', primaryColor: '#008751', secondaryColor: '#FFFFFF', continent: 'África' },
  { code: 'EG', name: 'Egito', emoji: '🇪🇬', flagUrl: 'https://flagcdn.com/w160/eg.png', primaryColor: '#C09300', secondaryColor: '#CE1126', continent: 'África' },
  { code: 'ZA', name: 'África do Sul', emoji: '🇿🇦', flagUrl: 'https://flagcdn.com/w160/za.png', primaryColor: '#007749', secondaryColor: '#FFB81C', continent: 'África' },
  { code: 'DZ', name: 'Argélia', emoji: '🇩🇿', flagUrl: 'https://flagcdn.com/w160/dz.png', primaryColor: '#006633', secondaryColor: '#D21034', continent: 'África' },
  { code: 'TN', name: 'Tunísia', emoji: '🇹🇳', flagUrl: 'https://flagcdn.com/w160/tn.png', primaryColor: '#E70013', secondaryColor: '#FFFFFF', continent: 'África' },
  { code: 'CI', name: 'Costa do Marfim', emoji: '🇨🇮', flagUrl: 'https://flagcdn.com/w160/ci.png', primaryColor: '#F77F00', secondaryColor: '#009E60', continent: 'África' },

  // Ásia & Oceania
  { code: 'JP', name: 'Japão', emoji: '🇯🇵', flagUrl: 'https://flagcdn.com/w160/jp.png', primaryColor: '#002B7F', secondaryColor: '#BC002D', continent: 'Ásia & Oceania' },
  { code: 'KR', name: 'Coreia do Sul', emoji: '🇰🇷', flagUrl: 'https://flagcdn.com/w160/kr.png', primaryColor: '#CD2E3A', secondaryColor: '#0047A0', continent: 'Ásia & Oceania' },
  { code: 'AU', name: 'Austrália', emoji: '🇦🇺', flagUrl: 'https://flagcdn.com/w160/au.png', primaryColor: '#00843D', secondaryColor: '#FFCD00', continent: 'Ásia & Oceania' },
  { code: 'SA', name: 'Arábia Saudita', emoji: '🇸🇦', flagUrl: 'https://flagcdn.com/w160/sa.png', primaryColor: '#006C35', secondaryColor: '#FFFFFF', continent: 'Ásia & Oceania' },
  { code: 'NZ', name: 'Nova Zelândia', emoji: '🇳🇿', flagUrl: 'https://flagcdn.com/w160/nz.png', primaryColor: '#000000', secondaryColor: '#FFFFFF', continent: 'Ásia & Oceania' },
  { code: 'CN', name: 'China', emoji: '🇨🇳', flagUrl: 'https://flagcdn.com/w160/cn.png', primaryColor: '#DE2910', secondaryColor: '#FFDE00', continent: 'Ásia & Oceania' },
  { code: 'QA', name: 'Catar', emoji: '🇶🇦', flagUrl: 'https://flagcdn.com/w160/qa.png', primaryColor: '#8D1B3D', secondaryColor: '#FFFFFF', continent: 'Ásia & Oceania' }
];

export function findCountryByCodeOrName(queryStr?: string | null): CountryInfo | undefined {
  if (!queryStr) return undefined;
  const clean = queryStr.trim().toLowerCase();

  return COUNTRIES.find(
    (c) =>
      c.code.toLowerCase() === clean ||
      c.name.toLowerCase() === clean ||
      c.emoji === queryStr.trim() ||
      c.flagUrl === queryStr.trim()
  );
}

export function getCountryFlagUrl(code: string): string {
  const c = COUNTRIES.find((item) => item.code.toUpperCase() === code.toUpperCase());
  return c ? c.flagUrl : `https://flagcdn.com/w160/${code.toLowerCase()}.png`;
}
