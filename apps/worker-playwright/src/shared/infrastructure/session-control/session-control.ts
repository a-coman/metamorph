import {
  createPrismaSessionControlChecker,
  markSessionAndJobPaused,
  type SessionControlPrismaClient,
} from '@metamorph/session-control';
import { prisma } from '../prisma/prisma-client.js';

export const sessionControlChecker = createPrismaSessionControlChecker(
  prisma as unknown as SessionControlPrismaClient,
);

export async function pauseSessionJob(
  sessionId: string,
  jobId: string,
): Promise<void> {
  await markSessionAndJobPaused(
    prisma as unknown as SessionControlPrismaClient,
    sessionId,
    jobId,
  );
}
