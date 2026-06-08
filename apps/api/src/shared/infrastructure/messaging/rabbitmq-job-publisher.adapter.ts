import { Injectable } from '@nestjs/common';
import {
  JOB_PLAYWRIGHT_DISCOVER,
  JOB_PLAYWRIGHT_EXECUTE_PAIR,
  type PlaywrightDiscoverJobMessage,
  type PlaywrightExecutePairJobMessage,
} from '@metamorph/contracts';
import {
  DiscoverJobMessagePayload,
  ExecutePairJobMessagePayload,
  JobMessagePublisherPort,
} from '../../../sessions/application/ports/job-message-publisher.port.js';
import { getRabbitMqConfig } from './rabbitmq.config.js';
import { RabbitMqConnectionService } from './rabbitmq-connection.service.js';

@Injectable()
export class RabbitMqJobPublisherAdapter implements JobMessagePublisherPort {
  constructor(private readonly rabbitMq: RabbitMqConnectionService) {}

  async publishDiscoverJob(payload: DiscoverJobMessagePayload): Promise<void> {
    const { exchange } = getRabbitMqConfig();
    const channel = await this.rabbitMq.getConfirmChannel();

    const message: PlaywrightDiscoverJobMessage = {
      job_id: payload.jobId,
      session_id: payload.sessionId,
      type: 'discover',
      mr_version_id: null,
      payload: { url: payload.url },
    };

    const body = Buffer.from(JSON.stringify(message));

    const published = channel.publish(
      exchange,
      JOB_PLAYWRIGHT_DISCOVER,
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
  }

  async publishExecutePairJob(
    payload: ExecutePairJobMessagePayload,
  ): Promise<void> {
    const { exchange } = getRabbitMqConfig();
    const channel = await this.rabbitMq.getConfirmChannel();

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
      exchange,
      JOB_PLAYWRIGHT_EXECUTE_PAIR,
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
  }
}
