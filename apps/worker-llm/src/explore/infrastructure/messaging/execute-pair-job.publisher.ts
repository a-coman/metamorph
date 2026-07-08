import {
  JOB_PLAYWRIGHT_EXECUTE_PAIR,
  RABBITMQ_EXCHANGE_DEFAULT,
  type PlaywrightExecutePairJobMessage,
} from '@metamorph/contracts';
import type { ExecutePairJobMessagePayload } from '@metamorph/mr-promotion';
import amqplib from 'amqplib';

export class ExecutePairJobPublisher {
  private readonly exchange: string;

  constructor(
    private readonly rabbitUrl: string,
    exchange = process.env.RABBITMQ_EXCHANGE ?? RABBITMQ_EXCHANGE_DEFAULT,
  ) {
    this.exchange = exchange;
  }

  async publish(payload: ExecutePairJobMessagePayload): Promise<void> {
    const connection = await amqplib.connect(this.rabbitUrl);
    const channel = await connection.createConfirmChannel();

    try {
      const message: PlaywrightExecutePairJobMessage = {
        job_id: payload.jobId,
        session_id: payload.sessionId,
        type: 'execute_pair',
        mr_version_id: payload.mrVersionId,
        payload: {
          url: payload.url,
          run_id: payload.runId,
        },
      };

      const body = Buffer.from(JSON.stringify(message));
      const published = channel.publish(
        this.exchange,
        JOB_PLAYWRIGHT_EXECUTE_PAIR,
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
  }
}
