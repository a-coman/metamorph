import { createHash } from 'node:crypto';
import type { BatchManifest } from './manifest.js';
import { TRANSFORM_FAMILIES } from './config.js';

export type ReplayRunRecord = {
  kind: 'initial_auto' | 'replay';
  runId: string;
  status: string;
  verdictStrict: string | null;
  sourcePayloadHash: string | null;
  followUpPayloadHash: string | null;
};

export type ReplayConsistencyClass =
  | 'stable'
  | 'verdict_drift'
  | 'observation_drift'
  | 'execute_failure';

export type ReplayMrResult = {
  domain: string;
  transformFamily: string;
  mrVersionId: string;
  runs: ReplayRunRecord[];
  consistencyClass: ReplayConsistencyClass;
};

export function classifyReplayConsistency(runs: ReplayRunRecord[]): ReplayConsistencyClass {
  if (runs.length === 0) {
    return 'execute_failure';
  }

  if (runs.some((run) => run.status !== 'completed')) {
    return 'execute_failure';
  }

  const verdicts = runs.map((run) => run.verdictStrict);
  const sourceHashes = runs.map((run) => run.sourcePayloadHash);
  const followUpHashes = runs.map((run) => run.followUpPayloadHash);

  const verdictsMatch = verdicts.every((verdict) => verdict === verdicts[0]);
  const sourceMatch = sourceHashes.every((hash) => hash === sourceHashes[0]);
  const followUpMatch = followUpHashes.every((hash) => hash === followUpHashes[0]);

  if (verdictsMatch && sourceMatch && followUpMatch) {
    return 'stable';
  }
  if (sourceMatch && followUpMatch && !verdictsMatch) {
    return 'verdict_drift';
  }
  if (verdictsMatch && (!sourceMatch || !followUpMatch)) {
    return 'observation_drift';
  }
  return 'observation_drift';
}

export function selectReplaySample(manifest: BatchManifest): Array<{
  domain: string;
  transformFamily: string;
  mrVersionId: string;
  initialAutoRunId: string | null;
}> {
  const selected: Array<{
    domain: string;
    transformFamily: string;
    mrVersionId: string;
    initialAutoRunId: string | null;
    rank: number;
    generation: number;
  }> = [];

  const domains = [...new Set(manifest.sessions.map((session) => session.domain))];

  for (const domain of domains) {
    for (const family of TRANSFORM_FAMILIES) {
      const candidates = manifest.sessions
        .flatMap((session) =>
          session.families
            .filter(
              (row) =>
                session.domain === domain &&
                row.transformFamily === family &&
                row.explorationSuccess &&
                row.mrVersionId,
            )
            .map((row) => ({
              domain: session.domain,
              transformFamily: row.transformFamily,
              mrVersionId: row.mrVersionId!,
              initialAutoRunId: row.initialAutoRunId,
              generation: session.generation,
              rank: hashRank(`${domain}:${family}:${session.generation}:${row.mrVersionId}`),
            })),
        )
        .sort((left, right) => left.rank - right.rank);

      for (const candidate of candidates.slice(0, 2)) {
        selected.push(candidate);
      }
    }
  }

  return selected.map(({ rank: _rank, generation: _generation, ...rest }) => rest);
}

function hashRank(seed: string): number {
  const hash = createHash('sha256').update(seed).digest('hex');
  return Number.parseInt(hash.slice(0, 8), 16);
}

export function aggregateReplayResults(results: ReplayMrResult[]) {
  const overall = countClasses(results);
  const byDomain: Record<string, ReturnType<typeof countClasses>> = {};
  const byFamily: Record<string, ReturnType<typeof countClasses>> = {};

  for (const domain of [...new Set(results.map((result) => result.domain))]) {
    byDomain[domain] = countClasses(results.filter((result) => result.domain === domain));
  }
  for (const family of TRANSFORM_FAMILIES) {
    byFamily[family] = countClasses(
      results.filter((result) => result.transformFamily === family),
    );
  }

  return {
    sampleSize: results.length,
    overall,
    byDomain,
    byFamily,
    rows: results,
  };
}

function countClasses(results: ReplayMrResult[]) {
  const counts = {
    stable: 0,
    verdict_drift: 0,
    observation_drift: 0,
    execute_failure: 0,
  };
  for (const result of results) {
    counts[result.consistencyClass] += 1;
  }
  const total = results.length;
  return {
    ...counts,
    stableRate: total ? counts.stable / total : null,
    verdictDriftRate: total ? counts.verdict_drift / total : null,
    observationDriftRate: total ? counts.observation_drift / total : null,
    executeFailureRate: total ? counts.execute_failure / total : null,
  };
}
