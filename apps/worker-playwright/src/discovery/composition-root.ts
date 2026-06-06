import { chromium } from 'playwright';
import { ChainDiscoverLlmJobService } from './application/services/chain-discover-llm-job.service.js';
import { DiscoverJobService } from './application/services/discover-job.service.js';
import { SavePageSnapshotService } from './application/services/save-page-snapshot.service.js';
import { RabbitMqLlmPublisherAdapter } from './infrastructure/messaging/rabbitmq-llm-publisher.adapter.js';
import { S3ArtifactStorageAdapter } from './infrastructure/minio/s3-artifact-storage.adapter.js';
import { PlaywrightDiscoverSubscriber } from './infrastructure/messaging/playwright-discover.subscriber.js';
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

function createChainDiscoverLlmJobService(): ChainDiscoverLlmJobService {
  return new ChainDiscoverLlmJobService(
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
    createChainDiscoverLlmJobService(),
    () =>
      chromium.launch({
        headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
        args: ['--disable-dev-shm-usage'],
      }),
  );
}

export function createPlaywrightDiscoverSubscriber(): PlaywrightDiscoverSubscriber {
  return new PlaywrightDiscoverSubscriber(createDiscoverJobService(), {
    url: requireRabbitMqUrl(),
  });
}
