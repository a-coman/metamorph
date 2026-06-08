import {
  JOB_PLAYWRIGHT_PROBE,
  RABBITMQ_EXCHANGE_DEFAULT,
  type PlaywrightProbeJobMessage,
} from '@metamorph/contracts';
import type { SlotStep } from '@metamorph/core';
import { JobStatus as PrismaJobStatus, JobType as PrismaJobType } from '../../../../../api/generated/prisma/enums.js';
import amqplib from 'amqplib';
import { prisma } from '../../../shared/infrastructure/prisma/prisma-client.js';
import type { ExplorePhase } from '../graph/explore-state.js';

export class ProbeJobPublisher {
  private readonly exchange: string;

  constructor(
    private readonly rabbitUrl: string,
    exchange = process.env.RABBITMQ_EXCHANGE ?? RABBITMQ_EXCHANGE_DEFAULT,
  ) {
    this.exchange = exchange;
  }

  async publish(input: {
    sessionId: string;
    mrVersionId: string;
    exploreJobId: string;
    phase: ExplorePhase;
    inventorySnapshotId: string;
    validatedPrefix: SlotStep[];
    probeSteps: SlotStep[];
    resumeUrl: string;
  }): Promise<string> {
    const job = await prisma.job.create({
      data: {
        sessionId: input.sessionId,
        mrVersionId: input.mrVersionId,
        type: PrismaJobType.probe,
        status: PrismaJobStatus.queued,
        payload: {
          explore_job_id: input.exploreJobId,
          phase: input.phase,
          inventory_snapshot_id: input.inventorySnapshotId,
          validated_prefix: input.validatedPrefix,
          probe_steps: input.probeSteps,
          resume_url: input.resumeUrl,
        },
      },
    });

    const connection = await amqplib.connect(this.rabbitUrl);
    const channel = await connection.createConfirmChannel();

    try {
      const message: PlaywrightProbeJobMessage = {
        job_id: job.id,
        session_id: input.sessionId,
        type: 'probe',
        mr_version_id: input.mrVersionId,
        payload: {
          explore_job_id: input.exploreJobId,
          phase: input.phase,
          inventory_snapshot_id: input.inventorySnapshotId,
          validated_prefix: input.validatedPrefix,
          probe_steps: input.probeSteps,
          resume_url: input.resumeUrl,
        },
      };

      const body = Buffer.from(JSON.stringify(message));
      const published = channel.publish(
        this.exchange,
        JOB_PLAYWRIGHT_PROBE,
        body,
        { contentType: 'application/json', persistent: true },
      );

      if (!published) {
        throw new Error('RabbitMQ publish buffer is full');
      }

      await channel.waitForConfirms();
    } finally {
      await channel.close();
      await connection.close();
    }

    return job.id;
  }
}
