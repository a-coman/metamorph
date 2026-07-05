import type { SessionJobSummaryDto, SessionMrVersionSummaryDto } from '@metamorph/api-client';

export type PipelineStepId = 'discovery' | 'exploring' | 'review' | 'approved';
export type PipelineStepState = 'pending' | 'active' | 'done' | 'failed' | 'warning';

const ACTIVE_JOB_STATUSES = new Set(['queued', 'running']);

const POST_REVIEW_STATUSES = new Set([
  'approved',
  'replayable',
  'stale',
  'executing',
  'executed',
  'violation_pending_triage',
]);

function pendingSteps(): PipelineStepState[] {
  return ['pending', 'pending', 'pending', 'pending'];
}

function isPostReviewStatus(status: string): boolean {
  return POST_REVIEW_STATUSES.has(status);
}

function allVersionsPostReview(mrVersions: SessionMrVersionSummaryDto[]): boolean {
  return mrVersions.length > 0 && mrVersions.every((version) => isPostReviewStatus(version.status));
}

export function resolvePipelineStepStates(
  mr: SessionMrVersionSummaryDto | undefined,
  mrVersions: SessionMrVersionSummaryDto[],
  jobs: SessionJobSummaryDto[],
): PipelineStepState[] {
  const discoverJob = jobs.find((job) => job.type === 'discover');
  const discoverDone = discoverJob?.status === 'done';
  const discoverActive =
    discoverJob !== undefined && ACTIVE_JOB_STATUSES.has(discoverJob.status);
  const discoverFailed =
    discoverJob?.status === 'failed' || discoverJob?.status === 'enqueue_failed';

  if (!mr) {
    if (discoverFailed) {
      return ['failed', 'pending', 'pending', 'pending'];
    }
    if (discoverActive) {
      return ['active', 'pending', 'pending', 'pending'];
    }
    if (discoverDone) {
      return ['done', 'pending', 'pending', 'pending'];
    }
    return pendingSteps();
  }

  if (mrVersions.some((version) => version.status === 'exploring')) {
    return ['done', 'active', 'pending', 'pending'];
  }

  if (
    mrVersions.length > 0 &&
    mrVersions.some((version) => version.status === 'exploration_failed')
  ) {
    const allFailed = mrVersions.every(
      (version) => version.status === 'exploration_failed',
    );
    if (allFailed) {
      return ['done', 'failed', 'pending', 'pending'];
    }
    if (mrVersions.some((version) => version.status === 'draft_pending_hitl')) {
      return ['done', 'done', 'active', 'pending'];
    }
    return ['done', 'warning', 'pending', 'pending'];
  }

  switch (mr.status) {
    case 'exploring':
      return ['done', 'active', 'pending', 'pending'];
    case 'exploration_failed':
      return ['done', 'failed', 'pending', 'pending'];
    case 'draft_pending_hitl':
      return ['done', 'done', 'active', 'pending'];
    case 'approved':
    case 'replayable':
    case 'stale':
    case 'executing':
    case 'executed':
      if (allVersionsPostReview(mrVersions)) {
        if (mrVersions.some((version) => version.status === 'violation_pending_triage')) {
          return ['done', 'done', 'done', 'warning'];
        }
        return ['done', 'done', 'done', 'done'];
      }
      return ['done', 'done', 'active', 'pending'];
    case 'violation_pending_triage':
      return ['done', 'done', 'done', 'warning'];
    default:
      return pendingSteps();
  }
}
