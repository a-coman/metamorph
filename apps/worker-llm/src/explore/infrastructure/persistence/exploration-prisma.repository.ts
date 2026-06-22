import { createHash } from 'node:crypto';
import type { CompilePlaybookResult, GenerationSlots, MrDefinition } from '@metamorph/core';
import { MrVersionStatus } from '../../../../../api/generated/prisma/enums.js';
import type { Prisma } from '../../../../../api/generated/prisma/client.js';
import { prisma } from '../../../shared/infrastructure/prisma/prisma-client.js';
import type { ExploreLlmAudit } from '../openrouter/explore-openrouter.client.js';

export class ExplorationPrismaRepository {
  async initExploration(input: {
    sessionId: string;
    pageSnapshotId: string;
    host: string;
    exploreJobId: string;
  }): Promise<{ mrVersionId: string }> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const mrDefinition = await tx.mrDefinition.create({
        data: {
          host: input.host,
          transformFamily: 'pending',
          definition: {
            precondition: { description: 'Exploration in progress' },
            transformation: {
              transform_family: 'idempotence',
              description: 'Pending exploration',
            },
            relation: {
              type: 'equal',
              on: ['applied_query', 'results_url'],
              description: 'Pending',
            },
          },
        },
      });

      const mrVersion = await tx.mrVersion.create({
        data: {
          sessionId: input.sessionId,
          mrDefinitionId: mrDefinition.id,
          pageSnapshotId: input.pageSnapshotId,
          status: MrVersionStatus.exploring,
          generationSlots: {
            source: { steps: [] },
            follow_up: { steps: [] },
            observation: { fields: [] },
          },
        },
      });

      await tx.job.update({
        where: { id: input.exploreJobId },
        data: { mrVersionId: mrVersion.id },
      });

      return { mrVersionId: mrVersion.id };
    });
  }

  async saveCheckpoint(input: {
    mrVersionId: string;
    phase: string;
    sequence: number;
    snapshotId: string;
    stepsJson: unknown;
    verdict: string;
    rationale?: string;
    llmCallId?: string;
  }): Promise<void> {
    await prisma.explorationCheckpoint.create({
      data: {
        mrVersionId: input.mrVersionId,
        llmCallId: input.llmCallId,
        phase: input.phase,
        sequence: input.sequence,
        snapshotId: input.snapshotId,
        stepsJson: input.stepsJson as Prisma.InputJsonValue,
        verdict: input.verdict,
        rationale: input.rationale,
      },
    });
  }

  async updateGenerationSlots(
    mrVersionId: string,
    generationSlots: GenerationSlots,
  ): Promise<void> {
    await prisma.mrVersion.update({
      where: { id: mrVersionId },
      data: { generationSlots },
    });
  }

  async markExplorationFailed(mrVersionId: string, reason: string): Promise<void> {
    await prisma.mrVersion.update({
      where: { id: mrVersionId },
      data: {
        status: MrVersionStatus.exploration_failed,
        explorationFailureReason: reason,
      },
    });

    console.error(`Exploration failed for mr_version ${mrVersionId}: ${reason}`);
  }

  async saveExplorationGoals(
    mrVersionId: string,
    goals: { source_phase_goal: string; follow_up_phase_goal: string },
  ): Promise<void> {
    await prisma.mrVersion.update({
      where: { id: mrVersionId },
      data: { explorationGoals: goals },
    });
  }

  async saveDraft(input: {
    mrVersionId: string;
    mrDefinitionId: string;
    mrDefinition: MrDefinition;
    generationSlots: GenerationSlots;
    compiled: CompilePlaybookResult;
    exploreJobId: string;
  }): Promise<void> {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.mrDefinition.update({
        where: { id: input.mrDefinitionId },
        data: {
          transformFamily: input.mrDefinition.transformation.transform_family,
          definition: input.mrDefinition,
        },
      });

      const playbookBlob = await tx.playbookBlob.create({
        data: {
          content: input.compiled.playbookContent,
          contentHash: input.compiled.contentHash,
          templateVersion: input.compiled.templateVersion,
        },
      });

      const schemaHash = createHash('sha256')
        .update(input.compiled.schemaContent)
        .digest('hex');

      const schemaBlob = await tx.schemaBlob.create({
        data: {
          content: input.compiled.schemaContent,
          contentHash: schemaHash,
        },
      });

      await tx.mrVersion.update({
        where: { id: input.mrVersionId },
        data: {
          status: MrVersionStatus.draft_pending_hitl,
          generationSlots: input.generationSlots,
          playbookBlobId: playbookBlob.id,
          schemaBlobId: schemaBlob.id,
        },
      });

    });
  }

  async beginLlmCall(input: {
    exploreJobId: string;
    mrVersionId: string;
    purpose: string;
    model: string;
    promptVersion: string;
  }): Promise<string> {
    const row = await prisma.llmCall.create({
      data: {
        jobId: input.exploreJobId,
        mrVersionId: input.mrVersionId,
        purpose: input.purpose,
        model: input.model,
        promptVersion: input.promptVersion,
      },
      select: { id: true },
    });

    return row.id;
  }

  async completeLlmCall(input: {
    id: string;
    audit: ExploreLlmAudit;
    responseJson: unknown;
  }): Promise<void> {
    await prisma.llmCall.update({
      where: { id: input.id },
      data: {
        tokensIn: input.audit.tokensIn,
        tokensOut: input.audit.tokensOut,
        latencyMs: input.audit.latencyMs,
        responseJson: input.responseJson as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
  }

  async patchLlmCallResponse(input: { id: string; responseJson: unknown }): Promise<void> {
    await prisma.llmCall.update({
      where: { id: input.id },
      data: {
        responseJson: input.responseJson as Prisma.InputJsonValue,
      },
    });
  }

  async failLlmCall(input: {
    id: string;
    error: string;
    responseJson?: unknown;
  }): Promise<void> {
    await prisma.llmCall.update({
      where: { id: input.id },
      data: {
        responseJson: (input.responseJson ?? { error: input.error }) as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
  }

  async findMrDefinitionId(mrVersionId: string): Promise<string | null> {
    const row = await prisma.mrVersion.findUnique({
      where: { id: mrVersionId },
      select: { mrDefinitionId: true },
    });

    return row?.mrDefinitionId ?? null;
  }
}
