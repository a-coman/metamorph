/** Matches the four default transform families (idempotence, subset, permutation, inverse). */
export const DEFAULT_WORKER_CONCURRENCY = 4;

const MAX_WORKER_CONCURRENCY = 16;

export function resolveWorkerConcurrency(
  envValue: string | undefined,
  fallback = DEFAULT_WORKER_CONCURRENCY,
): number {
  if (envValue === undefined || envValue.trim() === '') {
    return fallback;
  }

  const parsed = Number.parseInt(envValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, MAX_WORKER_CONCURRENCY);
}

export function resolvePlaywrightConcurrency(
  env: Record<string, string | undefined>,
): number {
  return resolveWorkerConcurrency(env.MAX_CONCURRENT_BROWSERS);
}

export function resolveLlmConcurrency(
  env: Record<string, string | undefined>,
): number {
  return resolveWorkerConcurrency(
    env.WORKER_LLM_CONCURRENCY ?? env.MAX_CONCURRENT_BROWSERS,
  );
}
