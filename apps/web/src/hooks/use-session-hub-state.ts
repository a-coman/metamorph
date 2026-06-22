'use client';

import { useState, useCallback } from 'react';
import { useSubscribeSessionEvents } from '@/hooks/session-events-context';
import type {
  SessionDetailsDto,
  SessionJobSummaryDto,
  SessionMrVersionSummaryDto,
  SessionEvent,
} from '@metamorph/api-client';

const ACTIVE_STATUSES = new Set(['queued', 'running']);

const ACTIVE_MR_STATUSES = new Set(['exploring', 'executing']);

export function resolveMrStatusBadge(mrStatus: string, controlStatus: string): string {
  if (
    (controlStatus === 'paused' || controlStatus === 'pausing') &&
    ACTIVE_MR_STATUSES.has(mrStatus)
  ) {
    return 'paused';
  }
  return mrStatus;
}

export function useSessionHubState(initial: SessionDetailsDto) {
  const [jobs, setJobs] = useState<SessionJobSummaryDto[]>(initial.jobs);
  const [mrVersions, setMrVersions] = useState<SessionMrVersionSummaryDto[]>(initial.mrVersions);
  const [controlStatus, setControlStatus] = useState(initial.controlStatus);

  const handleEvent = useCallback((event: SessionEvent) => {
    if (event.type === 'session.control_changed') {
      setControlStatus(event.controlStatus);
    } else if (event.type === 'job.updated') {
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

  useSubscribeSessionEvents(handleEvent);

  const hasActiveJob = jobs.some((j) => ACTIVE_STATUSES.has(j.status));
  const hasInterruptibleWork =
    hasActiveJob ||
    mrVersions.some((mr) => mr.status === 'exploring') ||
    controlStatus === 'pausing';
  const mr = mrVersions[0];

  return {
    jobs,
    mrVersions,
    controlStatus,
    setControlStatus,
    hasActiveJob,
    hasInterruptibleWork,
    mr,
  };
}
