import { Injectable } from '@nestjs/common';
import {
  promoteMrVersionIfAuto,
  type MrPromotionPrismaClient,
  type PromoteResult,
} from '@metamorph/mr-promotion';
import { JobMessagePublisherPort } from '../../../sessions/application/ports/job-message-publisher.port.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class AutoPromoteMrVersionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobMessagePublisher: JobMessagePublisherPort,
  ) {}

  async promoteIfAuto(mrVersionId: string): Promise<PromoteResult> {
    return promoteMrVersionIfAuto(
      {
        prisma: this.prisma as unknown as MrPromotionPrismaClient,
        publishExecutePairJob: (payload) =>
          this.jobMessagePublisher.publishExecutePairJob(payload),
      },
      mrVersionId,
    );
  }
}
