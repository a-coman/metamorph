import { loadValidationEnv } from './env.js';
loadValidationEnv();
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { writeCsv } from './csv.js';
import { TRANSFORM_FAMILIES } from './config.js';
import { buildMrQualityRow } from './mr-quality-export.js';
import { loadManifest } from './manifest.js';
import { computeRq1Metrics } from './metrics-rq1.js';
import { computeRq2Metrics } from './metrics-rq2.js';
import { computeRq3Metrics } from './metrics-rq3.js';
import { listFailingObservables } from './verdict-triage-export.js';
import { ensureOutDir, outPath } from './paths.js';
import { disconnectPrisma, getPrisma } from './prisma.js';

async function writeJson(filename: string, data: unknown): Promise<void> {
  await writeFile(outPath(filename), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function exportFailureReasons(
  failureReasonCounts: Record<string, number>,
): Promise<void> {
  const rows = Object.entries(failureReasonCounts)
    .sort((left, right) => right[1] - left[1])
    .map(([reason, frequency]) => ({
      reason,
      frequency,
      taxonomy: '',
    }));
  await writeCsv(outPath('failure-reasons.csv'), rows);
}

async function exportVerdictTriageCsv(manifest: NonNullable<Awaited<ReturnType<typeof loadManifest>>>) {
  const prisma = getPrisma();

  const failingEntries = manifest.sessions.flatMap((session) =>
    session.families
      .filter(
        (family) =>
          family.initialAutoRunId &&
          family.initialAutoVerdictStrict === 'fail',
      )
      .map((family) => ({
        domain: session.domain,
        generation: session.generation,
        transformFamily: family.transformFamily,
        mrVersionId: family.mrVersionId ?? '',
        runId: family.initialAutoRunId ?? '',
      })),
  );

  const runs = await prisma.run.findMany({
    where: { id: { in: failingEntries.map((entry) => entry.runId) } },
    select: {
      id: true,
      inputBundle: true,
    },
  });
  const runById = new Map(runs.map((run) => [run.id, run]));

  const rows = [];
  for (const entry of failingEntries) {
    const run = runById.get(entry.runId);
    const failures = listFailingObservables(run?.inputBundle);

    if (failures.length === 0) {
      rows.push({
        domain: entry.domain,
        generation: entry.generation,
        transformFamily: entry.transformFamily,
        mrVersionId: entry.mrVersionId,
        runId: entry.runId,
        observable: '',
        compare: '',
        sourceValue: '',
        followUpValue: '',
        error: '',
        triage: '',
      });
      continue;
    }

    for (const failure of failures) {
      rows.push({
        domain: entry.domain,
        generation: entry.generation,
        transformFamily: entry.transformFamily,
        mrVersionId: entry.mrVersionId,
        runId: entry.runId,
        observable: failure.observable,
        compare: failure.compare,
        sourceValue: failure.sourceValue,
        followUpValue: failure.followUpValue,
        error: failure.error,
        triage: '',
      });
    }
  }

  await writeCsv(outPath('rq3-verdict-triage.csv'), rows);
}

async function exportMrQualityCsv(manifest: NonNullable<Awaited<ReturnType<typeof loadManifest>>>) {
  const prisma = getPrisma();
  const compiled = manifest.sessions.flatMap((session) =>
    session.families
      .filter((family) => family.explorationSuccess && family.mrVersionId)
      .map((family) => ({
        domain: session.domain,
        generation: session.generation,
        transformFamily: family.transformFamily,
        mrVersionId: family.mrVersionId!,
        rank: hashRank(`${session.domain}:${family.transformFamily}:${family.mrVersionId}`),
      })),
  );

  const selected: typeof compiled = [];
  for (const domain of [...new Set(manifest.sessions.map((session) => session.domain))]) {
    for (const family of TRANSFORM_FAMILIES) {
      const candidates = compiled
        .filter((row) => row.domain === domain && row.transformFamily === family)
        .sort((left, right) => left.rank - right.rank);
      if (candidates[0]) {
        selected.push(candidates[0]);
      }
    }
  }

  const mrVersions = await prisma.mrVersion.findMany({
    where: { id: { in: selected.map((row) => row.mrVersionId) } },
    include: { mrDefinition: true },
  });
  const mrById = new Map(mrVersions.map((version) => [version.id, version]));

  const runIds = manifest.sessions.flatMap((session) =>
    session.families
      .map((family) => family.initialAutoRunId)
      .filter((id): id is string => id !== null),
  );
  const runs = await prisma.run.findMany({
    where: { id: { in: runIds } },
    include: { observations: true },
  });
  const runById = new Map(runs.map((run) => [run.id, run]));

  const rows = selected.map((entry) => {
    const mrVersion = mrById.get(entry.mrVersionId);
    const familyEntry = manifest.sessions
      .flatMap((session) =>
        session.families.map((family) => ({ session, family })),
      )
      .find(({ family }) => family.mrVersionId === entry.mrVersionId);
    const run = familyEntry?.family.initialAutoRunId
      ? runById.get(familyEntry.family.initialAutoRunId)
      : undefined;
    const sourceObservation = run?.observations.find(
      (observation) => observation.role === 'source',
    );
    const followUpObservation = run?.observations.find(
      (observation) => observation.role === 'follow_up',
    );

    return buildMrQualityRow({
      domain: entry.domain,
      generation: entry.generation,
      transformFamily: entry.transformFamily,
      mrVersionId: entry.mrVersionId,
      definition: mrVersion?.mrDefinition.definition as Record<string, unknown> | undefined,
      explorationGoals: mrVersion?.explorationGoals as Record<string, unknown> | null | undefined,
      generationSlots: mrVersion?.generationSlots as Record<string, unknown> | undefined,
      sourceObservationPayload: sourceObservation?.payload,
      followUpObservationPayload: followUpObservation?.payload,
    });
  });

  await writeCsv(outPath('rq3-mr-quality.csv'), rows);
}

function hashRank(seed: string): number {
  const hash = createHash('sha256').update(seed).digest('hex');
  return Number.parseInt(hash.slice(0, 8), 16);
}

async function main(): Promise<void> {
  const manifest = await loadManifest();
  if (!manifest) {
    throw new Error(`Manifest not found at ${outPath('batch-manifest.json')}. Run validation:batch first.`);
  }

  await ensureOutDir();

  const rq1 = await computeRq1Metrics(manifest);
  const rq2 = await computeRq2Metrics(manifest);
  const rq3 = await computeRq3Metrics(manifest);

  await writeJson('metrics-rq1.json', rq1);
  await writeJson('metrics-rq2.json', rq2);
  await writeJson('metrics-rq3.json', rq3);

  await exportFailureReasons(rq1.failureReasonCounts);
  await exportVerdictTriageCsv(manifest);
  await exportMrQualityCsv(manifest);

  console.log(`Wrote ${outPath('metrics-rq1.json')}`);
  console.log(`Wrote ${outPath('metrics-rq2.json')}`);
  console.log(`Wrote ${outPath('metrics-rq3.json')}`);
  console.log(`Wrote ${outPath('failure-reasons.csv')}`);
  console.log(`Wrote ${outPath('rq3-verdict-triage.csv')}`);
  console.log(`Wrote ${outPath('rq3-mr-quality.csv')}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
