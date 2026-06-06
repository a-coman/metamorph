import type { DomainEvent } from '@metamorph/utils';

export class DiscoverJobQueuedEvent implements DomainEvent {
  readonly occurredOn = new Date();
  readonly type = 'discover.job.queued';

  constructor(
    readonly jobId: string,
    readonly sessionId: string,
  ) {}
}
