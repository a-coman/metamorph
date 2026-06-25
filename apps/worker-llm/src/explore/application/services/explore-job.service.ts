import type { DomainError, Either } from '@metamorph/utils';
import { left, right } from '@metamorph/utils';
import { MrVersionStatus } from '../../../../../api/generated/prisma/enums.js';
import {
  pauseSessionJob,
  sessionControlChecker,
} from '../../../shared/infrastructure/session-control/session-control.js';
import type { ExploreJob } from '../../domain/entities/explore-job.entity.js';
import { JobStatus } from '../../domain/enums/job-status.enum.js';
import {
  JobExecutionFailedError,
  JobNotFoundError,
  JobNotRunnableError,
  JobPausedError,
} from '../../domain/errors/explore.errors.js';
import { ExploreJobRepositoryPort } from '../../domain/repositories/explore-job.repository.port.js';
import { ExploreGraphRunner } from '../../infrastructure/graph/explore-graph-runner.js';
import type { ProbeResumeValue } from '../../infrastructure/graph/explore-state.js';
import { ExplorationPrismaRepository } from '../../infrastructure/persistence/exploration-prisma.repository.js';

type ExploreOutcome = {
  status: 'completed' | 'interrupted' | 'failed' | 'paused';
  mrVersionId?: string;
  reason?: string;
};

const TERMINAL_MR_STATUSES = new Set<MrVersionStatus>([
  MrVersionStatus.draft_pending_hitl,
  MrVersionStatus.exploration_failed,
]);

export class ExploreJobService {
  constructor(
    private readonly jobRepository: ExploreJobRepositoryPort,
    private readonly graphRunner: ExploreGraphRunner,
    private readonly explorationRepo: ExplorationPrismaRepository,
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
        transformFamily: job.transformFamily,
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

    const resumeGuard = await this.guardResume(job, exploreJobId);
    if (resumeGuard.isLeft()) {
      return resumeGuard;
    }
    if (resumeGuard.value.skip) {
      return right({ mrVersionId: resumeGuard.value.mrVersionId });
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

    const resumeGuard = await this.guardResume(job, exploreJobId);
    if (resumeGuard.isLeft()) {
      return resumeGuard;
    }
    if (resumeGuard.value.skip) {
      return right({ mrVersionId: resumeGuard.value.mrVersionId });
    }

    try {
      const outcome = await this.graphRunner.resumeFromUserPause(exploreJobId);
      return this.handleOutcome(exploreJobId, job.sessionId, outcome);
    } catch (error) {
      return this.handleExecutionError(exploreJobId, error);
    }
  }

  private async guardResume(
    job: ExploreJob,
    exploreJobId: string,
  ): Promise<
    Either<
      DomainError,
      { skip: boolean; mrVersionId?: string }
    >
  > {
    if (job.status === JobStatus.running) {
      return right({ skip: false });
    }

    if (job.status === JobStatus.paused) {
      return left(new JobPausedError(exploreJobId));
    }

    if (job.status === JobStatus.queued) {
      return left(
        new JobNotRunnableError(exploreJobId, `status=${job.status}`),
      );
    }

    const mrVersion = await this.explorationRepo.getMrVersionForExploreJob(exploreJobId);
    if (!mrVersion) {
      return left(
        new JobNotRunnableError(exploreJobId, `status=${job.status}, mr_version missing`),
      );
    }

    if (TERMINAL_MR_STATUSES.has(mrVersion.status)) {
      console.warn(
        `Ignoring stale explore resume for terminal explore job ${exploreJobId} (mr=${mrVersion.status})`,
      );
      return right({ skip: true, mrVersionId: mrVersion.id });
    }

    if (mrVersion.status === MrVersionStatus.exploring) {
      console.warn(
        `Reopening explore job ${exploreJobId} for orphaned resume (mr still exploring)`,
      );
      job.reopen();
      await this.jobRepository.save(job);
      return right({ skip: false, mrVersionId: mrVersion.id });
    }

    return left(
      new JobNotRunnableError(
        exploreJobId,
        `status=${job.status}, mr_status=${mrVersion.status}`,
      ),
    );
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
      const reason = outcome.reason ?? 'Exploration failed';
      if (job) {
        job.fail(reason);
        await this.jobRepository.save(job);
      }
      if (outcome.mrVersionId) {
        await this.reconcileMrOnFailure(outcome.mrVersionId, reason);
      }
      return left(new JobExecutionFailedError(jobId, reason));
    }

    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      return right({ mrVersionId: outcome.mrVersionId });
    }

    if (outcome.mrVersionId) {
      const mrStatus = await this.explorationRepo.getMrVersionStatus(
        outcome.mrVersionId,
      );
      if (mrStatus !== MrVersionStatus.draft_pending_hitl) {
        const reason = `Explore graph completed but MR ${outcome.mrVersionId} is ${mrStatus ?? 'missing'} (expected draft_pending_hitl)`;
        await this.explorationRepo.markExplorationFailed(outcome.mrVersionId, reason);
        job.fail(reason);
        await this.jobRepository.save(job);
        return left(new JobExecutionFailedError(jobId, reason));
      }
    }

    job.complete();
    await this.jobRepository.save(job);

    console.log(`Explore job ${jobId} done — mr_version ${outcome.mrVersionId}`);
    return right({ mrVersionId: outcome.mrVersionId });
  }

  private async reconcileMrOnFailure(
    mrVersionId: string,
    reason: string,
  ): Promise<void> {
    const mrStatus = await this.explorationRepo.getMrVersionStatus(mrVersionId);
    if (mrStatus === MrVersionStatus.exploring) {
      await this.explorationRepo.markExplorationFailed(mrVersionId, reason);
    }
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

    const mrVersion = await this.explorationRepo.getMrVersionForExploreJob(jobId);
    if (mrVersion) {
      await this.reconcileMrOnFailure(mrVersion.id, message);
    }

    return left(new JobExecutionFailedError(jobId, message));
  }
}
