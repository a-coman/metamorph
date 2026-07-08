import type { BatchManifest } from './manifest.js';
import { getPrisma } from './prisma.js';
import { rate, summarizeNumeric } from './stats.js';

export async function computeRq2Metrics(manifest: BatchManifest) {
  const compiledMrs = manifest.sessions.flatMap((session) =>
    session.families
      .filter((family) => family.explorationSuccess)
      .map((family) => ({
        domain: session.domain,
        mrVersionId: family.mrVersionId!,
        initialAutoRunId: family.initialAutoRunId,
        initialAutoRunStatus: family.initialAutoRunStatus,
      })),
  );

  const completed = compiledMrs.filter((mr) => mr.initialAutoRunStatus === 'completed');
  const executeCompletionRate = rate(completed.length, compiledMrs.length);

  const byDomain = Object.fromEntries(
    [...new Set(manifest.sessions.map((session) => session.domain))].map((domain) => {
      const domainMrs = compiledMrs.filter((mr) => mr.domain === domain);
      const domainCompleted = domainMrs.filter((mr) => mr.initialAutoRunStatus === 'completed');
      return [
        domain,
        {
          compiled: domainMrs.length,
          completed: domainCompleted.length,
          completionRate: rate(domainCompleted.length, domainMrs.length),
        },
      ];
    }),
  );

  const runIds = compiledMrs
    .map((mr) => mr.initialAutoRunId)
    .filter((id): id is string => id !== null);

  const prisma = getPrisma();
  const runs = await prisma.run.findMany({
    where: { id: { in: runIds } },
    include: { job: true },
  });

  const durationsMs = runs
    .map((run) => wallMs(run.job.startedAt, run.job.finishedAt))
    .filter((value): value is number => value !== null);

  return {
    executeCompletion: {
      compiledMrs: compiledMrs.length,
      completedRuns: completed.length,
      completionRate: executeCompletionRate,
      byDomain,
    },
    replayDuration: summarizeNumeric(durationsMs),
  };
}

function wallMs(startedAt: Date | null, finishedAt: Date | null): number | null {
  if (!startedAt || !finishedAt) {
    return null;
  }
  return finishedAt.getTime() - startedAt.getTime();
}
