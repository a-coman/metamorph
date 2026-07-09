import amqplib, { type Channel, type ChannelModel, type ConsumeMessage } from 'amqplib';
import {
  QUEUE_LLM,
  llmJobMessageSchema,
  resolveLlmConcurrency,
} from '@metamorph/contracts';
import { ExploreJobService } from '../../application/services/explore-job.service.js';
import {
  JobNotFoundError,
  JobNotRunnableError,
  JobPausedError,
} from '../../domain/errors/explore.errors.js';

export type LlmExploreSubscriberConfig = {
  url: string;
};

export class LlmExploreSubscriber {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private consumerTag: string | null = null;

  constructor(
    private readonly exploreJobService: ExploreJobService,
    private readonly config: LlmExploreSubscriberConfig,
  ) {}

  async start(): Promise<void> {
    this.connection = await amqplib.connect(this.config.url);
    this.channel = await this.connection.createChannel();
    const concurrency = resolveLlmConcurrency(process.env);
    await this.channel.prefetch(concurrency);

    const { consumerTag } = await this.channel.consume(
      QUEUE_LLM,
      (message) => {
        void this.handleMessage(message);
      },
    );

    this.consumerTag = consumerTag;
    console.log(
      `Consuming queue ${QUEUE_LLM} (up to ${concurrency} parallel explore jobs)`,
    );
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
      const parsed = llmJobMessageSchema.safeParse(raw);

      if (!parsed.success) {
        console.error('Invalid LLM job message — sending to DLQ');
        this.channel.nack(message, false, false);
        return;
      }

      const result =
        parsed.data.type === 'explore'
          ? await this.exploreJobService.run(parsed.data.job_id)
          : parsed.data.type === 'explore_user_resume'
            ? await this.exploreJobService.resumeFromUserPause(
                parsed.data.explore_job_id,
              )
            : await this.exploreJobService.resume(parsed.data.explore_job_id, {
              probe_job_id: parsed.data.payload.probe_job_id,
              snapshot_id: parsed.data.payload.snapshot_id,
              probe_status: parsed.data.payload.probe_status,
              error: parsed.data.payload.error,
              failureContext: parsed.data.payload.failure_context
                ? {
                    failedStep: parsed.data.payload.failure_context.failed_step,
                    failedStepIndex:
                      parsed.data.payload.failure_context.failed_step_index,
                    failedBatchIndex:
                      parsed.data.payload.failure_context.failed_batch_index,
                    failedBatchSize:
                      parsed.data.payload.failure_context.failed_batch_size,
                    urlBeforeFailure:
                      parsed.data.payload.failure_context.url_before_failure,
                    screenshotBeforeSnapshotId:
                      parsed.data.payload.failure_context
                        .screenshot_before_snapshot_id,
                  }
                : undefined,
            });

      if (result.isRight()) {
        this.channel.ack(message);
        return;
      }

      const error = result.value;
      if (error instanceof JobNotRunnableError || error instanceof JobPausedError) {
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
      console.error(`Transient explore consumer error: ${messageText}`);
      this.channel.nack(message, false, true);
    }
  }
}
