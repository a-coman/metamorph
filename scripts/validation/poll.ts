import type { ApiClient, SessionDetailsDto } from '@metamorph/api-client';
import {
  TERMINAL_JOB_STATUSES,
  TERMINAL_MR_STATUSES,
  TERMINAL_RUN_STATUSES,
  TRANSFORM_FAMILIES,
} from './config.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type PollSessionResult = {
  session: SessionDetailsDto;
  allTerminal: boolean;
};

export async function pollSessionUntilTerminal(
  api: ApiClient,
  sessionId: string,
  options?: { maxIterations?: number; intervalMs?: number },
): Promise<PollSessionResult> {
  const maxIterations = options?.maxIterations ?? 300;
  const intervalMs = options?.intervalMs ?? 10_000;

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const session = await api.getSession(sessionId);
    const summary = summarizeSession(session);
    console.log(`[${iteration}/${maxIterations}] session=${sessionId} ${summary}`);

    if (await isSessionTerminal(api, session)) {
      return { session, allTerminal: true };
    }

    await sleep(intervalMs);
  }

  const session = await api.getSession(sessionId);
  return { session, allTerminal: false };
}

export async function pollRunUntilTerminal(
  api: ApiClient,
  runId: string,
  options?: { maxIterations?: number; intervalMs?: number },
): Promise<{ status: string; verdictStrict: string | null }> {
  const maxIterations = options?.maxIterations ?? 60;
  const intervalMs = options?.intervalMs ?? 10_000;

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const run = await api.getRun(runId);
    console.log(
      `[${iteration}/${maxIterations}] run=${runId} status=${run.status} verdict=${run.verdictStrict ?? 'null'}`,
    );
    if (TERMINAL_RUN_STATUSES.has(run.status)) {
      return { status: run.status, verdictStrict: run.verdictStrict };
    }
    await sleep(intervalMs);
  }

  const run = await api.getRun(runId);
  return { status: run.status, verdictStrict: run.verdictStrict };
}

async function isSessionTerminal(api: ApiClient, session: SessionDetailsDto): Promise<boolean> {
  const discoverJob = session.jobs.find((job) => job.type === 'discover');
  if (!discoverJob || !TERMINAL_JOB_STATUSES.has(discoverJob.status)) {
    return false;
  }

  if (discoverJob.status === 'failed') {
    return true;
  }

  const exploreJobs = session.jobs.filter((job) => job.type === 'explore');
  if (exploreJobs.some((job) => !TERMINAL_JOB_STATUSES.has(job.status))) {
    return false;
  }

  for (const family of TRANSFORM_FAMILIES) {
    const mr = session.mrVersions.find((version) => version.transformFamily === family);
    if (!mr) {
      if (exploreJobs.length < TRANSFORM_FAMILIES.length) {
        return false;
      }
      continue;
    }

    if (!TERMINAL_MR_STATUSES.has(mr.status)) {
      return false;
    }

    if (mr.status === 'exploration_failed') {
      continue;
    }

    const terminal = await isCompiledMrExecuteTerminal(api, mr.id, mr.status);
    if (!terminal) {
      return false;
    }
  }

  return true;
}

async function isCompiledMrExecuteTerminal(
  api: ApiClient,
  mrVersionId: string,
  status: string,
): Promise<boolean> {
  if (status === 'draft_pending_hitl') {
    return false;
  }

  const runs = await api.listRuns(mrVersionId);
  if (runs.length === 0) {
    return status === 'exploration_failed';
  }

  const latestRun = runs[0];
  if (!latestRun) {
    return false;
  }

  return TERMINAL_RUN_STATUSES.has(latestRun.status);
}

function summarizeSession(session: SessionDetailsDto): string {
  const jobs = session.jobs.map((job) => `${job.type}:${job.status}`).join(',');
  const mrs = TRANSFORM_FAMILIES.map((family) => {
    const mr = session.mrVersions.find((version) => version.transformFamily === family);
    return `${family}:${mr?.status ?? 'missing'}`;
  }).join(' | ');
  return `jobs=[${jobs}] mrs=${mrs}`;
}
