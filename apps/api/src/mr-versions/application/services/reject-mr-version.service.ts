import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RejectMrVersionResultDto } from '@metamorph/api-client';
import { MrVersionStatus } from '../../../../generated/prisma/enums.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class RejectMrVersionService {
  constructor(private readonly prisma: PrismaService) {}

  async reject(mrVersionId: string): Promise<RejectMrVersionResultDto> {
    const mrVersion = await this.prisma.mrVersion.findUnique({
      where: { id: mrVersionId },
    });

    if (!mrVersion) {
      throw new NotFoundException(`MR version ${mrVersionId} not found`);
    }

    if (mrVersion.status !== MrVersionStatus.draft_pending_hitl) {
      throw new BadRequestException(
        `MR version ${mrVersionId} cannot be rejected from status ${mrVersion.status}`,
      );
    }

    const updated = await this.prisma.mrVersion.update({
      where: { id: mrVersionId },
      data: {
        status: MrVersionStatus.exploration_failed,
        explorationFailureReason: 'Rejected by reviewer',
      },
    });

    return {
      id: updated.id,
      status: updated.status,
    };
  }
}
