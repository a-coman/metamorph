import { Injectable, NotFoundException } from '@nestjs/common';
import type { SessionActivityDto } from '@metamorph/api-client';
import { JobType, JobStatus } from '../../../../generated/prisma/enums.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { TracePathQuery } from '../../infrastructure/trace-path.query.js';
import { buildJobAttributionContext } from '../mappers/explore-job-attribution.js';
import {
  mapLlmCallDto,
  mapProbeDto,
  mapScreenshotDto,
} from '../mappers/session-event.mapper.js';

@Injectable()
export class SessionActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracePathQuery: TracePathQuery,
  ) {}

  async getActivitySnapshot(sessionId: string): Promise<SessionActivityDto> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        jobs: {
          select: {
            id: true,
            type: true,
            status: true,
            mrVersionId: true,
            payload: true,
            createdAt: true,
            startedAt: true,
            finishedAt: true,
            errorMessage: true,
            llmCalls: {
              select: {
                id: true,
                jobId: true,
                mrVersionId: true,
                purpose: true,
                model: true,
                promptVersion: true,
                tokensIn: true,
                tokensOut: true,
                latencyMs: true,
                responseJson: true,
                createdAt: true,
                completedAt: true,
                updatedAt: true,
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        mrVersions: {
          select: {
            id: true,
            mrDefinition: { select: { transformFamily: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        pageSnapshots: {
          select: {
            id: true,
            jobId: true,
            url: true,
            createdAt: true,
            annotatedScreenshotId: true,
            rawScreenshotId: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    const mrFamilies = new Map(
      session.mrVersions.map((mr) => [mr.id, mr.mrDefinition.transformFamily]),
    );
    const attributionContext = buildJobAttributionContext(session.jobs, mrFamilies);

    const probeJobIds = new Set(
      session.jobs.filter((job) => job.type === JobType.probe).map((job) => job.id),
    );
    const snapshotByJobId = new Map(
      session.pageSnapshots
        .filter((snapshot) => snapshot.jobId !== null)
        .map((snapshot) => [snapshot.jobId as string, snapshot]),
    );

    const llmCalls = session.jobs.flatMap((job) =>
      job.llmCalls.map((llmCall) => mapLlmCallDto(llmCall, attributionContext)),
    );

    const probes = session.jobs
      .filter((job) => job.type === JobType.probe)
      .map((job) => {
        const outputSnapshot = snapshotByJobId.get(job.id);
        return mapProbeDto(
          {
            job,
            outputSnapshotId: outputSnapshot?.id ?? null,
          },
          attributionContext,
        );
      });

    const screenshots = session.pageSnapshots.flatMap((snapshot) => {
      const isProbeOutput =
        snapshot.jobId !== null && probeJobIds.has(snapshot.jobId);
      if (isProbeOutput) {
        return [];
      }
      const dto = mapScreenshotDto(snapshot);
      return dto ? [dto] : [];
    });

    const terminalExploreJobs: SessionActivityDto['terminalExploreJobs'] = {};
    for (const job of session.jobs) {
      if (job.type !== JobType.explore) continue;
      if (job.status === JobStatus.done) {
        terminalExploreJobs[job.id] = 'done';
      } else if (
        job.status === JobStatus.failed ||
        job.status === JobStatus.enqueue_failed
      ) {
        terminalExploreJobs[job.id] = 'failed';
      }
    }

    const mrVersionIds = session.mrVersions.map((mr) => mr.id);
    const checkpoints =
      mrVersionIds.length > 0
        ? await this.loadCheckpointsForMrVersions(mrVersionIds)
        : [];

    return {
      llmCalls,
      probes,
      screenshots,
      checkpoints,
      terminalExploreJobs,
    };
  }

  private async loadCheckpointsForMrVersions(mrVersionIds: string[]) {
    const checkpoints = await this.prisma.explorationCheckpoint.findMany({
      where: { mrVersionId: { in: mrVersionIds } },
      orderBy: [{ mrVersionId: 'asc' }, { sequence: 'asc' }],
      select: {
        id: true,
        mrVersionId: true,
        phase: true,
        sequence: true,
        snapshotId: true,
        stepsJson: true,
        verdict: true,
        rationale: true,
        llmCallId: true,
        createdAt: true,
      },
    });

    const traceInfoMap = await this.tracePathQuery.resolveBySnapshotIds(
      checkpoints.map((row) => row.snapshotId),
    );

    return checkpoints.map((row) => {
      const traceInfo = traceInfoMap.get(row.snapshotId);
      return {
        ...row,
        mrVersionId: row.mrVersionId,
        llmCallId: row.llmCallId ?? null,
        tracePath: traceInfo?.path ?? null,
        traceArtifactId: traceInfo?.artifactId ?? null,
      };
    });
  }
}
