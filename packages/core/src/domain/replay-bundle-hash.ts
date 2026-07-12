import { createHash } from 'node:crypto';
import type { ObservationSpec } from './schemas/observable.schema.js';

export type ReplayBundleHashInput = {
  playbookContent: string;
  observationSpec: ObservationSpec;
  templateVersion: string;
};

export type ReplayBundleHashResult = {
  contentHash: string;
  replayBundleHash: string;
};

/**
 * Produces stable JSON by sorting object keys recursively while preserving
 * array order. This keeps replay bundle hashes independent of object insertion
 * order without changing the semantic order of steps or observables.
 */
export function canonicalJson(value: unknown): string {
  const serialized = JSON.stringify(canonicalize(value));
  if (serialized === undefined) {
    throw new TypeError('Value cannot be represented as canonical JSON');
  }
  return serialized;
}

export function computeReplayBundleHash(
  input: ReplayBundleHashInput,
): ReplayBundleHashResult {
  const contentHash = sha256(input.playbookContent);
  const replayBundleHash = sha256(
    canonicalJson({
      observationSpec: input.observationSpec,
      playbookContent: input.playbookContent,
      templateVersion: input.templateVersion,
    }),
  );

  return { contentHash, replayBundleHash };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonicalize(record[key])]),
    );
  }

  return value;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
