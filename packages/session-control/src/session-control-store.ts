import type { SessionControlStatus } from './session-control-status.js';
import type { SessionControlReader } from './session-control-reader.js';
import { SessionControlChecker } from './session-control-reader.js';

export type SessionControlPrismaClient = {
  session: {
    findUnique(args: {
      where: { id: string };
      select: { controlStatus: true };
    }): Promise<{ controlStatus: SessionControlStatus } | null>;
    update(args: {
      where: { id: string };
      data: {
        controlStatus: SessionControlStatus;
        controlStatusChangedAt: Date;
      };
    }): Promise<unknown>;
  };
  job: {
    update(args: {
      where: { id: string };
      data: {
        status: string;
        finishedAt?: Date;
      };
    }): Promise<unknown>;
  };
  $transaction<T>(fn: (tx: SessionControlPrismaClient) => Promise<T>): Promise<T>;
};

export function createPrismaSessionControlChecker(
  prisma: SessionControlPrismaClient,
): SessionControlChecker {
  const reader: SessionControlReader = {
    getControlStatus: async (sessionId) => {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { controlStatus: true },
      });
      return session?.controlStatus ?? null;
    },
  };

  return new SessionControlChecker(reader);
}

export async function markSessionAndJobPaused(
  prisma: SessionControlPrismaClient,
  sessionId: string,
  jobId: string,
): Promise<void> {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.session.update({
      where: { id: sessionId },
      data: {
        controlStatus: 'paused',
        controlStatusChangedAt: now,
      },
    });
    await tx.job.update({
      where: { id: jobId },
      data: {
        status: 'paused',
        finishedAt: now,
      },
    });
  });
}
