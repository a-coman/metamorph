import { SavePageSnapshotService } from '../discovery/application/services/save-page-snapshot.service.js';
import { S3ArtifactStorageAdapter } from '../discovery/infrastructure/minio/s3-artifact-storage.adapter.js';
import { PageSnapshotPrismaRepository } from '../discovery/infrastructure/persistence/repositories/page-snapshot-prisma.repository.js';
import { ProbeJobService } from '../probe/application/services/probe-job.service.js';
import { RabbitMqExploreResumePublisherAdapter } from '../probe/infrastructure/messaging/rabbitmq-explore-resume-publisher.adapter.js';
import {
  ProbeJobPrismaRepository,
  ProbeSnapshotPrismaQuery,
} from '../probe/infrastructure/persistence/repositories/probe-job-prisma.repository.js';
import { ProbeInventoryCaptureAdapter } from '../probe/infrastructure/playwright/probe-inventory-capture.adapter.js';
import { SaveProbeTraceService } from '../probe/application/services/save-probe-trace.service.js';

function requireRabbitMqUrl(): string {
  const url = process.env.RABBITMQ_URL;
  if (!url) {
    throw new Error('RABBITMQ_URL is required');
  }
  return url;
}

export function createProbeJobService(): ProbeJobService {
  const pageSnapshotRepository = new PageSnapshotPrismaRepository();
  const artifactStorage = new S3ArtifactStorageAdapter();

  const savePageSnapshot = new SavePageSnapshotService(
    pageSnapshotRepository,
    artifactStorage,
  );

  return new ProbeJobService(
    new ProbeJobPrismaRepository(),
    new ProbeSnapshotPrismaQuery(),
    new ProbeInventoryCaptureAdapter(),
    savePageSnapshot,
    new SaveProbeTraceService(),
    new RabbitMqExploreResumePublisherAdapter(requireRabbitMqUrl()),
  );
}
