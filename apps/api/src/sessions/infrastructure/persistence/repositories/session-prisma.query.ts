import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service.js';
import type { SessionDetailsDto } from '../../../application/dtos/session-details.dto.js';
import { SessionQueryPort } from '../../../application/ports/session-query.port.js';

@Injectable()
export class SessionPrismaQuery extends SessionQueryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findDetailsById(id: string): Promise<SessionDetailsDto | null> {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        jobs: {
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
            startedAt: true,
            finishedAt: true,
            errorMessage: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        pageSnapshots: {
          select: {
            id: true,
            url: true,
            createdAt: true,
            inventory: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!session) {
      return null;
    }

    return {
      id: session.id,
      url: session.url,
      mode: session.mode,
      generateCount: session.generateCount,
      weakOracle: session.weakOracle,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      jobs: session.jobs,
      pageSnapshots: session.pageSnapshots.map((snapshot) => {
        const inventory = snapshot.inventory as { labeledCount?: number };
        return {
          id: snapshot.id,
          url: snapshot.url,
          createdAt: snapshot.createdAt,
          labeledCount: inventory.labeledCount ?? 0,
        };
      }),
    };
  }
}
