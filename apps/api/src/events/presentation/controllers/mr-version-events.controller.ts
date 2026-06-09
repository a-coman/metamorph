import { Controller, Param, Sse } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { MrVersionEventsService } from '../../application/services/mr-version-events.service.js';

@Controller('mr-versions')
export class MrVersionEventsController {
  constructor(private readonly mrVersionEventsService: MrVersionEventsService) {}

  @Sse(':id/events')
  stream(@Param('id') id: string): Observable<MessageEvent> {
    return this.mrVersionEventsService.stream(id);
  }
}
