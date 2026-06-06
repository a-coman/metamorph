import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/infrastructure/prisma/prisma.service.js';
import { MinioStorageService } from '../shared/infrastructure/minio/minio-storage.service.js';

export type HealthCheckResult = {
  status: 'ok' | 'degraded';
  postgres: 'ok' | 'error';
  minio: 'ok' | 'error';
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioStorageService,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const [postgres, minio] = await Promise.all([
      this.checkPostgres(),
      this.checkMinio(),
    ]);

    const allOk = postgres === 'ok' && minio === 'ok';

    return {
      status: allOk ? 'ok' : 'degraded',
      postgres,
      minio,
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
}
