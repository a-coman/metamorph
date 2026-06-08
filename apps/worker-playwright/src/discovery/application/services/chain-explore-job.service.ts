import { JobType as PrismaJobType, JobStatus as PrismaJobStatus } from '../../../../../api/generated/prisma/enums.js';
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

  async chain(input: ChainExploreInput): Promise<{ jobId: string }> {
    const job = await prisma.job.create({
      data: {
        sessionId: input.sessionId,
        type: PrismaJobType.explore,
        status: PrismaJobStatus.pending_enqueue,
        payload: {
          page_snapshot_id: input.pageSnapshotId,
          parent_discover_job_id: input.parentDiscoverJobId,
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
      `Chained explore job ${job.id} for snapshot ${input.pageSnapshotId}`,
    );

    return { jobId: job.id };
  }
}
