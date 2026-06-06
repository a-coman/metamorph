import amqplib, { type Channel, type ChannelModel, type ConsumeMessage } from 'amqplib';
import { QUEUE_PLAYWRIGHT } from '@metamorph/contracts';
import { DiscoverJobService } from '../../application/services/discover-job.service.js';
import {
  JobNotFoundError,
  JobNotRunnableError,
} from '../../domain/errors/discovery.errors.js';
import { mapPlaywrightDiscoverMessage } from './playwright-discover.mapper.js';

export type PlaywrightDiscoverSubscriberConfig = {
  url: string;
};

export class PlaywrightDiscoverSubscriber {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private consumerTag: string | null = null;

  constructor(
    private readonly discoverJobService: DiscoverJobService,
    private readonly config: PlaywrightDiscoverSubscriberConfig,
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
      const command = mapPlaywrightDiscoverMessage(raw);

      if (!command) {
        console.error('Invalid discover job message — sending to DLQ');
        this.channel.nack(message, false, false);
        return;
      }

      const result = await this.discoverJobService.run(command.jobId);

      if (result.isRight()) {
        this.channel.ack(message);
        return;
      }

      const error = result.value;
      if (error instanceof JobNotRunnableError) {
        console.warn(error.errorMessage);
        this.channel.ack(message);
        return;
      }

      if (error instanceof JobNotFoundError) {
        console.warn(error.errorMessage);
        this.channel.nack(message, false, false);
        return;
      }

      console.error(error.errorMessage);
      this.channel.ack(message);
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : 'Unknown consumer error';
      console.error(`Transient discover consumer error: ${messageText}`);
      this.channel.nack(message, false, true);
    }
  }
}
