import type { DomainEvent } from '@metamorph/utils';

export class SessionCreatedEvent implements DomainEvent {
  readonly occurredOn = new Date();
  readonly type = 'session.created';

  constructor(
    readonly sessionId: string,
    readonly url: string,
  ) {}
}
