import Link from 'next/link';
import { Clock, ExternalLink } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import type { RunDetailsDto } from '@metamorph/api-client';

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(date));
}

function formatDuration(start: Date | string, end: Date | string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  return `${mins}m ${remainingSecs}s`;
}

function FinalUrlField({ label, url }: { label: string; url: string }) {
  return (
    <div className="grid grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-x-2 min-w-0">
      <span className="text-[11px] text-muted-foreground text-right truncate">{label}</span>
      <Link
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-1 min-w-0 text-[11px] text-primary hover:underline"
        title={url}
      >
        <span className="truncate">{url}</span>
        <ExternalLink className="size-3 shrink-0 opacity-50 group-hover:opacity-100" />
      </Link>
    </div>
  );
}

export function RunSummaryCard({
  run,
  isActive,
}: {
  run: RunDetailsDto;
  isActive: boolean;
}) {
  const hasUrls = Boolean(run.sourceFinalUrl || run.followUpFinalUrl);

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardContent className="pt-5 pb-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,360px)] lg:gap-x-8 lg:items-center">
          <div className="space-y-3 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-lg font-semibold tracking-tight font-mono">
                Run #{run.attempt}
              </h1>
              <StatusBadge status={run.status} />
              {run.verdictStrict && <StatusBadge status={run.verdictStrict} />}
              {isActive && (
                <span className="text-xs font-mono text-primary animate-pulse">● live</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-mono text-muted-foreground">
              <span>Started {formatDate(run.createdAt)}</span>
              {run.finishedAt && (
                <>
                  <span className="text-border select-none">·</span>
                  <span>Finished {formatDate(run.finishedAt)}</span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-foreground/70">
                    <Clock className="size-3" />
                    {formatDuration(run.createdAt, run.finishedAt)}
                  </span>
                </>
              )}
            </div>
          </div>

          {hasUrls && (
            <div className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5 space-y-1.5 lg:justify-self-end w-full">
              {run.sourceFinalUrl && (
                <FinalUrlField label="source_url" url={run.sourceFinalUrl} />
              )}
              {run.followUpFinalUrl && (
                <FinalUrlField label="follow_url" url={run.followUpFinalUrl} />
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
