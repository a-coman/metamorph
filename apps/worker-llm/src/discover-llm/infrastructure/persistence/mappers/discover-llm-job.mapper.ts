import { UniqueEntityID } from '@metamorph/utils';
import {
  JobStatus as PrismaJobStatus,
  JobType as PrismaJobType,
} from '../../../../../../api/generated/prisma/enums.js';
import { DiscoverLlmJob } from '../../../domain/entities/discover-llm-job.entity.js';
import { JobStatus } from '../../../domain/enums/job-status.enum.js';
import { JobType } from '../../../domain/enums/job-type.enum.js';

export class DiscoverLlmJobMapper {
  static toDomain(row: {
    id: string;
    sessionId: string;
    type: PrismaJobType;
    status: PrismaJobStatus;
    errorMessage: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    payload: unknown;
    session: { url: string };
  }): DiscoverLlmJob {
    const payload = row.payload as {
      page_snapshot_id?: string;
    };

    return DiscoverLlmJob.reconstitute(
      {
        sessionId: row.sessionId,
        sessionUrl: row.session.url,
        pageSnapshotId: payload.page_snapshot_id ?? '',
        type: JobType.discover_llm,
        status: toDomainJobStatus(row.status),
        errorMessage: row.errorMessage,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
      },
      UniqueEntityID.create(row.id),
    );
  }

  static toPersistence(job: DiscoverLlmJob) {
    return {
      id: job.id.value,
      status: toPrismaJobStatus(job.status),
      errorMessage: job.errorMessage ?? null,
      startedAt: job.startedAt ?? null,
      finishedAt: job.finishedAt ?? null,
    };
  }
}

function toDomainJobStatus(status: PrismaJobStatus): JobStatus {
  switch (status) {
    case PrismaJobStatus.running:
      return JobStatus.running;
    case PrismaJobStatus.done:
      return JobStatus.done;
    case PrismaJobStatus.failed:
      return JobStatus.failed;
    case PrismaJobStatus.pending_enqueue:
      return JobStatus.pending_enqueue;
    case PrismaJobStatus.enqueue_failed:
      return JobStatus.enqueue_failed;
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
    case JobStatus.pending_enqueue:
      return PrismaJobStatus.pending_enqueue;
    case JobStatus.enqueue_failed:
      return PrismaJobStatus.enqueue_failed;
    default:
      return PrismaJobStatus.queued;
  }
}
