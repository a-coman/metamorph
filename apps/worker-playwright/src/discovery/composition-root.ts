import { chromium } from 'playwright';
import { ChainExploreJobService } from './application/services/chain-explore-job.service.js';
import { DiscoverJobService } from './application/services/discover-job.service.js';
import { SavePageSnapshotService } from './application/services/save-page-snapshot.service.js';
import { RabbitMqLlmPublisherAdapter } from './infrastructure/messaging/rabbitmq-llm-publisher.adapter.js';
import { S3ArtifactStorageAdapter } from './infrastructure/minio/s3-artifact-storage.adapter.js';
import { createExecutePairJobService } from '../execute-pair/composition-root.js';
import { createProbeJobService } from '../probe/composition-root.js';
import { PlaywrightJobSubscriber } from '../shared/infrastructure/messaging/playwright-job.subscriber.js';
import { PageInventoryPlaywrightAdapter } from './infrastructure/playwright/page-inventory-playwright.adapter.js';
import { DiscoverJobPrismaRepository } from './infrastructure/persistence/repositories/discover-job-prisma.repository.js';
import { PageSnapshotPrismaRepository } from './infrastructure/persistence/repositories/page-snapshot-prisma.repository.js';

function requireRabbitMqUrl(): string {
  const url = process.env.RABBITMQ_URL;
  if (!url) {
    throw new Error('RABBITMQ_URL is required');
  }
  return url;
}

function createChainExploreJobService(): ChainExploreJobService {
  return new ChainExploreJobService(
    new RabbitMqLlmPublisherAdapter(requireRabbitMqUrl()),
  );
}

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
    createChainExploreJobService(),
    () =>
      chromium.launch({
        headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
        args: ['--disable-dev-shm-usage'],
      }),
  );
}

export function createPlaywrightJobSubscriber(): PlaywrightJobSubscriber {
  return new PlaywrightJobSubscriber(
    createDiscoverJobService(),
    createExecutePairJobService(),
    createProbeJobService(),
    {
      url: requireRabbitMqUrl(),
    },
  );
}
