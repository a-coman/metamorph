'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, ChevronRight, ArrowDown, Globe, Clock, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/status-badge';
import { SiteFavicon } from '@/components/site-favicon';
import { api } from '@/lib/api';
import type { SessionListItemDto } from '@metamorph/api-client';

function formatDate(date: Date | string) {
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

function formatRelativeTime(date: Date | string) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

function parseUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      hostname: u.hostname,
      pathname: u.pathname === '/' ? '' : u.pathname,
    };
  } catch {
    return { hostname: url, pathname: '' };
  }
}

interface SessionListTableProps {
  initialItems: SessionListItemDto[];
  initialNextCursor?: string;
}

export function SessionListTable({ initialItems, initialNextCursor }: SessionListTableProps) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await api.listSessions({ limit: 20 });
      setItems(result.items);
      setNextCursor(result.nextCursor);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const result = await api.listSessions({ limit: 20, cursor: nextCursor });
      setItems((prev) => [...prev, ...result.items]);
      setNextCursor(result.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Folder className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            Recent Sessions
          </span>
          <span className="text-xs text-muted-foreground/60">({items.length})</span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={refresh}
          disabled={refreshing}
          className="interactive-ghost text-muted-foreground"
          title="Refresh sessions"
        >
          <RefreshCw className={refreshing ? 'animate-spin' : ''} />
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-border rounded-xl bg-muted/20">
          <div className="p-3 rounded-full bg-muted mb-3">
            <Globe className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No sessions yet</p>
          <p className="text-sm text-muted-foreground">Create your first session above to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((session) => {
            const { hostname, pathname } = parseUrl(session.url);
            return (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="interactive-card group flex items-center gap-4 px-4 py-3.5 rounded-xl border border-border bg-card shadow-sm cursor-pointer"
                title={session.url}
              >
                <div className="interactive-icon p-2 rounded-lg shrink-0">
                  <SiteFavicon url={session.url} size="sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-medium text-sm text-foreground truncate">
                      {hostname}
                    </span>
                    {pathname && (
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {pathname}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground" suppressHydrationWarning>
                      <Clock className="size-3" />
                      {formatRelativeTime(session.createdAt)}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                      {session.mode}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={session.status} />
                  <ChevronRight className="interactive-chevron size-4" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {nextCursor && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={loadingMore}
            className="gap-2 text-muted-foreground"
          >
            {loadingMore ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <ArrowDown className="size-3.5" />
            )}
            Load more sessions
          </Button>
        </div>
      )}
    </div>
  );
}

export function SessionListSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-7 w-7 rounded" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 rounded-xl border border-border bg-card shadow-sm">
            <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
