import { Injectable, NotFoundException } from '@nestjs/common';
import type { PageSnapshotDto } from '@metamorph/api-client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class GetPageSnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(snapshotId: string): Promise<PageSnapshotDto> {
    const snapshot = await this.prisma.pageSnapshot.findUnique({
      where: { id: snapshotId },
      select: {
        id: true,
        url: true,
        inventory: true,
        createdAt: true,
        annotatedScreenshotId: true,
        rawScreenshotId: true,
      },
    });

    if (!snapshot) {
      throw new NotFoundException(`Page snapshot ${snapshotId} not found`);
    }

    const inventory = snapshot.inventory as { labeledCount?: number };

    return {
      id: snapshot.id,
      url: snapshot.url,
      labeledCount: inventory.labeledCount ?? 0,
      createdAt: snapshot.createdAt,
      ...(snapshot.annotatedScreenshotId
        ? { annotatedScreenshotArtifactId: snapshot.annotatedScreenshotId }
        : {}),
      ...(snapshot.rawScreenshotId
        ? { rawScreenshotArtifactId: snapshot.rawScreenshotId }
        : {}),
    };
  }
}
