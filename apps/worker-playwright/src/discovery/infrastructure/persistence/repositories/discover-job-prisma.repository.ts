import { prisma } from '../../../../shared/infrastructure/prisma/prisma-client.js';
import { DiscoverJob } from '../../../domain/entities/discover-job.entity.js';
import { DiscoverJobRepositoryPort } from '../../../domain/repositories/discover-job.repository.port.js';
import { DiscoverJobMapper } from '../mappers/discover-job.mapper.js';

export class DiscoverJobPrismaRepository extends DiscoverJobRepositoryPort {
  async findById(jobId: string): Promise<DiscoverJob | null> {
    const row = await prisma.job.findUnique({
      where: { id: jobId },
      include: { session: true },
    });

    if (!row) {
      return null;
    }

    return DiscoverJobMapper.toDomain(row);
  }

  async save(job: DiscoverJob): Promise<void> {
    const data = DiscoverJobMapper.toPersistence(job);

    await prisma.job.update({
      where: { id: data.id },
      data: {
        status: data.status,
        errorMessage: data.errorMessage,
        startedAt: data.startedAt,
        finishedAt: data.finishedAt,
      },
    });
  }
}
