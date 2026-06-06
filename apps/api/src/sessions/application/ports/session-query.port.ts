import type { SessionDetailsDto } from '../dtos/session-details.dto.js';

/** Read-side port — pragmatic CQRS for GET projections without loading full aggregates. */
export abstract class SessionQueryPort {
  abstract findDetailsById(id: string): Promise<SessionDetailsDto | null>;
}
