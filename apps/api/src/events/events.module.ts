import { Module } from '@nestjs/common';
import { MrVersionEventsService } from './application/services/mr-version-events.service.js';
import { SessionEventsService } from './application/services/session-events.service.js';
import { TracePathQuery } from './infrastructure/trace-path.query.js';
import { MrVersionEventsController } from './presentation/controllers/mr-version-events.controller.js';
import { SessionEventsController } from './presentation/controllers/session-events.controller.js';

@Module({
  controllers: [SessionEventsController, MrVersionEventsController],
  providers: [SessionEventsService, MrVersionEventsService, TracePathQuery],
})
export class EventsModule {}
