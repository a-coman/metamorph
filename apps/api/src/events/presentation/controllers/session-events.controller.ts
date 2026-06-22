import { Controller, Get, Param, Sse } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { SessionActivityService } from '../../application/services/session-activity.service.js';
import { SessionEventsService } from '../../application/services/session-events.service.js';

@Controller('sessions')
export class SessionEventsController {
  constructor(
    private readonly sessionEventsService: SessionEventsService,
    private readonly sessionActivityService: SessionActivityService,
  ) {}

  @Get(':id/activity')
  getActivity(@Param('id') id: string) {
    return this.sessionActivityService.getActivitySnapshot(id);
  }

  @Sse(':id/events')
  stream(@Param('id') id: string): Observable<MessageEvent> {
    return this.sessionEventsService.stream(id);
  }
}
