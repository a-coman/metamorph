import { Controller, Param, Sse } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { SessionEventsService } from '../../application/services/session-events.service.js';

@Controller('sessions')
export class SessionEventsController {
  constructor(private readonly sessionEventsService: SessionEventsService) {}

  @Sse(':id/events')
  stream(@Param('id') id: string): Observable<MessageEvent> {
    return this.sessionEventsService.stream(id);
  }
}
