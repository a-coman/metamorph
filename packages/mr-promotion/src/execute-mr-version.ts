import { MrPromotionError } from './errors.js';
import type { MrPromotionDeps } from './mr-promotion-deps.js';

export type ExecuteMrVersionResult = {
  jobId: string;
  runId: string;
  status: 'queued' | 'enqueue_failed';
};

export async function executeMrVersion(
  deps: MrPromotionDeps,
  mrVersionId: string,
): Promise<ExecuteMrVersionResult> {
  const mrVersion = await deps.prisma.mrVersion.findUnique({
    where: { id: mrVersionId },
    include: {
      session: true,
      playbookBlob: true,
    },
  });

  if (!mrVersion) {
    throw new MrPromotionError('not_found', `MR version ${mrVersionId} not found`);
  }

  if (mrVersion.status !== 'approved') {
    throw new MrPromotionError(
      'invalid_status',
      `MR version ${mrVersionId} must be approved before execute (status=${mrVersion.status})`,
    );
  }

  if (!mrVersion.playbookBlob) {
    throw new MrPromotionError(
      'missing_playbook',
      `MR version ${mrVersionId} has no compiled playbook`,
    );
  }

  const session = mrVersion.session;
  if (!session) {
    throw new MrPromotionError('not_found', `Session for MR version ${mrVersionId} not found`);
  }

  const created = await deps.prisma.$transaction(async (tx) => {
    const job = await tx.job.create({
      data: {
        sessionId: mrVersion.sessionId,
        mrVersionId: mrVersion.id,
        type: 'execute_pair',
        status: 'pending_enqueue',
        payload: {},
      },
    });

    const run = await tx.run.create({
      data: {
        mrVersionId: mrVersion.id,
        jobId: job.id,
        status: 'pending',
        playbookContentHash: mrVersion.playbookBlob?.contentHash,
      },
    });

    await tx.job.update({
      where: { id: job.id },
      data: {
        payload: {
          run_id: run.id,
          url: session.url,
        },
      },
    });

    return { jobId: job.id, runId: run.id };
  });

  await deps.prisma.job.update({
    where: { id: created.jobId },
    data: { status: 'queued' },
  });

  try {
    await deps.publishExecutePairJob({
      jobId: created.jobId,
      sessionId: mrVersion.sessionId,
      mrVersionId: mrVersion.id,
      runId: created.runId,
      url: session.url,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to publish execute pair job';

    await deps.prisma.job.update({
      where: { id: created.jobId },
      data: {
        status: 'enqueue_failed',
        errorMessage: message,
      },
    });

    return {
      jobId: created.jobId,
      runId: created.runId,
      status: 'enqueue_failed',
    };
  }

  return {
    jobId: created.jobId,
    runId: created.runId,
    status: 'queued',
  };
}
