import { DiscoverLlmJobService } from './application/services/discover-llm-job.service.js';
import { OpenRouterClient } from './infrastructure/openrouter/openrouter.client.js';
import { LlmDiscoverSubscriber } from './infrastructure/messaging/llm-discover.subscriber.js';
import { DiscoverLlmJobPrismaRepository } from './infrastructure/persistence/repositories/discover-llm-job-prisma.repository.js';
import { MrDraftPrismaRepository } from './infrastructure/persistence/repositories/mr-draft-prisma.repository.js';
import { PageSnapshotPrismaRepository } from './infrastructure/persistence/repositories/page-snapshot-prisma.repository.js';
import { S3ArtifactReaderAdapter } from '../shared/infrastructure/minio/s3-artifact-reader.adapter.js';

function requireRabbitMqUrl(): string {
  const url = process.env.RABBITMQ_URL;
  if (!url) {
    throw new Error('RABBITMQ_URL is required');
  }
  return url;
}

export function createDiscoverLlmJobService(): DiscoverLlmJobService {
  return new DiscoverLlmJobService(
    new DiscoverLlmJobPrismaRepository(),
    new PageSnapshotPrismaRepository(),
    new S3ArtifactReaderAdapter(),
    new OpenRouterClient(),
    new MrDraftPrismaRepository(),
  );
}

export function createLlmDiscoverSubscriber(): LlmDiscoverSubscriber {
  return new LlmDiscoverSubscriber(createDiscoverLlmJobService(), {
    url: requireRabbitMqUrl(),
  });
}
