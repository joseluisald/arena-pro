/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { findCountryByCodeOrName, getCountryFlagUrl } from '../data/countries';

export function isImageUrl(str?: string | null): boolean {
  if (!str) return false;
  const s = str.trim();
  if (
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('data:image/') ||
    s.startsWith('blob:') ||
    s.startsWith('/') ||
    s.startsWith('./') ||
    s.startsWith('flag:')
  ) {
    return true;
  }
  return /\.(png|jpg|jpeg|svg|webp|gif|ico)(\?.*)?$/i.test(s);
}

interface TeamBadgeProps {
  badge?: string | null;
  name?: string;
  className?: string;
  imgClassName?: string;
  style?: React.CSSProperties;
  fallbackEmoji?: string;
}

export const TeamBadge: React.FC<TeamBadgeProps> = ({
  badge,
  name,
  className = '',
  imgClassName = 'w-full h-full object-cover rounded-md',
  style,
  fallbackEmoji = '🛡️',
}) => {
  const [imgError, setImgError] = useState(false);

  if (!badge || !badge.trim()) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 ${className}`}
        style={style}
      >
        {fallbackEmoji}
      </span>
    );
  }

  const clean = badge.trim();

  // Handle flag:CODE prefix
  let resolvedUrl: string | null = null;
  if (clean.startsWith('flag:')) {
    const code = clean.replace('flag:', '').trim();
    resolvedUrl = getCountryFlagUrl(code);
  } else if (isImageUrl(clean)) {
    resolvedUrl = clean;
  } else {
    // Check if it matches a known country
    const country = findCountryByCodeOrName(clean);
    if (country) {
      resolvedUrl = country.flagUrl;
    }
  }

  if (resolvedUrl && !imgError) {
    return (
      <span
        className={`inline-flex items-center justify-center overflow-hidden shrink-0 shadow-sm ${className}`}
        style={style}
      >
        <img
          src={resolvedUrl}
          alt={name || 'Brasão ou bandeira'}
          className={imgClassName}
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      style={style}
    >
      {clean || fallbackEmoji}
    </span>
  );
};

