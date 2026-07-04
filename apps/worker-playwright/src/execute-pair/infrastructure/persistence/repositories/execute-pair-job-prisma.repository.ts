import { prisma } from '../../../../shared/infrastructure/prisma/prisma-client.js';
import type { ExecutePairJob } from '../../../domain/entities/execute-pair-job.entity.js';
import { ExecutePairJobRepositoryPort } from '../../../domain/repositories/execute-pair-job.repository.port.js';
import { ExecutePairJobMapper } from '../mappers/execute-pair-job.mapper.js';

export class ExecutePairJobPrismaRepository extends ExecutePairJobRepositoryPort {
  async findById(jobId: string): Promise<ExecutePairJob | null> {
    const row = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        session: true,
        mrVersion: {
          include: {
            playbookBlob: true,
            schemaBlob: true,
          },
        },
      },
    });

    if (!row) {
      return null;
    }

    return ExecutePairJobMapper.toDomain(row);
  }

  async save(job: ExecutePairJob): Promise<void> {
    const data = ExecutePairJobMapper.toPersistence(job);

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
