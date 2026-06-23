import { TRANSFORM_FAMILIES } from '@metamorph/core';
import { JobType as PrismaJobType, JobStatus as PrismaJobStatus, SessionControlStatus } from '../../../../../api/generated/prisma/enums.js';
import { prisma } from '../../../shared/infrastructure/prisma/prisma-client.js';
import { LlmJobPublisherPort } from '../ports/llm-job-publisher.port.js';

export type ChainExploreInput = {
  sessionId: string;
  sessionUrl: string;
  pageSnapshotId: string;
  parentDiscoverJobId: string;
};

export class ChainExploreJobService {
  constructor(private readonly llmJobPublisher: LlmJobPublisherPort) {}

  async chain(input: ChainExploreInput): Promise<{ jobIds: string[] }> {
    const session = await prisma.session.findUnique({
      where: { id: input.sessionId },
      select: { controlStatus: true },
    });

    if (!session || session.controlStatus !== SessionControlStatus.active) {
      console.log(
        `Skipping explore chain for session ${input.sessionId} — control status ${session?.controlStatus ?? 'missing'}`,
      );
      return { jobIds: [] };
    }

    const jobIds: string[] = [];

    for (const transformFamily of TRANSFORM_FAMILIES) {
      const jobId = await this.createAndPublishExploreJob(input, transformFamily);
      if (jobId) {
        jobIds.push(jobId);
      }
    }

    return { jobIds };
  }

  private async createAndPublishExploreJob(
    input: ChainExploreInput,
    transformFamily: (typeof TRANSFORM_FAMILIES)[number],
  ): Promise<string | null> {
    const job = await prisma.job.create({
      data: {
        sessionId: input.sessionId,
        type: PrismaJobType.explore,
        status: PrismaJobStatus.pending_enqueue,
        payload: {
          page_snapshot_id: input.pageSnapshotId,
          parent_discover_job_id: input.parentDiscoverJobId,
          transform_family: transformFamily,
        },
      },
    });

    await prisma.job.update({
      where: { id: job.id },
      data: { status: PrismaJobStatus.queued },
    });

    try {
      await this.llmJobPublisher.publishExploreJob({
        jobId: job.id,
        sessionId: input.sessionId,
        pageSnapshotId: input.pageSnapshotId,
        url: input.sessionUrl,
        transformFamily,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to publish explore job';

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: PrismaJobStatus.enqueue_failed,
          errorMessage: message,
        },
      });

      throw error;
    }

    console.log(
      `Chained explore job ${job.id} (${transformFamily}) for snapshot ${input.pageSnapshotId}`,
    );

    return job.id;
  }
}
