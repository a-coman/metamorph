import {
  computeReplayBundleHash,
  GenerationSlotsSchema,
} from '@metamorph/core';
import { MrPromotionError } from './errors.js';
import type { MrPromotionPrismaClient } from './mr-promotion-deps.js';

export type ApproveMrVersionResult = {
  id: string;
  status: string;
  approvedAt: Date;
};

export async function approveMrVersion(
  prisma: MrPromotionPrismaClient,
  mrVersionId: string,
  playbookContent?: string,
): Promise<ApproveMrVersionResult> {
  const mrVersion = await prisma.mrVersion.findUnique({
    where: { id: mrVersionId },
    include: { playbookBlob: true },
  });

  if (!mrVersion) {
    throw new MrPromotionError(
      'not_found',
      `MR version ${mrVersionId} not found`,
    );
  }

  if (mrVersion.status !== 'draft_pending_hitl') {
    throw new MrPromotionError(
      'invalid_status',
      `MR version ${mrVersionId} cannot be approved from status ${mrVersion.status}`,
    );
  }

  if (!mrVersion.playbookBlob) {
    throw new MrPromotionError(
      'missing_playbook',
      `MR version ${mrVersionId} has no playbook to approve`,
    );
  }

  const slots = GenerationSlotsSchema.safeParse(mrVersion.generationSlots);
  if (!slots.success) {
    throw new MrPromotionError(
      'missing_playbook',
      `MR version ${mrVersionId} has an invalid observation specification`,
    );
  }

  const approvedPlaybookContent =
    playbookContent ?? mrVersion.playbookBlob.content;
  const hashes = computeReplayBundleHash({
    playbookContent: approvedPlaybookContent,
    observationSpec: slots.data.observation,
    templateVersion: mrVersion.playbookBlob.templateVersion,
  });

  if (playbookContent !== undefined) {
    if (!mrVersion.playbookBlobId) {
      throw new MrPromotionError(
        'missing_playbook',
        `MR version ${mrVersionId} has no playbook to update`,
      );
    }

    await prisma.playbookBlob.update({
      where: { id: mrVersion.playbookBlobId },
      data: {
        content: playbookContent,
        contentHash: hashes.contentHash,
      },
    });
  }

  const approvedAt = new Date();
  const updated = await prisma.mrVersion.update({
    where: { id: mrVersionId },
    data: {
      status: 'approved',
      approvedAt,
      replayBundleHash: hashes.replayBundleHash,
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    approvedAt,
  };
}
