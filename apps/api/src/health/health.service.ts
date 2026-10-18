import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/infrastructure/prisma/prisma.service.js';
import { S3StorageService } from '../shared/infrastructure/s3/s3-storage.service.js';
import { RabbitMqConnectionService } from '../shared/infrastructure/messaging/rabbitmq-connection.service.js';

export type HealthCheckResult = {
  status: 'ok' | 'degraded';
  postgres: 'ok' | 'error';
  storage: 'ok' | 'error';
  rabbitmq: 'ok' | 'error';
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
    private readonly rabbitMq: RabbitMqConnectionService,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const [postgres, storage, rabbitmq] = await Promise.all([
      this.checkPostgres(),
      this.checkStorage(),
      this.checkRabbitMq(),
    ]);

    const allOk = postgres === 'ok' && storage === 'ok' && rabbitmq === 'ok';

    return {
      status: allOk ? 'ok' : 'degraded',
      postgres,
      storage,
      rabbitmq,
    };
  }

  private async checkPostgres(): Promise<'ok' | 'error'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkStorage(): Promise<'ok' | 'error'> {
    try {
      await this.storage.ping();
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkRabbitMq(): Promise<'ok' | 'error'> {
    try {
      await this.rabbitMq.ping();
      return 'ok';
    } catch {
      return 'error';
    }
  }
}
