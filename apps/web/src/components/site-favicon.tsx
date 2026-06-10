'use client';

import { useState } from 'react';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFaviconUrl } from '@/lib/favicon';

interface SiteFaviconProps {
  url: string;
  size?: 'sm' | 'md';
  fallbackClassName?: string;
  className?: string;
}

const SIZE = {
  sm: { px: 32, display: 'size-4', dimension: 16 },
  md: { px: 64, display: 'size-6', dimension: 24 },
} as const;

export function SiteFavicon({
  url,
  size = 'sm',
  fallbackClassName,
  className,
}: SiteFaviconProps) {
  const [failed, setFailed] = useState(false);
  const { px, display, dimension } = SIZE[size];
  const src = getFaviconUrl(url, px);

  if (!src || failed) {
    return (
      <Globe
        className={cn(display, 'shrink-0 text-muted-foreground', fallbackClassName, className)}
        aria-hidden
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={dimension}
      height={dimension}
      className={cn(display, 'shrink-0 rounded-sm object-contain', className)}
      onError={() => setFailed(true)}
    />
  );
}
