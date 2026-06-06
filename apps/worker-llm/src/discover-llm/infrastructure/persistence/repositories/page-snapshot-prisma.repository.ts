import {
  PageSnapshotInventorySchema,
  type PageSnapshotInventory,
} from '@metamorph/core';
import { prisma } from '../../../../shared/infrastructure/prisma/prisma-client.js';

export type LoadedPageSnapshot = {
  id: string;
  sessionId: string;
  url: string;
  inventory: PageSnapshotInventory;
  artifactPath: string;
};

export class PageSnapshotPrismaRepository {
  async findById(snapshotId: string): Promise<LoadedPageSnapshot | null> {
    const row = await prisma.pageSnapshot.findUnique({
      where: { id: snapshotId },
      include: {
        annotatedScreenshot: true,
      },
    });

    if (!row || !row.annotatedScreenshot) {
      return null;
    }

    const inventory = PageSnapshotInventorySchema.parse(row.inventory);

    return {
      id: row.id,
      sessionId: row.sessionId,
      url: row.url,
      inventory,
      artifactPath: row.annotatedScreenshot.path,
    };
  }
}
