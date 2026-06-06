import type { Prisma } from '../../../../../../api/generated/prisma/client.js';
import { ArtifactKind } from '../../../../../../api/generated/prisma/enums.js';
import { prisma } from '../../../../shared/infrastructure/prisma/prisma-client.js';
import {
  PageSnapshotRepositoryPort,
  type PersistPageSnapshotInput,
} from '../../../domain/repositories/page-snapshot.repository.port.js';

export class PageSnapshotPrismaRepository extends PageSnapshotRepositoryPort {
  async save(input: PersistPageSnapshotInput) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const pageSnapshot = await tx.pageSnapshot.create({
        data: {
          sessionId: input.sessionId,
          jobId: input.jobId,
          url: input.url,
          inventory: input.inventory,
        },
      });

      const artifact = await tx.artifact.create({
        data: {
          sessionId: input.sessionId,
          pageSnapshotId: pageSnapshot.id,
          kind: ArtifactKind.annotated_screenshot,
          path: input.artifactPath,
          mimeType: 'image/png',
          sizeBytes: input.screenshot.length,
        },
      });

      await tx.pageSnapshot.update({
        where: { id: pageSnapshot.id },
        data: { annotatedScreenshotId: artifact.id },
      });

      return {
        pageSnapshotId: pageSnapshot.id,
        artifactId: artifact.id,
        artifactPath: input.artifactPath,
      };
    });
  }
}
