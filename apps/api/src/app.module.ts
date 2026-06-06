import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { CoreModule } from './shared/core/core.module.js';
import { MinioModule } from './shared/infrastructure/minio/minio.module.js';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module.js';

@Module({
  imports: [CoreModule, PrismaModule, MinioModule, HealthModule, SessionsModule],
})
export class AppModule {}
