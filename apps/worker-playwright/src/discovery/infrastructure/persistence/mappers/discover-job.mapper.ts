import { UniqueEntityID } from '@metamorph/utils';
import {
  JobStatus as PrismaJobStatus,
  JobType as PrismaJobType,
} from '../../../../../../api/generated/prisma/enums.js';
import { DiscoverJob } from '../../../domain/entities/discover-job.entity.js';
import { JobStatus } from '../../../domain/enums/job-status.enum.js';
import { JobType } from '../../../domain/enums/job-type.enum.js';

export class DiscoverJobMapper {
  static toDomain(row: {
    id: string;
    sessionId: string;
    type: PrismaJobType;
    status: PrismaJobStatus;
    errorMessage: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    session: { url: string };
  }): DiscoverJob {
    return DiscoverJob.reconstitute(
      {
        sessionId: row.sessionId,
        sessionUrl: row.session.url,
        type: toDomainJobType(row.type),
        status: toDomainJobStatus(row.status),
        errorMessage: row.errorMessage,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
      },
      UniqueEntityID.create(row.id),
    );
  }

  static toPersistence(job: DiscoverJob) {
    return {
      id: job.id.value,
      status: toPrismaJobStatus(job.status),
      errorMessage: job.errorMessage ?? null,
      startedAt: job.startedAt ?? null,
      finishedAt: job.finishedAt ?? null,
    };
  }
}

function toDomainJobType(type: PrismaJobType): JobType {
  return type === PrismaJobType.discover ? JobType.discover : JobType.discover;
}

function toDomainJobStatus(status: PrismaJobStatus): JobStatus {
  switch (status) {
    case PrismaJobStatus.running:
      return JobStatus.running;
    case PrismaJobStatus.done:
      return JobStatus.done;
    case PrismaJobStatus.failed:
      return JobStatus.failed;
    default:
      return JobStatus.queued;
  }
}

function toPrismaJobStatus(status: JobStatus): PrismaJobStatus {
  switch (status) {
    case JobStatus.running:
      return PrismaJobStatus.running;
    case JobStatus.done:
      return PrismaJobStatus.done;
    case JobStatus.failed:
      return PrismaJobStatus.failed;
    default:
      return PrismaJobStatus.queued;
  }
}
