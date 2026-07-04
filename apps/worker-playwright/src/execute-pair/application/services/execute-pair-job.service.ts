import {
  evaluateMr,
  validateObservationPayload,
} from '@metamorph/core';
import type { DomainError, Either } from '@metamorph/utils';
import { left, right } from '@metamorph/utils';
import {
  ExecutePairJobExecutionFailedError,
  ExecutePairJobNotFoundError,
  ExecutePairJobPausedError,
} from '../../domain/errors/execute-pair.errors.js';
import {
  pauseSessionJob,
  sessionControlChecker,
} from '../../../shared/infrastructure/session-control/session-control.js';
import type { ExecutePairJob } from '../../domain/entities/execute-pair-job.entity.js';
import { ExecutePairJobRepositoryPort } from '../../domain/repositories/execute-pair-job.repository.port.js';
import { PlaybookRunnerAdapter } from '../../infrastructure/playwright/playbook-runner.adapter.js';
import { RunPrismaRepository } from '../../infrastructure/persistence/repositories/run-prisma.repository.js';
import type { S3ArtifactStorageAdapter } from '../../../discovery/infrastructure/minio/s3-artifact-storage.adapter.js';

export class ExecutePairJobService {
  constructor(
    private readonly jobRepository: ExecutePairJobRepositoryPort,
    private readonly runRepository: RunPrismaRepository,
    private readonly playbookRunner: PlaybookRunnerAdapter,
    private readonly artifactStorage: S3ArtifactStorageAdapter,
  ) {}

  async run(jobId: string): Promise<Either<DomainError, void>> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      return left(new ExecutePairJobNotFoundError(jobId));
    }

    if (await sessionControlChecker.isPauseRequested(job.sessionId)) {
      await pauseSessionJob(job.sessionId, jobId);
      await this.runRepository.markPaused(job.runId);
      return left(new ExecutePairJobPausedError(jobId));
    }

    const startOrError = job.start();
    if (startOrError.isLeft()) {
      return left(startOrError.value);
    }

    await this.jobRepository.save(job);
    await this.runRepository.markRunning(job.runId);

    try {
      const playbookResult = await this.playbookRunner.run(
        job.playbookContent,
        job.runId,
        job.sessionId,
      );

      for (const [role, observation] of [
        ['source', playbookResult.sourceObservation],
        ['follow_up', playbookResult.followUpObservation],
      ] as const) {
        const validation = validateObservationPayload(
          job.schemaContent,
          observation,
          job.observables,
        );

        if (!validation.valid) {
          const message = `Invalid ${role} observation: ${validation.error}`;
          await this.failRun(job.runId, job, message);
          return left(new ExecutePairJobExecutionFailedError(jobId, message));
        }
      }

      const evaluation = evaluateMr(
        job.observables,
        playbookResult.sourceObservation,
        playbookResult.followUpObservation,
      );

      await this.runRepository.saveSuccess({
        runId: job.runId,
        sessionId: job.sessionId,
        mrVersionId: job.mrVersionId,
        playbookContentHash: job.playbookContentHash,
        sessionUrl: job.sessionUrl,
        observables: job.observables,
        sourceObservation: playbookResult.sourceObservation,
        followUpObservation: playbookResult.followUpObservation,
        evaluation,
        traceZipPath: playbookResult.traceZipPath,
        artifactStorage: this.artifactStorage,
      });

      job.complete();
      await this.jobRepository.save(job);

      console.log(
        `Execute pair job ${jobId} done — run ${job.runId}, verdict=${evaluation.verdict}`,
      );

      return right(undefined);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown execute pair job error';

      if (message === 'Playbook paused by user') {
        await pauseSessionJob(job.sessionId, jobId);
        await this.runRepository.markPaused(job.runId);
        job.pause();
        await this.jobRepository.save(job);
        return left(new ExecutePairJobPausedError(jobId));
      }

      await this.failRun(job.runId, job, message);
      return left(new ExecutePairJobExecutionFailedError(jobId, message));
    }
  }

  private async failRun(
    runId: string,
    job: ExecutePairJob,
    message: string,
  ): Promise<void> {
    job.fail(message);
    await this.runRepository.markFailed(runId, message);
    await this.jobRepository.save(job);
  }
}
