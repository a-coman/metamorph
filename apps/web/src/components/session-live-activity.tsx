'use client';

import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import {
  Brain,
  Camera,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Loader2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Clock,
  Zap,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { CheckpointCard } from '@/components/checkpoint-card';
import {
  useSubscribeSessionEvents,
  useSessionEventsConnection,
} from '@/hooks/session-events-context';
import { useMrVersionEvents } from '@/hooks/use-sse';
import { api } from '@/lib/api';
import type {
  SessionEvent,
  MrVersionEvent,
  LlmCallDto,
  ProbeStatusDto,
  ScreenshotDto,
  ExplorationCheckpointDto,
} from '@metamorph/api-client';

interface SessionLiveActivityProps {
  mrVersionId?: string | null;
  isActive: boolean;
}

type ActivityItem =
  | { type: 'llm'; data: LlmCallDto }
  | { type: 'probe'; data: ProbeStatusDto }
  | { type: 'screenshot'; data: ScreenshotDto }
  | { type: 'checkpoint'; data: ExplorationCheckpointDto };

const LLM_PURPOSE_CONFIG: Record<string, { label: string; description: string }> = {
  mr_plan: { label: 'MR Planning', description: 'Analyzing page to define test strategy' },
  explore_plan: { label: 'Planning Steps', description: 'Planning next exploration steps' },
  plan_explore: { label: 'Planning Steps', description: 'Planning next exploration steps' },
  explore_verify: { label: 'Verifying Checkpoint', description: 'Evaluating step execution results' },
  compile_draft: { label: 'Compiling Playbook', description: 'Generating test playbook' },
};

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

function LlmCallCard({ llmCall, isNew }: { llmCall: LlmCallDto; isNew: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { label, description } = formatPurpose(llmCall.purpose);

  return (
    <div
      className={cn(
        'interactive-card rounded-lg border bg-card shadow-sm',
        isNew ? 'border-primary/50 shadow-lg shadow-primary/5 animate-fade-in' : 'border-border',
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left cursor-pointer"
      >
        <div className="p-1.5 rounded-md bg-purple-100 text-purple-600 shrink-0">
          <Brain className="size-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">{label}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
              {llmCall.model.split('/').pop()}
            </span>
            <ActivityTimestamp value={llmCall.createdAt} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-0">
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
            {llmCall.latencyMs !== null && (
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

function ProbeStatusCard({ probe, isNew }: { probe: ProbeStatusDto; isNew: boolean }) {
  const statusConfig: Record<string, { icon: typeof Loader2; color: string; bgColor: string }> = {
    queued: { icon: Clock, color: 'text-muted-foreground', bgColor: 'bg-muted' },
    running: { icon: Loader2, color: 'text-primary', bgColor: 'bg-primary/10' },
    done: { icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
    failed: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
  };

  const config = statusConfig[probe.status] ?? statusConfig.queued;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'interactive-card rounded-lg border bg-card shadow-sm transition-all duration-300',
        isNew ? 'border-primary/50 shadow-lg shadow-primary/5 animate-fade-in' : 'border-border',
      )}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <div className={cn('p-1.5 rounded-md shrink-0', config.bgColor, config.color)}>
          <Crosshair className="size-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">
              Probe {probe.phase && <span className="text-muted-foreground">({probe.phase})</span>}
            </span>
            <span className={cn('flex items-center gap-1 text-xs font-medium', config.color)}>
              <Icon className={cn('size-3', probe.status === 'running' && 'animate-spin')} />
              {probe.status}
            </span>
            <ActivityTimestamp value={probe.updatedAt} />
          </div>
          {probe.stepCount !== null && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Executing {probe.stepCount} step{probe.stepCount !== 1 ? 's' : ''}
            </p>
          )}
          {probe.error && (
            <p className="text-xs text-red-600 mt-1 line-clamp-2">{probe.error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ScreenshotCard({ screenshot, isNew }: { screenshot: ScreenshotDto; isNew: boolean }) {
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
        <span className="text-xs font-medium text-muted-foreground">Screenshot captured</span>
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

export function SessionLiveActivity({ mrVersionId, isActive }: SessionLiveActivityProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const connectionState = useSessionEventsConnection();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const liveUpdatesEnabledRef = useRef(false);

  const getKey = useCallback((a: ActivityItem): string => {
    switch (a.type) {
      case 'llm': return `llm-${a.data.id}`;
      case 'probe': return `probe-${a.data.jobId}-${a.data.status}`;
      case 'screenshot': return `screenshot-${a.data.id}`;
      case 'checkpoint': return `checkpoint-${a.data.id}`;
    }
  }, []);

  const getTimestamp = useCallback((a: ActivityItem): number => {
    switch (a.type) {
      case 'llm': return new Date(a.data.createdAt).getTime();
      case 'probe': return new Date(a.data.updatedAt).getTime();
      case 'screenshot': return new Date(a.data.createdAt).getTime();
      case 'checkpoint': return new Date(a.data.createdAt).getTime();
    }
  }, []);

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
    if (scrollDebounceRef.current) {
      clearTimeout(scrollDebounceRef.current);
    }

    scrollDebounceRef.current = setTimeout(() => {
      scrollToBottom(smooth);
    }, 100);
  }, [scrollToBottom]);

  // Pin to bottom before paint while replaying historical events from SSE.
  useLayoutEffect(() => {
    if (activities.length === 0 || liveUpdatesEnabledRef.current) return;
    scrollToBottom(false);
  }, [activities, scrollToBottom]);

  useEffect(() => {
    if (connectionState !== 'connected') {
      liveUpdatesEnabledRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      liveUpdatesEnabledRef.current = true;
    }, 1200);

    return () => clearTimeout(timer);
  }, [connectionState]);

  const addActivity = useCallback((newActivity: ActivityItem, activityId: string) => {
    let added = false;

    setActivities((prev) => {
      const existingKeys = new Set(prev.map(getKey));
      const newKey = getKey(newActivity);
      if (existingKeys.has(newKey)) return prev;
      added = true;
      const updated = [...prev, newActivity];
      updated.sort((a, b) => getTimestamp(a) - getTimestamp(b));
      return updated.slice(-50);
    });

    if (!added) return;

    setNewIds((prev) => new Set([...prev, activityId]));
    setTimeout(() => {
      setNewIds((prev) => {
        const next = new Set(prev);
        next.delete(activityId);
        return next;
      });
    }, 3000);

    if (liveUpdatesEnabledRef.current) {
      scheduleScroll(true);
    }
  }, [getKey, getTimestamp, scheduleScroll]);

  const handleSessionEvent = useCallback((event: SessionEvent) => {
    let newActivity: ActivityItem | null = null;
    let activityId: string | null = null;

    if (event.type === 'llm.call') {
      newActivity = { type: 'llm', data: event.llmCall };
      activityId = event.llmCall.id;
    } else if (event.type === 'probe.status') {
      newActivity = { type: 'probe', data: event.probe };
      activityId = `probe-${event.probe.jobId}-${event.probe.status}`;
    } else if (event.type === 'screenshot.captured') {
      newActivity = { type: 'screenshot', data: event.screenshot };
      activityId = event.screenshot.id;
    }

    if (newActivity && activityId) {
      addActivity(newActivity, activityId);
    }
  }, [addActivity]);

  const handleMrVersionEvent = useCallback((event: MrVersionEvent) => {
    if (event.type === 'checkpoint.created') {
      const checkpoint = event.checkpoint;
      addActivity(
        { type: 'checkpoint', data: checkpoint },
        `checkpoint-${checkpoint.id}`,
      );
    }
  }, [addActivity]);

  useSubscribeSessionEvents(handleSessionEvent);
  useMrVersionEvents(mrVersionId ?? null, handleMrVersionEvent);

  const getActivityId = (activity: ActivityItem): string => {
    return getKey(activity);
  };

  const showConnecting = connectionState === 'connecting' && activities.length === 0;
  const showError = connectionState === 'error' && activities.length === 0;

  if (showConnecting) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Sparkles className="size-4 text-muted-foreground" />
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
            <Sparkles className="size-4 text-muted-foreground" />
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
          <Sparkles className="size-4 text-muted-foreground" />
          Live Activity
          {isActive ? (
            <span className="flex items-center gap-1.5 text-xs text-primary font-medium ml-auto">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              Streaming
            </span>
          ) : activities.length > 0 ? (
            <span className="text-xs text-muted-foreground ml-auto">
              {activities.length} events
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
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
              <div className="space-y-2 pr-4">
                {activities.map((activity) => {
                  const id = getActivityId(activity);
                  const isNew = newIds.has(id);
                  switch (activity.type) {
                    case 'llm':
                      return <LlmCallCard key={id} llmCall={activity.data} isNew={isNew} />;
                    case 'probe':
                      return <ProbeStatusCard key={id} probe={activity.data} isNew={isNew} />;
                    case 'screenshot':
                      return <ScreenshotCard key={id} screenshot={activity.data} isNew={isNew} />;
                    case 'checkpoint':
                      return (
                        <CheckpointCard
                          key={id}
                          checkpoint={activity.data}
                          isNew={isNew}
                          variant="feed"
                        />
                      );
                  }
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
          <Sparkles className="size-4 text-muted-foreground" />
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
