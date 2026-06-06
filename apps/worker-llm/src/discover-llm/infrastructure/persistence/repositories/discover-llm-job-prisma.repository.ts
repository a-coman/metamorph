import { prisma } from '../../../../shared/infrastructure/prisma/prisma-client.js';
import { DiscoverLlmJob } from '../../../domain/entities/discover-llm-job.entity.js';
import { DiscoverLlmJobRepositoryPort } from '../../../domain/repositories/discover-llm-job.repository.port.js';
import { DiscoverLlmJobMapper } from '../mappers/discover-llm-job.mapper.js';

export class DiscoverLlmJobPrismaRepository extends DiscoverLlmJobRepositoryPort {
  async findById(jobId: string): Promise<DiscoverLlmJob | null> {
    const row = await prisma.job.findUnique({
      where: { id: jobId },
      include: { session: true },
    });

    if (!row) {
      return null;
    }

    return DiscoverLlmJobMapper.toDomain(row);
  }

  async save(job: DiscoverLlmJob): Promise<void> {
    const data = DiscoverLlmJobMapper.toPersistence(job);

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
