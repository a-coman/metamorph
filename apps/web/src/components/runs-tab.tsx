'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Play, Loader2, ChevronRight, RefreshCw, Clock, FlaskConical, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/status-badge';
import { useMrVersionEvents } from '@/hooks/use-sse';
import { api } from '@/lib/api';
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            Test Runs
          </span>
          {runs.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {runs.length}
            </span>
          )}
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
              Execute Test
            </Button>
          )}
        </div>
      </div>

      {!canExecute && runs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 text-center border border-dashed border-border rounded-xl bg-muted/20">
          <div className="p-3 rounded-full bg-muted mb-3">
            <CheckCircle className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Playbook Approval Required</p>
          <p className="text-sm text-muted-foreground">Approve the playbook in the Playbook tab to enable execution</p>
        </div>
      )}

      {canExecute && runs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 text-center border border-dashed border-border rounded-xl bg-muted/20">
          <div className="p-3 rounded-full bg-primary/10 mb-3">
            <Play className="size-5 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">Ready to Execute</p>
          <p className="text-sm text-muted-foreground">Click the Execute button above to start testing</p>
        </div>
      )}

      {runs.length > 0 && (
        <div className="space-y-2">
          {runs.map((run) => (
            <Link
              key={run.id}
              href={`/sessions/${sessionId}/mr/${mrVersionId}/runs/${run.id}`}
              className="interactive-card group flex items-center gap-4 px-4 py-3.5 rounded-xl border border-border bg-card shadow-sm cursor-pointer"
            >
              <div className="interactive-icon p-2 rounded-lg">
                <FlaskConical className="size-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Run #{run.attempt}</span>
                  <StatusBadge status={run.status} />
                  {run.verdictStrict && <StatusBadge status={run.verdictStrict} />}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {formatDate(run.createdAt)}
                  </span>
                  {run.finishedAt && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
                      {formatDuration(run.createdAt, run.finishedAt)}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="interactive-chevron size-4 shrink-0" />
            </Link>
          ))}
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
