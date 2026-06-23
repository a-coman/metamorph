import { Injectable } from '@nestjs/common';
import { JobStatus, SessionControlStatus } from '../../../../../generated/prisma/enums.js';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service.js';
import type {
  SessionDetailsDto,
  SessionListDto,
  SessionListItemDto,
} from '../../../application/dtos/session-details.dto.js';
import { SessionQueryPort } from '../../../application/ports/session-query.port.js';

const ACTIVE_JOB_STATUSES: JobStatus[] = [
  JobStatus.pending_enqueue,
  JobStatus.queued,
  JobStatus.running,
];

function deriveSessionStatus(
  controlStatus: SessionControlStatus,
  latestJob: { type: string; status: string } | undefined,
  mrVersionStatus: string | undefined,
): string {
  if (controlStatus !== SessionControlStatus.active) {
    return controlStatus;
  }

  const jobActive =
    latestJob !== undefined &&
    ACTIVE_JOB_STATUSES.includes(latestJob.status as JobStatus);

  if (jobActive) {
    // During exploration, MR status is more meaningful than probe/explore jobs.
    if (mrVersionStatus === 'exploring') {
      return 'exploring';
    }
    return `${latestJob.type}:${latestJob.status}`;
  }

  if (mrVersionStatus) {
    return mrVersionStatus;
  }

  if (latestJob) {
    return `${latestJob.type}:${latestJob.status}`;
  }

  return 'idle';
}

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
        mrVersions: {
          select: {
            id: true,
            status: true,
            mrDefinition: {
              select: {
                transformFamily: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
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
      transformFamilies: session.transformFamilies,
      controlStatus: session.controlStatus,
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
      mrVersions: session.mrVersions.map((mrVersion) => ({
        id: mrVersion.id,
        status: mrVersion.status,
        transformFamily: mrVersion.mrDefinition.transformFamily,
      })),
    };
  }

  async findList(params: {
    limit: number;
    cursor?: string;
  }): Promise<SessionListDto> {
    const limit = params.limit;
    const cursorSession = params.cursor
      ? await this.prisma.session.findUnique({
          where: { id: params.cursor },
          select: { id: true, createdAt: true },
        })
      : null;

    const sessions = await this.prisma.session.findMany({
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursorSession
        ? {
            where: {
              OR: [
                { createdAt: { lt: cursorSession.createdAt } },
                {
                  createdAt: cursorSession.createdAt,
                  id: { lt: cursorSession.id },
                },
              ],
            },
          }
        : {}),
      select: {
        id: true,
        url: true,
        mode: true,
        controlStatus: true,
        createdAt: true,
        jobs: {
          select: { type: true, status: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        mrVersions: {
          select: { status: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const hasMore = sessions.length > limit;
    const page = hasMore ? sessions.slice(0, limit) : sessions;

    const items: SessionListItemDto[] = page.map((session) => {
      const latestJob = session.jobs[0];
      const latestMr = session.mrVersions[0];
      const mrVersionStatus = latestMr?.status;
      const status = deriveSessionStatus(
        session.controlStatus,
        latestJob,
        mrVersionStatus,
      );

      return {
        id: session.id,
        url: session.url,
        mode: session.mode,
        createdAt: session.createdAt,
        status,
        ...(mrVersionStatus && mrVersionStatus !== status
          ? { mrVersionStatus }
          : {}),
      };
    });

    return {
      items,
      ...(hasMore && page.length > 0
        ? { nextCursor: page[page.length - 1]!.id }
        : {}),
    };
  }
}
