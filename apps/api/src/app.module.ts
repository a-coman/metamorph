import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { CoreModule } from './shared/core/core.module.js';
import { MinioModule } from './shared/infrastructure/minio/minio.module.js';
import { RabbitMqModule } from './shared/infrastructure/messaging/rabbitmq.module.js';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module.js';

@Module({
  imports: [
    CoreModule,
    PrismaModule,
    MinioModule,
    RabbitMqModule,
    HealthModule,
    SessionsModule,
  ],
})
export class AppModule {}
