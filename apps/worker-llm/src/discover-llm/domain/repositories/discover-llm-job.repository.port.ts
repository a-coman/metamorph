import { DiscoverLlmJob } from '../entities/discover-llm-job.entity.js';

export abstract class DiscoverLlmJobRepositoryPort {
  abstract findById(jobId: string): Promise<DiscoverLlmJob | null>;

  abstract save(job: DiscoverLlmJob): Promise<void>;
}
