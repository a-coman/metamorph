'use client';

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Play, Loader2, ChevronRight, RefreshCw, Clock, FlaskConical, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/status-badge';
import { useMrVersionEvents } from '@/hooks/use-sse';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { RunSummaryDto, MrVersionEvent } from '@metamorph/api-client';

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
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

function RunsSummaryBar({ runs }: { runs: RunSummaryDto[] }) {
  const completed = runs.filter((run) => run.status === 'completed');
  const passed = completed.filter((run) => run.verdictStrict === 'pass').length;
  const failed = completed.filter((run) => run.verdictStrict === 'fail').length;
  const active = runs.filter((run) => ['pending', 'running'].includes(run.status)).length;

  if (runs.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
      <span className="text-muted-foreground">{runs.length} run{runs.length === 1 ? '' : 's'}</span>
      {passed > 0 && (
        <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
          {passed} passed
        </span>
      )}
      {failed > 0 && (
        <span className="inline-flex items-center rounded-md border border-destructive/30 bg-destructive/5 px-1.5 py-0.5 text-destructive">
          {failed} failed
        </span>
      )}
      {active > 0 && (
        <span className="inline-flex items-center rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-primary">
          {active} active
        </span>
      )}
    </div>
  );
}

interface RunsTabProps {
  sessionId: string;
  mrVersionId: string;
  mrStatus: string;
  initialRuns: RunSummaryDto[];
  sessionControlPaused?: boolean;
}

export function RunsTab({
  sessionId,
  mrVersionId,
  mrStatus,
  initialRuns,
  sessionControlPaused = false,
}: RunsTabProps) {
  const [runs, setRuns] = useState(initialRuns);
  const [executing, setExecuting] = useState(false);
  const [mrVersionStatus, setMrVersionStatus] = useState(mrStatus);

  const canExecute = mrVersionStatus === 'approved';
  const hasActiveRun = runs.some((r) => ['pending', 'running'].includes(r.status));

  const handleEvent = useCallback((event: MrVersionEvent) => {
    if (event.type === 'run.updated') {
      setRuns((prev) => {
        const idx = prev.findIndex((r) => r.id === event.run.id);
        if (idx === -1) return [event.run, ...prev];
        const next = [...prev];
        next[idx] = event.run;
        return next;
      });
    } else if (event.type === 'status.changed') {
      setMrVersionStatus(event.status);
    }
  }, []);

  useMrVersionEvents(hasActiveRun ? mrVersionId : null, handleEvent);

  const handleExecute = useCallback(async () => {
    setExecuting(true);
    try {
      await api.executeMrVersion(mrVersionId);
      toast.success('Execution queued');
      const updated = await api.listRuns(mrVersionId);
      setRuns(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Execute failed');
    } finally {
      setExecuting(false);
    }
  }, [mrVersionId]);

  const refreshRuns = useCallback(async () => {
    try {
      const updated = await api.listRuns(mrVersionId);
      setRuns(updated);
    } catch {
      toast.error('Failed to refresh runs');
    }
  }, [mrVersionId]);

  const sortedRuns = useMemo(
    () => [...runs].sort((a, b) => b.attempt - a.attempt),
    [runs],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Test runs</span>
          </div>
          <RunsSummaryBar runs={runs} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={refreshRuns}
            className="text-muted-foreground"
            title="Refresh runs"
          >
            <RefreshCw className="size-3.5" />
          </Button>
          {canExecute && (
            <Button
              size="sm"
              onClick={handleExecute}
              disabled={executing || hasActiveRun || sessionControlPaused}
              className="gap-2"
            >
              {executing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              Execute test
            </Button>
          )}
        </div>
      </div>

      {!canExecute && runs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 text-center border border-dashed border-border rounded-xl bg-muted/20">
          <div className="p-3 rounded-full bg-muted mb-3">
            <CheckCircle className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Playbook approval required</p>
          <p className="text-sm text-muted-foreground mt-1">
            Approve the playbook in the Playbook tab to enable execution
          </p>
        </div>
      )}

      {canExecute && runs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 text-center border border-dashed border-border rounded-xl bg-muted/20">
          <div className="p-3 rounded-full bg-primary/10 mb-3">
            <Play className="size-5 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">Ready to execute</p>
          <p className="text-sm text-muted-foreground mt-1">
            Click Execute test to run source and follow_up against this MR
          </p>
        </div>
      )}

      {sortedRuns.length > 0 && (
        <div className="space-y-2">
          {sortedRuns.map((run) => {
            const verdictAccent =
              run.verdictStrict === 'pass'
                ? 'border-l-emerald-400'
                : run.verdictStrict === 'fail'
                  ? 'border-l-destructive'
                  : 'border-l-border';

            return (
              <Link
                key={run.id}
                href={`/sessions/${sessionId}/mr/${mrVersionId}/runs/${run.id}`}
                className={cn(
                  'interactive-card group flex items-center gap-4 px-4 py-3.5 rounded-xl border border-border border-l-[3px] bg-card shadow-sm cursor-pointer',
                  verdictAccent,
                )}
              >
                <div className="interactive-icon p-2 rounded-lg bg-muted/40">
                  <FlaskConical className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium font-mono">Run #{run.attempt}</span>
                    <StatusBadge status={run.status} />
                    {run.verdictStrict && <StatusBadge status={run.verdictStrict} />}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatDate(run.createdAt)}
                    </span>
                    {run.finishedAt && (
                      <span className="px-1.5 py-0.5 rounded-md border border-border/60 bg-muted/40">
                        {formatDuration(run.createdAt, run.finishedAt)}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="interactive-chevron size-4 shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function RunsTabSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="px-4 py-3.5 rounded-xl border border-border bg-card shadow-sm flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded" />
              <Skeleton className="h-5 w-16 rounded" />
            </div>
            <Skeleton className="h-3 w-36 rounded" />
          </div>
          <Skeleton className="h-4 w-4 rounded" />
        </div>
      ))}
    </div>
  );
}
