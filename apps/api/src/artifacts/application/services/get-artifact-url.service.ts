import { Injectable, NotFoundException } from '@nestjs/common';
import type { ArtifactUrlDto } from '@metamorph/api-client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { S3StorageService } from '../../../shared/infrastructure/s3/s3-storage.service.js';

@Injectable()
export class GetArtifactUrlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
  ) {}

  async getUrl(artifactId: string): Promise<ArtifactUrlDto> {
    const artifact = await this.prisma.artifact.findUnique({
      where: { id: artifactId },
    });

    if (!artifact) {
      throw new NotFoundException(`Artifact ${artifactId} not found`);
    }

    const linked =
      artifact.sessionId !== null ||
      artifact.runId !== null ||
      artifact.pageSnapshotId !== null;

    if (!linked) {
      throw new NotFoundException(`Artifact ${artifactId} not found`);
    }

    const { url, expiresAt } = await this.storage.getPresignedUrl(artifact.path);

    return {
      url,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
