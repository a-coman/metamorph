'use client';

import {
  CheckCircle,
  Eye,
  Loader2,
  Route,
  Search,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SessionJobSummaryDto, SessionMrVersionSummaryDto } from '@metamorph/api-client';

type StepId = 'discovery' | 'exploring' | 'review' | 'approved';
type StepState = 'pending' | 'active' | 'done' | 'failed' | 'warning';

const ACTIVE_JOB_STATUSES = new Set(['queued', 'running']);

const PIPELINE_STEPS: {
  id: StepId;
  label: string;
  icon: typeof Search;
}[] = [
    { id: 'discovery', label: 'Discovery', icon: Search },
    { id: 'exploring', label: 'Exploration', icon: Sparkles },
    { id: 'review', label: 'Review', icon: Eye },
    { id: 'approved', label: 'Approved', icon: CheckCircle },
  ];

const STEP_MESSAGES: Record<StepId, string> = {
  discovery: 'Analyzing page structure and capturing inventory',
  exploring: 'Building the metamorphic relation — details in Live Activity',
  review: 'Playbook draft ready — review and approve the relation',
  approved: 'Relation approved — ready for test execution',
};

const STEP_WARNING_MESSAGES: Partial<Record<StepId, string>> = {
  approved: 'Violation detected — triage required before replay',
};

function resolveStepStates(
  mr: SessionMrVersionSummaryDto | undefined,
  jobs: SessionJobSummaryDto[],
): StepState[] {
  const discoverJob = jobs.find((job) => job.type === 'discover');
  const discoverDone = discoverJob?.status === 'done';
  const discoverActive =
    discoverJob !== undefined && ACTIVE_JOB_STATUSES.has(discoverJob.status);
  const discoverFailed =
    discoverJob?.status === 'failed' || discoverJob?.status === 'enqueue_failed';

  const pending = (): StepState[] => ['pending', 'pending', 'pending', 'pending'];

  if (!mr) {
    if (discoverFailed) {
      return ['failed', 'pending', 'pending', 'pending'];
    }
    if (discoverActive) {
      return ['active', 'pending', 'pending', 'pending'];
    }
    if (discoverDone) {
      return ['done', 'pending', 'pending', 'pending'];
    }
    return pending();
  }

  switch (mr.status) {
    case 'exploring':
      return ['done', 'active', 'pending', 'pending'];
    case 'exploration_failed':
      return ['done', 'failed', 'pending', 'pending'];
    case 'draft_pending_hitl':
      return ['done', 'done', 'active', 'pending'];
    case 'approved':
    case 'replayable':
    case 'stale':
      return ['done', 'done', 'done', 'done'];
    case 'violation_pending_triage':
      return ['done', 'done', 'done', 'warning'];
    default:
      return pending();
  }
}

function stepCircleStyles(state: StepState): string {
  switch (state) {
    case 'done':
      return 'bg-emerald-100 text-emerald-600 border-emerald-200';
    case 'active':
      return 'bg-primary/10 text-primary border-primary/30';
    case 'failed':
      return 'bg-red-100 text-red-600 border-red-200';
    case 'warning':
      return 'bg-amber-100 text-amber-600 border-amber-200';
    default:
      return 'bg-muted/50 text-muted-foreground border-border';
  }
}

function connectorStyles(leftState: StepState): string {
  return leftState === 'done' || leftState === 'warning' ? 'bg-primary/40' : 'bg-border';
}

function PipelinePhaseMessage({
  stepStates,
}: {
  stepStates: StepState[];
}) {
  const failedIndex = stepStates.findIndex((state) => state === 'failed');
  if (failedIndex !== -1) {
    const step = PIPELINE_STEPS[failedIndex];
    return (
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900">
        <XCircle className="size-4 shrink-0 text-red-600" />
        <span className="text-sm text-foreground">
          {step.id === 'discovery'
            ? 'Discovery failed — check session jobs or retry'
            : 'Exploration failed — see Live Activity for the last error'}
        </span>
      </div>
    );
  }

  const warningIndex = stepStates.findIndex((state) => state === 'warning');
  if (warningIndex !== -1) {
    const step = PIPELINE_STEPS[warningIndex];
    const message = STEP_WARNING_MESSAGES[step.id];
    if (!message) return null;
    return (
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
        <Eye className="size-4 shrink-0 text-amber-600" />
        <span className="text-sm text-foreground">{message}</span>
      </div>
    );
  }

  const activeIndex = stepStates.findIndex((state) => state === 'active');
  if (activeIndex === -1) return null;

  const step = PIPELINE_STEPS[activeIndex];
  const message = STEP_MESSAGES[step.id];
  const showSpinner = step.id === 'discovery' || step.id === 'exploring';

  return (
    <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-primary/5 border border-primary/20">
      {showSpinner ? (
        <Loader2 className="size-4 animate-spin shrink-0 text-primary" />
      ) : (
        <step.icon className="size-4 shrink-0 text-primary" />
      )}
      <span className="text-sm text-foreground">{message}</span>
    </div>
  );
}

type SessionPipelineStepperProps = {
  mr?: SessionMrVersionSummaryDto;
  jobs: SessionJobSummaryDto[];
};

export function SessionPipelineStepper({ mr, jobs }: SessionPipelineStepperProps) {
  const stepStates = resolveStepStates(mr, jobs);
  const hasStarted = jobs.length > 0 || mr !== undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Route className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Pipeline</span>
      </div>

      {hasStarted && <PipelinePhaseMessage stepStates={stepStates} />}

      {!hasStarted ? (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground border border-dashed border-border rounded-xl bg-muted/20">
          Pipeline starting...
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card px-4 py-5 shadow-sm">
          <div className="flex items-start w-full">
            {PIPELINE_STEPS.map((step, index) => {
              const state = stepStates[index];
              const Icon = step.icon;
              const isLast = index === PIPELINE_STEPS.length - 1;

              return (
                <div key={step.id} className={cn('flex items-start', !isLast && 'flex-1')}>
                  <div className="flex flex-col items-center gap-2 min-w-[4.5rem]">
                    <div
                      className={cn(
                        'flex items-center justify-center size-9 rounded-full border transition-colors',
                        stepCircleStyles(state),
                      )}
                    >
                      {state === 'active' && (step.id === 'discovery' || step.id === 'exploring') ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : state === 'failed' ? (
                        <XCircle className="size-4" />
                      ) : (
                        <Icon className="size-4" />
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-xs font-medium text-center leading-tight',
                        state === 'pending' ? 'text-muted-foreground' : 'text-foreground',
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {!isLast && (
                    <div
                      className={cn(
                        'h-0.5 flex-1 mt-[1.125rem] mx-2 rounded-full transition-colors',
                        connectorStyles(state),
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
