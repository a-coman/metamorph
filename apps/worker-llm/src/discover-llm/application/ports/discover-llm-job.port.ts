import type { DomainError, Either } from '@metamorph/utils';

export abstract class DiscoverLlmJobPort {
  abstract run(jobId: string): Promise<Either<DomainError, { mrVersionId: string }>>;
}
