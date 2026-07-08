import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module.js';
import { RabbitMqModule } from '../shared/infrastructure/messaging/rabbitmq.module.js';
import { ExplorationQueryPort } from './application/ports/exploration-query.port.js';
import { MrVersionQueryPort } from './application/ports/mr-version-query.port.js';
import { RunQueryPort } from './application/ports/run-query.port.js';
import { ApproveMrVersionService } from './application/services/approve-mr-version.service.js';
import { AutoPromoteMrVersionService } from './application/services/auto-promote-mr-version.service.js';
import { RejectMrVersionService } from './application/services/reject-mr-version.service.js';
import { ExecuteMrVersionService } from './application/services/execute-mr-version.service.js';
import {
  ExplorationPrismaQuery,
  ExplorationService,
} from './infrastructure/persistence/exploration-prisma.query.js';
import {
  MrVersionPrismaQuery,
  MrVersionService,
} from './infrastructure/persistence/mr-version-prisma.query.js';
import { RunPrismaQuery } from './infrastructure/persistence/run-prisma.query.js';
import { MrVersionsController } from './presentation/controllers/mr-versions.controller.js';
import { RunsController } from './presentation/controllers/runs.controller.js';

@Module({
  imports: [EventsModule, RabbitMqModule],
  controllers: [MrVersionsController, RunsController],
  providers: [
    MrVersionService,
    ExplorationService,
    ApproveMrVersionService,
    AutoPromoteMrVersionService,
    RejectMrVersionService,
    ExecuteMrVersionService,
    { provide: MrVersionQueryPort, useClass: MrVersionPrismaQuery },
    { provide: ExplorationQueryPort, useClass: ExplorationPrismaQuery },
    { provide: RunQueryPort, useClass: RunPrismaQuery },
  ],
})
export class MrVersionsModule {}
