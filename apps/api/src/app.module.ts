import { Module } from '@nestjs/common';
import { ArtifactsModule } from './artifacts/artifacts.module.js';
import { EventsModule } from './events/events.module.js';
import { HealthModule } from './health/health.module.js';
import { MrVersionsModule } from './mr-versions/mr-versions.module.js';
import { PageSnapshotsModule } from './page-snapshots/page-snapshots.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { CoreModule } from './shared/core/core.module.js';
import { S3Module } from './shared/infrastructure/s3/s3.module.js';
import { RabbitMqModule } from './shared/infrastructure/messaging/rabbitmq.module.js';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module.js';

@Module({
  imports: [
    CoreModule,
    PrismaModule,
    S3Module,
    RabbitMqModule,
    HealthModule,
    SessionsModule,
    MrVersionsModule,
    ArtifactsModule,
    PageSnapshotsModule,
    EventsModule,
  ],
})
export class AppModule {}
