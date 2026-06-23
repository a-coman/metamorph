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
import { aggregateMrPipelineStatus } from '@/lib/mr-versions';
import {
  FamilyExplorationChips,
  formatFailedFamilyNames,
} from '@/components/family-exploration-chips';
import type { ActivitySelection } from '@/lib/session-activity-by-family';
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
  exploring: 'Building metamorphic relations',
  review: 'Playbook drafts ready — review and approve each relation',
  approved: 'Relations approved — ready for test execution',
};

const STEP_WARNING_MESSAGES: Partial<Record<StepId, string>> = {
  approved: 'Violation detected — triage required before replay',
};

function resolveStepStates(
  mr: SessionMrVersionSummaryDto | undefined,
  mrVersions: SessionMrVersionSummaryDto[],
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

  if (mrVersions.some((version) => version.status === 'exploring')) {
    return ['done', 'active', 'pending', 'pending'];
  }

  if (
    mrVersions.length > 0 &&
    mrVersions.some((version) => version.status === 'exploration_failed')
  ) {
    const allFailed = mrVersions.every(
      (version) => version.status === 'exploration_failed',
    );
    if (allFailed) {
      return ['done', 'failed', 'pending', 'pending'];
    }
    if (mrVersions.some((version) => version.status === 'draft_pending_hitl')) {
      return ['done', 'done', 'active', 'pending'];
    }
    return ['done', 'warning', 'pending', 'pending'];
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
      if (
        mrVersions.length >= 4 &&
        mrVersions.every((version) =>
          ['approved', 'replayable', 'stale', 'violation_pending_triage'].includes(
            version.status,
          ),
        )
      ) {
        return ['done', 'done', 'done', 'done'];
      }
      return ['done', 'done', 'active', 'pending'];
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

function PhaseMessage({
  message,
  running = false,
}: {
  message: string;
  running?: boolean;
}) {
  return (
    <p className="min-h-7 py-1 text-center text-sm leading-7 text-muted-foreground">
      {running ? `${message}...` : message}
    </p>
  );
}

function PipelinePhaseMessage({
  stepStates,
  mrVersions,
}: {
  stepStates: StepState[];
  mrVersions: SessionMrVersionSummaryDto[];
}) {
  const failedIndex = stepStates.findIndex((state) => state === 'failed');
  if (failedIndex !== -1) {
    const step = PIPELINE_STEPS[failedIndex];
    const failedNames = formatFailedFamilyNames(mrVersions);
    return (
      <PhaseMessage
        message={
          step.id === 'discovery'
            ? 'Discovery failed — check session jobs or retry'
            : failedNames
              ? `Exploration failed for: ${failedNames} — see Live Activity`
              : 'Exploration failed for one or more relations — see Live Activity'
        }
      />
    );
  }

  const warningIndex = stepStates.findIndex((state) => state === 'warning');
  if (warningIndex !== -1) {
    const step = PIPELINE_STEPS[warningIndex];
    const failedNames = formatFailedFamilyNames(mrVersions);
    if (step.id === 'exploring' && failedNames) {
      return (
        <PhaseMessage
          message={`Partial exploration failure (${failedNames}) — other families may still be exploring or ready for review`}
        />
      );
    }

    const message = STEP_WARNING_MESSAGES[step.id];
    if (!message) return null;
    return <PhaseMessage message={message} />;
  }

  const activeIndex = stepStates.findIndex((state) => state === 'active');
  if (activeIndex === -1) return null;

  const step = PIPELINE_STEPS[activeIndex];
  const message = STEP_MESSAGES[step.id];
  const isRunning = step.id === 'discovery' || step.id === 'exploring';

  return <PhaseMessage message={message} running={isRunning} />;
}

type SessionPipelineStepperProps = {
  mrVersions: SessionMrVersionSummaryDto[];
  jobs: SessionJobSummaryDto[];
  controlStatus?: string;
  selectedFamily?: ActivitySelection;
  onSelectFamily?: (selection: ActivitySelection) => void;
  /**
   * Embedded mode: renders without the "Pipeline" label and without the outer
   * card border — for use inline inside another card (e.g. Live Activity).
   * Also suppresses the FamilyExplorationChips strip.
   */
  embedded?: boolean;
};

function StepperStepsRow({
  pausedStepStates,
}: {
  pausedStepStates: StepState[];
}) {
  return (
    <div className="flex items-start w-full">
      {PIPELINE_STEPS.map((step, index) => {
        const state = pausedStepStates[index];
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
                {state === 'active' &&
                  (step.id === 'discovery' || step.id === 'exploring') ? (
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
  );
}

export function SessionPipelineStepper({
  mrVersions,
  jobs,
  controlStatus,
  selectedFamily,
  onSelectFamily,
  embedded = false,
}: SessionPipelineStepperProps) {
  const mr = aggregateMrPipelineStatus(mrVersions);
  const stepStates = resolveStepStates(mr, mrVersions, jobs);
  const pausedStepStates =
    controlStatus === 'paused'
      ? stepStates.map((state) => (state === 'active' ? 'warning' : state))
      : stepStates;
  const hasStarted = jobs.length > 0 || mrVersions.length > 0;
  const showFamilyStrip =
    !embedded &&
    mrVersions.length > 0 &&
    (stepStates[1] === 'active' ||
      stepStates[1] === 'failed' ||
      stepStates[1] === 'warning');

  const pausedBanner = controlStatus === 'paused' && (
    <PhaseMessage message="Session paused — resume to continue the pipeline" />
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        {pausedBanner}
        {hasStarted && controlStatus !== 'paused' && (
          <PipelinePhaseMessage
            stepStates={stepStates}
            mrVersions={mrVersions}
          />
        )}
        {hasStarted && <StepperStepsRow pausedStepStates={pausedStepStates} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Route className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Pipeline</span>
      </div>

      {pausedBanner}

      {hasStarted && controlStatus !== 'paused' && (
        <PipelinePhaseMessage stepStates={stepStates} mrVersions={mrVersions} />
      )}

      {!hasStarted ? (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground border border-dashed border-border rounded-xl bg-muted/20">
          Pipeline starting...
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card px-4 py-5 shadow-sm">
          <StepperStepsRow pausedStepStates={pausedStepStates} />
          {showFamilyStrip && (
            <FamilyExplorationChips
              mrVersions={mrVersions}
              controlStatus={controlStatus}
              selected={selectedFamily}
              onSelect={onSelectFamily}
            />
          )}
        </div>
      )}
    </div>
  );
}
