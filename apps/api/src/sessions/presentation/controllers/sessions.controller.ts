import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SessionPort } from '../../application/ports/session.port.js';
import { CreateSessionRequest } from '../contracts/create-session.request.js';
import { ListSessionsQuery } from '../contracts/list-sessions.query.js';
import { toCreateSessionDto } from '../mappers/create-session.pmapper.js';
import { mapSessionDomainError } from '../mappers/session-error.http-mapper.js';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionPort: SessionPort) {}

  @Post()
  async create(@Body() request: CreateSessionRequest) {
    const result = await this.sessionPort.createSession(
      toCreateSessionDto(request),
    );

    if (result.isLeft()) {
      mapSessionDomainError(result.value);
    }

    return result.value;
  }

  @Post(':id/discover')
  async discover(@Param('id') id: string) {
    const result = await this.sessionPort.queueDiscover(id);

    if (result.isLeft()) {
      mapSessionDomainError(result.value);
    }

    return result.value;
  }

  @Get()
  list(@Query() query: ListSessionsQuery) {
    return this.sessionPort.listSessions({
      limit: query.limit ?? 20,
      cursor: query.cursor,
    });
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const result = await this.sessionPort.getSession(id);

    if (result.isLeft()) {
      mapSessionDomainError(result.value);
    }

    return result.value;
  }
}
