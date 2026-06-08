import type { DomainError, Either } from '@metamorph/utils';
import { left, right } from '@metamorph/utils';
import {
  JobExecutionFailedError,
  JobNotFoundError,
} from '../../domain/errors/explore.errors.js';
import { ExploreJobRepositoryPort } from '../../domain/repositories/explore-job.repository.port.js';
import { ExploreGraphRunner } from '../../infrastructure/graph/explore-graph-runner.js';
import type { ProbeResumeValue } from '../../infrastructure/graph/explore-state.js';

export class ExploreJobService {
  constructor(
    private readonly jobRepository: ExploreJobRepositoryPort,
    private readonly graphRunner: ExploreGraphRunner,
  ) {}

  async run(jobId: string): Promise<Either<DomainError, { mrVersionId?: string }>> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      return left(new JobNotFoundError(jobId));
    }

    const startOrError = job.start();
    if (startOrError.isLeft()) {
      return left(startOrError.value);
    }

    await this.jobRepository.save(job);

    try {
      const outcome = await this.graphRunner.start({
        exploreJobId: jobId,
        sessionId: job.sessionId,
        sessionUrl: job.sessionUrl,
        pageSnapshotId: job.pageSnapshotId,
      });

      if (outcome.status === 'interrupted') {
        console.log(`Explore job ${jobId} interrupted — waiting for probe`);
        return right({ mrVersionId: outcome.mrVersionId });
      }

      if (outcome.status === 'failed') {
        throw new Error(outcome.reason ?? 'Exploration failed');
      }

      job.complete();
      await this.jobRepository.save(job);

      console.log(`Explore job ${jobId} done — mr_version ${outcome.mrVersionId}`);
      return right({ mrVersionId: outcome.mrVersionId });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown explore job error';

      job.fail(message);
      await this.jobRepository.save(job);

      return left(new JobExecutionFailedError(jobId, message));
    }
  }

  async resume(
    exploreJobId: string,
    resumeValue: ProbeResumeValue,
  ): Promise<Either<DomainError, { mrVersionId?: string }>> {
    const job = await this.jobRepository.findById(exploreJobId);
    if (!job) {
      return left(new JobNotFoundError(exploreJobId));
    }

    try {
      const outcome = await this.graphRunner.resume(exploreJobId, resumeValue);

      if (outcome.status === 'interrupted') {
        console.log(`Explore job ${exploreJobId} interrupted — waiting for probe`);
        return right({ mrVersionId: outcome.mrVersionId });
      }

      if (outcome.status === 'failed') {
        job.fail(outcome.reason ?? 'Exploration failed');
        await this.jobRepository.save(job);
        return left(
          new JobExecutionFailedError(
            exploreJobId,
            outcome.reason ?? 'Exploration failed',
          ),
        );
      }

      job.complete();
      await this.jobRepository.save(job);

      console.log(
        `Explore job ${exploreJobId} completed — mr_version ${outcome.mrVersionId}`,
      );

      return right({ mrVersionId: outcome.mrVersionId });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown explore resume error';

      job.fail(message);
      await this.jobRepository.save(job);

      return left(new JobExecutionFailedError(exploreJobId, message));
    }
  }
}
