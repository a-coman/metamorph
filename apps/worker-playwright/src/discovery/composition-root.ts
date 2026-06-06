import { chromium } from 'playwright';
import { DiscoverJobService } from './application/services/discover-job.service.js';
import { SavePageSnapshotService } from './application/services/save-page-snapshot.service.js';
import { S3ArtifactStorageAdapter } from './infrastructure/minio/s3-artifact-storage.adapter.js';
import { PageInventoryPlaywrightAdapter } from './infrastructure/playwright/page-inventory-playwright.adapter.js';
import { DiscoverJobPrismaRepository } from './infrastructure/persistence/repositories/discover-job-prisma.repository.js';
import { PageSnapshotPrismaRepository } from './infrastructure/persistence/repositories/page-snapshot-prisma.repository.js';

export function createDiscoverJobService(): DiscoverJobService {
  const jobRepository = new DiscoverJobPrismaRepository();
  const pageSnapshotRepository = new PageSnapshotPrismaRepository();
  const artifactStorage = new S3ArtifactStorageAdapter();
  const inventoryCapture = new PageInventoryPlaywrightAdapter();

  const savePageSnapshot = new SavePageSnapshotService(
    pageSnapshotRepository,
    artifactStorage,
  );

  return new DiscoverJobService(
    jobRepository,
    inventoryCapture,
    savePageSnapshot,
    () =>
      chromium.launch({
        headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
        args: ['--disable-dev-shm-usage'],
      }),
  );
}
