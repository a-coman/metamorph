import { createHash } from 'node:crypto';
import type { CompilePlaybookResult } from '@metamorph/core';
import type { LlmDiscoverOutput } from '@metamorph/core';
import type { Prisma } from '../../../../../../api/generated/prisma/client.js';
import { MrVersionStatus } from '../../../../../../api/generated/prisma/enums.js';
import { prisma } from '../../../../shared/infrastructure/prisma/prisma-client.js';

export type PersistMrDraftInput = {
  sessionId: string;
  pageSnapshotId: string;
  jobId: string;
  host: string;
  llmOutput: LlmDiscoverOutput;
  compiled: CompilePlaybookResult;
  llmAudit: {
    model: string;
    promptVersion: string;
    tokensIn: number | null;
    tokensOut: number | null;
    latencyMs: number;
  };
};

export class MrDraftPrismaRepository {
  async saveDraft(input: PersistMrDraftInput): Promise<{ mrVersionId: string }> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const mrDefinition = await tx.mrDefinition.create({
        data: {
          host: input.host,
          transformFamily: input.llmOutput.mr_definition.transformation.transform_family,
          definition: input.llmOutput.mr_definition,
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

      const mrVersion = await tx.mrVersion.create({
        data: {
          sessionId: input.sessionId,
          mrDefinitionId: mrDefinition.id,
          pageSnapshotId: input.pageSnapshotId,
          status: MrVersionStatus.draft_pending_hitl,
          generationSlots: input.llmOutput.generation_slots,
          playbookBlobId: playbookBlob.id,
          schemaBlobId: schemaBlob.id,
        },
      });

      await tx.llmCall.create({
        data: {
          jobId: input.jobId,
          mrVersionId: mrVersion.id,
          purpose: 'discover_llm_propose',
          model: input.llmAudit.model,
          promptVersion: input.llmAudit.promptVersion,
          tokensIn: input.llmAudit.tokensIn,
          tokensOut: input.llmAudit.tokensOut,
          latencyMs: input.llmAudit.latencyMs,
        },
      });

      return { mrVersionId: mrVersion.id };
    });
  }
}
