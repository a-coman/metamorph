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
  const observableItemsByFamily: Record<
    string,
    { pass: number; fail: number; total: number; passRate: number | null; failRate: number | null }
  > = Object.fromEntries(
    TRANSFORM_FAMILIES.map((family) => [
      family,
      { pass: 0, fail: 0, total: 0, passRate: null, failRate: null },
    ]),
  );

  // Count every observable evaluated in every completed run. A strict verdict is
  // an all-observable result, so restricting this to failing runs would make the
  // observable failure rate incomparable with its corresponding success rate.
  for (const verdict of verdicts) {
    const run = runById.get(verdict.runId);
    const details = parseEvaluationDetails(run?.inputBundle);
    for (const detail of Object.values(details)) {
      if (detail.ok !== true && detail.ok !== false) {
        continue;
      }
      const outcome = observableItemsByFamily[verdict.transformFamily]!;
      outcome.total += 1;
      outcome[detail.ok ? 'pass' : 'fail'] += 1;
    }
  }

  for (const outcome of Object.values(observableItemsByFamily)) {
    outcome.passRate = rate(outcome.pass, outcome.total);
    outcome.failRate = rate(outcome.fail, outcome.total);
  }

  const observableItems = Object.values(observableItemsByFamily).reduce(
    (total, outcome) => ({
      pass: total.pass + outcome.pass,
      fail: total.fail + outcome.fail,
      total: total.total + outcome.total,
    }),
    { pass: 0, fail: 0, total: 0 },
  );

  return {
    strictVerdicts: {
      total: verdicts.length,
      pass: passCount,
      fail: failCount,
      passRate: rate(passCount, verdicts.length),
      failRate: rate(failCount, verdicts.length),
      byFamily,
    },
    observableItems: {
      ...observableItems,
      passRate: rate(observableItems.pass, observableItems.total),
      failRate: rate(observableItems.fail, observableItems.total),
      byFamily: observableItemsByFamily,
    },
    failingRunCount: failingRuns.length,
  };
}
