import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Prisma } from '../../../../../../api/generated/prisma/client.js';
import {
  ArtifactKind,
  ObservationRole,
  RunStatus,
  Verdict,
} from '../../../../../../api/generated/prisma/enums.js';
import { prisma } from '../../../../shared/infrastructure/prisma/prisma-client.js';
import type { MrEvaluationResult, ObservableDef } from '@metamorph/core';
import { deriveFinalUrlFromObservation } from '@metamorph/core';

export class RunPrismaRepository {
  async markRunning(runId: string): Promise<void> {
    await prisma.run.update({
      where: { id: runId },
      data: { status: RunStatus.running },
    });
  }

  async markFailed(runId: string, message: string): Promise<void> {
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: RunStatus.failed,
        finishedAt: new Date(),
        inputBundle: {
          error: message,
        } as Prisma.InputJsonValue,
      },
    });
  }

  async markPaused(runId: string): Promise<void> {
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: RunStatus.paused,
        finishedAt: new Date(),
      },
    });
  }

  async saveSuccess(input: {
    runId: string;
    sessionId: string;
    mrVersionId: string;
    playbookContentHash: string;
    replayBundleHash: string;
    sessionUrl: string;
    observables: ObservableDef[];
    sourceObservation: Record<string, unknown>;
    followUpObservation: Record<string, unknown>;
    evaluation: MrEvaluationResult;
    traceZipPath: string | null;
    artifactStorage: {
      put(key: string, body: Buffer, contentType: string): Promise<void>;
    };
  }): Promise<void> {
    const sourceHash = hashPayload(input.sourceObservation);
    const followUpHash = hashPayload(input.followUpObservation);
    const sourceFinalUrl = deriveFinalUrlFromObservation(
      input.sourceObservation,
      input.observables,
      input.sessionUrl,
    );
    const followUpFinalUrl = deriveFinalUrlFromObservation(
      input.followUpObservation,
      input.observables,
      input.sessionUrl,
    );

    await prisma.$transaction(async (tx) => {
      await tx.run.update({
        where: { id: input.runId },
        data: {
          status: RunStatus.completed,
          verdictStrict: input.evaluation.verdict as Verdict,
          playbookContentHash: input.playbookContentHash,
          replayBundleHash: input.replayBundleHash,
          sourceFinalUrl,
          followUpFinalUrl,
          finishedAt: new Date(),
          inputBundle: {
            evaluation_details: input.evaluation.details,
          } as Prisma.InputJsonValue,
        },
      });

      await tx.observation.createMany({
        data: [
          {
            runId: input.runId,
            role: ObservationRole.source,
            payload: input.sourceObservation as Prisma.InputJsonValue,
            payloadHash: sourceHash,
          },
          {
            runId: input.runId,
            role: ObservationRole.follow_up,
            payload: input.followUpObservation as Prisma.InputJsonValue,
            payloadHash: followUpHash,
          },
        ],
      });

      if (input.evaluation.verdict === 'fail') {
        await tx.violation.create({
          data: {
            runId: input.runId,
            mrVersionId: input.mrVersionId,
            verdictStrict: Verdict.fail,
          },
        });
      }

      if (input.traceZipPath) {
        const traceBody = await readFile(input.traceZipPath);
        const artifactPath = `sessions/${input.sessionId}/runs/${input.runId}/trace.zip`;

        await input.artifactStorage.put(
          artifactPath,
          traceBody,
          'application/zip',
        );

        await tx.artifact.create({
          data: {
            sessionId: input.sessionId,
            runId: input.runId,
            kind: ArtifactKind.trace,
            path: artifactPath,
            mimeType: 'application/zip',
            sizeBytes: traceBody.byteLength,
          },
        });
      }
    });
  }
}

function hashPayload(payload: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
