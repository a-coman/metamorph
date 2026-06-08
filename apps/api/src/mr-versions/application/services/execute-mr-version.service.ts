import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  JobStatus,
  JobType,
  MrVersionStatus,
  RunStatus,
} from '../../../../generated/prisma/enums.js';
import type { ExecuteMrVersionResultDto } from '../dtos/run.dto.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { EnqueueExecutePairJobService } from './enqueue-execute-pair-job.service.js';

@Injectable()
export class ExecuteMrVersionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enqueueExecutePairJob: EnqueueExecutePairJobService,
  ) {}

  async execute(mrVersionId: string): Promise<ExecuteMrVersionResultDto> {
    const mrVersion = await this.prisma.mrVersion.findUnique({
      where: { id: mrVersionId },
      include: {
        session: true,
        playbookBlob: true,
      },
    });

    if (!mrVersion) {
      throw new NotFoundException(`MR version ${mrVersionId} not found`);
    }

    if (mrVersion.status !== MrVersionStatus.approved) {
      throw new BadRequestException(
        `MR version ${mrVersionId} must be approved before execute (status=${mrVersion.status})`,
      );
    }

    if (!mrVersion.playbookBlob) {
      throw new BadRequestException(
        `MR version ${mrVersionId} has no compiled playbook`,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const job = await tx.job.create({
        data: {
          sessionId: mrVersion.sessionId,
          mrVersionId: mrVersion.id,
          type: JobType.execute_pair,
          status: JobStatus.pending_enqueue,
          payload: {},
        },
      });

      const run = await tx.run.create({
        data: {
          mrVersionId: mrVersion.id,
          jobId: job.id,
          status: RunStatus.pending,
          playbookContentHash: mrVersion.playbookBlob?.contentHash,
        },
      });

      await tx.job.update({
        where: { id: job.id },
        data: {
          payload: {
            run_id: run.id,
            url: mrVersion.session.url,
          },
        },
      });

      return { jobId: job.id, runId: run.id };
    });

    const enqueueResult = await this.enqueueExecutePairJob.enqueue({
      jobId: created.jobId,
      sessionId: mrVersion.sessionId,
      mrVersionId: mrVersion.id,
      runId: created.runId,
      url: mrVersion.session.url,
    });

    return {
      jobId: created.jobId,
      runId: created.runId,
      status: enqueueResult.status,
    };
  }
}
