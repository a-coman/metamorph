import { UniqueEntityID } from '@metamorph/utils';
import { JobType as PrismaJobType } from '../../../../../../api/generated/prisma/enums.js';
import { prisma } from '../../../../shared/infrastructure/prisma/prisma-client.js';
import { ExploreJob } from '../../../domain/entities/explore-job.entity.js';
import { ExploreJobRepositoryPort } from '../../../domain/repositories/explore-job.repository.port.js';
import { JobType } from '../../../domain/enums/job-type.enum.js';
import { JobStatus } from '../../../domain/enums/job-status.enum.js';

type ExplorePayloadJson = {
  page_snapshot_id: string;
};

export class ExploreJobPrismaRepository extends ExploreJobRepositoryPort {
  async findById(jobId: string): Promise<ExploreJob | null> {
    const row = await prisma.job.findUnique({
      where: { id: jobId },
      include: { session: true },
    });

    if (!row || row.type !== PrismaJobType.explore) {
      return null;
    }

    const payload = row.payload as ExplorePayloadJson;

    return ExploreJob.reconstitute(
      {
        sessionId: row.sessionId,
        sessionUrl: row.session.url,
        pageSnapshotId: payload.page_snapshot_id,
        type: JobType.explore,
        status: row.status as JobStatus,
        errorMessage: row.errorMessage,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
      },
      UniqueEntityID.create(row.id),
    );
  }

  async save(job: ExploreJob): Promise<void> {
    await prisma.job.update({
      where: { id: job.id.value },
      data: {
        status: job.status,
        errorMessage: job.errorMessage,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
      },
    });
  }
}
