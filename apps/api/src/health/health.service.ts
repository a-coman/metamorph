import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/infrastructure/prisma/prisma.service.js';
import { MinioStorageService } from '../shared/infrastructure/minio/minio-storage.service.js';
import { RabbitMqConnectionService } from '../shared/infrastructure/messaging/rabbitmq-connection.service.js';

export type HealthCheckResult = {
  status: 'ok' | 'degraded';
  postgres: 'ok' | 'error';
  minio: 'ok' | 'error';
  rabbitmq: 'ok' | 'error';
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioStorageService,
    private readonly rabbitMq: RabbitMqConnectionService,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const [postgres, minio, rabbitmq] = await Promise.all([
      this.checkPostgres(),
      this.checkMinio(),
      this.checkRabbitMq(),
    ]);

    const allOk = postgres === 'ok' && minio === 'ok' && rabbitmq === 'ok';

    return {
      status: allOk ? 'ok' : 'degraded',
      postgres,
      minio,
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

  private async checkMinio(): Promise<'ok' | 'error'> {
    try {
      await this.minio.ping();
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
