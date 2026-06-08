import { S3ArtifactStorageAdapter } from '../discovery/infrastructure/minio/s3-artifact-storage.adapter.js';
import { ExecutePairJobService } from './application/services/execute-pair-job.service.js';
import { ExecutePairJobPrismaRepository } from './infrastructure/persistence/repositories/execute-pair-job-prisma.repository.js';
import { RunPrismaRepository } from './infrastructure/persistence/repositories/run-prisma.repository.js';
import { PlaybookRunnerAdapter } from './infrastructure/playwright/playbook-runner.adapter.js';

export function createExecutePairJobService(): ExecutePairJobService {
  return new ExecutePairJobService(
    new ExecutePairJobPrismaRepository(),
    new RunPrismaRepository(),
    new PlaybookRunnerAdapter(),
    new S3ArtifactStorageAdapter(),
  );
}
