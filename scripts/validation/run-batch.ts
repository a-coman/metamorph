import { loadValidationEnv } from './env.js';
loadValidationEnv();
import { createValidationApiClient } from './api.js';
import { parseBatchCli, resolveBatchSlots } from './cli.js';
import { TRANSFORM_FAMILIES } from './config.js';
import { writeCsv } from './csv.js';
import {
  ensureManifest,
  getSessionSlot,
  saveManifest,
  upsertSessionEntry,
  type BatchManifest,
  type FamilyResult,
  type SessionManifestEntry,
} from './manifest.js';
import { ensureOutDir, outPath } from './paths.js';
import { pollSessionUntilTerminal } from './poll.js';
import { disconnectPrisma, getPrisma } from './prisma.js';

async function buildFamilyResults(
  sessionId: string,
): Promise<FamilyResult[]> {
  const prisma = getPrisma();
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      mrVersions: {
        include: {
          mrDefinition: true,
          runs: {
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
        },
      },
    },
  });

  if (!session) {
    throw new Error(`Session ${sessionId} not found in database`);
  }

  return TRANSFORM_FAMILIES.map((transformFamily) => {
    const mrVersion = session.mrVersions.find(
      (version) => version.mrDefinition.transformFamily === transformFamily,
    );

    if (!mrVersion) {
      return {
        transformFamily,
        mrVersionId: null,
        status: 'missing',
        explorationSuccess: false,
        explorationFailureReason: null,
        initialAutoRunId: null,
        initialAutoRunStatus: null,
        initialAutoVerdictStrict: null,
      };
    }

    const explorationSuccess = mrVersion.playbookBlobId !== null;
    const initialRun = mrVersion.runs[0] ?? null;

    return {
      transformFamily,
      mrVersionId: mrVersion.id,
      status: mrVersion.status,
      explorationSuccess,
      explorationFailureReason: mrVersion.explorationFailureReason,
      initialAutoRunId: initialRun?.id ?? null,
      initialAutoRunStatus: initialRun?.status ?? null,
      initialAutoVerdictStrict: initialRun?.verdictStrict ?? null,
    };
  });
}

async function runSessionSlot(
  manifest: BatchManifest,
  slot: { domain: string; generation: number; url: string },
  force: boolean,
): Promise<void> {
  const existing = getSessionSlot(manifest, slot.domain, slot.generation);
  if (existing && !force) {
    console.log(`Skipping ${slot.domain} g${slot.generation} (already in manifest, use --force)`);
    return;
  }

  const api = createValidationApiClient();
  const startedAt = new Date().toISOString();

  console.log(`\n=== Creating session: ${slot.domain} generation ${slot.generation} ===`);
  console.log(`URL: ${slot.url}`);

  const created = await api.createSession({
    url: slot.url,
    mode: 'auto',
    weakOracle: false,
    transformFamilies: [...TRANSFORM_FAMILIES],
  });

  console.log(`Session created: ${created.sessionId}`);

  const pollResult = await pollSessionUntilTerminal(api, created.sessionId);
  if (!pollResult.allTerminal) {
    console.warn(`Warning: session ${created.sessionId} timed out before all families terminal`);
  }

  const families = await buildFamilyResults(created.sessionId);
  const entry: SessionManifestEntry = {
    domain: slot.domain,
    generation: slot.generation,
    url: slot.url,
    sessionId: created.sessionId,
    startedAt,
    finishedAt: new Date().toISOString(),
    families,
  };

  upsertSessionEntry(manifest, entry);
  await saveManifest(manifest);

  console.log(`Recorded ${slot.domain} g${slot.generation} → session ${created.sessionId}`);
}

async function writeBatchSessionsCsv(manifest: BatchManifest): Promise<void> {
  const rows = manifest.sessions.flatMap((session) =>
    session.families.map((family) => ({
      domain: session.domain,
      generation: session.generation,
      sessionId: session.sessionId,
      transformFamily: family.transformFamily,
      mrVersionId: family.mrVersionId ?? '',
      status: family.status,
      explorationSuccess: family.explorationSuccess,
      explorationFailureReason: family.explorationFailureReason ?? '',
      initialAutoRunId: family.initialAutoRunId ?? '',
      initialAutoVerdictStrict: family.initialAutoVerdictStrict ?? '',
      initialAutoRunStatus: family.initialAutoRunStatus ?? '',
    })),
  );

  await writeCsv(outPath('batch-sessions.csv'), rows);
}

async function main(): Promise<void> {
  const options = parseBatchCli(process.argv.slice(2));
  const slots = resolveBatchSlots(options);
  const manifest = await ensureManifest();
  await ensureOutDir();

  console.log(`Batch ${manifest.batchId}`);
  console.log(`Running ${slots.length} session slot(s)`);

  for (const slot of slots) {
    await runSessionSlot(manifest, slot, options.force);
  }

  await writeBatchSessionsCsv(manifest);
  console.log(`\nWrote ${outPath('batch-manifest.json')}`);
  console.log(`Wrote ${outPath('batch-sessions.csv')}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
