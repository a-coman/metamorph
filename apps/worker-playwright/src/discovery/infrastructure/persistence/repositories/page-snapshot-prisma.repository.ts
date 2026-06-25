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

      let rawScreenshotId: string | undefined;
      let annotatedScreenshotId: string | undefined;
      let primaryArtifactId: string | undefined;
      let primaryArtifactPath: string | undefined;

      if (input.rawArtifactPath && input.rawScreenshot) {
        const rawArtifact = await tx.artifact.create({
          data: {
            sessionId: input.sessionId,
            pageSnapshotId: pageSnapshot.id,
            kind: ArtifactKind.screenshot,
            path: input.rawArtifactPath,
            mimeType: 'image/png',
            sizeBytes: input.rawScreenshot.length,
          },
        });
        rawScreenshotId = rawArtifact.id;
        primaryArtifactId = rawArtifact.id;
        primaryArtifactPath = input.rawArtifactPath;
      }

      if (input.artifactPath && input.screenshot) {
        const annotatedArtifact = await tx.artifact.create({
          data: {
            sessionId: input.sessionId,
            pageSnapshotId: pageSnapshot.id,
            kind: ArtifactKind.annotated_screenshot,
            path: input.artifactPath,
            mimeType: 'image/png',
            sizeBytes: input.screenshot.length,
          },
        });
        annotatedScreenshotId = annotatedArtifact.id;
        if (!primaryArtifactId) {
          primaryArtifactId = annotatedArtifact.id;
          primaryArtifactPath = input.artifactPath;
        }
      }

      await tx.pageSnapshot.update({
        where: { id: pageSnapshot.id },
        data: {
          ...(rawScreenshotId ? { rawScreenshotId } : {}),
          ...(annotatedScreenshotId ? { annotatedScreenshotId } : {}),
        },
      });

      if (!primaryArtifactId || !primaryArtifactPath) {
        throw new Error('Page snapshot requires at least one screenshot artifact');
      }

      return {
        pageSnapshotId: pageSnapshot.id,
        artifactId: primaryArtifactId,
        artifactPath: primaryArtifactPath,
      };
    });
  }
}
