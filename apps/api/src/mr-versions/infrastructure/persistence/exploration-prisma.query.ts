import { Injectable, NotFoundException } from '@nestjs/common';
import type { ExplorationTimelineDto } from '../../application/dtos/mr-version.dto.js';
import { ExplorationQueryPort } from '../../application/ports/exploration-query.port.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class ExplorationPrismaQuery extends ExplorationQueryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findTimelineByMrVersionId(
    mrVersionId: string,
  ): Promise<ExplorationTimelineDto | null> {
    const mrVersion = await this.prisma.mrVersion.findUnique({
      where: { id: mrVersionId },
    });

    if (!mrVersion) {
      return null;
    }

    const generationSlots = mrVersion.generationSlots as {
      source?: { steps?: unknown[] };
      follow_up?: { steps?: unknown[] };
    };

    const checkpoints = await this.prisma.explorationCheckpoint.findMany({
      where: { mrVersionId },
      orderBy: { sequence: 'asc' },
    });

    const snapshotIds = checkpoints.map((row) => row.snapshotId);
    const traceArtifacts =
      snapshotIds.length > 0
        ? await this.prisma.artifact.findMany({
            where: {
              pageSnapshotId: { in: snapshotIds },
              kind: 'trace',
            },
            select: { pageSnapshotId: true, path: true },
            orderBy: { createdAt: 'desc' },
          })
        : [];

    const tracePathBySnapshot = new Map<string, string>();
    for (const artifact of traceArtifacts) {
      if (artifact.pageSnapshotId && !tracePathBySnapshot.has(artifact.pageSnapshotId)) {
        tracePathBySnapshot.set(artifact.pageSnapshotId, artifact.path);
      }
    }

    return {
      mrVersionId,
      status: mrVersion.status,
      validatedSteps: {
        source: generationSlots.source?.steps ?? [],
        follow_up: generationSlots.follow_up?.steps ?? [],
      },
      checkpoints: checkpoints.map((row) => ({
        id: row.id,
        phase: row.phase,
        sequence: row.sequence,
        snapshotId: row.snapshotId,
        stepsJson: row.stepsJson,
        verdict: row.verdict,
        rationale: row.rationale,
        tracePath: tracePathBySnapshot.get(row.snapshotId) ?? null,
        createdAt: row.createdAt,
      })),
    };
  }
}

@Injectable()
export class ExplorationService {
  constructor(private readonly explorationQuery: ExplorationQueryPort) {}

  async getTimeline(mrVersionId: string): Promise<ExplorationTimelineDto> {
    const timeline =
      await this.explorationQuery.findTimelineByMrVersionId(mrVersionId);

    if (!timeline) {
      throw new NotFoundException(`MR version ${mrVersionId} not found`);
    }

    return timeline;
  }
}
