'use client';

import { Fragment, useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo, type ReactNode } from 'react';
import {
  Sparkles,
  Camera,
  ChevronDown,
  ChevronUp,
  Crosshair,
  FileCode,
  Flame,
  Loader2,
  AlertTriangle,
  Activity,
  Clock,
  Zap,
  Eye,
  Pause,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { CheckpointCard, CheckpointScreenshot, CheckpointSteps } from '@/components/checkpoint-card';
import { LlmResponsePanel } from '@/components/llm-response-panel';
import { StatusBadge } from '@/components/status-badge';
import {
  resolveLlmCallStatus,
  resolveProbeBadgeStatus,
  type ActivityStatusContext,
  type TerminalExploreJobStatus,
} from '@/lib/activity-status';
import {
  type ExplorationPhase,
  type StandaloneActivity,
  type TimelineFeedItem,
} from '@/lib/exploration-cycles';
import {
  activityEventAtLlm,
  activityEventAtProbe,
  activityEventAtScreenshot,
} from '@/lib/activity-feed';
import { hydrateSessionActivity } from '@/lib/hydrate-session-activity';
import { useSubscribeSessionMrVersionsEvents } from '@/hooks/session-mr-versions-events-context';
import type { SessionMrVersionEvent } from '@/hooks/session-mr-versions-events-context';
import {
  useSubscribeSessionEvents,
  useSessionEventsConnection,
} from '@/hooks/session-events-context';
import { api } from '@/lib/api';
import type { SlotStepLike } from '@/lib/format-slot-step';
import { FamilyActivitySummaryRow } from '@/components/family-activity-summary-row';
import { SessionPipelineStepper } from '@/components/session-pipeline-stepper';
import {
  buildExploreJobAttributionFromSessionJobs,
  buildFamilyDisplayBuckets,
  buildSessionActivityByFamily,
  findFamilyBucket,
  resolveDefaultActivitySelection,
  syncActivitySelection,
  type ActivitySelection,
  type ExploreJobAttributionMap,
} from '@/lib/session-activity-by-family';
import type {
  SessionEvent,
  LlmCallDto,
  ProbeStatusDto,
  ScreenshotDto,
  ExplorationCheckpointDto,
  SessionActivityDto,
  SessionMrVersionSummaryDto,
  SessionJobSummaryDto,
} from '@metamorph/api-client';

interface SessionLiveActivityProps {
  sessionId: string;
  isActive: boolean;
  controlStatus?: string;
  initialActivity?: SessionActivityDto | null;
  mrVersions: SessionMrVersionSummaryDto[];
  transformFamilies?: string[];
  jobs?: SessionJobSummaryDto[];
  selectedFamily?: ActivitySelection;
  onSelectFamily?: (selection: ActivitySelection) => void;
}

type RawActivityState = {
  llmCalls: Map<string, LlmCallDto>;
  probes: Map<string, ProbeStatusDto>;
  screenshots: Map<string, ScreenshotDto>;
  checkpoints: Map<string, ExplorationCheckpointDto>;
};

const LLM_PURPOSE_CONFIG: Record<string, { label: string; description: string }> = {
  mr_plan: { label: 'Planning MR', description: 'Analyzing page to define test strategy' },
  explore_plan: { label: 'Planning Steps', description: 'Planning next exploration steps' },
  plan_explore: { label: 'Planning Steps', description: 'Planning next exploration steps' },
  explore_verify: { label: 'Verifying Checkpoint', description: 'Evaluating step execution results' },
  observe_spec: {
    label: 'Observation Spec',
    description: 'Defining per-MR observables and extraction bindings',
  },
  compile_draft: {
    label: 'Compiling Playbook',
    description: 'Building Playwright playbook from validated steps',
  },
};

const LLM_PURPOSES = new Set([
  'mr_plan',
  'explore_plan',
  'plan_explore',
  'explore_verify',
  'observe_spec',
  'observation_anchor',
]);

const LLM_PROMPT_PRE_CLASS =
  'text-xs bg-muted/40 rounded-md p-2 min-w-0 w-full overflow-y-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere]';

function formatPurpose(purpose: string): { label: string; description: string } {
  return LLM_PURPOSE_CONFIG[purpose] ?? {
    label: purpose.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: 'Processing...',
  };
}

function formatFamilyLabel(family: string): string {
  return family.replace(/_/g, ' ');
}

function formatScreenshotPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

const ACTIVITY_TIME_LOCALE = 'en-GB';

function formatActivityTime(value: Date | string): string {
  return new Date(value).toLocaleTimeString(ACTIVITY_TIME_LOCALE, {
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
      title={new Date(value).toLocaleString(ACTIVITY_TIME_LOCALE, { hour12: false })}
    >
      {formatActivityTime(value)}
    </span>
  );
}

const PHASE_DIVIDER_CONFIG: Record<ExplorationPhase, { step: string; label: string }> = {
  source: { step: '1', label: 'Source' },
  follow_up: { step: '2', label: 'Follow-up' },
};

function ActivityPhaseDivider({ phase }: { phase: ExplorationPhase }) {
  const { step, label } = PHASE_DIVIDER_CONFIG[phase];

  return (
    <div
      className="flex items-center gap-3 py-2"
      role="separator"
      aria-label={`${label} phase`}
    >
      <div className="flex-1 h-px bg-border" />
      <div className="flex items-center gap-1.5 shrink-0 px-1">
        <span className="size-5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center shrink-0">
          {step}
        </span>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function VerifySkippedCard({
  reason,
  isNew,
  id,
}: {
  reason: 'probe_failed' | 'graph_interrupted';
  isNew: boolean;
  id: string;
}) {
  const label =
    reason === 'probe_failed'
      ? 'Verify skipped (probe failed)'
      : 'Verify skipped (exploration interrupted)';

  return (
    <div
      id={id}
      className={cn(
        'interactive-card rounded-lg border bg-card shadow-sm px-3 py-2.5',
        isNew ? 'border-primary/50 shadow-lg shadow-primary/5 animate-fade-in' : 'border-border',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-md shrink-0 bg-muted text-muted-foreground">
          <Sparkles className="size-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">Verifying Checkpoint</span>
            <StatusBadge status="skipped" />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </div>
    </div>
  );
}

function renderStandalone(
  item: StandaloneActivity,
  isNew: boolean,
  statusContext: ActivityStatusContext,
) {
  switch (item.type) {
    case 'llm':
      return (
        <LlmCallCard
          llmCall={item.llm}
          checkpoint={item.checkpoint}
          isNew={isNew}
          statusContext={statusContext}
        />
      );
    case 'compile':
      return (
        <CompileDraftCard
          record={item.record}
          isNew={isNew}
          statusContext={statusContext}
        />
      );
    case 'session_capture':
      return (
        <SessionCaptureCard
          screenshot={item.screenshot}
          isNew={isNew}
        />
      );
    case 'checkpoint_orphan':
      return (
        <CheckpointCard
          checkpoint={item.checkpoint}
          isNew={isNew}
          variant="feed"
        />
      );
  }
}

function renderTimelineItem(
  item: TimelineFeedItem,
  isNewFor: (id: string) => boolean,
  statusContext: ActivityStatusContext,
): ReactNode {
  if (item.kind === 'phase_divider') {
    return <ActivityPhaseDivider phase={item.phase} />;
  }

  if (item.kind === 'standalone') {
    const standaloneId =
      item.item.type === 'llm'
        ? `llm-${item.item.llm.id}`
        : item.item.type === 'compile'
          ? `compile-${item.item.record.id}`
          : item.item.type === 'session_capture'
            ? `screenshot-${item.item.screenshot.id}`
            : `checkpoint-${item.item.checkpoint.id}`;

    return renderStandalone(item.item, isNewFor(standaloneId), statusContext);
  }

  const { cycle, step } = item;

  switch (step) {
    case 'plan':
      if (!cycle.plan) return null;
      return (
        <LlmCallCard
          llmCall={cycle.plan}
          isNew={isNewFor(`llm-${cycle.plan.id}`)}
          statusContext={statusContext}
        />
      );
    case 'probe':
      if (!cycle.probe) return null;
      return (
        <ProbeCycleCard
          probe={cycle.probe}
          isNew={isNewFor(`probe-${cycle.probe.jobId}`)}
          statusContext={statusContext}
        />
      );
    case 'verify':
      if (!cycle.verify) return null;
      return (
        <LlmCallCard
          llmCall={cycle.verify}
          checkpoint={cycle.checkpoint}
          isNew={isNewFor(`llm-${cycle.verify.id}`)}
          statusContext={statusContext}
        />
      );
    case 'verify_skipped': {
      if (!cycle.verifySkipped) return null;
      const skippedId = `${cycle.id}-verify-skipped`;
      return (
        <VerifySkippedCard
          id={skippedId}
          reason={cycle.verifySkipped}
          isNew={isNewFor(skippedId)}
        />
      );
    }
  }
}

function timelineItemKey(item: TimelineFeedItem, index: number): string {
  if (item.kind === 'phase_divider') {
    return `phase-divider-${item.phase}-${index}`;
  }
  if (item.kind === 'standalone') {
    if (item.item.type === 'llm') return `llm-${item.item.llm.id}`;
    if (item.item.type === 'compile') return `compile-${item.item.record.id}`;
    if (item.item.type === 'session_capture') return `screenshot-${item.item.screenshot.id}`;
    return `checkpoint-${item.item.checkpoint.id}`;
  }
  return `${item.cycle.id}-${item.step}`;
}

function CompileDraftCard({
  record,
  isNew,
  statusContext,
}: {
  record: LlmCallDto;
  isNew: boolean;
  statusContext?: ActivityStatusContext;
}) {
  const { label, description } = formatPurpose(record.purpose);
  const status = resolveLlmCallStatus(record, undefined, statusContext);

  return (
    <div
      className={cn(
        'interactive-card rounded-lg border bg-card shadow-sm',
        isNew ? 'border-primary/50 shadow-lg shadow-primary/5 animate-fade-in' : 'border-border',
      )}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <div className="p-1.5 rounded-md bg-slate-100 text-slate-600 shrink-0">
          <FileCode className="size-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">{label}</span>
            <StatusBadge status={status} />
            <ActivityTimestamp value={record.createdAt} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  );
}

function LlmPurposeIcon({ purpose }: { purpose: string }) {
  const isVerify = purpose === 'explore_verify';
  return (
    <div
      className={cn(
        'p-1.5 rounded-md shrink-0',
        isVerify ? 'bg-primary/10 text-primary' : 'bg-purple-100 text-purple-600',
      )}
    >
      <Sparkles className="size-3.5" />
    </div>
  );
}

function LlmCallCard({
  llmCall,
  checkpoint,
  isNew,
  statusContext,
}: {
  llmCall: LlmCallDto;
  checkpoint?: ExplorationCheckpointDto;
  isNew: boolean;
  statusContext?: ActivityStatusContext;
}) {
  const [expanded, setExpanded] = useState(false);
  const { label, description } = formatPurpose(llmCall.purpose);
  const status = resolveLlmCallStatus(llmCall, checkpoint, statusContext);
  const showModelBadge = LLM_PURPOSES.has(llmCall.purpose);
  const hasPrompts = llmCall.systemPrompt || llmCall.userPrompt;
  const canExpand = llmCall.responseJson !== null || hasPrompts;

  return (
    <div
      className={cn(
        'interactive-card rounded-lg border bg-card shadow-sm overflow-hidden min-w-0',
        isNew ? 'border-primary/50 shadow-lg shadow-primary/5 animate-fade-in' : 'border-border',
      )}
    >
      <button
        type="button"
        onClick={() => canExpand && setExpanded((v) => !v)}
        disabled={!canExpand}
        className={cn(
          'w-full min-w-0 flex items-start gap-3 px-3 py-2.5 text-left',
          canExpand ? 'cursor-pointer' : 'cursor-default',
        )}
      >
        <LlmPurposeIcon purpose={llmCall.purpose} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">{label}</span>
            <StatusBadge status={status} />
            {showModelBadge && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                {llmCall.model.split('/').pop()}
              </span>
            )}
            <ActivityTimestamp value={activityEventAtLlm(llmCall)} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        {canExpand && (
          <div className="shrink-0 text-muted-foreground">
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </div>
        )}
      </button>

      {expanded && canExpand && (
        <div className="min-w-0 px-3 pb-3 pt-0 space-y-3">
          {llmCall.systemPrompt && (
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">System prompt</p>
              <pre className={cn(LLM_PROMPT_PRE_CLASS, 'max-h-48')}>
                {llmCall.systemPrompt}
              </pre>
            </div>
          )}
          {llmCall.userPrompt && (
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                User prompt
                {llmCall.userPromptImages
                  ? ` (${llmCall.userPromptImages.count} image(s))`
                  : ''}
              </p>
              <pre className={cn(LLM_PROMPT_PRE_CLASS, 'max-h-64')}>
                {llmCall.userPrompt}
              </pre>
            </div>
          )}
          {llmCall.responseJson !== null && (
            <LlmResponsePanel
              purpose={llmCall.purpose}
              responseJson={llmCall.responseJson}
              checkpoint={checkpoint}
            />
          )}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground bg-muted/30 rounded-md px-2.5 py-2">
            {llmCall.tokensIn !== null && (
              <span className="flex items-center gap-1">
                <Zap className="size-3 text-amber-500" />
                {llmCall.tokensIn.toLocaleString()} in
              </span>
            )}
            {llmCall.tokensOut !== null && (
              <span className="flex items-center gap-1">
                <Zap className="size-3 text-emerald-500" />
                {llmCall.tokensOut.toLocaleString()} out
              </span>
            )}
            {llmCall.latencyMs !== null && llmCall.latencyMs > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {(llmCall.latencyMs / 1000).toFixed(1)}s
              </span>
            )}
            <span className="text-muted-foreground/50 font-mono">
              v{llmCall.promptVersion}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function isSmokeProbe(probe: ProbeStatusDto): boolean {
  return probe.mode === 'smoke_replay';
}

function isPrefixSyncProbe(probe: ProbeStatusDto): boolean {
  return probe.mode === 'prefix_sync';
}

function probeActivityLabel(probe: ProbeStatusDto): string {
  if (isSmokeProbe(probe)) return 'Smoke replay';
  if (isPrefixSyncProbe(probe)) return 'Sync Inventory';
  return 'Probe';
}

function ProbeCycleCard({
  probe,
  isNew,
  statusContext,
}: {
  probe: ProbeStatusDto;
  isNew: boolean;
  statusContext?: ActivityStatusContext;
}) {
  const [expanded, setExpanded] = useState(false);
  const smoke = isSmokeProbe(probe);
  const prefixSync = isPrefixSyncProbe(probe);
  const steps = (probe.executedSteps ?? []) as SlotStepLike[];
  const outputSnapshotId = probe.outputSnapshotId ?? probe.snapshotId;
  const canExpand = steps.length > 0 || outputSnapshotId !== null;

  return (
    <div
      className={cn(
        'interactive-card rounded-lg border bg-card shadow-sm overflow-hidden min-w-0 transition-all duration-300',
        isNew ? 'border-primary/50 shadow-lg shadow-primary/5 animate-fade-in' : 'border-border',
      )}
    >
      {canExpand ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full min-w-0 flex items-start gap-3 px-3 py-2.5 text-left cursor-pointer"
        >
          <ProbeCycleHeader probe={probe} statusContext={statusContext} />
          <div className="shrink-0 text-muted-foreground">
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </div>
        </button>
      ) : (
        <div className="flex min-w-0 items-start gap-3 px-3 py-2.5">
          <ProbeCycleHeader probe={probe} statusContext={statusContext} />
        </div>
      )}

      {expanded && canExpand && (
        <div className="px-3 pb-3 pt-0 space-y-3">
          {steps.length > 0 && <CheckpointSteps steps={steps} />}
          {outputSnapshotId && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 px-0.5">
                {smoke
                  ? 'Screenshot after smoke replay'
                  : prefixSync
                    ? 'Screenshot after sync inventory'
                    : 'Screenshot after probe'}
              </p>
              <CheckpointScreenshot snapshotId={outputSnapshotId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProbeCycleHeader({
  probe,
  statusContext,
}: {
  probe: ProbeStatusDto;
  statusContext?: ActivityStatusContext;
}) {
  const smoke = isSmokeProbe(probe);
  const prefixSync = isPrefixSyncProbe(probe);
  const replayFromHomepage = smoke || prefixSync;
  const ProbeKindIcon = smoke ? Flame : prefixSync ? RefreshCw : Crosshair;
  const status = resolveProbeBadgeStatus(probe, statusContext);

  return (
    <>
      <div
        className={cn(
          'p-1.5 rounded-md shrink-0',
          prefixSync ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600',
        )}
      >
        <ProbeKindIcon className="size-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">
            {probeActivityLabel(probe)}
          </span>
          <StatusBadge status={status} />
          <ActivityTimestamp value={activityEventAtProbe(probe)} />
        </div>
        {probe.stepCount !== null && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {replayFromHomepage
              ? `Replaying ${probe.stepCount} step${probe.stepCount !== 1 ? 's' : ''} from homepage`
              : `Executing ${probe.stepCount} step${probe.stepCount !== 1 ? 's' : ''}`}
          </p>
        )}
        {probe.error && (
          <p
            className="mt-1 overflow-hidden text-xs text-red-600 [overflow-wrap:anywhere] line-clamp-3"
            title={probe.error}
          >
            {probe.error}
          </p>
        )}
      </div>
    </>
  );
}

function SessionCaptureCard({
  screenshot,
  isNew,
}: {
  screenshot: ScreenshotDto;
  isNew: boolean;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .getArtifactUrl(screenshot.artifactId)
      .then(({ url }) => {
        setImageUrl(url);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [screenshot.artifactId]);

  if (error) {
    return null;
  }

  return (
    <div
      className={cn(
        'interactive-card rounded-lg border bg-card shadow-sm overflow-hidden transition-all duration-300',
        isNew ? 'border-primary/50 shadow-lg shadow-primary/5 animate-fade-in' : 'border-border',
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/60">
        <Camera className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Session capture</span>
        <ActivityTimestamp value={activityEventAtScreenshot(screenshot)} />
        {screenshot.url && (
          <span className="text-xs text-muted-foreground/50 truncate ml-auto max-w-[150px]">
            {formatScreenshotPath(screenshot.url)}
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="w-full aspect-video" />
      ) : imageUrl ? (
        <img
          src={imageUrl}
          alt="Page screenshot"
          className="w-full aspect-video object-cover object-top"
          loading="lazy"
        />
      ) : null}
    </div>
  );
}

function createEmptyRawState(): RawActivityState {
  return {
    llmCalls: new Map(),
    probes: new Map(),
    screenshots: new Map(),
    checkpoints: new Map(),
  };
}

function normalizeProbe(probe: ProbeStatusDto): ProbeStatusDto {
  const createdAt = probe.createdAt ?? probe.updatedAt;
  return {
    ...probe,
    exploreJobId: probe.exploreJobId ?? null,
    planLlmCallId: probe.planLlmCallId ?? null,
    cycleIteration: probe.cycleIteration ?? null,
    createdAt,
    startedAt: probe.startedAt ?? null,
    updatedAt: probe.updatedAt ?? createdAt,
  };
}

function normalizeLlmCall(llmCall: LlmCallDto): LlmCallDto {
  return {
    ...llmCall,
    jobId: llmCall.jobId ?? null,
    status:
      llmCall.status ??
      (llmCall.responseJson !== null && llmCall.responseJson !== undefined ? 'done' : 'running'),
    updatedAt: llmCall.updatedAt ?? llmCall.createdAt,
  };
}

function llmCallsEqual(a: LlmCallDto, b: LlmCallDto): boolean {
  return (
    a.status === b.status &&
    a.tokensIn === b.tokensIn &&
    a.tokensOut === b.tokensOut &&
    a.latencyMs === b.latencyMs &&
    a.systemPrompt === b.systemPrompt &&
    a.userPrompt === b.userPrompt &&
    JSON.stringify(a.userPromptImages) === JSON.stringify(b.userPromptImages) &&
    JSON.stringify(a.responseJson) === JSON.stringify(b.responseJson)
  );
}

function shouldIgnoreLlmCallUpdate(existing: LlmCallDto, incoming: LlmCallDto): boolean {
  if (llmCallsEqual(existing, incoming)) {
    return true;
  }
  if (
    (existing.status === 'done' || existing.status === 'failed') &&
    incoming.status === 'running'
  ) {
    return true;
  }
  return false;
}

export function SessionLiveActivity({
  sessionId,
  isActive,
  controlStatus = 'active',
  initialActivity,
  mrVersions,
  transformFamilies = [],
  jobs = [],
  selectedFamily: selectedFamilyProp,
  onSelectFamily,
}: SessionLiveActivityProps) {
  const [rawState, setRawState] = useState<RawActivityState>(() => {
    if (!initialActivity) {
      return createEmptyRawState();
    }
    const hydrated = hydrateSessionActivity(initialActivity);
    return {
      llmCalls: hydrated.llmCalls,
      probes: hydrated.probes,
      screenshots: hydrated.screenshots,
      checkpoints: hydrated.checkpoints,
    };
  });
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [terminalExploreJobs, setTerminalExploreJobs] = useState<
    Map<string, TerminalExploreJobStatus>
  >(() =>
    initialActivity
      ? hydrateSessionActivity(initialActivity).terminalExploreJobs
      : new Map(),
  );
  const exploreJobs = useMemo(
    () => buildExploreJobAttributionFromSessionJobs(jobs, mrVersions),
    [jobs, mrVersions],
  );
  const [internalSelection, setInternalSelection] = useState<ActivitySelection>(() =>
    resolveDefaultActivitySelection(mrVersions, transformFamilies),
  );

  const selectedFamily = selectedFamilyProp ?? internalSelection;

  const handleSelectFamily = useCallback(
    (selection: ActivitySelection) => {
      if (onSelectFamily) {
        onSelectFamily(selection);
      } else {
        setInternalSelection(selection);
      }
    },
    [onSelectFamily],
  );

  useEffect(() => {
    if (selectedFamilyProp) return;
    setInternalSelection((current) =>
      syncActivitySelection(current, mrVersions, transformFamilies),
    );
  }, [mrVersions, transformFamilies, selectedFamilyProp]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hasScrolledInitiallyRef = useRef(initialActivity != null);
  const liveStreamingRef = useRef(false);

  const connectionState = useSessionEventsConnection();

  const hydratedState = useMemo(
    () => ({
      llmCalls: rawState.llmCalls,
      probes: rawState.probes,
      screenshots: rawState.screenshots,
      checkpoints: rawState.checkpoints,
      terminalExploreJobs,
    }),
    [rawState, terminalExploreJobs],
  );

  const activityByFamily = useMemo(
    () => buildSessionActivityByFamily(hydratedState, mrVersions, exploreJobs),
    [hydratedState, mrVersions, exploreJobs],
  );

  const displayFamilies = useMemo(
    () => buildFamilyDisplayBuckets(hydratedState, mrVersions, transformFamilies, exploreJobs),
    [hydratedState, mrVersions, transformFamilies, exploreJobs],
  );

  const selectedBucket =
    selectedFamily.kind === 'family'
      ? findFamilyBucket(displayFamilies, selectedFamily)
      : null;

  const cycleFeed =
    selectedFamily.kind === 'session'
      ? activityByFamily.session.feed
      : (selectedBucket?.feed ?? []);

  const feedItemCount = cycleFeed.length;

  const selectionLabel =
    selectedFamily.kind === 'family'
      ? formatFamilyLabel(
        selectedFamily.family ?? selectedBucket?.family ?? 'relation',
      )
      : 'Session';

  const statusContext = useMemo<ActivityStatusContext>(
    () => ({
      terminalExploreJobs,
      sessionControlStatus:
        controlStatus === 'pausing' || controlStatus === 'paused'
          ? controlStatus
          : 'active',
    }),
    [terminalExploreJobs, controlStatus],
  );

  const scrollToBottom = useCallback((smooth: boolean) => {
    const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
    if (viewport) {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    } else {
      bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  }, []);

  const scheduleScroll = useCallback((smooth: boolean) => {
    if (!liveStreamingRef.current) return;

    if (scrollDebounceRef.current) {
      clearTimeout(scrollDebounceRef.current);
    }

    scrollDebounceRef.current = setTimeout(() => {
      if (liveStreamingRef.current) {
        scrollToBottom(smooth);
      }
    }, 100);
  }, [scrollToBottom]);

  useEffect(() => {
    liveStreamingRef.current = isActive && connectionState === 'connected';
  }, [isActive, connectionState]);

  useLayoutEffect(() => {
    if (feedItemCount === 0 || hasScrolledInitiallyRef.current) return;
    hasScrolledInitiallyRef.current = true;
    scrollToBottom(false);
  }, [feedItemCount, scrollToBottom]);

  const markNew = useCallback((activityId: string) => {
    setNewIds((prev) => new Set([...prev, activityId]));
    setTimeout(() => {
      setNewIds((prev) => {
        const next = new Set(prev);
        next.delete(activityId);
        return next;
      });
    }, 3000);
  }, []);

  const ingestEvent = useCallback((activityId: string, updater: (prev: RawActivityState) => RawActivityState) => {
    let added = false;
    setRawState((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      added = true;
      return next;
    });

    if (!added) return;

    markNew(activityId);
    scheduleScroll(true);
  }, [markNew, scheduleScroll]);

  const handleSessionEvent = useCallback((event: SessionEvent) => {
    if (event.type === 'job.updated') {
      const { job } = event;
      if (job.status === 'done' || job.status === 'completed') {
        setTerminalExploreJobs((prev) => {
          const next = new Map(prev);
          next.set(job.id, 'done');
          return next;
        });
      } else if (job.status === 'failed' || job.status === 'enqueue_failed') {
        setTerminalExploreJobs((prev) => {
          const next = new Map(prev);
          next.set(job.id, 'failed');
          return next;
        });
      }
      return;
    }

    if (event.type === 'llm.status' || event.type === 'llm.call') {
      const llmCall = normalizeLlmCall(event.llmCall);
      const id = `llm-${llmCall.id}`;
      ingestEvent(id, (prev) => {
        const existing = prev.llmCalls.get(llmCall.id);
        if (existing && shouldIgnoreLlmCallUpdate(existing, llmCall)) {
          return prev;
        }
        const llmCalls = new Map(prev.llmCalls);
        llmCalls.set(llmCall.id, llmCall);
        return { ...prev, llmCalls };
      });
      return;
    }

    if (event.type === 'probe.status') {
      const probe = normalizeProbe(event.probe);
      const id = `probe-${probe.jobId}`;
      ingestEvent(id, (prev) => {
        const existing = prev.probes.get(probe.jobId);
        if (
          existing?.status === probe.status &&
          new Date(existing.updatedAt).getTime() === new Date(probe.updatedAt).getTime()
        ) {
          return prev;
        }
        const probes = new Map(prev.probes);
        probes.set(probe.jobId, probe);
        return { ...prev, probes };
      });
      return;
    }

    if (event.type === 'screenshot.captured') {
      const id = `screenshot-${event.screenshot.id}`;
      ingestEvent(id, (prev) => {
        if (prev.screenshots.has(event.screenshot.id)) return prev;
        const screenshots = new Map(prev.screenshots);
        screenshots.set(event.screenshot.id, event.screenshot);
        return { ...prev, screenshots };
      });
    }
  }, [ingestEvent]);

  const handleMrVersionEvent = useCallback((event: SessionMrVersionEvent) => {
    if (event.type !== 'checkpoint.created') return;

    const checkpoint = {
      ...event.checkpoint,
      mrVersionId: event.checkpoint.mrVersionId ?? event.mrVersionId,
    };

    const id = `checkpoint-${checkpoint.id}`;
    ingestEvent(id, (prev) => {
      if (prev.checkpoints.has(checkpoint.id)) return prev;
      const checkpoints = new Map(prev.checkpoints);
      checkpoints.set(checkpoint.id, checkpoint);
      return { ...prev, checkpoints };
    });
  }, [ingestEvent]);

  useSubscribeSessionEvents(handleSessionEvent);
  useSubscribeSessionMrVersionsEvents(handleMrVersionEvent);

  const showConnecting = connectionState === 'connecting' && feedItemCount === 0;
  const showError = connectionState === 'error' && feedItemCount === 0;

  if (showConnecting) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" />
            Live Activity
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
              <Loader2 className="size-3 animate-spin" />
              Connecting...
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 rounded-full bg-muted mb-3 animate-pulse">
              <Eye className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Connecting to session</p>
            <p className="text-xs text-muted-foreground mt-1">Loading activity stream...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (showError) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" />
            Live Activity
            <span className="flex items-center gap-1.5 text-xs text-red-500 ml-auto">
              Connection error
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 rounded-full bg-red-100 mb-3">
              <AlertTriangle className="size-5 text-red-500" />
            </div>
            <p className="text-sm font-medium text-foreground">Could not connect</p>
            <p className="text-xs text-muted-foreground mt-1">Try refreshing the page</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" />
          Live Activity
          {selectedFamily.kind === 'family' && (
            <span className="text-xs text-muted-foreground font-normal">
              — {selectionLabel}
            </span>
          )}
          {controlStatus === 'paused' || controlStatus === 'pausing' ? (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium ml-auto">
              <Pause className="size-3" />
              Paused
            </span>
          ) : isActive ? (
            <span className="flex items-center gap-1.5 text-xs text-primary font-medium ml-auto">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              Streaming
            </span>
          ) : feedItemCount > 0 ? (
            <span className="text-xs text-muted-foreground ml-auto">
              {feedItemCount} events
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
        {displayFamilies.length > 0 && (
          <FamilyActivitySummaryRow
            sessionId={sessionId}
            families={displayFamilies}
            selected={selectedFamily}
            controlStatus={controlStatus}
            onSelect={handleSelectFamily}
          />
        )}

        {/* Per-relation (or session-level) pipeline progress */}
        {(() => {
          const selectedMrVersion = selectedBucket?.mrVersionId
            ? mrVersions.find((mr) => mr.id === selectedBucket.mrVersionId)
            : undefined;
          const pipelineMrVersions = selectedMrVersion ? [selectedMrVersion] : [];
          return (
            <div className="pt-4 pb-4 border-b border-border/60">
              <SessionPipelineStepper
                mrVersions={pipelineMrVersions}
                jobs={jobs}
                controlStatus={controlStatus}
                embedded
              />
            </div>
          );
        })()}

        {feedItemCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="p-3 rounded-full bg-muted mb-3">
              <Eye className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {displayFamilies.length === 0 && mrVersions.length === 0
                ? 'No session activity yet'
                : `No activity yet for ${selectionLabel}`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Events will appear as this relation explores...
            </p>
          </div>
        ) : (
          <div ref={scrollAreaRef}>
            <ScrollArea className="h-[620px]">
              <div className="min-w-0 space-y-2 pr-4 pt-4 pb-1">
                {cycleFeed.map((item, index) => (
                  <Fragment key={timelineItemKey(item, index)}>
                    {renderTimelineItem(
                      item,
                      (id) => newIds.has(id),
                      statusContext,
                    )}
                  </Fragment>
                ))}
              </div>
              <div ref={bottomRef} />
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SessionLiveActivitySkeleton() {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" />
          Live Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border">
              <Skeleton className="size-7 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
