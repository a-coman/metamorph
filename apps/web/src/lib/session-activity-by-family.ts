import type {
  ExplorationCheckpointDto,
  LlmCallDto,
  ProbeStatusDto,
  ScreenshotDto,
  SessionMrVersionSummaryDto,
} from '@metamorph/api-client';
import type { HydratedActivityState } from '@/lib/hydrate-session-activity';
import {
  buildExplorationCycles,
  buildTimelineFeed,
  type ExplorationCycle,
  type StandaloneActivity,
  type TimelineFeedItem,
} from '@/lib/exploration-cycles';
import { sortMrVersionsByFamily } from '@/lib/mr-versions';

export type ExploreJobAttributionMap = Map<
  string,
  { mrVersionId: string | null; transformFamily: string | null }
>;

export type FamilyActivityBucket = {
  family: string;
  mrVersionId: string;
  status: string;
  cycles: ExplorationCycle[];
  standalone: StandaloneActivity[];
  feed: TimelineFeedItem[];
  eventCount: number;
  hasInFlightActivity: boolean;
};

export type SessionActivityBucket = {
  cycles: ExplorationCycle[];
  standalone: StandaloneActivity[];
  feed: TimelineFeedItem[];
  eventCount: number;
};

export type SessionActivityByFamilyResult = {
  families: FamilyActivityBucket[];
  session: SessionActivityBucket;
};

export type ActivitySelection =
  | { kind: 'session' }
  | { kind: 'family'; family: string; mrVersionId: string };

function matchesMr(
  mrVersionId: string | null | undefined,
  transformFamily: string | null | undefined,
  exploreJobId: string | null | undefined,
  target: SessionMrVersionSummaryDto,
  exploreJobs: ExploreJobAttributionMap,
): boolean {
  if (mrVersionId && mrVersionId === target.id) {
    return true;
  }
  if (transformFamily && transformFamily === target.transformFamily) {
    return true;
  }
  if (exploreJobId) {
    const attribution = exploreJobs.get(exploreJobId);
    if (attribution?.mrVersionId === target.id) {
      return true;
    }
    if (attribution?.transformFamily === target.transformFamily) {
      return true;
    }
  }
  return false;
}

function isSessionLevelLlm(
  llm: LlmCallDto,
  exploreJobs: ExploreJobAttributionMap,
): boolean {
  if (llm.mrVersionId || llm.transformFamily) {
    return false;
  }
  if (llm.exploreJobId && exploreJobs.has(llm.exploreJobId)) {
    return false;
  }
  if (llm.jobId && exploreJobs.has(llm.jobId)) {
    return false;
  }
  return true;
}

function filterActivityForMr(
  state: HydratedActivityState,
  mr: SessionMrVersionSummaryDto,
  exploreJobs: ExploreJobAttributionMap,
): HydratedActivityState {
  const llmCalls = new Map<string, LlmCallDto>();
  for (const [id, llm] of state.llmCalls) {
    if (
      matchesMr(
        llm.mrVersionId,
        llm.transformFamily,
        llm.exploreJobId ?? llm.jobId,
        mr,
        exploreJobs,
      )
    ) {
      llmCalls.set(id, llm);
    }
  }

  const probes = new Map<string, ProbeStatusDto>();
  for (const [id, probe] of state.probes) {
    if (
      matchesMr(
        probe.mrVersionId,
        probe.transformFamily,
        probe.exploreJobId,
        mr,
        exploreJobs,
      )
    ) {
      probes.set(id, probe);
    }
  }

  const checkpoints = new Map<string, ExplorationCheckpointDto>();
  for (const [id, checkpoint] of state.checkpoints) {
    if (checkpoint.mrVersionId === mr.id) {
      checkpoints.set(id, checkpoint);
    }
  }

  return {
    llmCalls,
    probes,
    screenshots: new Map<string, ScreenshotDto>(),
    checkpoints,
    terminalExploreJobs: state.terminalExploreJobs,
  };
}

function filterSessionLevelActivity(
  state: HydratedActivityState,
  mrVersions: SessionMrVersionSummaryDto[],
  exploreJobs: ExploreJobAttributionMap,
): HydratedActivityState {
  const llmCalls = new Map<string, LlmCallDto>();
  for (const [id, llm] of state.llmCalls) {
    if (isSessionLevelLlm(llm, exploreJobs)) {
      llmCalls.set(id, llm);
      continue;
    }
    const attributed = mrVersions.some((mr) =>
      matchesMr(
        llm.mrVersionId,
        llm.transformFamily,
        llm.exploreJobId ?? llm.jobId,
        mr,
        exploreJobs,
      ),
    );
    if (!attributed) {
      llmCalls.set(id, llm);
    }
  }

  const probes = new Map<string, ProbeStatusDto>();
  for (const [id, probe] of state.probes) {
    const attributed = mrVersions.some((mr) =>
      matchesMr(
        probe.mrVersionId,
        probe.transformFamily,
        probe.exploreJobId,
        mr,
        exploreJobs,
      ),
    );
    if (!attributed) {
      probes.set(id, probe);
    }
  }

  return {
    llmCalls,
    probes,
    screenshots: state.screenshots,
    checkpoints: new Map<string, ExplorationCheckpointDto>(),
    terminalExploreJobs: state.terminalExploreJobs,
  };
}

function hasInFlight(
  llmCalls: Map<string, LlmCallDto>,
  probes: Map<string, ProbeStatusDto>,
): boolean {
  for (const llm of llmCalls.values()) {
    if (llm.status === 'running') {
      return true;
    }
  }
  for (const probe of probes.values()) {
    if (probe.status === 'queued' || probe.status === 'running') {
      return true;
    }
  }
  return false;
}

function filterActivityForFamilyView(
  state: HydratedActivityState,
  mr: SessionMrVersionSummaryDto,
  exploreJobs: ExploreJobAttributionMap,
): HydratedActivityState {
  const family = filterActivityForMr(state, mr, exploreJobs);

  const llmCalls = new Map(family.llmCalls);
  for (const [id, llm] of state.llmCalls) {
    if (isSessionLevelLlm(llm, exploreJobs)) {
      llmCalls.set(id, llm);
    }
  }

  return {
    llmCalls,
    probes: family.probes,
    screenshots: state.screenshots,
    checkpoints: family.checkpoints,
    terminalExploreJobs: state.terminalExploreJobs,
  };
}

export function buildSessionActivityByFamily(
  state: HydratedActivityState,
  mrVersions: SessionMrVersionSummaryDto[],
  exploreJobs: ExploreJobAttributionMap = new Map(),
): SessionActivityByFamilyResult {
  const sorted = sortMrVersionsByFamily(mrVersions);

  const sessionFiltered = filterSessionLevelActivity(
    state,
    mrVersions,
    exploreJobs,
  );
  const sessionCycles = buildExplorationCycles(sessionFiltered);
  const sessionFeed = buildTimelineFeed(
    sessionCycles.cycles,
    sessionCycles.standalone,
  );

  const families = sorted.map((mr) => {
    const filtered = filterActivityForFamilyView(state, mr, exploreJobs);
    const { cycles, standalone } = buildExplorationCycles(filtered);
    const feed = buildTimelineFeed(cycles, standalone);
    const familyOnly = filterActivityForMr(state, mr, exploreJobs);

    return {
      family: mr.transformFamily,
      mrVersionId: mr.id,
      status: mr.status,
      cycles,
      standalone,
      feed,
      eventCount: feed.length,
      hasInFlightActivity: hasInFlight(familyOnly.llmCalls, familyOnly.probes),
    };
  });

  return {
    families,
    session: {
      cycles: sessionCycles.cycles,
      standalone: sessionCycles.standalone,
      feed: sessionFeed,
      eventCount: sessionFeed.length,
    },
  };
}

export function resolveDefaultActivitySelection(
  mrVersions: SessionMrVersionSummaryDto[],
): ActivitySelection {
  const sorted = sortMrVersionsByFamily(mrVersions);
  const exploring = sorted.find((mr) => mr.status === 'exploring');
  if (exploring) {
    return {
      kind: 'family',
      family: exploring.transformFamily,
      mrVersionId: exploring.id,
    };
  }

  const failed = sorted.find((mr) => mr.status === 'exploration_failed');
  if (failed) {
    return {
      kind: 'family',
      family: failed.transformFamily,
      mrVersionId: failed.id,
    };
  }

  if (sorted.length > 0) {
    return {
      kind: 'family',
      family: sorted[0].transformFamily,
      mrVersionId: sorted[0].id,
    };
  }

  return { kind: 'session' };
}

export function syncActivitySelection(
  current: ActivitySelection,
  mrVersions: SessionMrVersionSummaryDto[],
): ActivitySelection {
  if (current.kind === 'family') {
    const stillValid = mrVersions.some((mr) => mr.id === current.mrVersionId);
    if (stillValid) {
      return current;
    }
  }

  const next = resolveDefaultActivitySelection(mrVersions);
  if (
    current.kind === next.kind &&
    (current.kind === 'session' ||
      (current.kind === 'family' &&
        next.kind === 'family' &&
        current.mrVersionId === next.mrVersionId))
  ) {
    return current;
  }

  return next;
}

export function buildExploreJobAttributionFromSessionJobs(
  jobs: Array<{
    id: string;
    type: string;
    payload?: unknown;
    mrVersionId?: string | null;
  }>,
  mrVersions: SessionMrVersionSummaryDto[],
): ExploreJobAttributionMap {
  const mrFamilies = new Map(mrVersions.map((mr) => [mr.id, mr.transformFamily]));
  const map: ExploreJobAttributionMap = new Map();

  for (const job of jobs) {
    if (job.type !== 'explore') {
      continue;
    }
    const payload = job.payload as Record<string, unknown> | null;
    const payloadFamily =
      typeof payload?.transform_family === 'string'
        ? payload.transform_family
        : null;
    const mrVersionId = job.mrVersionId ?? null;
    const transformFamily =
      payloadFamily ??
      (mrVersionId ? mrFamilies.get(mrVersionId) ?? null : null);
    map.set(job.id, { mrVersionId, transformFamily });
  }

  return map;
}
