/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';

export function isImageUrl(str?: string | null): boolean {
  if (!str) return false;
  const s = str.trim();
  if (
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('data:image/') ||
    s.startsWith('blob:') ||
    s.startsWith('/') ||
    s.startsWith('./')
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
  imgClassName = 'w-full h-full object-contain p-0.5 rounded-lg',
  style,
  fallbackEmoji = '🛡️',
}) => {
  const [imgError, setImgError] = useState(false);

  if (badge && isImageUrl(badge) && !imgError) {
    return (
      <span
        className={`inline-flex items-center justify-center overflow-hidden shrink-0 ${className}`}
        style={style}
      >
        <img
          src={badge.trim()}
          alt={name || 'Brasão do time'}
          className={imgClassName}
          onError={() => setImgError(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      style={style}
    >
      {badge && badge.trim() ? badge.trim() : fallbackEmoji}
    </span>
  );
};
