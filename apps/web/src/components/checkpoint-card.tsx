'use client';

import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Play,
} from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { SlotStepLabel, type SlotStepLike } from '@/lib/format-slot-step';
import type { ExplorationCheckpointDto } from '@metamorph/api-client';

function formatActivityTime(value: Date | string): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function ActivityTimestamp({ value }: { value: Date | string }) {
  return (
    <span
      className="text-[11px] tabular-nums shrink-0 text-muted-foreground/60"
      title={new Date(value).toLocaleString(undefined, { hour12: false })}
    >
      {formatActivityTime(value)}
    </span>
  );
}

export function CheckpointTraceLink({ artifactId }: { artifactId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const { url } = await api.getArtifactUrl(artifactId);
      const viewerUrl = `https://trace.playwright.dev/?trace=${encodeURIComponent(url)}`;
      window.open(viewerUrl, '_blank', 'noopener,noreferrer');
    } catch {
      window.open(`/api/artifact-url/${artifactId}`, '_blank', 'noopener,noreferrer');
    } finally {
      setLoading(false);
    }
  }

  return (
    <a
      href="#"
      onClick={handleClick}
      aria-disabled={loading}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-all cursor-pointer',
        'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-sm',
        loading && 'opacity-60 pointer-events-none',
      )}
    >
      {loading ? (
        <Loader2 className="size-2.5 animate-spin" />
      ) : (
        <ExternalLink className="size-2.5" />
      )}
      View trace
    </a>
  );
}

export function CheckpointScreenshot({ snapshotId }: { snapshotId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .getPageSnapshot(snapshotId)
      .then(async (snap) => {
        const artifactId =
          snap.annotatedScreenshotArtifactId ?? snap.rawScreenshotArtifactId;
        if (!artifactId) return;
        const result = await api.getArtifactUrl(artifactId);
        setUrl(result.url);
      })
      .catch(() => setError(true));
  }, [snapshotId]);

  if (error) return null;
  if (!url) return <Skeleton className="w-full aspect-video rounded-md" />;

  return (
    <img
      src={url}
      alt="Page screenshot"
      className="w-full aspect-video object-cover object-top rounded-md border border-border"
      loading="lazy"
    />
  );
}

export function CheckpointSteps({ steps }: { steps: SlotStepLike[] }) {
  return (
    <div className="space-y-1 p-2.5 rounded-lg bg-muted/30 max-h-32 overflow-y-auto">
      <span className="text-xs font-medium text-muted-foreground">Steps executed:</span>
      {steps.map((step, i) => (
        <div
          key={i}
          className="text-xs font-mono text-muted-foreground flex items-start gap-2"
        >
          <span className="text-muted-foreground/50 w-4 shrink-0">{i + 1}.</span>
          <SlotStepLabel step={step} />
        </div>
      ))}
    </div>
  );
}

type CheckpointCardProps = {
  checkpoint: ExplorationCheckpointDto;
  isNew?: boolean;
  variant: 'timeline' | 'feed';
  index?: number;
  isLast?: boolean;
};

export function CheckpointCard({
  checkpoint,
  isNew,
  variant,
  index = 0,
  isLast,
}: CheckpointCardProps) {
  const [expanded, setExpanded] = useState(false);
  const steps = checkpoint.stepsJson as SlotStepLike[] | null;

  const verdictColors: Record<string, string> = {
    ok: 'bg-emerald-500',
    goal_reached: 'bg-primary',
    fail: 'bg-red-500',
    pending: 'bg-muted-foreground',
  };

  const toggle = () => setExpanded((v) => !v);

  const cardBody = (
    <div
      className={cn(
        'rounded-xl border bg-card shadow-sm transition-all duration-300',
        variant === 'timeline' && 'flex-1 mb-2',
        variant === 'feed' && 'interactive-card',
        isNew
          ? 'border-primary/50 shadow-lg shadow-primary/5 animate-fade-in'
          : 'border-border',
        variant === 'timeline' && !isNew && 'interactive-card',
      )}
    >
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'w-full flex items-start gap-3 text-left cursor-pointer',
          variant === 'timeline' ? 'px-4 py-3' : 'px-3 py-2.5',
        )}
      >
        {variant === 'feed' && (
          <div className="p-1.5 rounded-md shrink-0 bg-emerald-100 text-emerald-600">
            <Play className="size-3.5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'font-medium text-foreground',
                variant === 'timeline' ? 'text-xs text-muted-foreground' : 'text-sm',
              )}
            >
              {variant === 'timeline' ? `#${index + 1}` : `Checkpoint #${checkpoint.sequence}`}
            </span>
            <StatusBadge status={checkpoint.verdict} />
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium capitalize">
              {checkpoint.phase}
            </span>
            {variant === 'timeline' && checkpoint.traceArtifactId && (
              <CheckpointTraceLink artifactId={checkpoint.traceArtifactId} />
            )}
            {variant === 'feed' && (
              <ActivityTimestamp value={checkpoint.createdAt} />
            )}
          </div>
          {checkpoint.rationale && (
            <p
              className={cn(
                'text-muted-foreground mt-1 leading-relaxed',
                variant === 'timeline' ? 'text-sm' : 'text-xs',
                expanded ? '' : 'line-clamp-2',
              )}
            >
              {checkpoint.rationale}
            </p>
          )}
        </div>
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </button>

      {expanded && (
        <div className={variant === 'timeline' ? 'px-4 pb-4' : 'px-3 pb-3 pt-0'}>
          {variant === 'timeline' ? (
            <div className="grid grid-cols-2 gap-4">
              <CheckpointScreenshot snapshotId={checkpoint.snapshotId} />
              {steps && steps.length > 0 && (
                <div className="space-y-1.5 overflow-y-auto max-h-32 p-3 rounded-lg bg-muted/30">
                  <span className="text-xs font-medium text-muted-foreground">Steps</span>
                  {steps.map((step, i) => (
                    <div
                      key={i}
                      className="text-xs font-mono text-muted-foreground flex items-start gap-2"
                    >
                      <span className="text-muted-foreground/50 w-4 shrink-0">{i + 1}.</span>
                      <SlotStepLabel step={step} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            steps &&
            steps.length > 0 && <CheckpointSteps steps={steps} />
          )}
        </div>
      )}
    </div>
  );

  if (variant === 'feed') {
    return cardBody;
  }

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-[18px]">
        <div
          className={cn(
            'size-2.5 rounded-full shrink-0',
            verdictColors[checkpoint.verdict] ?? 'bg-muted-foreground',
            isNew && 'animate-pulse ring-4 ring-primary/20',
          )}
        />
        {!isLast && <div className="w-0.5 flex-1 bg-border/60 mt-1" />}
      </div>
      {cardBody}
    </div>
  );
}
