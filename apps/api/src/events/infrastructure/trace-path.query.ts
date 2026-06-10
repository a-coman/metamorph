import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';

export type TraceInfo = {
  path: string;
  artifactId: string;
};

@Injectable()
export class TracePathQuery {
  constructor(private readonly prisma: PrismaService) {}

  async resolveBySnapshotIds(
    snapshotIds: string[],
  ): Promise<Map<string, TraceInfo>> {
    if (snapshotIds.length === 0) {
      return new Map();
    }

    const traceArtifacts = await this.prisma.artifact.findMany({
      where: {
        pageSnapshotId: { in: snapshotIds },
        kind: 'trace',
      },
      select: { id: true, pageSnapshotId: true, path: true },
      orderBy: { createdAt: 'desc' },
    });

    const traceBySnapshot = new Map<string, TraceInfo>();
    for (const artifact of traceArtifacts) {
      if (
        artifact.pageSnapshotId &&
        !traceBySnapshot.has(artifact.pageSnapshotId)
      ) {
        traceBySnapshot.set(artifact.pageSnapshotId, {
          path: artifact.path,
          artifactId: artifact.id,
        });
      }
    }

    return traceBySnapshot;
  }
}
