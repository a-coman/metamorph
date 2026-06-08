import type { MrDefinition } from '@metamorph/core';
import { UniqueEntityID } from '@metamorph/utils';
import {
  JobStatus as PrismaJobStatus,
  JobType as PrismaJobType,
} from '../../../../../../api/generated/prisma/enums.js';
import { ExecutePairJob } from '../../../domain/entities/execute-pair-job.entity.js';
import { JobStatus } from '../../../domain/enums/job-status.enum.js';
import { JobType } from '../../../domain/enums/job-type.enum.js';

export class ExecutePairJobMapper {
  static toDomain(row: {
    id: string;
    sessionId: string;
    mrVersionId: string | null;
    type: PrismaJobType;
    status: PrismaJobStatus;
    payload: unknown;
    errorMessage: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    session: { url: string };
    mrVersion: {
      id: string;
      playbookBlob: { content: string; contentHash: string } | null;
      schemaBlob: { content: string } | null;
      mrDefinition: { definition: unknown };
    } | null;
  }): ExecutePairJob | null {
    if (!row.mrVersion?.playbookBlob || !row.mrVersion.schemaBlob) {
      return null;
    }

    const payload = row.payload as { run_id?: string };
    if (!payload.run_id) {
      return null;
    }

    return ExecutePairJob.reconstitute(
      {
        sessionId: row.sessionId,
        sessionUrl: row.session.url,
        runId: payload.run_id,
        mrVersionId: row.mrVersionId ?? row.mrVersion.id,
        type: JobType.execute_pair,
        status: toDomainJobStatus(row.status),
        playbookContent: row.mrVersion.playbookBlob.content,
        schemaContent: row.mrVersion.schemaBlob.content,
        mrDefinition: row.mrVersion.mrDefinition.definition as MrDefinition,
        playbookContentHash: row.mrVersion.playbookBlob.contentHash,
        errorMessage: row.errorMessage,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
      },
      UniqueEntityID.create(row.id),
    );
  }

  static toPersistence(job: ExecutePairJob) {
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
