import { ExploreJobService } from './application/services/explore-job.service.js';
import { ExploreGraphRunner } from './infrastructure/graph/explore-graph-runner.js';
import { LlmExploreSubscriber } from './infrastructure/messaging/llm-explore.subscriber.js';
import { ProbeJobPublisher } from './infrastructure/messaging/probe-job.publisher.js';
import { ExploreOpenRouterClient } from './infrastructure/openrouter/explore-openrouter.client.js';
import { ExplorationPrismaRepository } from './infrastructure/persistence/exploration-prisma.repository.js';
import { ExploreSnapshotRepository } from './infrastructure/persistence/explore-snapshot.repository.js';
import { ExploreJobPrismaRepository } from './infrastructure/persistence/repositories/explore-job-prisma.repository.js';
import { S3ArtifactReaderAdapter } from '../shared/infrastructure/minio/s3-artifact-reader.adapter.js';
import { sessionControlChecker } from '../shared/infrastructure/session-control/session-control.js';

function requireRabbitMqUrl(): string {
  const url = process.env.RABBITMQ_URL;
  if (!url) {
    throw new Error('RABBITMQ_URL is required');
  }
  return url;
}

function createExploreGraphRunner(): ExploreGraphRunner {
  return new ExploreGraphRunner({
    explorationRepo: new ExplorationPrismaRepository(),
    snapshotRepo: new ExploreSnapshotRepository(),
    openRouter: new ExploreOpenRouterClient(),
    probePublisher: new ProbeJobPublisher(requireRabbitMqUrl()),
    artifactReader: new S3ArtifactReaderAdapter(),
    sessionControl: sessionControlChecker,
  });
}

export function createExploreJobService(): ExploreJobService {
  return new ExploreJobService(
    new ExploreJobPrismaRepository(),
    createExploreGraphRunner(),
  );
}

export function createLlmExploreSubscriber(): LlmExploreSubscriber {
  return new LlmExploreSubscriber(createExploreJobService(), {
    url: requireRabbitMqUrl(),
  });
}
