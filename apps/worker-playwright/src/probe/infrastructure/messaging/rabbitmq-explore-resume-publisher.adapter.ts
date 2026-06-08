import {
  JOB_LLM_EXPLORE_RESUME,
  RABBITMQ_EXCHANGE_DEFAULT,
  type LlmExploreResumeMessage,
} from '@metamorph/contracts';
import amqplib from 'amqplib';
import { ExploreResumePublisherPort } from '../../application/ports/explore-resume-publisher.port.js';

export class RabbitMqExploreResumePublisherAdapter extends ExploreResumePublisherPort {
  private readonly exchange: string;

  constructor(
    private readonly url: string,
    exchange = process.env.RABBITMQ_EXCHANGE ?? RABBITMQ_EXCHANGE_DEFAULT,
  ) {
    super();
    this.exchange = exchange;
  }

  async publishExploreResume(input: {
    exploreJobId: string;
    sessionId: string;
    probeJobId: string;
    snapshotId: string | null;
    probeStatus: 'ok' | 'failed';
    error?: string;
  }): Promise<void> {
    const connection = await amqplib.connect(this.url);
    const channel = await connection.createConfirmChannel();

    try {
      const message: LlmExploreResumeMessage = {
        job_id: input.exploreJobId,
        session_id: input.sessionId,
        type: 'explore_resume',
        explore_job_id: input.exploreJobId,
        payload: {
          probe_job_id: input.probeJobId,
          snapshot_id: input.snapshotId,
          probe_status: input.probeStatus,
          error: input.error,
        },
      };

      const body = Buffer.from(JSON.stringify(message));
      const published = channel.publish(
        this.exchange,
        JOB_LLM_EXPLORE_RESUME,
        body,
        {
          contentType: 'application/json',
          persistent: true,
        },
      );

      if (!published) {
        throw new Error('RabbitMQ publish buffer is full');
      }

      await channel.waitForConfirms();
    } finally {
      await channel.close();
      await connection.close();
    }
  }
}
