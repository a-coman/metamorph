import amqplib, { type Channel, type ChannelModel, type ConsumeMessage } from 'amqplib';
import { QUEUE_LLM } from '@metamorph/contracts';
import { DiscoverLlmJobService } from '../../application/services/discover-llm-job.service.js';
import {
  JobNotFoundError,
  JobNotRunnableError,
} from '../../domain/errors/discover-llm.errors.js';
import { mapLlmDiscoverMessage } from './llm-discover.mapper.js';

export type LlmDiscoverSubscriberConfig = {
  url: string;
};

export class LlmDiscoverSubscriber {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private consumerTag: string | null = null;

  constructor(
    private readonly discoverLlmJobService: DiscoverLlmJobService,
    private readonly config: LlmDiscoverSubscriberConfig,
  ) {}

  async start(): Promise<void> {
    this.connection = await amqplib.connect(this.config.url);
    this.channel = await this.connection.createChannel();
    await this.channel.prefetch(1);

    const { consumerTag } = await this.channel.consume(
      QUEUE_LLM,
      (message) => {
        void this.handleMessage(message);
      },
    );

    this.consumerTag = consumerTag;
    console.log(`Consuming queue ${QUEUE_LLM}`);
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
      const command = mapLlmDiscoverMessage(raw);

      if (!command) {
        console.error('Invalid discover LLM job message — sending to DLQ');
        this.channel.nack(message, false, false);
        return;
      }

      const result = await this.discoverLlmJobService.run(command.jobId);

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
      console.error(`Transient discover LLM consumer error: ${messageText}`);
      this.channel.nack(message, false, true);
    }
  }
}
