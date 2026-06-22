import type { DomainError, Either } from '@metamorph/utils';
import { left, right } from '@metamorph/utils';
import {
  pauseSessionJob,
  sessionControlChecker,
} from '../../../shared/infrastructure/session-control/session-control.js';
import {
  JobExecutionFailedError,
  JobNotFoundError,
  JobPausedError,
} from '../../domain/errors/explore.errors.js';
import { ExploreJobRepositoryPort } from '../../domain/repositories/explore-job.repository.port.js';
import { ExploreGraphRunner } from '../../infrastructure/graph/explore-graph-runner.js';
import type { ProbeResumeValue } from '../../infrastructure/graph/explore-state.js';

type ExploreOutcome = {
  status: 'completed' | 'interrupted' | 'failed' | 'paused';
  mrVersionId?: string;
  reason?: string;
};

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

    if (await sessionControlChecker.isPauseRequested(job.sessionId)) {
      await pauseSessionJob(job.sessionId, jobId);
      return left(new JobPausedError(jobId));
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

      return this.handleOutcome(jobId, job.sessionId, outcome);
    } catch (error) {
      return this.handleExecutionError(jobId, error);
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

    if (await sessionControlChecker.isPauseRequested(job.sessionId)) {
      await pauseSessionJob(job.sessionId, exploreJobId);
      return left(new JobPausedError(exploreJobId));
    }

    try {
      const outcome = await this.graphRunner.resume(exploreJobId, resumeValue);
      return this.handleOutcome(exploreJobId, job.sessionId, outcome);
    } catch (error) {
      return this.handleExecutionError(exploreJobId, error);
    }
  }

  async resumeFromUserPause(
    exploreJobId: string,
  ): Promise<Either<DomainError, { mrVersionId?: string }>> {
    const job = await this.jobRepository.findById(exploreJobId);
    if (!job) {
      return left(new JobNotFoundError(exploreJobId));
    }

    if (await sessionControlChecker.isPauseRequested(job.sessionId)) {
      await pauseSessionJob(job.sessionId, exploreJobId);
      return left(new JobPausedError(exploreJobId));
    }

    try {
      const outcome = await this.graphRunner.resumeFromUserPause(exploreJobId);
      return this.handleOutcome(exploreJobId, job.sessionId, outcome);
    } catch (error) {
      return this.handleExecutionError(exploreJobId, error);
    }
  }

  private async handleOutcome(
    jobId: string,
    sessionId: string,
    outcome: ExploreOutcome,
  ): Promise<Either<DomainError, { mrVersionId?: string }>> {
    if (outcome.status === 'paused') {
      await pauseSessionJob(sessionId, jobId);
      console.log(`Explore job ${jobId} paused by user`);
      return left(new JobPausedError(jobId));
    }

    if (outcome.status === 'interrupted') {
      console.log(`Explore job ${jobId} interrupted — waiting for probe`);
      return right({ mrVersionId: outcome.mrVersionId });
    }

    if (outcome.status === 'failed') {
      const job = await this.jobRepository.findById(jobId);
      if (job) {
        job.fail(outcome.reason ?? 'Exploration failed');
        await this.jobRepository.save(job);
      }
      return left(
        new JobExecutionFailedError(
          jobId,
          outcome.reason ?? 'Exploration failed',
        ),
      );
    }

    const job = await this.jobRepository.findById(jobId);
    if (job) {
      job.complete();
      await this.jobRepository.save(job);
    }

    console.log(`Explore job ${jobId} done — mr_version ${outcome.mrVersionId}`);
    return right({ mrVersionId: outcome.mrVersionId });
  }

  private async handleExecutionError(
    jobId: string,
    error: unknown,
  ): Promise<Either<DomainError, { mrVersionId?: string }>> {
    const message =
      error instanceof Error ? error.message : 'Unknown explore job error';

    const job = await this.jobRepository.findById(jobId);
    if (job) {
      job.fail(message);
      await this.jobRepository.save(job);
    }

    return left(new JobExecutionFailedError(jobId, message));
  }
}
