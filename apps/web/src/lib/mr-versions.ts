import type { SessionMrVersionSummaryDto } from '@metamorph/api-client';

const FAMILY_ORDER = [
  'idempotence',
  'inclusion',
  'permutation',
  'inverse',
] as const;

export function sortMrVersionsByFamily(
  mrVersions: SessionMrVersionSummaryDto[],
): SessionMrVersionSummaryDto[] {
  return [...mrVersions].sort((left, right) => {
    const leftIndex = FAMILY_ORDER.indexOf(
      left.transformFamily as (typeof FAMILY_ORDER)[number],
    );
    const rightIndex = FAMILY_ORDER.indexOf(
      right.transformFamily as (typeof FAMILY_ORDER)[number],
    );
    const normalizedLeft = leftIndex === -1 ? FAMILY_ORDER.length : leftIndex;
    const normalizedRight = rightIndex === -1 ? FAMILY_ORDER.length : rightIndex;
    return normalizedLeft - normalizedRight;
  });
}

export function aggregateMrPipelineStatus(
  mrVersions: SessionMrVersionSummaryDto[],
): SessionMrVersionSummaryDto | undefined {
  if (mrVersions.length === 0) {
    return undefined;
  }

  const sorted = sortMrVersionsByFamily(mrVersions);

  if (sorted.some((mr) => mr.status === 'exploring')) {
    return sorted.find((mr) => mr.status === 'exploring') ?? sorted[0];
  }

  if (sorted.some((mr) => mr.status === 'exploration_failed')) {
    return sorted.find((mr) => mr.status === 'exploration_failed') ?? sorted[0];
  }

  if (sorted.some((mr) => mr.status === 'draft_pending_hitl')) {
    return sorted.find((mr) => mr.status === 'draft_pending_hitl') ?? sorted[0];
  }

  if (sorted.some((mr) => mr.status === 'violation_pending_triage')) {
    return sorted.find((mr) => mr.status === 'violation_pending_triage') ?? sorted[0];
  }

  return sorted[0];
}
