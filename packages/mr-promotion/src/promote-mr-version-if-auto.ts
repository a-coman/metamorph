import { approveMrVersion } from './approve-mr-version.js';
import { executeMrVersion } from './execute-mr-version.js';
import { MrPromotionError } from './errors.js';
import type { MrPromotionDeps } from './mr-promotion-deps.js';

export type PromoteResult =
  | { outcome: 'skipped'; reason: 'hitl' | 'paused' | 'wrong_status' }
  | { outcome: 'promoted'; jobId: string; runId: string }
  | { outcome: 'failed'; step: 'approve' | 'execute' | 'enqueue'; error: string };

export async function promoteMrVersionIfAuto(
  deps: MrPromotionDeps,
  mrVersionId: string,
): Promise<PromoteResult> {
  const mrVersion = await deps.prisma.mrVersion.findUnique({
    where: { id: mrVersionId },
    select: {
      id: true,
      sessionId: true,
      status: true,
      playbookBlobId: true,
      session: {
        select: {
          mode: true,
          controlStatus: true,
          url: true,
        },
      },
    },
  });

  if (!mrVersion?.session) {
    return {
      outcome: 'failed',
      step: 'approve',
      error: `MR version ${mrVersionId} not found`,
    };
  }

  if (mrVersion.session.mode !== 'auto') {
    return { outcome: 'skipped', reason: 'hitl' };
  }

  if (
    mrVersion.session.controlStatus === 'paused' ||
    mrVersion.session.controlStatus === 'pausing'
  ) {
    return { outcome: 'skipped', reason: 'paused' };
  }

  if (mrVersion.status !== 'draft_pending_hitl') {
    return { outcome: 'skipped', reason: 'wrong_status' };
  }

  try {
    await approveMrVersion(deps.prisma, mrVersionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Approve failed';
    return { outcome: 'failed', step: 'approve', error: message };
  }

  try {
    const executed = await executeMrVersion(deps, mrVersionId);

    if (executed.status === 'enqueue_failed') {
      return {
        outcome: 'failed',
        step: 'enqueue',
        error: 'Failed to publish execute pair job',
      };
    }

    return {
      outcome: 'promoted',
      jobId: executed.jobId,
      runId: executed.runId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Execute failed';
    return { outcome: 'failed', step: 'execute', error: message };
  }
}

export { MrPromotionError };
