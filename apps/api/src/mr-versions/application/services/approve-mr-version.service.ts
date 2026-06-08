import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MrVersionStatus } from '../../../../generated/prisma/enums.js';
import type { ApproveMrVersionResultDto } from '../dtos/run.dto.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';

@Injectable()
export class ApproveMrVersionService {
  constructor(private readonly prisma: PrismaService) {}

  async approve(mrVersionId: string): Promise<ApproveMrVersionResultDto> {
    const mrVersion = await this.prisma.mrVersion.findUnique({
      where: { id: mrVersionId },
    });

    if (!mrVersion) {
      throw new NotFoundException(`MR version ${mrVersionId} not found`);
    }

    if (mrVersion.status !== MrVersionStatus.draft_pending_hitl) {
      throw new BadRequestException(
        `MR version ${mrVersionId} cannot be approved from status ${mrVersion.status}`,
      );
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
