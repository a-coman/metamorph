import { Module } from '@nestjs/common';
import { MrVersionQueryPort } from './application/ports/mr-version-query.port.js';
import {
  MrVersionPrismaQuery,
  MrVersionService,
} from './infrastructure/persistence/mr-version-prisma.query.js';
import { MrVersionsController } from './presentation/controllers/mr-versions.controller.js';

@Module({
  controllers: [MrVersionsController],
  providers: [
    MrVersionService,
    { provide: MrVersionQueryPort, useClass: MrVersionPrismaQuery },
  ],
})
export class MrVersionsModule {}
