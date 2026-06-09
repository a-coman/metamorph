import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class TracePathQuery {
  constructor(private readonly prisma: PrismaService) {}

  async resolveBySnapshotIds(
    snapshotIds: string[],
  ): Promise<Map<string, string>> {
    if (snapshotIds.length === 0) {
      return new Map();
    }

    const traceArtifacts = await this.prisma.artifact.findMany({
      where: {
        pageSnapshotId: { in: snapshotIds },
        kind: 'trace',
      },
      select: { pageSnapshotId: true, path: true },
      orderBy: { createdAt: 'desc' },
    });

    const tracePathBySnapshot = new Map<string, string>();
    for (const artifact of traceArtifacts) {
      if (
        artifact.pageSnapshotId &&
        !tracePathBySnapshot.has(artifact.pageSnapshotId)
      ) {
        tracePathBySnapshot.set(artifact.pageSnapshotId, artifact.path);
      }
    }

    return tracePathBySnapshot;
  }
}
