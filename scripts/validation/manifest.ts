import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { TRANSFORM_FAMILIES, buildBatchConfig, type TransformFamily } from './config.js';
import { ensureOutDir, outPath } from './paths.js';

export type FamilyResult = {
  transformFamily: TransformFamily;
  mrVersionId: string | null;
  status: string;
  explorationSuccess: boolean;
  explorationFailureReason: string | null;
  initialAutoRunId: string | null;
  initialAutoRunStatus: string | null;
  initialAutoVerdictStrict: string | null;
};

export type SessionManifestEntry = {
  domain: string;
  generation: number;
  url: string;
  sessionId: string;
  startedAt: string;
  finishedAt: string;
  families: FamilyResult[];
};

export type BatchManifest = {
  batchId: string;
  createdAt: string;
  config: ReturnType<typeof buildBatchConfig>;
  sessions: SessionManifestEntry[];
};

export function manifestPath(): string {
  return outPath('batch-manifest.json');
}

export async function loadManifest(): Promise<BatchManifest | null> {
  try {
    const raw = await readFile(manifestPath(), 'utf8');
    return JSON.parse(raw) as BatchManifest;
  } catch {
    return null;
  }
}

export async function saveManifest(manifest: BatchManifest): Promise<void> {
  await ensureOutDir();
  await writeFile(manifestPath(), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export async function ensureManifest(): Promise<BatchManifest> {
  const existing = await loadManifest();
  if (existing) {
    return existing;
  }

  const manifest: BatchManifest = {
    batchId: randomUUID(),
    createdAt: new Date().toISOString(),
    config: buildBatchConfig(),
    sessions: [],
  };
  await saveManifest(manifest);
  return manifest;
}

export function getSessionSlot(
  manifest: BatchManifest,
  domain: string,
  generation: number,
): SessionManifestEntry | undefined {
  return manifest.sessions.find(
    (session) => session.domain === domain && session.generation === generation,
  );
}

export function isSlotComplete(entry: SessionManifestEntry): boolean {
  if (entry.families.length < TRANSFORM_FAMILIES.length) {
    return false;
  }
  return entry.families.every((family) => isFamilyTerminal(family));
}

function isFamilyTerminal(family: FamilyResult): boolean {
  if (!family.status || family.status === 'exploring') {
    return false;
  }
  if (family.explorationSuccess) {
    return (
      family.initialAutoRunStatus === 'completed' || family.initialAutoRunStatus === 'failed'
    );
  }
  return family.status === 'exploration_failed' || family.mrVersionId !== null;
}

export function upsertSessionEntry(
  manifest: BatchManifest,
  entry: SessionManifestEntry,
): void {
  const index = manifest.sessions.findIndex(
    (session) => session.domain === entry.domain && session.generation === entry.generation,
  );
  if (index >= 0) {
    manifest.sessions[index] = entry;
    return;
  }
  manifest.sessions.push(entry);
}
