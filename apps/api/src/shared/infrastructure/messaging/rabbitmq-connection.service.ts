import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import amqplib, {
  type ChannelModel,
  type ConfirmChannel,
} from 'amqplib';
import { getRabbitMqConfig } from './rabbitmq.config.js';

@Injectable()
export class RabbitMqConnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqConnectionService.name);
  private connection: ChannelModel | null = null;
  private confirmChannel: ConfirmChannel | null = null;
  private connecting: Promise<void> | null = null;

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  async getConfirmChannel(): Promise<ConfirmChannel> {
    await this.connect();
    if (!this.confirmChannel) {
      throw new Error('RabbitMQ confirm channel is not available');
    }
    return this.confirmChannel;
  }

  async ping(): Promise<void> {
    const channel = await this.getConfirmChannel();
    await channel.checkExchange(getRabbitMqConfig().exchange);
  }

  private async connect(): Promise<void> {
    if (this.confirmChannel) {
      return;
    }

    if (this.connecting) {
      await this.connecting;
      return;
    }

    this.connecting = this.openConnection();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private async openConnection(): Promise<void> {
    const { url } = getRabbitMqConfig();
    this.connection = await amqplib.connect(url);
    this.confirmChannel = await this.connection.createConfirmChannel();

    this.connection.on('error', (error: Error) => {
      this.logger.error('RabbitMQ connection error', error.message);
    });

    this.connection.on('close', () => {
      this.logger.warn('RabbitMQ connection closed');
      this.connection = null;
      this.confirmChannel = null;
    });
  }

  private async close(): Promise<void> {
    try {
      await this.confirmChannel?.close();
    } catch {
      // ignore shutdown errors
    }

    try {
      await this.connection?.close();
    } catch {
      // ignore shutdown errors
    }

    this.confirmChannel = null;
    this.connection = null;
  }
}
