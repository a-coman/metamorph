import {
  promoteMrVersionIfAuto,
  type MrPromotionPrismaClient,
  type PromoteResult,
} from '@metamorph/mr-promotion';
import { prisma } from '../../../shared/infrastructure/prisma/prisma-client.js';
import type { ExecutePairJobPublisher } from '../messaging/execute-pair-job.publisher.js';

export class AutoPromoter {
  constructor(private readonly executePairPublisher: ExecutePairJobPublisher) {}

  async promoteIfAuto(mrVersionId: string): Promise<PromoteResult> {
    return promoteMrVersionIfAuto(
      {
        prisma: prisma as unknown as MrPromotionPrismaClient,
        publishExecutePairJob: (payload) => this.executePairPublisher.publish(payload),
      },
      mrVersionId,
    );
  }
}
