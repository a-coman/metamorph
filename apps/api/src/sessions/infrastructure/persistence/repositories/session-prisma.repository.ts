import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service.js';
import { SessionAggregate } from '../../../domain/aggregates/session.aggregate.js';
import { SessionRepositoryPort } from '../../../domain/repositories/session.repository.port.js';
import { SessionMapper } from '../mappers/session.mapper.js';

@Injectable()
export class SessionPrismaRepository extends SessionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async save(aggregate: SessionAggregate): Promise<void> {
    const data = SessionMapper.toPersistence(aggregate);

    await this.prisma.$transaction(async (tx) => {
      await tx.session.upsert({
        where: { id: data.id },
        create: {
          id: data.id,
          url: data.url,
          mode: data.mode,
          generateCount: data.generateCount,
          weakOracle: data.weakOracle,
          transformFamilies: data.transformFamilies,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        },
        update: {
          url: data.url,
          mode: data.mode,
          generateCount: data.generateCount,
          weakOracle: data.weakOracle,
          transformFamilies: data.transformFamilies,
          updatedAt: data.updatedAt,
        },
      });

      for (const job of data.jobs) {
        await tx.job.upsert({
          where: { id: job.id },
          create: {
            id: job.id,
            sessionId: data.id,
            type: job.type,
            status: job.status,
            errorMessage: job.errorMessage,
            createdAt: job.createdAt,
            startedAt: job.startedAt,
            finishedAt: job.finishedAt,
          },
          update: {
            status: job.status,
            errorMessage: job.errorMessage,
            startedAt: job.startedAt,
            finishedAt: job.finishedAt,
          },
        });
      }
    });
  }

  async findById(id: string): Promise<SessionAggregate | null> {
    const row = await this.prisma.session.findUnique({
      where: { id },
      include: {
        jobs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!row) {
      return null;
    }

    return SessionMapper.toDomain(row);
  }

  async remove(id: string): Promise<boolean> {
    try {
      await this.prisma.session.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}
