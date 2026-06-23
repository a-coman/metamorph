import {
  JOB_LLM_EXPLORE,
  RABBITMQ_EXCHANGE_DEFAULT,
  type LlmExploreJobMessage,
} from '@metamorph/contracts';
import amqplib from 'amqplib';
import { LlmJobPublisherPort } from '../../application/ports/llm-job-publisher.port.js';

export class RabbitMqLlmPublisherAdapter extends LlmJobPublisherPort {
  private readonly exchange: string;

  constructor(
    private readonly url: string,
    exchange = process.env.RABBITMQ_EXCHANGE ?? RABBITMQ_EXCHANGE_DEFAULT,
  ) {
    super();
    this.exchange = exchange;
  }

  async publishExploreJob(input: {
    jobId: string;
    sessionId: string;
    pageSnapshotId: string;
    url: string;
    transformFamily: string;
  }): Promise<void> {
    const connection = await amqplib.connect(this.url);
    const channel = await connection.createConfirmChannel();

    try {
      const message: LlmExploreJobMessage = {
        job_id: input.jobId,
        session_id: input.sessionId,
        type: 'explore',
        page_snapshot_id: input.pageSnapshotId,
        payload: { url: input.url },
      };

      const body = Buffer.from(JSON.stringify(message));
      const published = channel.publish(this.exchange, JOB_LLM_EXPLORE, body, {
        contentType: 'application/json',
        persistent: true,
      });

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
