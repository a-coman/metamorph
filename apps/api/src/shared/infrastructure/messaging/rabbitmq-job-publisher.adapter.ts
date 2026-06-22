import { Injectable } from '@nestjs/common';
import {
  JOB_LLM_EXPLORE_USER_RESUME,
  JOB_PLAYWRIGHT_DISCOVER,
  JOB_PLAYWRIGHT_EXECUTE_PAIR,
  JOB_PLAYWRIGHT_PROBE,
  JOB_LLM_EXPLORE,
  type LlmExploreUserResumeMessage,
  type LlmExploreJobMessage,
  type PlaywrightDiscoverJobMessage,
  type PlaywrightExecutePairJobMessage,
  type PlaywrightProbeJobMessage,
} from '@metamorph/contracts';
import {
  DiscoverJobMessagePayload,
  ExecutePairJobMessagePayload,
  ExploreUserResumeMessagePayload,
  ExploreJobMessagePayload,
  JobMessagePublisherPort,
  ProbeJobMessagePayload,
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

  async publishProbeJob(payload: ProbeJobMessagePayload): Promise<void> {
    const { exchange } = getRabbitMqConfig();
    const channel = await this.rabbitMq.getConfirmChannel();

    const message: PlaywrightProbeJobMessage = {
      job_id: payload.jobId,
      session_id: payload.sessionId,
      type: 'probe',
      mr_version_id: payload.mrVersionId,
      payload: payload.payload as PlaywrightProbeJobMessage['payload'],
    };

    const body = Buffer.from(JSON.stringify(message));
    const published = channel.publish(
      exchange,
      JOB_PLAYWRIGHT_PROBE,
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

  async publishExploreUserResume(
    payload: ExploreUserResumeMessagePayload,
  ): Promise<void> {
    const { exchange } = getRabbitMqConfig();
    const channel = await this.rabbitMq.getConfirmChannel();

    const message: LlmExploreUserResumeMessage = {
      job_id: payload.jobId,
      session_id: payload.sessionId,
      type: 'explore_user_resume',
      explore_job_id: payload.exploreJobId,
    };

    const body = Buffer.from(JSON.stringify(message));
    const published = channel.publish(
      exchange,
      JOB_LLM_EXPLORE_USER_RESUME,
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

  async publishExploreJob(payload: ExploreJobMessagePayload): Promise<void> {
    const { exchange } = getRabbitMqConfig();
    const channel = await this.rabbitMq.getConfirmChannel();

    const message: LlmExploreJobMessage = {
      job_id: payload.jobId,
      session_id: payload.sessionId,
      type: 'explore',
      page_snapshot_id: payload.pageSnapshotId,
      payload: { url: payload.url },
    };

    const body = Buffer.from(JSON.stringify(message));
    const published = channel.publish(exchange, JOB_LLM_EXPLORE, body, {
      contentType: 'application/json',
      persistent: true,
    });

    if (!published) {
      throw new Error('RabbitMQ publish buffer is full');
    }

    await channel.waitForConfirms();
  }
}
