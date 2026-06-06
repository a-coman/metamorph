import { JobType as PrismaJobType, JobStatus as PrismaJobStatus } from '../../../../../api/generated/prisma/enums.js';
import { prisma } from '../../../shared/infrastructure/prisma/prisma-client.js';
import { LlmJobPublisherPort } from '../ports/llm-job-publisher.port.js';

export type ChainDiscoverLlmInput = {
  sessionId: string;
  sessionUrl: string;
  pageSnapshotId: string;
  parentDiscoverJobId: string;
};

export class ChainDiscoverLlmJobService {
  constructor(private readonly llmJobPublisher: LlmJobPublisherPort) {}

  async chain(input: ChainDiscoverLlmInput): Promise<{ jobId: string }> {
    const job = await prisma.job.create({
      data: {
        sessionId: input.sessionId,
        type: PrismaJobType.discover_llm,
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
      await this.llmJobPublisher.publishDiscoverLlmJob({
        jobId: job.id,
        sessionId: input.sessionId,
        pageSnapshotId: input.pageSnapshotId,
        url: input.sessionUrl,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to publish discover LLM job';

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
      `Chained discover_llm job ${job.id} for snapshot ${input.pageSnapshotId}`,
    );

    return { jobId: job.id };
  }
}
