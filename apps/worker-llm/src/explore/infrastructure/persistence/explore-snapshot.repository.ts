import type { PageSnapshotInventory } from '@metamorph/core';
import { prisma } from '../../../shared/infrastructure/prisma/prisma-client.js';

export type SnapshotRecord = {
  id: string;
  url: string;
  inventory: PageSnapshotInventory;
  rawArtifactPath: string | null;
  annotatedArtifactPath: string | null;
};

export class ExploreSnapshotRepository {
  async findById(snapshotId: string): Promise<SnapshotRecord | null> {
    const row = await prisma.pageSnapshot.findUnique({
      where: { id: snapshotId },
      include: {
        rawScreenshot: true,
        annotatedScreenshot: true,
      },
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      url: row.url,
      inventory: row.inventory as PageSnapshotInventory,
      rawArtifactPath: row.rawScreenshot?.path ?? null,
      annotatedArtifactPath: row.annotatedScreenshot?.path ?? null,
    };
  }

  async loadRawScreenshot(snapshotId: string): Promise<string> {
    const snapshot = await this.findById(snapshotId);
    if (!snapshot?.rawArtifactPath) {
      throw new Error(`Snapshot ${snapshotId} has no raw screenshot artifact`);
    }

    return snapshot.rawArtifactPath;
  }

  async loadAnnotatedScreenshot(snapshotId: string): Promise<string> {
    const snapshot = await this.findById(snapshotId);
    if (!snapshot?.annotatedArtifactPath) {
      throw new Error(`Snapshot ${snapshotId} has no annotated screenshot artifact`);
    }

    return snapshot.annotatedArtifactPath;
  }
}
