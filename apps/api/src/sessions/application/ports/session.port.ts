import type { DomainError, Either } from '@metamorph/utils';
import type {
  CreateSessionDto,
  CreateSessionResultDto,
  QueueDiscoverResultDto,
} from '../dtos/create-session.dto.js';
import type {
  SessionDetailsDto,
  SessionListDto,
} from '../dtos/session-details.dto.js';

export abstract class SessionPort {
  abstract createSession(
    dto: CreateSessionDto,
  ): Promise<Either<DomainError, CreateSessionResultDto>>;

  abstract queueDiscover(
    sessionId: string,
  ): Promise<Either<DomainError, QueueDiscoverResultDto>>;

  abstract getSession(
    sessionId: string,
  ): Promise<Either<DomainError, SessionDetailsDto>>;

  abstract listSessions(params: {
    limit: number;
    cursor?: string;
  }): Promise<SessionListDto>;
}
