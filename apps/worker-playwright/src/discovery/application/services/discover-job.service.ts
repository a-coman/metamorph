import type { Browser } from 'playwright';
import type { DomainError, Either } from '@metamorph/utils';
import { left, right } from '@metamorph/utils';
import {
  JobExecutionFailedError,
  JobNotFoundError,
  JobPausedError,
} from '../../domain/errors/discovery.errors.js';
import { DiscoverJobRepositoryPort } from '../../domain/repositories/discover-job.repository.port.js';
import { DiscoverJobPort } from '../ports/discover-job.port.js';
import { PageInventoryCapturePort } from '../ports/page-inventory-capture.port.js';
import { ChainExploreJobService } from './chain-explore-job.service.js';
import { SavePageSnapshotService } from './save-page-snapshot.service.js';
import {
  pauseSessionJob,
  sessionControlChecker,
} from '../../../shared/infrastructure/session-control/session-control.js';

export class DiscoverJobService implements DiscoverJobPort {
  constructor(
    private readonly jobRepository: DiscoverJobRepositoryPort,
    private readonly inventoryCapture: PageInventoryCapturePort,
    private readonly savePageSnapshot: SavePageSnapshotService,
    private readonly chainExploreJob: ChainExploreJobService,
    private readonly launchBrowser: () => Promise<Browser>,
  ) {}

  async run(jobId: string): Promise<Either<DomainError, void>> {
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

    let browser: Browser | null = null;

    try {
      browser = await this.launchBrowser();

      const inventory = await this.inventoryCapture.capture(
        browser,
        job.sessionUrl,
      );

      const result = await this.savePageSnapshot.execute({
        sessionId: job.sessionId,
        jobId: job.id.value,
        inventory,
      });

      job.complete();
      await this.jobRepository.save(job);

      if (await sessionControlChecker.isPauseRequested(job.sessionId)) {
        await pauseSessionJob(job.sessionId, jobId);
        return left(new JobPausedError(jobId));
      }

      await this.chainExploreJob.chain({
        sessionId: job.sessionId,
        sessionUrl: job.sessionUrl,
        pageSnapshotId: result.pageSnapshotId,
        parentDiscoverJobId: job.id.value,
      });

      console.log(
        `Discover job ${jobId} done — snapshot ${result.pageSnapshotId}, artifact ${result.artifactPath}`,
      );

      return right(undefined);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown discover job error';

      job.fail(message);
      await this.jobRepository.save(job);

      return left(new JobExecutionFailedError(jobId, message));
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}
