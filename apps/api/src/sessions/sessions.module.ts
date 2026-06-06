import { Module } from '@nestjs/common';
import { SessionQueryPort } from './application/ports/session-query.port.js';
import { SessionPort } from './application/ports/session.port.js';
import { SessionService } from './application/services/session.service.js';
import { SessionRepositoryPort } from './domain/repositories/session.repository.port.js';
import { SessionPrismaQuery } from './infrastructure/persistence/repositories/session-prisma.query.js';
import { SessionPrismaRepository } from './infrastructure/persistence/repositories/session-prisma.repository.js';
import { SessionsController } from './presentation/controllers/sessions.controller.js';

@Module({
  controllers: [SessionsController],
  providers: [
    SessionService,
    { provide: SessionRepositoryPort, useClass: SessionPrismaRepository },
    { provide: SessionQueryPort, useClass: SessionPrismaQuery },
    { provide: SessionPort, useExisting: SessionService },
  ],
})
export class SessionsModule {}
