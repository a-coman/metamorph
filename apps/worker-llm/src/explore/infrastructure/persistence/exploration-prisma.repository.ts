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
  }): Promise<void> {
    await prisma.explorationCheckpoint.create({
      data: {
        mrVersionId: input.mrVersionId,
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
    llmAudit: ExploreLlmAudit;
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

      await tx.llmCall.create({
        data: {
          jobId: input.exploreJobId,
          mrVersionId: input.mrVersionId,
          purpose: input.llmAudit.purpose,
          model: input.llmAudit.model,
          promptVersion: input.llmAudit.promptVersion,
          tokensIn: input.llmAudit.tokensIn,
          tokensOut: input.llmAudit.tokensOut,
          latencyMs: input.llmAudit.latencyMs,
        },
      });
    });
  }

  async recordLlmCall(input: {
    exploreJobId: string;
    mrVersionId: string;
    audit: ExploreLlmAudit;
  }): Promise<void> {
    await prisma.llmCall.create({
      data: {
        jobId: input.exploreJobId,
        mrVersionId: input.mrVersionId,
        purpose: input.audit.purpose,
        model: input.audit.model,
        promptVersion: input.audit.promptVersion,
        tokensIn: input.audit.tokensIn,
        tokensOut: input.audit.tokensOut,
        latencyMs: input.audit.latencyMs,
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
