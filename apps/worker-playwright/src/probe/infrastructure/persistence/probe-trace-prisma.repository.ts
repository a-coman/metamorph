import { ArtifactKind } from '../../../../../api/generated/prisma/enums.js';
import { prisma } from '../../../shared/infrastructure/prisma/prisma-client.js';
import { S3ArtifactStorageAdapter } from '../../../discovery/infrastructure/minio/s3-artifact-storage.adapter.js';

export class ProbeTracePrismaRepository {
  constructor(
    private readonly artifactStorage: S3ArtifactStorageAdapter = new S3ArtifactStorageAdapter(),
  ) {}

  async save(input: {
    sessionId: string;
    jobId: string;
    pageSnapshotId?: string | null;
    traceZip: Buffer;
  }): Promise<string> {
    const path = `sessions/${input.sessionId}/probes/${input.jobId}/trace.zip`;

    await this.artifactStorage.put(path, input.traceZip, 'application/zip');

    await prisma.artifact.create({
      data: {
        sessionId: input.sessionId,
        pageSnapshotId: input.pageSnapshotId ?? undefined,
        kind: ArtifactKind.trace,
        path,
        mimeType: 'application/zip',
        sizeBytes: input.traceZip.length,
      },
    });

    return path;
  }
}
