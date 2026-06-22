import amqplib, { type Channel, type ChannelModel, type ConsumeMessage } from 'amqplib';
import { QUEUE_PLAYWRIGHT, playwrightJobMessageSchema } from '@metamorph/contracts';
import type { DiscoverJobService } from '../../../discovery/application/services/discover-job.service.js';
import {
  JobNotFoundError,
  JobNotRunnableError,
  JobPausedError,
} from '../../../discovery/domain/errors/discovery.errors.js';
import type { ExecutePairJobService } from '../../../execute-pair/application/services/execute-pair-job.service.js';
import {
  ExecutePairJobNotFoundError,
  ExecutePairJobNotRunnableError,
} from '../../../execute-pair/domain/errors/execute-pair.errors.js';
import type { ProbeJobService } from '../../../probe/application/services/probe-job.service.js';
import {
  ProbeJobNotFoundError,
  ProbeJobNotRunnableError,
  ProbeJobPausedError,
} from '../../../probe/domain/errors/probe.errors.js';
import {
  ExecutePairJobPausedError,
} from '../../../execute-pair/domain/errors/execute-pair.errors.js';

export type PlaywrightJobSubscriberConfig = {
  url: string;
};

export class PlaywrightJobSubscriber {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private consumerTag: string | null = null;

  constructor(
    private readonly discoverJobService: DiscoverJobService,
    private readonly executePairJobService: ExecutePairJobService,
    private readonly probeJobService: ProbeJobService,
    private readonly config: PlaywrightJobSubscriberConfig,
  ) {}

  async start(): Promise<void> {
    this.connection = await amqplib.connect(this.config.url);
    this.channel = await this.connection.createChannel();
    await this.channel.prefetch(1);

    const { consumerTag } = await this.channel.consume(
      QUEUE_PLAYWRIGHT,
      (message) => {
        void this.handleMessage(message);
      },
    );

    this.consumerTag = consumerTag;
    console.log(`Consuming queue ${QUEUE_PLAYWRIGHT}`);
  }

  async stop(): Promise<void> {
    if (this.channel && this.consumerTag) {
      await this.channel.cancel(this.consumerTag);
      this.consumerTag = null;
    }

    try {
      await this.channel?.close();
    } catch {
      // ignore shutdown errors
    }

    try {
      await this.connection?.close();
    } catch {
      // ignore shutdown errors
    }

    this.channel = null;
    this.connection = null;
  }

  private async handleMessage(message: ConsumeMessage | null): Promise<void> {
    if (!message || !this.channel) {
      return;
    }

    try {
      const raw = JSON.parse(message.content.toString()) as unknown;
      const parsed = playwrightJobMessageSchema.safeParse(raw);

      if (!parsed.success) {
        console.error('Invalid playwright job message — sending to DLQ');
        this.channel.nack(message, false, false);
        return;
      }

      const result =
        parsed.data.type === 'discover'
          ? await this.discoverJobService.run(parsed.data.job_id)
          : parsed.data.type === 'execute_pair'
            ? await this.executePairJobService.run(parsed.data.job_id)
            : await this.probeJobService.run(parsed.data.job_id);

      if (result.isRight()) {
        this.channel.ack(message);
        return;
      }

      const error = result.value;
      if (
        error instanceof JobNotRunnableError ||
        error instanceof ExecutePairJobNotRunnableError ||
        error instanceof ProbeJobNotRunnableError ||
        error instanceof JobPausedError ||
        error instanceof ProbeJobPausedError ||
        error instanceof ExecutePairJobPausedError
      ) {
        console.warn(error.errorMessage);
        this.channel.ack(message);
        return;
      }

      if (
        error instanceof JobNotFoundError ||
        error instanceof ExecutePairJobNotFoundError ||
        error instanceof ProbeJobNotFoundError
      ) {
        console.warn(error.errorMessage);
        this.channel.nack(message, false, false);
        return;
      }

      console.error(error.errorMessage);
      this.channel.ack(message);
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : 'Unknown consumer error';
      console.error(`Transient playwright consumer error: ${messageText}`);
      this.channel.nack(message, false, true);
    }
  }
}
