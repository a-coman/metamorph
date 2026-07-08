import type { BatchManifest } from './manifest.js';
import { getPrisma } from './prisma.js';
import { rate } from './stats.js';
import { TRANSFORM_FAMILIES } from './config.js';
import {
  listFailingObservables,
  parseEvaluationDetails,
} from './verdict-triage-export.js';

export async function computeRq3Metrics(manifest: BatchManifest) {
  const initialRuns = manifest.sessions.flatMap((session) =>
    session.families
      .filter(
        (family) =>
          family.initialAutoRunId &&
          family.initialAutoRunStatus === 'completed',
      )
      .map((family) => ({
        domain: session.domain,
        transformFamily: family.transformFamily,
        mrVersionId: family.mrVersionId!,
        runId: family.initialAutoRunId!,
        verdictStrict: family.initialAutoVerdictStrict,
      })),
  );

  const prisma = getPrisma();
  const runs = await prisma.run.findMany({
    where: { id: { in: initialRuns.map((run) => run.runId) } },
    select: {
      id: true,
      verdictStrict: true,
      inputBundle: true,
    },
  });

  const runById = new Map(runs.map((run) => [run.id, run]));

  const verdicts = initialRuns.map((entry) => {
    const run = runById.get(entry.runId);
    return {
      ...entry,
      verdictStrict: run?.verdictStrict ?? entry.verdictStrict,
    };
  });

  const passCount = verdicts.filter((run) => run.verdictStrict === 'pass').length;
  const failCount = verdicts.filter((run) => run.verdictStrict === 'fail').length;

  const byFamily = Object.fromEntries(
    TRANSFORM_FAMILIES.map((family) => {
      const familyRuns = verdicts.filter((run) => run.transformFamily === family);
      const passes = familyRuns.filter((run) => run.verdictStrict === 'pass').length;
      const fails = familyRuns.filter((run) => run.verdictStrict === 'fail').length;
      return [
        family,
        {
          total: familyRuns.length,
          pass: passes,
          fail: fails,
          passRate: rate(passes, familyRuns.length),
          failRate: rate(fails, familyRuns.length),
        },
      ];
    }),
  );

  const failingRuns = verdicts.filter((run) => run.verdictStrict === 'fail');
  const observableFailures: Record<string, { failures: number; opportunities: number; failureRate: number | null }> = {};

  for (const failingRun of failingRuns) {
    const run = runById.get(failingRun.runId);
    const details = parseEvaluationDetails(run?.inputBundle);
    for (const [key, detail] of Object.entries(details)) {
      if (!observableFailures[key]) {
        observableFailures[key] = { failures: 0, opportunities: 0, failureRate: null };
      }
      observableFailures[key]!.opportunities += 1;
      if (detail.ok === false) {
        observableFailures[key]!.failures += 1;
      }
    }
  }

  for (const key of Object.keys(observableFailures)) {
    const row = observableFailures[key]!;
    row.failureRate = rate(row.failures, row.opportunities);
  }

  return {
    strictVerdicts: {
      total: verdicts.length,
      pass: passCount,
      fail: failCount,
      passRate: rate(passCount, verdicts.length),
      failRate: rate(failCount, verdicts.length),
      byFamily,
    },
    perObservableFailureRate: observableFailures,
    failingRunCount: failingRuns.length,
  };
}
