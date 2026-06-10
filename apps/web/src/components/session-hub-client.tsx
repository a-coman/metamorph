'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Brain, ChevronRight, Crosshair, Layers, Loader2, Play, RefreshCw, RotateCcw, Search, Sparkles } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { SessionLiveActivity } from '@/components/session-live-activity';
import { useSubscribeSessionEvents } from '@/hooks/session-events-context';
import type { SessionDetailsDto, SessionJobSummaryDto, SessionMrVersionSummaryDto, SessionEvent } from '@metamorph/api-client';

interface SessionHubClientProps {
  sessionId: string;
  initial: SessionDetailsDto;
}

const JOB_ORDER = ['discover', 'explore', 'probe', 'execute_pair', 'replay', 'regenerate_step', 'llm_oracle'];

const JOB_CONFIG: Record<string, { label: string; icon: typeof Search; description: string }> = {
  discover: { label: 'Discovery', icon: Search, description: 'Analyzing page structure' },
  explore: { label: 'Exploration', icon: Sparkles, description: 'AI-driven path discovery' },
  probe: { label: 'Probe', icon: Crosshair, description: 'Testing exploration steps in the browser' },
  execute_pair: { label: 'Execution', icon: Play, description: 'Running test cases' },
  replay: { label: 'Replay', icon: RotateCcw, description: 'Replaying a validated path' },
  regenerate_step: { label: 'Step Regeneration', icon: RefreshCw, description: 'Regenerating a failed step' },
  llm_oracle: { label: 'LLM Oracle', icon: Brain, description: 'Evaluating test results' },
};

function formatJobLabel(type: string): string {
  return JOB_CONFIG[type]?.label ?? type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const ACTIVE_STATUSES = new Set(['queued', 'running']);

function PhaseMessage({ jobs }: { jobs: SessionJobSummaryDto[] }) {
  const activeJob = jobs.find((j) => ACTIVE_STATUSES.has(j.status));
  if (!activeJob) return null;

  const config = JOB_CONFIG[activeJob.type];
  const msg = config?.description ?? `Running ${formatJobLabel(activeJob.type)}...`;

  return (
    <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-primary/5 border border-primary/20">
      <Loader2 className="size-4 animate-spin shrink-0 text-primary" />
      <span className="text-sm text-foreground">{msg}</span>
    </div>
  );
}

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

  const sortedJobs = [...jobs].sort((a, b) => {
    const aIndex = JOB_ORDER.indexOf(a.type);
    const bIndex = JOB_ORDER.indexOf(b.type);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

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
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Pipeline</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {sortedJobs.map((job, index) => {
              const config = JOB_CONFIG[job.type];
              const Icon = config?.icon ?? Play;
              const label = formatJobLabel(job.type);
              const isActive = ACTIVE_STATUSES.has(job.status);
              return (
                <div
                  key={job.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${isActive ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
                    }`}
                >
                  <span className="text-xs text-muted-foreground">{index + 1}.</span>
                  <Icon className={`size-3.5 ${isActive ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">{label}</span>
                  <StatusBadge status={job.status} />
                </div>
              );
            })}
            {jobs.length === 0 && (
              <div className="flex-1 flex items-center justify-center py-6 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                Pipeline starting...
              </div>
            )}
          </div>

          <PhaseMessage jobs={jobs} />
        </div>

        <SessionLiveActivity mrVersionId={mr?.id} isActive={hasActiveJob || !mr} />
      </div>
    </div>
  );
}
