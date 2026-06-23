import { UniqueEntityID } from '@metamorph/utils';
import {
  JobStatus as PrismaJobStatus,
  JobType as PrismaJobType,
  SessionMode as PrismaSessionMode,
} from '../../../../../generated/prisma/enums.js';
import { SessionAggregate } from '../../../domain/aggregates/session.aggregate.js';
import { Job } from '../../../domain/entities/job.entity.js';
import { JobStatus } from '../../../domain/enums/job-status.enum.js';
import { JobType } from '../../../domain/enums/job-type.enum.js';
import { SessionMode } from '../../../domain/enums/session-mode.enum.js';

export class SessionMapper {
  static toDomain(
    row: {
      id: string;
      url: string;
      mode: PrismaSessionMode;
      generateCount: number;
      weakOracle: boolean;
      transformFamilies: string[];
      createdAt: Date;
      updatedAt: Date;
      jobs: {
        id: string;
        type: PrismaJobType;
        status: PrismaJobStatus;
        errorMessage: string | null;
        createdAt: Date;
        startedAt: Date | null;
        finishedAt: Date | null;
      }[];
    },
  ): SessionAggregate {
    return SessionAggregate.reconstitute(
      {
        url: row.url,
        mode: toDomainSessionMode(row.mode),
        generateCount: row.generateCount,
        weakOracle: row.weakOracle,
        transformFamilies: row.transformFamilies,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        jobs: row.jobs.map((job) =>
          Job.reconstitute(
            {
              type: toDomainJobType(job.type),
              status: toDomainJobStatus(job.status),
              errorMessage: job.errorMessage,
              createdAt: job.createdAt,
              startedAt: job.startedAt,
              finishedAt: job.finishedAt,
            },
            UniqueEntityID.create(job.id),
          ),
        ),
      },
      UniqueEntityID.create(row.id),
    );
  }

  static toPersistence(aggregate: SessionAggregate) {
    return {
      id: aggregate.id.value,
      url: aggregate.url,
      mode: toPrismaSessionMode(aggregate.mode),
      generateCount: aggregate.generateCount,
      weakOracle: aggregate.weakOracle,
      transformFamilies: aggregate.transformFamilies,
      createdAt: aggregate.createdAt,
      updatedAt: aggregate.updatedAt,
      jobs: aggregate.jobs.map((job) => ({
        id: job.id.value,
        type: toPrismaJobType(job.type),
        status: toPrismaJobStatus(job.status),
        errorMessage: job.errorMessage ?? null,
        createdAt: job.createdAt,
        startedAt: job.startedAt ?? null,
        finishedAt: job.finishedAt ?? null,
      })),
    };
  }
}

function toDomainSessionMode(mode: PrismaSessionMode): SessionMode {
  return mode === PrismaSessionMode.auto ? SessionMode.auto : SessionMode.hitl;
}

function toPrismaSessionMode(mode: SessionMode): PrismaSessionMode {
  return mode === SessionMode.auto
    ? PrismaSessionMode.auto
    : PrismaSessionMode.hitl;
}

function toDomainJobType(type: PrismaJobType): JobType {
  return type === PrismaJobType.discover ? JobType.discover : JobType.discover;
}

function toPrismaJobType(type: JobType): PrismaJobType {
  return type === JobType.discover
    ? PrismaJobType.discover
    : PrismaJobType.discover;
}

function toDomainJobStatus(status: PrismaJobStatus): JobStatus {
  switch (status) {
    case PrismaJobStatus.pending_enqueue:
      return JobStatus.pending_enqueue;
    case PrismaJobStatus.enqueue_failed:
      return JobStatus.enqueue_failed;
    case PrismaJobStatus.queued:
      return JobStatus.queued;
    case PrismaJobStatus.running:
      return JobStatus.running;
    case PrismaJobStatus.done:
      return JobStatus.done;
    case PrismaJobStatus.failed:
      return JobStatus.failed;
    case PrismaJobStatus.paused:
      return JobStatus.paused;
  }
}

function toPrismaJobStatus(status: JobStatus): PrismaJobStatus {
  switch (status) {
    case JobStatus.pending_enqueue:
      return PrismaJobStatus.pending_enqueue;
    case JobStatus.enqueue_failed:
      return PrismaJobStatus.enqueue_failed;
    case JobStatus.queued:
      return PrismaJobStatus.queued;
    case JobStatus.running:
      return PrismaJobStatus.running;
    case JobStatus.done:
      return PrismaJobStatus.done;
    case JobStatus.failed:
      return PrismaJobStatus.failed;
    case JobStatus.paused:
      return PrismaJobStatus.paused;
  }
}
