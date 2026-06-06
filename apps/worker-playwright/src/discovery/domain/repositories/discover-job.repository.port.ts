import { DiscoverJob } from '../entities/discover-job.entity.js';

export abstract class DiscoverJobRepositoryPort {
  abstract findById(jobId: string): Promise<DiscoverJob | null>;

  abstract save(job: DiscoverJob): Promise<void>;
}
