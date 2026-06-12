import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ExplorationCheckpointStatsDto,
  ExplorationPhaseGoalsDto,
  ExplorationTimelineDto,
} from '../../application/dtos/mr-version.dto.js';
import { ExplorationQueryPort } from '../../application/ports/exploration-query.port.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { TracePathQuery } from '../../../events/infrastructure/trace-path.query.js';

@Injectable()
export class ExplorationPrismaQuery extends ExplorationQueryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracePathQuery: TracePathQuery,
  ) {
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
    const traceBySnapshot = await this.tracePathQuery.resolveBySnapshotIds(
      snapshotIds,
    );

    const phaseGoals = parsePhaseGoals(mrVersion.explorationGoals);
    const checkpointStats = buildCheckpointStats(checkpoints);

    return {
      mrVersionId,
      status: mrVersion.status,
      validatedSteps: {
        source: generationSlots.source?.steps ?? [],
        follow_up: generationSlots.follow_up?.steps ?? [],
      },
      checkpoints: checkpoints.map((row) => {
        const trace = traceBySnapshot.get(row.snapshotId);
        return {
          id: row.id,
          phase: row.phase,
          sequence: row.sequence,
          snapshotId: row.snapshotId,
          stepsJson: row.stepsJson,
          verdict: row.verdict,
          rationale: row.rationale,
          llmCallId: row.llmCallId,
          tracePath: trace?.path ?? null,
          traceArtifactId: trace?.artifactId ?? null,
          createdAt: row.createdAt,
        };
      }),
      ...(mrVersion.explorationFailureReason
        ? { failureReason: mrVersion.explorationFailureReason }
        : {}),
      ...(phaseGoals ? { phaseGoals } : {}),
      checkpointStats,
    };
  }
}

function parsePhaseGoals(raw: unknown): ExplorationPhaseGoalsDto | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const goals = raw as Record<string, unknown>;
  const source = goals.source_phase_goal;
  const followUp = goals.follow_up_phase_goal;

  if (typeof source !== 'string' || typeof followUp !== 'string') {
    return undefined;
  }

  return { source, follow_up: followUp };
}

function buildCheckpointStats(
  checkpoints: { phase: string; verdict: string }[],
): ExplorationCheckpointStatsDto {
  const empty = { ok: 0, fail: 0, goal_reached: 0 };
  const stats: ExplorationCheckpointStatsDto = {
    source: { ...empty },
    follow_up: { ...empty },
  };

  for (const row of checkpoints) {
    const phase = row.phase === 'follow_up' ? 'follow_up' : 'source';
    const verdict = row.verdict as keyof typeof empty;
    if (verdict in stats[phase]) {
      stats[phase][verdict] += 1;
    }
  }

  return stats;
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
