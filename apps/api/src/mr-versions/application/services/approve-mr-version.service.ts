import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ApproveMrVersionResultDto } from '@metamorph/api-client';
import { MrVersionStatus } from '../../../../generated/prisma/enums.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class ApproveMrVersionService {
  constructor(private readonly prisma: PrismaService) {}

  async approve(
    mrVersionId: string,
    playbookContent?: string,
  ): Promise<ApproveMrVersionResultDto> {
    const mrVersion = await this.prisma.mrVersion.findUnique({
      where: { id: mrVersionId },
      include: { playbookBlob: true },
    });

    if (!mrVersion) {
      throw new NotFoundException(`MR version ${mrVersionId} not found`);
    }

    if (mrVersion.status !== MrVersionStatus.draft_pending_hitl) {
      throw new BadRequestException(
        `MR version ${mrVersionId} cannot be approved from status ${mrVersion.status}`,
      );
    }

    if (playbookContent !== undefined) {
      if (!mrVersion.playbookBlobId) {
        throw new BadRequestException(
          `MR version ${mrVersionId} has no playbook to update`,
        );
      }

      const contentHash = createHash('sha256')
        .update(playbookContent)
        .digest('hex');

      await this.prisma.playbookBlob.update({
        where: { id: mrVersion.playbookBlobId },
        data: {
          content: playbookContent,
          contentHash,
        },
      });
    }

    const approvedAt = new Date();
    const updated = await this.prisma.mrVersion.update({
      where: { id: mrVersionId },
      data: {
        status: MrVersionStatus.approved,
        approvedAt,
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      approvedAt,
    };
  }
}
