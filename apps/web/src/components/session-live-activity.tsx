'use client';

import { Fragment, useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { CheckpointCard, CheckpointScreenshot, CheckpointSteps } from '@/components/checkpoint-card';
import { LlmResponsePanel } from '@/components/llm-response-panel';
import { StatusBadge } from '@/components/status-badge';
import { resolveLlmCallStatus, resolveProbeBadgeStatus } from '@/lib/activity-status';
import { useSubscribeMrVersionEvents } from '@/hooks/mr-version-events-context';
import {
  useSubscribeSessionEvents,
  useSessionEventsConnection,
} from '@/hooks/session-events-context';
import { api } from '@/lib/api';
import type { SlotStepLike } from '@/lib/format-slot-step';
import type {
  SessionEvent,
  MrVersionEvent,
  LlmCallDto,
  ProbeStatusDto,
  ScreenshotDto,
  ExplorationCheckpointDto,
} from '@metamorph/api-client';

interface SessionLiveActivityProps {
  isActive: boolean;
}

type ActivityGroup =
  | {
    type: 'llm';
    id: string;
    llm: LlmCallDto;
    checkpoint?: ExplorationCheckpointDto;
    sortAt: number;
  }
  | {
    type: 'probe';
    id: string;
    probe: ProbeStatusDto;
    sortAt: number;
  }
  | {
    type: 'session_capture';
    id: string;
    screenshot: ScreenshotDto;
    sortAt: number;
  }
  | {
    type: 'checkpoint_orphan';
    id: string;
    checkpoint: ExplorationCheckpointDto;
    sortAt: number;
  }
  | {
    type: 'compile';
    id: string;
    record: LlmCallDto;
    sortAt: number;
  };

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
]);

function formatPurpose(purpose: string): { label: string; description: string } {
  return LLM_PURPOSE_CONFIG[purpose] ?? {
    label: purpose.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: 'Processing...',
  };
}

function formatScreenshotPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

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

function buildActivityGroups(state: RawActivityState): ActivityGroup[] {
  const checkpointByLlmId = new Map<string, ExplorationCheckpointDto>();
  const attachedCheckpointIds = new Set<string>();

  for (const checkpoint of state.checkpoints.values()) {
    if (checkpoint.llmCallId) {
      checkpointByLlmId.set(checkpoint.llmCallId, checkpoint);
    }
  }

  const groups: ActivityGroup[] = [];

  for (const llm of state.llmCalls.values()) {
    if (llm.purpose === 'compile_draft') {
      groups.push({
        type: 'compile',
        id: `compile-${llm.id}`,
        record: llm,
        sortAt: new Date(llm.createdAt).getTime(),
      });
      continue;
    }

    const checkpoint = checkpointByLlmId.get(llm.id);
    if (checkpoint) {
      attachedCheckpointIds.add(checkpoint.id);
    }
    groups.push({
      type: 'llm',
      id: `llm-${llm.id}`,
      llm,
      checkpoint,
      sortAt: new Date(llm.createdAt).getTime(),
    });
  }

  for (const probe of state.probes.values()) {
    groups.push({
      type: 'probe',
      id: `probe-${probe.jobId}`,
      probe,
      sortAt: new Date(probe.updatedAt).getTime(),
    });
  }

  for (const screenshot of state.screenshots.values()) {
    groups.push({
      type: 'session_capture',
      id: `screenshot-${screenshot.id}`,
      screenshot,
      sortAt: new Date(screenshot.createdAt).getTime(),
    });
  }

  for (const checkpoint of state.checkpoints.values()) {
    if (attachedCheckpointIds.has(checkpoint.id)) continue;
    groups.push({
      type: 'checkpoint_orphan',
      id: `checkpoint-${checkpoint.id}`,
      checkpoint,
      sortAt: new Date(checkpoint.createdAt).getTime(),
    });
  }

  groups.sort((a, b) => a.sortAt - b.sortAt);
  return groups;
}

type ExplorationPhase = 'source' | 'follow_up';

type ActivityFeedItem =
  | { kind: 'group'; group: ActivityGroup }
  | { kind: 'phase_divider'; phase: ExplorationPhase };

function normalizeExplorationPhase(value: string | null | undefined): ExplorationPhase | null {
  if (value === 'follow_up') return 'follow_up';
  if (value === 'source') return 'source';
  return null;
}

function getExplicitPhase(group: ActivityGroup): ExplorationPhase | null {
  switch (group.type) {
    case 'checkpoint_orphan':
      return normalizeExplorationPhase(group.checkpoint.phase);
    case 'llm':
      return group.checkpoint
        ? normalizeExplorationPhase(group.checkpoint.phase)
        : null;
    case 'probe':
      return normalizeExplorationPhase(group.probe.phase);
    default:
      return null;
  }
}

function isMrPlanLlm(group: ActivityGroup): boolean {
  return group.type === 'llm' && group.llm.purpose === 'mr_plan';
}

function isExplorePlanLlm(group: ActivityGroup): boolean {
  return (
    group.type === 'llm' &&
    (group.llm.purpose === 'plan_explore' || group.llm.purpose === 'explore_plan')
  );
}

function isSourceSmokeComplete(group: ActivityGroup): boolean {
  return (
    group.type === 'probe' &&
    group.probe.mode === 'smoke_replay' &&
    group.probe.phase === 'source' &&
    group.probe.status === 'done'
  );
}

function buildActivityFeed(groups: ActivityGroup[]): ActivityFeedItem[] {
  if (groups.length === 0) return [];

  const items: ActivityFeedItem[] = [];
  let currentPhase: ExplorationPhase | null = null;
  let sourceDividerInserted = false;
  let followUpDividerInserted = false;
  let pendingFollowUpStart = false;

  for (const group of groups) {
    const explicitPhase = getExplicitPhase(group);

    if (
      !followUpDividerInserted &&
      explicitPhase === 'follow_up' &&
      currentPhase === 'source'
    ) {
      items.push({ kind: 'phase_divider', phase: 'follow_up' });
      followUpDividerInserted = true;
      pendingFollowUpStart = false;
    } else if (
      !followUpDividerInserted &&
      pendingFollowUpStart &&
      isExplorePlanLlm(group)
    ) {
      items.push({ kind: 'phase_divider', phase: 'follow_up' });
      followUpDividerInserted = true;
      pendingFollowUpStart = false;
      currentPhase = 'follow_up';
    }

    if (explicitPhase === 'follow_up') {
      currentPhase = 'follow_up';
    } else if (explicitPhase === 'source' && currentPhase === null) {
      currentPhase = 'source';
    }

    if (isSourceSmokeComplete(group)) {
      pendingFollowUpStart = true;
    }

    items.push({ kind: 'group', group });

    if (!sourceDividerInserted && isMrPlanLlm(group)) {
      items.push({ kind: 'phase_divider', phase: 'source' });
      sourceDividerInserted = true;
      if (currentPhase === null) currentPhase = 'source';
    }
  }

  return items;
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

function renderActivityGroup(group: ActivityGroup, isNew: boolean) {
  switch (group.type) {
    case 'llm':
      return (
        <LlmCallCard
          llmCall={group.llm}
          checkpoint={group.checkpoint}
          isNew={isNew}
        />
      );
    case 'compile':
      return (
        <CompileDraftCard
          record={group.record}
          isNew={isNew}
        />
      );
    case 'probe':
      return (
        <ProbeCycleCard
          probe={group.probe}
          isNew={isNew}
        />
      );
    case 'session_capture':
      return (
        <SessionCaptureCard
          screenshot={group.screenshot}
          isNew={isNew}
        />
      );
    case 'checkpoint_orphan':
      return (
        <CheckpointCard
          checkpoint={group.checkpoint}
          isNew={isNew}
          variant="feed"
        />
      );
  }
}

function CompileDraftCard({ record, isNew }: { record: LlmCallDto; isNew: boolean }) {
  const { label, description } = formatPurpose(record.purpose);
  const status = resolveLlmCallStatus(record);

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
}: {
  llmCall: LlmCallDto;
  checkpoint?: ExplorationCheckpointDto;
  isNew: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { label, description } = formatPurpose(llmCall.purpose);
  const status = resolveLlmCallStatus(llmCall, checkpoint);
  const showModelBadge = LLM_PURPOSES.has(llmCall.purpose);
  const canExpand = llmCall.status === 'done' && llmCall.responseJson !== null;

  return (
    <div
      className={cn(
        'interactive-card rounded-lg border bg-card shadow-sm',
        isNew ? 'border-primary/50 shadow-lg shadow-primary/5 animate-fade-in' : 'border-border',
      )}
    >
      <button
        type="button"
        onClick={() => canExpand && setExpanded((v) => !v)}
        disabled={!canExpand}
        className={cn(
          'w-full flex items-start gap-3 px-3 py-2.5 text-left',
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
            <ActivityTimestamp value={llmCall.createdAt} />
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
        <div className="px-3 pb-3 pt-0 space-y-3">
          <LlmResponsePanel
            purpose={llmCall.purpose}
            responseJson={llmCall.responseJson}
            checkpoint={checkpoint}
          />
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

function probeActivityLabel(probe: ProbeStatusDto): string {
  return isSmokeProbe(probe) ? 'Smoke replay' : 'Probe';
}

function ProbeCycleCard({ probe, isNew }: { probe: ProbeStatusDto; isNew: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const smoke = isSmokeProbe(probe);
  const steps = (probe.executedSteps ?? []) as SlotStepLike[];
  const outputSnapshotId = probe.outputSnapshotId ?? probe.snapshotId;
  const canExpand = steps.length > 0 || outputSnapshotId !== null;

  return (
    <div
      className={cn(
        'interactive-card rounded-lg border bg-card shadow-sm overflow-hidden transition-all duration-300',
        isNew ? 'border-primary/50 shadow-lg shadow-primary/5 animate-fade-in' : 'border-border',
      )}
    >
      {canExpand ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-start gap-3 px-3 py-2.5 text-left cursor-pointer"
        >
          <ProbeCycleHeader probe={probe} />
          <div className="shrink-0 text-muted-foreground">
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </div>
        </button>
      ) : (
        <div className="flex items-start gap-3 px-3 py-2.5">
          <ProbeCycleHeader probe={probe} />
        </div>
      )}

      {expanded && canExpand && (
        <div className="px-3 pb-3 pt-0 space-y-3">
          {steps.length > 0 && <CheckpointSteps steps={steps} />}
          {outputSnapshotId && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 px-0.5">
                {smoke ? 'Screenshot after smoke replay' : 'Screenshot after probe'}
              </p>
              <CheckpointScreenshot snapshotId={outputSnapshotId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProbeCycleHeader({ probe }: { probe: ProbeStatusDto }) {
  const smoke = isSmokeProbe(probe);
  const ProbeKindIcon = smoke ? Flame : Crosshair;
  const status = resolveProbeBadgeStatus(probe);

  return (
    <>
      <div className="p-1.5 rounded-md shrink-0 bg-amber-100 text-amber-600">
        <ProbeKindIcon className="size-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">
            {probeActivityLabel(probe)}
          </span>
          <StatusBadge status={status} />
          <ActivityTimestamp value={probe.updatedAt} />
        </div>
        {probe.stepCount !== null && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {smoke
              ? `Replaying ${probe.stepCount} step${probe.stepCount !== 1 ? 's' : ''} from homepage`
              : `Executing ${probe.stepCount} step${probe.stepCount !== 1 ? 's' : ''}`}
          </p>
        )}
        {probe.error && (
          <p className="text-xs text-red-600 mt-1 line-clamp-2">{probe.error}</p>
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
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <Camera className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Session capture</span>
        <ActivityTimestamp value={screenshot.createdAt} />
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

function normalizeLlmCall(llmCall: LlmCallDto): LlmCallDto {
  return {
    ...llmCall,
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
    JSON.stringify(a.responseJson) === JSON.stringify(b.responseJson)
  );
}

export function SessionLiveActivity({ isActive }: SessionLiveActivityProps) {
  const [rawState, setRawState] = useState<RawActivityState>(createEmptyRawState);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const connectionState = useSessionEventsConnection();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hasScrolledInitiallyRef = useRef(false);
  const liveStreamingRef = useRef(false);

  const activityGroups = useMemo(() => buildActivityGroups(rawState), [rawState]);
  const activityFeed = useMemo(() => buildActivityFeed(activityGroups), [activityGroups]);

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
    if (activityGroups.length === 0 || hasScrolledInitiallyRef.current) return;
    hasScrolledInitiallyRef.current = true;
    scrollToBottom(false);
  }, [activityGroups.length, scrollToBottom]);

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
    if (event.type === 'llm.status' || event.type === 'llm.call') {
      const llmCall = normalizeLlmCall(event.llmCall);
      const id = `llm-${llmCall.id}`;
      ingestEvent(id, (prev) => {
        const existing = prev.llmCalls.get(llmCall.id);
        if (existing && llmCallsEqual(existing, llmCall)) {
          return prev;
        }
        const llmCalls = new Map(prev.llmCalls);
        llmCalls.set(llmCall.id, llmCall);
        return { ...prev, llmCalls };
      });
      return;
    }

    if (event.type === 'probe.status') {
      const id = `probe-${event.probe.jobId}`;
      ingestEvent(id, (prev) => {
        const existing = prev.probes.get(event.probe.jobId);
        if (
          existing?.status === event.probe.status &&
          new Date(existing.updatedAt).getTime() ===
          new Date(event.probe.updatedAt).getTime()
        ) {
          return prev;
        }
        const probes = new Map(prev.probes);
        probes.set(event.probe.jobId, event.probe);
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

  const handleMrVersionEvent = useCallback((event: MrVersionEvent) => {
    if (event.type !== 'checkpoint.created') return;

    const id = `checkpoint-${event.checkpoint.id}`;
    ingestEvent(id, (prev) => {
      if (prev.checkpoints.has(event.checkpoint.id)) return prev;
      const checkpoints = new Map(prev.checkpoints);
      checkpoints.set(event.checkpoint.id, event.checkpoint);
      return { ...prev, checkpoints };
    });
  }, [ingestEvent]);

  useSubscribeSessionEvents(handleSessionEvent);
  useSubscribeMrVersionEvents(handleMrVersionEvent);

  const showConnecting = connectionState === 'connecting' && activityGroups.length === 0;
  const showError = connectionState === 'error' && activityGroups.length === 0;

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
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" />
          Live Activity
          {isActive ? (
            <span className="flex items-center gap-1.5 text-xs text-primary font-medium ml-auto">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              Streaming
            </span>
          ) : activityGroups.length > 0 ? (
            <span className="text-xs text-muted-foreground ml-auto">
              {activityGroups.length} events
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activityGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 rounded-full bg-muted mb-3">
              <Eye className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground mt-1">Events will appear as the session runs...</p>
          </div>
        ) : (
          <div ref={scrollAreaRef}>
            <ScrollArea className="h-[620px]">
              <div className="space-y-2 pr-4 pt-1 pb-1">
                {activityFeed.map((item, index) => {
                  if (item.kind === 'phase_divider') {
                    return (
                      <ActivityPhaseDivider
                        key={`phase-divider-${item.phase}-${index}`}
                        phase={item.phase}
                      />
                    );
                  }

                  const { group } = item;
                  return (
                    <Fragment key={group.id}>
                      {renderActivityGroup(group, newIds.has(group.id))}
                    </Fragment>
                  );
                })}
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
