import type { Locator, Page } from 'playwright';
import {
  resolveInventoryItemTargetCandidates,
  type InventoryItem,
  type ResolvedInventoryTarget,
} from '@metamorph/core';
import { buildLocatorFromChain } from './parse-locator-chain.js';
import { runWithoutTrace } from './run-without-trace.js';

const DEFAULT_RESOLVE_TIMEOUT_MS = 5000;
const RESOLVE_POLL_INTERVAL_MS = 250;

export class UniqueTargetResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UniqueTargetResolutionError';
  }
}

export type ResolveUniqueTargetOptions = {
  timeoutMs?: number;
};

function buildCandidateLocator(
  page: Page,
  candidate: ResolvedInventoryTarget,
): Locator {
  return candidate.kind === 'locator'
    ? buildLocatorFromChain(page, candidate.value)
    : page.locator(candidate.value);
}

function firstLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\n')[0] ?? message;
}

/**
 * Resolves the first candidate that matches exactly one element on the live
 * page, polling until the timeout so late-rendered targets still resolve.
 * Verifying counts at action time (instead of trusting scan-time counts)
 * catches pages that changed between snapshot and probe.
 */
export async function resolveUniqueTargetLocator(
  page: Page,
  candidates: ResolvedInventoryTarget[],
  description: string,
  options?: ResolveUniqueTargetOptions,
): Promise<Locator> {
  if (candidates.length === 0) {
    throw new UniqueTargetResolutionError(
      `No target candidates for ${description}`,
    );
  }

  return runWithoutTrace(
    page,
    async () => {
      const timeoutMs = options?.timeoutMs ?? DEFAULT_RESOLVE_TIMEOUT_MS;
      const deadline = Date.now() + timeoutMs;
      let attempts: string[] = [];

      for (;;) {
        attempts = [];
        for (const candidate of candidates) {
          let count: number;
          let locator: Locator;
          try {
            locator = buildCandidateLocator(page, candidate);
            count = await locator.count();
          } catch (error) {
            attempts.push(`${candidate.value} -> invalid (${firstLine(error)})`);
            continue;
          }

          if (count === 1) {
            return locator;
          }
          attempts.push(`${candidate.value} -> ${count} matches`);
        }

        if (Date.now() >= deadline) {
          break;
        }
        await page.waitForTimeout(RESOLVE_POLL_INTERVAL_MS);
      }

      throw new UniqueTargetResolutionError(
        `No unique target for ${description} after ${timeoutMs}ms. Tried: ${attempts.join('; ')}`,
      );
    },
    { title: 'Resolve target' },
  );
}

export async function resolveInventoryItemLocator(
  page: Page,
  item: InventoryItem,
  options?: ResolveUniqueTargetOptions,
): Promise<Locator> {
  return resolveUniqueTargetLocator(
    page,
    resolveInventoryItemTargetCandidates(item),
    item.shortId,
    options,
  );
}
