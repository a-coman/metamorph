import { JobType as PrismaJobType } from '../../../../../../api/generated/prisma/enums.js';
import type { PageSnapshotInventory } from '@metamorph/core';
import type { SlotStep } from '@metamorph/core';
import { prisma } from '../../../../shared/infrastructure/prisma/prisma-client.js';
import { ProbeJob } from '../../../domain/entities/probe-job.entity.js';
import { JobType } from '../../../domain/enums/job-type.enum.js';
import { JobStatus } from '../../../domain/enums/job-status.enum.js';
import {
  ProbeJobRepositoryPort,
  ProbeSnapshotQueryPort,
} from '../../../domain/repositories/probe-job.repository.port.js';

type ProbePayloadJson = {
  explore_job_id: string;
  phase: 'source' | 'follow_up';
  inventory_snapshot_id: string;
  mode?: 'incremental' | 'smoke_replay';
  validated_prefix: SlotStep[];
  probe_steps: SlotStep[];
  resume_url: string;
};

export class ProbeJobPrismaRepository extends ProbeJobRepositoryPort {
  async findById(jobId: string): Promise<ProbeJob | null> {
    const row = await prisma.job.findUnique({
      where: { id: jobId },
      include: { session: true, mrVersion: true },
    });

    if (!row || row.type !== PrismaJobType.probe) {
      return null;
    }

    const payload = row.payload as ProbePayloadJson;

    return ProbeJob.reconstitute(row.id, {
      sessionId: row.sessionId,
      sessionUrl: row.session.url,
      payload: {
        exploreJobId: payload.explore_job_id,
        mrVersionId: row.mrVersionId ?? '',
        phase: payload.phase,
        inventorySnapshotId: payload.inventory_snapshot_id,
        mode: payload.mode ?? 'incremental',
        validatedPrefix: payload.validated_prefix,
        probeSteps: payload.probe_steps,
        resumeUrl: payload.resume_url,
      },
      type: JobType.probe,
      status: row.status as JobStatus,
      errorMessage: row.errorMessage,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
    });
  }

  async save(job: ProbeJob): Promise<void> {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: job.status,
        errorMessage: job.errorMessage,
        startedAt: job.startedAt ?? undefined,
        finishedAt: job.finishedAt ?? undefined,
      },
    });
  }
}

export class ProbeSnapshotPrismaQuery extends ProbeSnapshotQueryPort {
  async findInventoryById(snapshotId: string) {
    const row = await prisma.pageSnapshot.findUnique({
      where: { id: snapshotId },
    });

    if (!row) {
      return null;
    }

    return {
      inventory: row.inventory as PageSnapshotInventory,
      url: row.url,
    };
  }
}
