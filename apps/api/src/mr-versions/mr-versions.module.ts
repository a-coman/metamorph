import { Module } from '@nestjs/common';
import { ExplorationQueryPort } from './application/ports/exploration-query.port.js';
import { MrVersionQueryPort } from './application/ports/mr-version-query.port.js';
import { RunQueryPort } from './application/ports/run-query.port.js';
import { ApproveMrVersionService } from './application/services/approve-mr-version.service.js';
import { RejectMrVersionService } from './application/services/reject-mr-version.service.js';
import { EnqueueExecutePairJobService } from './application/services/enqueue-execute-pair-job.service.js';
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
  controllers: [MrVersionsController, RunsController],
  providers: [
    MrVersionService,
    ExplorationService,
    ApproveMrVersionService,
    RejectMrVersionService,
    EnqueueExecutePairJobService,
    ExecuteMrVersionService,
    { provide: MrVersionQueryPort, useClass: MrVersionPrismaQuery },
    { provide: ExplorationQueryPort, useClass: ExplorationPrismaQuery },
    { provide: RunQueryPort, useClass: RunPrismaQuery },
  ],
})
export class MrVersionsModule {}
