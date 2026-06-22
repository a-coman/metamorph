'use client';

import { useState, useCallback, useRef } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, Loader2 as SpinIcon, Pause } from 'lucide-react';
import { useMrVersionTab } from '@/hooks/use-mr-version-tab';
import { CheckpointCard } from '@/components/checkpoint-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMrVersionEvents } from '@/hooks/use-sse';
import { useSubscribeSessionEvents } from '@/hooks/session-events-context';
import type {
  ExplorationTimelineDto,
  MrVersionEvent,
} from '@metamorph/api-client';

interface ExplorationTimelineProps {
  mrVersionId: string;
  initial: ExplorationTimelineDto;
  initialControlStatus?: string;
}

export function ExplorationTimeline({
  mrVersionId,
  initial,
  initialControlStatus = 'active',
}: ExplorationTimelineProps) {
  const { setTab } = useMrVersionTab('exploration');
  const [status, setStatus] = useState(initial.status);
  const [controlStatus, setControlStatus] = useState(initialControlStatus);
  const [checkpoints, setCheckpoints] = useState(initial.checkpoints);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  const isExplorationActive = !['draft_pending_hitl', 'exploration_failed', 'approved'].includes(status);
  const isSessionPaused = controlStatus === 'paused' || controlStatus === 'pausing';

  const handleEvent = useCallback((event: MrVersionEvent) => {
    if (event.type === 'checkpoint.created') {
      setCheckpoints((prev) => {
        if (prev.some((c) => c.id === event.checkpoint.id)) return prev;
        return [...prev, event.checkpoint];
      });
      setNewIds((prev) => new Set([...prev, event.checkpoint.id]));
      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev);
          next.delete(event.checkpoint.id);
          return next;
        });
      }, 3000);
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else if (event.type === 'status.changed') {
      setStatus(event.status);
    }
  }, []);

  useSubscribeSessionEvents((event) => {
    if (event.type === 'session.control_changed') {
      setControlStatus(event.controlStatus);
    }
  });

  useMrVersionEvents(isExplorationActive ? mrVersionId : null, handleEvent);

  const goals = initial.phaseGoals;

  return (
    <div className="space-y-6">
      {status === 'exploration_failed' && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50">
          <div className="p-1.5 rounded-lg bg-red-100">
            <AlertCircle className="size-4 text-red-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-red-700">Exploration Failed</div>
            {initial.failureReason && (
              <div className="text-sm text-red-600 mt-0.5">{initial.failureReason}</div>
            )}
          </div>
        </div>
      )}

      {status === 'draft_pending_hitl' && (
        <button
          type="button"
          onClick={() => setTab('playbook')}
          className="interactive-card group flex w-full items-center gap-4 px-4 py-3.5 rounded-xl border border-border bg-card shadow-sm cursor-pointer text-left"
        >
          <div className="interactive-icon p-2 rounded-lg">
            <CheckCircle2 className="size-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="text-sm font-medium text-foreground">Exploration Complete</div>
            <div className="text-sm text-muted-foreground">
              Review and approve the playbook in the <span className="font-medium text-primary">Playbook</span> tab
            </div>
          </div>
          <ChevronRight className="interactive-chevron size-4 shrink-0" />
        </button>
      )}

      {goals && (
        <div className="space-y-4 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Test Flow</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0 p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <div className="size-5 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center shrink-0">1</div>
                <span className="text-sm font-medium text-foreground">Source</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed break-words [overflow-wrap:anywhere]">{goals.source}</p>
            </div>
            <div className="min-w-0 p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <div className="size-5 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center shrink-0">2</div>
                <span className="text-sm font-medium text-foreground">Follow-up</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed break-words [overflow-wrap:anywhere]">{goals.follow_up}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Checkpoints
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {checkpoints.length}
            </span>
          </div>
          {isExplorationActive && isSessionPaused && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
              <Pause className="size-3" />
              Paused
            </span>
          )}
          {isExplorationActive && !isSessionPaused && (
            <span className="flex items-center gap-1.5 text-xs text-primary font-medium">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              Live
            </span>
          )}
        </div>

        {checkpoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl bg-muted/20">
            <div className="p-3 rounded-full bg-muted mb-3 animate-pulse">
              <SpinIcon className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Waiting for checkpoints</p>
            <p className="text-sm text-muted-foreground">
              {isSessionPaused
                ? 'Exploration is paused — resume the session to continue'
                : 'The AI is exploring the application...'}
            </p>
          </div>
        ) : (
          <div>
            {checkpoints.map((cp, i) => (
              <CheckpointCard
                key={cp.id}
                checkpoint={cp}
                index={i}
                isNew={newIds.has(cp.id)}
                isLast={i === checkpoints.length - 1}
                variant="timeline"
              />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export function ExplorationTimelineSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-4 w-12 rounded" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}
