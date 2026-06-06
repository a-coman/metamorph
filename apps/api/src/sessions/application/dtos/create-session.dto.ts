import type { SessionMode } from '../../domain/enums/session-mode.enum.js';

export type CreateSessionDto = {
  url: string;
  mode?: SessionMode;
  generateCount?: number;
  weakOracle?: boolean;
};

export type CreateSessionResultDto = {
  sessionId: string;
  jobId: string;
  status: string;
};

export type QueueDiscoverResultDto = {
  jobId: string;
  status: string;
};
