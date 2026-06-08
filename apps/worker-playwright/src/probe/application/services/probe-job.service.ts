import { withProbeGotoPrefix } from '@metamorph/core';
import type { DomainError, Either } from '@metamorph/utils';
import { left, right } from '@metamorph/utils';
import { SavePageSnapshotService } from '../../../discovery/application/services/save-page-snapshot.service.js';
import { ProbeInventoryCaptureError } from '../../domain/errors/probe-capture.errors.js';
import {
  ProbeJobExecutionFailedError,
  ProbeJobNotFoundError,
  ProbeJobNotRunnableError,
} from '../../domain/errors/probe.errors.js';
import type { ProbeJob } from '../../domain/entities/probe-job.entity.js';
import {
  ProbeJobRepositoryPort,
  ProbeSnapshotQueryPort,
} from '../../domain/repositories/probe-job.repository.port.js';
import { ExploreResumePublisherPort } from '../ports/explore-resume-publisher.port.js';
import { ProbeInventoryCaptureAdapter } from '../../infrastructure/playwright/probe-inventory-capture.adapter.js';
import { SaveProbeTraceService } from './save-probe-trace.service.js';

export class ProbeJobService {
  constructor(
    private readonly jobRepository: ProbeJobRepositoryPort,
    private readonly snapshotQuery: ProbeSnapshotQueryPort,
    private readonly inventoryCapture: ProbeInventoryCaptureAdapter,
    private readonly savePageSnapshot: SavePageSnapshotService,
    private readonly saveProbeTrace: SaveProbeTraceService,
    private readonly exploreResumePublisher: ExploreResumePublisherPort,
  ) {}

  async run(jobId: string): Promise<Either<DomainError, void>> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      return left(new ProbeJobNotFoundError(jobId));
    }

    const startResult = job.start();
    if (!startResult.ok) {
      return left(new ProbeJobNotRunnableError(jobId, startResult.reason));
    }

    await this.jobRepository.save(job);

    const snapshotData = await this.snapshotQuery.findInventoryById(
      job.payload.inventorySnapshotId,
    );

    if (!snapshotData) {
      return this.failJob(
        job,
        jobId,
        `Inventory snapshot ${job.payload.inventorySnapshotId} not found`,
        null,
      );
    }

    try {
      const rawSteps = [...job.payload.validatedPrefix, ...job.payload.probeSteps];
      const allSteps = withProbeGotoPrefix(rawSteps, job.payload.resumeUrl);

      const capture = await this.inventoryCapture.captureAfterSteps(
        allSteps,
        snapshotData.inventory,
        jobId,
      );

      const saved = await this.savePageSnapshot.execute({
        sessionId: job.sessionId,
        jobId,
        inventory: capture.inventory,
      });

      const tracePath = await this.persistTrace({
        sessionId: job.sessionId,
        jobId,
        pageSnapshotId: saved.pageSnapshotId,
        traceZip: capture.traceZip,
      });

      job.complete();
      await this.jobRepository.save(job);

      await this.exploreResumePublisher.publishExploreResume({
        exploreJobId: job.payload.exploreJobId,
        sessionId: job.sessionId,
        probeJobId: jobId,
        snapshotId: saved.pageSnapshotId,
        probeStatus: 'ok',
      });

      console.log(
        `Probe job ${jobId} done — snapshot ${saved.pageSnapshotId} url=${capture.inventory.url}${tracePath ? ` trace=${tracePath}` : ''}`,
      );

      return right(undefined);
    } catch (error) {
      const captureError =
        error instanceof ProbeInventoryCaptureError ? error : null;
      const traceZip = captureError?.traceZip ?? null;
      const message =
        error instanceof Error ? error.message : 'Unknown probe job error';

      let failureSnapshotId: string | null = null;
      if (captureError?.partialInventory) {
        const saved = await this.savePageSnapshot.execute({
          sessionId: job.sessionId,
          jobId,
          inventory: captureError.partialInventory,
        });
        failureSnapshotId = saved.pageSnapshotId;
      }

      await this.persistTrace({
        sessionId: job.sessionId,
        jobId,
        pageSnapshotId: failureSnapshotId,
        traceZip,
      });

      return this.failJob(job, jobId, message, traceZip, failureSnapshotId);
    }
  }

  private async persistTrace(input: {
    sessionId: string;
    jobId: string;
    pageSnapshotId: string | null;
    traceZip: Buffer | null;
  }): Promise<string | null> {
    if (!input.traceZip || input.traceZip.length === 0) {
      return null;
    }

    return this.saveProbeTrace.execute({
      sessionId: input.sessionId,
      jobId: input.jobId,
      pageSnapshotId: input.pageSnapshotId,
      traceZip: input.traceZip,
    });
  }

  private async failJob(
    job: ProbeJob,
    jobId: string,
    message: string,
    traceZip: Buffer | null,
    snapshotId: string | null = null,
  ): Promise<Either<DomainError, void>> {
    job.fail(message);
    await this.jobRepository.save(job);

    await this.exploreResumePublisher.publishExploreResume({
      exploreJobId: job.payload.exploreJobId,
      sessionId: job.sessionId,
      probeJobId: jobId,
      snapshotId,
      probeStatus: 'failed',
      error: message,
    });

    if (traceZip) {
      console.log(
        `Probe job ${jobId} failed${snapshotId ? ` — failure snapshot ${snapshotId}` : ''} — trace saved for debugging`,
      );
    }

    return left(new ProbeJobExecutionFailedError(jobId, message));
  }
}
