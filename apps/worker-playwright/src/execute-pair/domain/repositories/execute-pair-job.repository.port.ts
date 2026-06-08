import type { ExecutePairJob } from '../entities/execute-pair-job.entity.js';

export abstract class ExecutePairJobRepositoryPort {
  abstract findById(jobId: string): Promise<ExecutePairJob | null>;
  abstract save(job: ExecutePairJob): Promise<void>;
}
