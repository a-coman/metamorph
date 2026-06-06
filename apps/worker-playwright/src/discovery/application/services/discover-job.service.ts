import type { Browser } from 'playwright';
import type { DomainError, Either } from '@metamorph/utils';
import { left, right } from '@metamorph/utils';
import {
  JobExecutionFailedError,
  JobNotFoundError,
} from '../../domain/errors/discovery.errors.js';
import { DiscoverJobRepositoryPort } from '../../domain/repositories/discover-job.repository.port.js';
import { DiscoverJobPort } from '../ports/discover-job.port.js';
import { PageInventoryCapturePort } from '../ports/page-inventory-capture.port.js';
import { SavePageSnapshotService } from './save-page-snapshot.service.js';

export class DiscoverJobService implements DiscoverJobPort {
  constructor(
    private readonly jobRepository: DiscoverJobRepositoryPort,
    private readonly inventoryCapture: PageInventoryCapturePort,
    private readonly savePageSnapshot: SavePageSnapshotService,
    private readonly launchBrowser: () => Promise<Browser>,
  ) {}

  async run(jobId: string): Promise<Either<DomainError, void>> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      return left(new JobNotFoundError(jobId));
    }

    const startOrError = job.start();
    if (startOrError.isLeft()) {
      return left(startOrError.value);
    }

    await this.jobRepository.save(job);

    const browser = await this.launchBrowser();

    try {
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
      await browser.close();
    }
  }
}
