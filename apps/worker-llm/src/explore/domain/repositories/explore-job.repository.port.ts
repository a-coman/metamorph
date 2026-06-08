import { ExploreJob } from '../entities/explore-job.entity.js';

export abstract class ExploreJobRepositoryPort {
  abstract findById(jobId: string): Promise<ExploreJob | null>;
  abstract save(job: ExploreJob): Promise<void>;
}
