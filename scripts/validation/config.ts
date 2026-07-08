import { execSync } from 'node:child_process';

export const TRANSFORM_FAMILIES = [
  'idempotence',
  'subset',
  'permutation',
  'inverse',
] as const;

export type TransformFamily = (typeof TRANSFORM_FAMILIES)[number];

export type ValidationDomain = {
  id: string;
  url: string;
  generations: number;
};

export const VALIDATION_DOMAINS: ValidationDomain[] = [
  { id: 'amazon', url: 'https://www.amazon.es/', generations: 10 },
  { id: 'booking', url: 'https://www.booking.com/', generations: 10 },
  { id: 'airbnb', url: 'https://www.airbnb.es/', generations: 10 },
  { id: 'mediamarkt', url: 'https://www.mediamarkt.es/', generations: 10 },
  { id: 'github', url: 'https://github.com/', generations: 10 },
];

export const TERMINAL_MR_STATUSES = new Set([
  'exploration_failed',
  'draft_pending_hitl',
  'approved',
  'replayable',
  'stale',
  'violation_pending_triage',
]);

export const TERMINAL_JOB_STATUSES = new Set(['done', 'failed', 'enqueue_failed']);

export const TERMINAL_RUN_STATUSES = new Set(['completed', 'failed']);

export function getDomainById(id: string): ValidationDomain | undefined {
  return VALIDATION_DOMAINS.find((domain) => domain.id === id);
}

export function listSessionSlots(): Array<{ domain: string; generation: number; url: string }> {
  const slots: Array<{ domain: string; generation: number; url: string }> = [];
  for (const domain of VALIDATION_DOMAINS) {
    for (let generation = 1; generation <= domain.generations; generation += 1) {
      slots.push({ domain: domain.id, generation, url: domain.url });
    }
  }
  return slots;
}

export function getGitSha(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export function buildBatchConfig() {
  return {
    gitSha: getGitSha(),
    openrouterModel: process.env.OPENROUTER_MODEL ?? 'unknown',
    playwrightLocale: process.env.PLAYWRIGHT_LOCALE ?? 'es-ES',
    weakOracle: false,
    sessionMode: 'auto' as const,
    transformFamilies: [...TRANSFORM_FAMILIES],
  };
}
