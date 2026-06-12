'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ChevronRight, Sparkles } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { SessionLiveActivity } from '@/components/session-live-activity';
import { SessionPipelineStepper } from '@/components/session-pipeline-stepper';
import { MrVersionEventsProvider } from '@/hooks/mr-version-events-context';
import { useSubscribeSessionEvents } from '@/hooks/session-events-context';
import type { SessionDetailsDto, SessionJobSummaryDto, SessionMrVersionSummaryDto, SessionEvent } from '@metamorph/api-client';

interface SessionHubClientProps {
  sessionId: string;
  initial: SessionDetailsDto;
}

const ACTIVE_STATUSES = new Set(['queued', 'running']);

export function SessionHubClient({ sessionId, initial }: SessionHubClientProps) {
  const [jobs, setJobs] = useState<SessionJobSummaryDto[]>(initial.jobs);
  const [mrVersions, setMrVersions] = useState<SessionMrVersionSummaryDto[]>(initial.mrVersions);

  const handleEvent = useCallback((event: SessionEvent) => {
    if (event.type === 'job.updated') {
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === event.job.id);
        if (idx === -1) return [...prev, event.job];
        const next = [...prev];
        next[idx] = event.job;
        return next;
      });
    } else if (event.type === 'mr.created') {
      setMrVersions((prev) => {
        if (prev.some((mr) => mr.id === event.mr.id)) return prev;
        return [event.mr, ...prev];
      });
    } else if (event.type === 'mr.status_changed') {
      setMrVersions((prev) => {
        const idx = prev.findIndex((mr) => mr.id === event.mrVersionId);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], status: event.status };
        return next;
      });
    }
  }, []);

  const hasActiveJob = jobs.some((j) => ACTIVE_STATUSES.has(j.status));
  const mr = mrVersions[0];

  useSubscribeSessionEvents(handleEvent);

  return (
    <div className="space-y-8">
      {mr ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block size-5 shrink-0 bg-muted-foreground [mask-image:url(/logo-mark.svg)] [mask-size:contain] [mask-repeat:no-repeat] [mask-position:center] [-webkit-mask-image:url(/logo-mark.svg)] [-webkit-mask-size:contain] [-webkit-mask-repeat:no-repeat] [-webkit-mask-position:center]"
            />
            <span className="text-sm font-medium text-muted-foreground">Metamorphic Relation</span>
          </div>
          <Link
            href={`/sessions/${sessionId}/mr/${mr.id}`}
            className="interactive-card group flex items-center gap-4 p-4 rounded-xl border border-border bg-card shadow-sm cursor-pointer"
          >
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <StatusBadge status={mr.status} />
                <span className="text-sm font-medium text-foreground capitalize">{mr.transformFamily}</span>
              </div>
              <div className="text-xs text-muted-foreground/60 font-mono truncate">{mr.id}</div>
            </div>
            <ChevronRight className="interactive-chevron size-5 shrink-0" />
          </Link>
        </div>
      ) : hasActiveJob ? (
        <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-border rounded-xl bg-muted/20">
          <div className="p-3 rounded-full bg-muted mb-3">
            <Sparkles className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Metamorphic relation pending</p>
          <p className="text-sm text-muted-foreground">Will appear once discovery completes</p>
        </div>
      ) : null}

      <div className="space-y-6">
        <SessionPipelineStepper mr={mr} jobs={jobs} />
        <MrVersionEventsProvider mrVersionId={mr?.id ?? null}>
          <SessionLiveActivity isActive={hasActiveJob || !mr} />
        </MrVersionEventsProvider>
      </div>
    </div>
  );
}
