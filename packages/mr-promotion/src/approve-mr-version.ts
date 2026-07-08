import { createHash } from 'node:crypto';
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
    throw new MrPromotionError('not_found', `MR version ${mrVersionId} not found`);
  }

  if (mrVersion.status !== 'draft_pending_hitl') {
    throw new MrPromotionError(
      'invalid_status',
      `MR version ${mrVersionId} cannot be approved from status ${mrVersion.status}`,
    );
  }

  if (playbookContent !== undefined) {
    if (!mrVersion.playbookBlobId) {
      throw new MrPromotionError(
        'missing_playbook',
        `MR version ${mrVersionId} has no playbook to update`,
      );
    }

    const contentHash = createHash('sha256').update(playbookContent).digest('hex');

    await prisma.playbookBlob.update({
      where: { id: mrVersion.playbookBlobId },
      data: {
        content: playbookContent,
        contentHash,
      },
    });
  }

  const approvedAt = new Date();
  const updated = await prisma.mrVersion.update({
    where: { id: mrVersionId },
    data: {
      status: 'approved',
      approvedAt,
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    approvedAt,
  };
}
