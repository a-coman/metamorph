import type { DomainError, Either } from '@metamorph/utils';

export abstract class DiscoverJobPort {
  abstract run(jobId: string): Promise<Either<DomainError, void>>;
}
